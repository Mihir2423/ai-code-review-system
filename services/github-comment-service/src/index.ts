import 'dotenv/config';
import prisma from '@repo/db';
import { ensureTopics, kafka } from '@repo/kafka';
import { logger } from '@repo/logger';
import { Octokit } from 'octokit';

const TOPIC = 'pr.comment';

interface PRCommentMessage {
    owner: string;
    repo: string;
    prNumber: number;
    userId: string;
    comment: string;
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

async function postComment(
    owner: string,
    repo: string,
    prNumber: number,
    comment: string,
    accessToken: string,
): Promise<void> {
    const octokit = new Octokit({ auth: accessToken });

    await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: comment,
    });

    logger.info({ owner, repo, prNumber }, 'Posted comment to pull request');
}

async function startConsumer(): Promise<void> {
    const consumer = kafka.consumer({
        groupId: 'github-comment-service',
        sessionTimeout: 300000,
        heartbeatInterval: 30000,
    });
    await consumer.connect();
    await consumer.subscribe({ topic: TOPIC, fromBeginning: false });
    await consumer.run({
        eachMessage: async ({ message }) => {
            const value = message.value?.toString();
            if (!value) return;

            const prComment = JSON.parse(value) as PRCommentMessage;
            logger.info({ prComment, offset: message.offset }, 'Received pr-comment event');

            const { owner, repo, prNumber, userId, comment } = prComment;

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
                await postComment(owner, repo, prNumber, comment, accessToken);
            } catch (error) {
                logger.error({ error, owner, repo, prNumber }, 'Failed to post comment');
            }
        },
    });

    logger.info({ topic: TOPIC }, 'Kafka consumer started');
}

async function main(): Promise<void> {
    logger.info('GitHub Comment service started');
    await ensureTopics([TOPIC]);
    await startConsumer();
}

main().catch((error) => {
    logger.error({ error }, 'Failed to start GitHub Comment service');
    process.exit(1);
});
