// apps/pr-processor/src/index.ts

import 'dotenv/config';
import { createAppAuth } from '@octokit/auth-app';
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
    installationId: string; // ✅ added
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

const CHECK_NAME = 'AI Code Review';

async function createCheckRun(owner: string, repo: string, commitSha: string, octokit: Octokit): Promise<number> {
    const { data: checkRun } = await octokit.rest.checks.create({
        owner,
        repo,
        name: CHECK_NAME,
        head_sha: commitSha,
        status: 'in_progress',
        output: {
            title: 'AI Review in Progress',
            summary: 'Analyzing pull request changes...',
        },
    });

    logger.info({ owner, repo, checkRunId: checkRun.id }, 'Created check run');
    return checkRun.id;
}

// ✅ Replaces getAccessToken — authenticates as the bot
async function getBotOctokit(installationId: string): Promise<Octokit> {
    const auth = createAppAuth({
        appId: process.env.GITHUB_APP_ID!,
        privateKey: process.env.GITHUB_BOT_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        installationId,
    });

    const { token } = await auth({ type: 'installation' });
    return new Octokit({ auth: token });
}

async function reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number,
    octokit: Octokit, // ✅ accepts octokit instead of accessToken
): Promise<PRDetails> {
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
        mediaType: { format: 'diff' },
    });

    logger.info({ prNumber }, 'Pull request diff retrieved');

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
        const { owner, repo, prNumber, userId, installationId } = job.data as PRReviewMessage;

        logger.info({ owner, repo, prNumber }, 'Received pr-review event');

        if (!installationId) {
            logger.error('No installationId provided in message');
            return;
        }

        let octokit: Octokit;
        try {
            octokit = await getBotOctokit(installationId);
        } catch (error) {
            logger.error(
                {
                    installationId,
                    message: (error as Error).message,
                    stack: (error as Error).stack,
                },
                'Failed to get bot octokit',
            );
            return;
        }

        try {
            const prData = await reviewPullRequest(owner, repo, prNumber, octokit);

            const query = `${prData.prTitle}\n${prData.prBody}`;

            const repository = await prisma.repository.findFirst({
                where: { owner, name: repo, userId },
            });

            const checkRunId = await createCheckRun(owner, repo, prData.commitSha, octokit);

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
                        installationId,
                        diff: prData.diff,
                        commitSha: prData.commitSha,
                        checkRunId,
                    },
                    {
                        jobId: `pr-context-${owner}-${repo}-${prNumber}-${userId}`,
                    },
                );

                logger.info({ repoId: repository.id, prNumber, checkRunId }, 'Sent context retrieval message to queue');
            }

            // ✅ post initial "processing" comment as bot
            await addJob(
                commentQueue,
                'pr-comment',
                {
                    owner,
                    repo,
                    prNumber,
                    installationId, // ✅ was userId
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
                    jobId: `pr-comment-${owner}-${repo}-${prNumber}-${installationId}`,
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
            }
        }
    });

    logger.info({ queue: QUEUE_NAME }, 'PR review worker started');
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
