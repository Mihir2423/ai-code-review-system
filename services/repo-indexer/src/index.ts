import 'dotenv/config';
import prisma from '@repo/db';
import { ensureTopics, kafka } from '@repo/kafka';
import { logger } from '@repo/logger';
import { Octokit } from 'octokit';
import { generateEmbedding, indexCodebase } from './lib/embedding.js';
import { type FileContent, fetchRepositoryFiles, type RepoDetails } from './lib/github.js';
import { pineconeIndex } from './lib/pinecone.js';

const TOPIC = 'repo.index';
const CONTEXT_TOPIC = 'pr.context';

interface PRContextMessage {
    query: string;
    repoId: string;
    owner: string;
    repo: string;
    prNumber: number;
    userId: string;
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

async function startContextConsumer(): Promise<void> {
    const consumer = kafka.consumer({
        groupId: 'repo-indexer-context',
        sessionTimeout: 300000,
        heartbeatInterval: 30000,
    });
    await consumer.connect();
    await consumer.subscribe({ topic: CONTEXT_TOPIC, fromBeginning: false });
    await consumer.run({
        eachMessage: async ({ message }) => {
            const value = message.value?.toString();
            if (!value) return;

            const contextMessage = JSON.parse(value) as PRContextMessage;
            logger.info({ contextMessage, offset: message.offset }, 'Received pr-context event');

            const { query, repoId, owner, repo, prNumber } = contextMessage;
            logger.info({ query, repoId }, 'Retrieving context for PR');

            try {
                const context = await retrieveContext(query, repoId);
                logger.info({ repoId, prNumber, contextLength: context.length }, 'Retrieved context for PR');
                logger.info({ context }, 'Context content');
            } catch (error) {
                logger.error({ error, repoId, prNumber }, 'Failed to retrieve context');
            }
        },
    });

    logger.info({ topic: CONTEXT_TOPIC }, 'Context consumer started');
}

async function startConsumer(): Promise<void> {
    const consumer = kafka.consumer({
        groupId: 'repo-indexer',
        sessionTimeout: 300000,
        heartbeatInterval: 30000,
    });
    await consumer.connect();
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

            await indexRepository(repoDetails, accessToken);
        },
    });

    logger.info({ topic: TOPIC }, 'Kafka consumer started');
}

async function main(): Promise<void> {
    logger.info('Repo Indexer service started');
    await ensureTopics([TOPIC, CONTEXT_TOPIC]);
    await startConsumer();
    await startContextConsumer();
}

main().catch((error) => {
    logger.error({ error }, 'Failed to index repository');
    process.exit(1);
});
