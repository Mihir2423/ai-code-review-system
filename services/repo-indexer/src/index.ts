import 'dotenv/config';
import { generateEmbedding } from '@repo/ai';
import prisma from '@repo/db';
import { ensureTopics, kafkaManager, sendMessage } from '@repo/kafka';
import { logger } from '@repo/logger';
import { Octokit } from 'octokit';
import { deleteVectorsByRepoId, indexCodebase } from './lib/embedding.js';
import { type FileContent, fetchRepositoryFiles, type RepoDetails } from './lib/github.js';
import { pineconeIndex } from './lib/pinecone.js';

const TOPIC = 'repo.index';
const CONTEXT_TOPIC = 'pr.context';
const AI_REVIEW_TOPIC = 'pr.ai-review';

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

async function indexRepository(repoDetails: RepoDetails, accessToken: string, isRetry: boolean = false): Promise<void> {
    try {
        await prisma.repository.update({
            where: { id: repoDetails.repoId },
            data: { indexingStatus: 'in_progress' },
        });
    } catch (error) {
        logger.error({ error, repoId: repoDetails.repoId }, 'Failed to update indexing status to in_progress');
    }

    try {
        if (!isRetry) {
            await deleteVectorsByRepoId(repoDetails.repoId);
        }

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

        try {
            await prisma.repository.update({
                where: { id: repoDetails.repoId },
                data: { indexingStatus: 'completed' },
            });
        } catch (error) {
            logger.error({ error, repoId: repoDetails.repoId }, 'Failed to update indexing status to completed');
        }

        logger.info({ repoId: repoDetails.repoId }, 'Successfully indexed repository');
    } catch (error) {
        logger.error({ error, repoDetails }, 'Failed to index repository');

        let statusValue = 'failed';

        if (error instanceof Error) {
            if (
                error.message.includes('rate limit') ||
                error.message.includes('RESOURCE_EXHAUSTED') ||
                error.message.includes('429')
            ) {
                statusValue = 'pending';
                logger.info({ repoId: repoDetails.repoId }, 'Rate limit hit, setting status to pending for retry');
            }
        }

        try {
            await prisma.repository.update({
                where: { id: repoDetails.repoId },
                data: { indexingStatus: statusValue },
            });
        } catch (statusError) {
            logger.error(
                { error: statusError, repoId: repoDetails.repoId },
                'Failed to update indexing status to failed',
            );
        }

        throw error;
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

async function startContextConsumer(): Promise<void> {
    const consumer = kafkaManager.consumer({
        groupId: 'repo-indexer-context',
        sessionTimeout: 300000,
        heartbeatInterval: 30000,
    });

    await consumer.connect();
    logger.info('[Repo Indexer] Context consumer connected to Kafka');

    await consumer.subscribe({ topic: CONTEXT_TOPIC, fromBeginning: false });

    await consumer.run({
        eachMessage: async ({ message }) => {
            const value = message.value?.toString();
            if (!value) return;

            const contextMessage = JSON.parse(value) as PRContextMessage;
            logger.info({ contextMessage, offset: message.offset }, 'Received pr-context event');

            const { query, repoId, owner, repo, prNumber, userId, diff, commitSha } = contextMessage;
            logger.info({ query, repoId }, 'Retrieving context for PR');

            try {
                const context = await retrieveContext(query, repoId);
                logger.info({ repoId, prNumber, contextLength: context.length }, 'Retrieved context for PR');

                await sendMessage(AI_REVIEW_TOPIC, {
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
                logger.info({ repoId, prNumber }, 'Sent AI review message to Kafka');
            } catch (error) {
                logger.error({ error, repoId, prNumber }, 'Failed to retrieve context');
            }
        },
    });

    logger.info({ topic: CONTEXT_TOPIC }, 'Context consumer started');
}

async function startConsumer(): Promise<void> {
    const consumer = kafkaManager.consumer({
        groupId: 'repo-indexer',
        sessionTimeout: 300000,
        heartbeatInterval: 30000,
    });

    await consumer.connect();
    logger.info('[Repo Indexer] Consumer connected to Kafka');

    await consumer.subscribe({ topic: TOPIC, fromBeginning: false });

    await consumer.run({
        eachMessage: async ({ message }) => {
            const value = message.value?.toString();
            if (!value) return;

            const repoDetailsWithUser = JSON.parse(value) as RepoDetails & { userId?: string };
            const { userId, ...repoDetails } = repoDetailsWithUser;
            logger.info({ repoDetails, userId, offset: message.offset }, 'Received index-repo event');

            if (!userId) {
                logger.error('No userId provided in message');
                return;
            }

            const accessToken = await getAccessToken(userId);
            if (!accessToken) {
                logger.error({ userId }, 'No GitHub access token found for user');
                return;
            }

            let isRetry = false;
            try {
                const repo = await prisma.repository.findUnique({
                    where: { id: repoDetails.repoId },
                    select: { indexingStatus: true },
                });
                isRetry = repo?.indexingStatus === 'pending' || repo?.indexingStatus === 'failed';
            } catch (error) {
                logger.error({ error, repoDetails }, 'Failed to index repository');

                try {
                    await prisma.repository.update({
                        where: { id: repoDetails.repoId },
                        data: { indexingStatus: 'failed' },
                    });
                } catch (statusError) {
                    logger.error(
                        { error: statusError, repoId: repoDetails.repoId },
                        'Failed to update indexing status to failed',
                    );
                }

                throw error;
            }

            await indexRepository(repoDetails, accessToken, isRetry);
        },
    });

    logger.info({ topic: TOPIC }, 'Kafka consumer started');
}

async function main(): Promise<void> {
    logger.info('Repo Indexer service starting...');

    try {
        await ensureTopics([TOPIC, CONTEXT_TOPIC, AI_REVIEW_TOPIC]);
        logger.info('[Repo Indexer] Topics ensured');

        await startConsumer();
        await startContextConsumer();
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
    await kafkaManager.disconnect();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    await kafkaManager.disconnect();
    process.exit(0);
});
