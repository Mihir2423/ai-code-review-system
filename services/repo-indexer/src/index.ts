import 'dotenv/config';
import { generateEmbedding } from '@repo/ai';
import prisma from '@repo/db';
import { logger } from '@repo/logger';
import { addJob, createQueue, createWorker } from '@repo/queue';
import { Octokit } from 'octokit';
import { indexCodebase } from './lib/embedding.js';
import { type FileContent, fetchRepositoryFiles, type RepoDetails } from './lib/github.js';
import { pineconeIndex } from './lib/pinecone.js';

const QUEUE_NAME = 'repo-index';
const CONTEXT_QUEUE = 'pr-context';
const AI_REVIEW_QUEUE = 'pr-ai-review';

interface PRContextMessage {
    query: string;
    repoId: string;
    owner: string;
    repo: string;
    prNumber: number;
    userId: string;
    diff: string;
    commitSha: string;
}

const repoIndexQueue = createQueue(QUEUE_NAME);
const contextQueue = createQueue(CONTEXT_QUEUE);
const aiReviewQueue = createQueue(AI_REVIEW_QUEUE);

let repoIndexWorker: ReturnType<typeof createWorker>;
let contextWorker: ReturnType<typeof createWorker>;

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

async function indexRepository(repoDetails: RepoDetails, accessToken: string): Promise<void> {
    const octokit = new Octokit({ auth: accessToken });

    const files = await fetchRepositoryFiles(octokit, repoDetails, async (file: FileContent) => {
        logger.info({ path: file.path, size: file.size }, 'Processing file');
    });

    logger.info({ repoDetails, totalFiles: files.length }, 'Fetched all files from repository');

    await indexCodebase(files, {
        repoId: repoDetails.repoId,
        owner: repoDetails.owner,
        repo: repoDetails.repo,
    });
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

        const { query, repoId, owner, repo, prNumber, userId, diff, commitSha } = contextMessage;
        logger.info({ query, repoId }, 'Retrieving context for PR');

        try {
            const context = await retrieveContext(query, repoId);
            logger.info({ repoId, prNumber, contextLength: context.length }, 'Retrieved context for PR');

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
            });
            logger.info({ repoId, prNumber }, 'Sent AI review message to queue');
        } catch (error) {
            logger.error({ error, repoId, prNumber }, 'Failed to retrieve context');
        }
    });

    logger.info({ queue: CONTEXT_QUEUE }, 'Context worker started');
}

async function startWorker(): Promise<void> {
    repoIndexWorker = createWorker(QUEUE_NAME, async (job) => {
        const repoDetailsWithUser = job.data as RepoDetails & { userId?: string };
        const { userId, ...repoDetails } = repoDetailsWithUser;
        logger.info({ repoDetails, userId }, 'Received index-repo event');

        if (!userId) {
            logger.error('No userId provided in message');
            return;
        }

        const accessToken = await getAccessToken(userId);
        if (!accessToken) {
            logger.error({ userId }, 'No GitHub access token found for user');
            return;
        }

        await indexRepository(repoDetails, accessToken);
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
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    await repoIndexWorker?.close();
    await contextWorker?.close();
    await repoIndexQueue.close();
    await contextQueue.close();
    await aiReviewQueue.close();
    process.exit(0);
});
