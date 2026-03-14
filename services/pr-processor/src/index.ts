import 'dotenv/config';
import prisma from '@repo/db';
import { ensureTopics, kafkaManager, sendMessage } from '@repo/kafka';
import { logger } from '@repo/logger';
import { Octokit } from 'octokit';

const TOPIC = 'pr.review';
const COMMENT_TOPIC = 'pr.comment';
const CONTEXT_TOPIC = 'pr.context';

interface PRReviewMessage {
    owner: string;
    repo: string;
    prNumber: number;
    userId: string;
}

interface PRDetails {
    prTitle: string;
    prBody: string;
    prUrl: string;
    diff: string;
    commitSha: string;
}

async function getAccessToken(userId: string): Promise<string | null> {
    try {
        const account = await prisma.account.findFirst({
            where: { userId, providerId: 'github' },
            select: { accessToken: true },
        });
        return account?.accessToken ?? null;
    } catch (error) {
        logger.error({ error, userId }, 'Failed to fetch access token from database');
        return null;
    }
}

async function reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number,
    accessToken: string,
): Promise<PRDetails> {
    const octokit = new Octokit({ auth: accessToken });

    const { data: pr } = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
    });

    logger.info({ prNumber, title: pr.title, author: pr.user?.login }, 'Processing pull request');

    const { data: diff } = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
        mediaType: {
            format: 'diff',
        },
    });

    logger.info({ prNumber }, 'Pull request diff retrieved');
    logger.info({ diff }, 'Pull request diff content');

    return {
        prTitle: pr.title,
        prBody: pr.body || '',
        prUrl: pr.html_url,
        diff: diff as unknown as string,
        commitSha: pr.head.sha,
    };
}

async function startConsumer(): Promise<void> {
    const consumer = kafkaManager.consumer({
        groupId: 'pr-processor',
        sessionTimeout: 300000,
        heartbeatInterval: 30000,
    });

    await consumer.connect();
    logger.info('[PR Processor] Consumer connected to Kafka');

    await consumer.subscribe({ topic: TOPIC, fromBeginning: false });

    await consumer.run({
        eachMessage: async ({ message }) => {
            const value = message.value?.toString();
            if (!value) return;

            const prDetails = JSON.parse(value) as PRReviewMessage;
            logger.info({ prDetails, offset: message.offset }, 'Received pr-review event');

            const { owner, repo, prNumber, userId } = prDetails;

            if (!userId) {
                logger.error('No userId provided in message');
                return;
            }

            const accessToken = await getAccessToken(userId);
            if (!accessToken) {
                logger.error({ userId }, 'No GitHub access token found for user');
                return;
            }

            try {
                const prData = await reviewPullRequest(owner, repo, prNumber, accessToken);

                const query = `${prData.prTitle}\n${prData.prBody}`;
                logger.info({ query }, 'Generated query for context retrieval');

                const repository = await prisma.repository.findFirst({
                    where: { owner, name: repo, userId },
                });

                if (repository) {
                    await prisma.review.upsert({
                        where: {
                            repositoryId_prNumber: {
                                repositoryId: repository.id,
                                prNumber,
                            },
                        },
                        create: {
                            repositoryId: repository.id,
                            prNumber,
                            prTitle: prData.prTitle,
                            prUrl: prData.prUrl,
                            review: '',
                            issues: [],
                            status: 'pending',
                        },
                        update: {
                            status: 'pending',
                        },
                    });

                    await sendMessage(CONTEXT_TOPIC, {
                        query,
                        repoId: repository.id,
                        owner,
                        repo,
                        prNumber,
                        userId,
                        diff: prData.diff,
                        commitSha: prData.commitSha,
                    });
                    logger.info({ repoId: repository.id, prNumber }, 'Sent context retrieval message to Kafka');
                }

                await sendMessage(COMMENT_TOPIC, {
                    owner,
                    repo,
                    prNumber,
                    userId,
                    comment: `> [!NOTE]
> Currently processing new changes in this PR. This may take a few minutes, please wait...
>
> \`\`\`ascii
>  ________________________________
> < Overly attached code reviewer. >
>  --------------------------------
>   \\\\
>     \\\\   (__/)
>         (•ㅅ•)
>         /　 づ
> \`\`\``,
                });

                logger.info({ owner, repo, prNumber }, 'Sent initial comment message to Kafka');
            } catch (error) {
                logger.error({ error, owner, repo, prNumber }, 'Failed to review pull request');

                const repository = await prisma.repository.findFirst({
                    where: { owner, name: repo, userId },
                });

                if (repository) {
                    await prisma.review.upsert({
                        where: {
                            repositoryId_prNumber: {
                                repositoryId: repository.id,
                                prNumber,
                            },
                        },
                        create: {
                            repositoryId: repository.id,
                            prNumber,
                            prTitle: `PR #${prNumber}`,
                            prUrl: `https://github.com/${owner}/${repo}/pull/${prNumber}`,
                            review: '',
                            status: 'failed',
                        },
                        update: {
                            status: 'failed',
                        },
                    });
                    logger.info({ repositoryId: repository.id, prNumber }, 'Created failed review record');
                }
            }
        },
    });

    logger.info({ topic: TOPIC }, 'Kafka consumer started');
}

async function main(): Promise<void> {
    logger.info('PR Processor service starting...');

    try {
        await ensureTopics([TOPIC, COMMENT_TOPIC, CONTEXT_TOPIC]);
        logger.info('[PR Processor] Topics ensured');

        await startConsumer();
    } catch (error) {
        logger.error({ error }, 'Failed to start PR processor');

        setTimeout(() => {
            logger.info('Retrying PR Processor startup...');
            main().catch((err) => {
                logger.error({ error: err }, 'Retry failed');
                process.exit(1);
            });
        }, 5000);

        return;
    }
}

main();

process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    await kafkaManager.disconnect();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    await kafkaManager.disconnect();
    process.exit(0);
});
