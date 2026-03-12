import 'dotenv/config';
import prisma from '@repo/db';
import { kafka } from '@repo/kafka';
import { logger } from '@repo/logger';
import { Octokit } from 'octokit';
import { type FileContent, fetchRepositoryFiles, type RepoDetails } from './lib/github.js';

const TOPIC = 'repo.index';

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

    logger.info({ repoDetails, totalFiles: files.length }, 'Indexed repository');
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
    await startConsumer();
}

main().catch((error) => {
    logger.error({ error }, 'Failed to index repository');
    process.exit(1);
});
