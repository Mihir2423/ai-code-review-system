import 'dotenv/config';
import prisma from '@repo/db';
import { logger } from '@repo/logger';
import { addJob, createQueue, createWorker } from '@repo/queue';
import { Octokit } from 'octokit';

const QUEUE_NAME = 'pr-review';
const COMMENT_QUEUE = 'pr-comment';
const CONTEXT_QUEUE = 'pr-context';

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

const prReviewQueue = createQueue(QUEUE_NAME);
const commentQueue = createQueue(COMMENT_QUEUE);
const contextQueue = createQueue(CONTEXT_QUEUE);

let prReviewWorker: ReturnType<typeof createWorker>;

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

async function startWorker(): Promise<void> {
    prReviewWorker = createWorker(QUEUE_NAME, async (job) => {
        const prDetails = job.data as PRReviewMessage;
        logger.info({ prDetails }, 'Received pr-review event');

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

                await addJob(
                    contextQueue,
                    'pr-context',
                    {
                        query,
                        repoId: repository.id,
                        owner,
                        repo,
                        prNumber,
                        userId,
                        diff: prData.diff,
                        commitSha: prData.commitSha,
                    },
                    {
                        jobId: `pr-context-${owner}-${repo}-${prNumber}-${userId}`,
                    },
                );
                logger.info({ repoId: repository.id, prNumber }, 'Sent context retrieval message to queue');
            }

            await addJob(
                commentQueue,
                'pr-comment',
                {
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
                },
                {
                    jobId: `pr-comment-${owner}-${repo}-${prNumber}-${userId}`,
                },
            );

            logger.info({ owner, repo, prNumber }, 'Sent initial comment message to queue');
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
    });

    logger.info({ queue: QUEUE_NAME }, 'Queue worker started');
}

async function main(): Promise<void> {
    logger.info('PR Processor service starting...');

    try {
        await startWorker();
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
    await prReviewWorker?.close();
    await prReviewQueue.close();
    await commentQueue.close();
    await contextQueue.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    await prReviewWorker?.close();
    await prReviewQueue.close();
    await commentQueue.close();
    await contextQueue.close();
    process.exit(0);
});
