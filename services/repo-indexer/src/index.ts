import 'dotenv/config';
import { generateEmbedding } from '@repo/ai';
import prisma from '@repo/db';
import { logger } from '@repo/logger';
import { addJob, createEventPublisher, createQueue, createWorker } from '@repo/queue';
import { Octokit } from 'octokit';
import { indexChangedFiles, indexCodebase } from './lib/embedding.js';
import { type FileContent, fetchChangedFiles, fetchRepositoryFiles, type RepoDetails } from './lib/github.js';
import { pineconeIndex } from './lib/pinecone.js';

const QUEUE_NAME = 'repo-index';
const CONTEXT_QUEUE = 'pr-context';
const AI_REVIEW_QUEUE = 'pr-ai-review';

interface RepoIndexMessage {
    repoId: string;
    branchId: string;
    jobId: string;
    owner: string;
    repo: string;
    url: string;
    userId: string;
    installationId: string;
    retryCount?: number;
    baseCommitSha?: string;
    headCommitSha?: string;
}

interface PRContextMessage {
    query: string;
    repoId: string;
    owner: string;
    repo: string;
    prNumber: number;
    userId: string;
    diff: string;
    commitSha: string;
    installationId: string;
    checkRunId?: number;
    reviewId?: string;
    previousCommitSha?: string;
    openIssues?: Array<{
        path: string | null;
        line: number | null;
        body: string;
        suggestion: string | null;
        severity: string;
    }>;
    isUpdate?: boolean;
}

const repoIndexQueue = createQueue(QUEUE_NAME);
const contextQueue = createQueue(CONTEXT_QUEUE);
const aiReviewQueue = createQueue(AI_REVIEW_QUEUE);

let repoIndexWorker: ReturnType<typeof createWorker>;
let contextWorker: ReturnType<typeof createWorker>;

const eventPublisher = createEventPublisher();

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

async function retrieveContext(query: string, repoId: string, topK: number = 5) {
    const embedding = await generateEmbedding(query, 1024);
    const results = await pineconeIndex.query({
        vector: embedding,
        filter: { repoId },
        topK,
        includeMetadata: true,
    });

    return results.matches.map((match) => match?.metadata?.content as string).filter(Boolean);
}

async function startContextWorker(): Promise<void> {
    contextWorker = createWorker(CONTEXT_QUEUE, async (job) => {
        const contextMessage = job.data as PRContextMessage;
        logger.info({ contextMessage }, 'Received pr-context event');

        const {
            query,
            repoId,
            owner,
            repo,
            prNumber,
            userId,
            diff,
            commitSha,
            installationId,
            checkRunId,
            reviewId,
            previousCommitSha,
            openIssues,
            isUpdate,
        } = contextMessage;
        logger.info({ query, repoId }, 'Retrieving context for PR');

        try {
            if (reviewId) {
                await eventPublisher.publishStage(
                    reviewId,
                    'CONTEXT_RETRIEVAL_STARTED',
                    CONTEXT_QUEUE,
                    'Context Retrieval',
                    'pending',
                    'Starting context retrieval from vector store',
                );
            }

            const context = await retrieveContext(query, repoId);
            logger.info({ repoId, prNumber, contextLength: context.length }, 'Retrieved context for PR');

            if (reviewId) {
                await eventPublisher.publishStage(
                    reviewId,
                    'CONTEXT_RETRIEVED',
                    CONTEXT_QUEUE,
                    'Context Retrieval',
                    'success',
                    `Retrieved ${context.length} context entries`,
                    { contextLength: context.length },
                );
            }

            await addJob(aiReviewQueue, 'pr-ai-review', {
                title: query.split('\n')[0],
                description: query.split('\n').slice(1).join('\n'),
                context,
                diff,
                repoId,
                owner,
                repo,
                prNumber,
                userId,
                commitSha,
                installationId,
                checkRunId,
                reviewId,
                previousCommitSha,
                openIssues,
                isUpdate,
            });
            logger.info({ repoId, prNumber, checkRunId }, 'Sent AI review message to queue');
        } catch (error) {
            logger.error({ error, repoId, prNumber }, 'Failed to retrieve context');

            if (reviewId) {
                await eventPublisher.publishStage(
                    reviewId,
                    'CONTEXT_RETRIEVAL_STARTED',
                    CONTEXT_QUEUE,
                    'Context Retrieval',
                    'error',
                    `Failed to retrieve context: ${error instanceof Error ? error.message : 'Unknown error'}`,
                );
            }
        }
    });

    logger.info({ queue: CONTEXT_QUEUE }, 'Context worker started');
}

async function startWorker(): Promise<void> {
    repoIndexWorker = createWorker(QUEUE_NAME, async (job) => {
        const message = job.data as RepoIndexMessage;
        const { repoId, branchId, jobId, userId, owner, repo, url, baseCommitSha, headCommitSha } = message;
        logger.info({ repoId, branchId, jobId, userId, baseCommitSha, headCommitSha }, 'Received index-repo event');

        await prisma.repoIndexingJob.update({
            where: { id: jobId },
            data: { status: 'processing', lastAttemptAt: new Date() },
        });

        await prisma.repositoryBranch.update({
            where: { id: branchId },
            data: { indexingStatus: 'indexing' },
        });

        await prisma.indexingEvent.create({
            data: {
                jobId,
                type: 'JOB_STARTED',
                status: 'success',
                message: 'Indexing job started',
            },
        });

        try {
            const accessToken = await getAccessToken(userId);
            if (!accessToken) {
                throw new Error('No GitHub access token found for user');
            }

            const octokit = new Octokit({ auth: accessToken });
            let indexedCount = 0;
            let removedCount = 0;

            if (baseCommitSha && headCommitSha && baseCommitSha !== headCommitSha) {
                logger.info({ repoId, branchId, baseCommitSha, headCommitSha }, 'Using diff-based indexing');

                const { changedFiles, isFullIndex } = await fetchChangedFiles(
                    octokit,
                    owner,
                    repo,
                    baseCommitSha,
                    headCommitSha,
                );

                if (!isFullIndex && changedFiles.length > 0) {
                    const result = await indexChangedFiles(changedFiles, {
                        repoId,
                        branchId,
                        jobId,
                        owner,
                        repo,
                    });
                    indexedCount = result.indexedCount;
                    removedCount = result.removedCount;
                } else {
                    logger.info({ repoId, branchId }, 'Falling back to full indexing');
                    const repoDetails: RepoDetails = {
                        repoId,
                        owner,
                        repo,
                        url,
                    };

                    const files = await fetchRepositoryFiles(octokit, repoDetails, async (file) => {
                        logger.info({ path: file.path, size: file.size }, 'Processing file');
                    });

                    logger.info({ repoId, branchId, totalFiles: files.length }, 'Fetched all files from repository');

                    indexedCount = await indexCodebase(files, {
                        repoId,
                        branchId,
                        jobId,
                        owner,
                        repo,
                    });
                }
            } else {
                logger.info({ repoId, branchId }, 'No diff info, using full indexing');
                const repoDetails: RepoDetails = {
                    repoId,
                    owner,
                    repo,
                    url,
                };

                const files = await fetchRepositoryFiles(octokit, repoDetails, async (file) => {
                    logger.info({ path: file.path, size: file.size }, 'Processing file');
                });

                logger.info({ repoId, branchId, totalFiles: files.length }, 'Fetched all files from repository');

                indexedCount = await indexCodebase(files, {
                    repoId,
                    branchId,
                    jobId,
                    owner,
                    repo,
                });
            }

            await prisma.repoIndexingJob.update({
                where: { id: jobId },
                data: { status: 'completed' },
            });

            await prisma.repositoryBranch.update({
                where: { id: branchId },
                data: {
                    indexingStatus: 'indexed',
                    lastIndexedAt: new Date(),
                },
            });

            await prisma.indexingEvent.create({
                data: {
                    jobId,
                    type: 'JOB_COMPLETED',
                    status: 'success',
                    message: `Indexing completed. ${indexedCount} files indexed, ${removedCount} removed.`,
                    details: JSON.stringify({ indexedCount, removedCount }),
                },
            });

            logger.info({ repoId, branchId, jobId, indexedCount, removedCount }, 'Indexing job completed');
        } catch (error) {
            logger.error({ error, repoId, branchId, jobId }, 'Indexing job failed');

            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const isRetryable = errorMessage.includes('rate limit') || errorMessage.includes('quota');
            const retryCount = message.retryCount ?? 0;

            await prisma.repoIndexingJob.update({
                where: { id: jobId },
                data: {
                    status: isRetryable && retryCount < 3 ? 'pending' : 'failed',
                    errorMessage,
                    lastAttemptAt: new Date(),
                    nextRetryAt: isRetryable ? new Date(Date.now() + 60000 * 2 ** retryCount) : null,
                },
            });

            await prisma.repositoryBranch.update({
                where: { id: branchId },
                data: { indexingStatus: 'failed' },
            });

            await prisma.indexingEvent.create({
                data: {
                    jobId,
                    type: 'JOB_FAILED',
                    status: 'failed',
                    message: errorMessage,
                    details: JSON.stringify({ isRetryable }),
                },
            });

            if (isRetryable) {
                throw error;
            }
        }
    });

    logger.info({ queue: QUEUE_NAME }, 'Worker started');
}

async function main(): Promise<void> {
    logger.info('Repo Indexer service starting...');

    try {
        await startWorker();
        await startContextWorker();
    } catch (error) {
        logger.error({ error }, 'Failed to start Repo Indexer');

        setTimeout(() => {
            logger.info('Retrying Repo Indexer startup...');
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
    await repoIndexWorker?.close();
    await contextWorker?.close();
    await repoIndexQueue.close();
    await contextQueue.close();
    await aiReviewQueue.close();
    await eventPublisher.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    await repoIndexWorker?.close();
    await contextWorker?.close();
    await repoIndexQueue.close();
    await contextQueue.close();
    await aiReviewQueue.close();
    await eventPublisher.close();
    process.exit(0);
});
