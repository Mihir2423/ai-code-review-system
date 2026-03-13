import 'dotenv/config';
import prisma from '@repo/db';
import { ensureTopics, kafkaManager, sendMessage } from '@repo/kafka';
import { logger } from '@repo/logger';
import express from 'express';

const TOPIC = 'pr.review';

const app = express();
const PORT = process.env.PORT || 4000;
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'development-secret';

app.use(express.json());

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'webhook-service' });
});

app.post('/api/webhooks/github', async (req, res) => {
    const event = req.headers['x-github-event'] as string;
    const delivery = req.headers['x-github-delivery'] as string;

    logger.info({ event, delivery, body: req.body }, 'GitHub webhook received');

    if (event === 'pull_request') {
        const action = req.body.action;
        const pr = req.body.pull_request;
        const repo = req.body.repository;

        logger.info({ action, pr: pr?.number, repo: repo?.full_name }, 'Pull request event');

        const owner = repo?.owner?.login;
        const repoName = repo?.name;
        const fullName = repo?.full_name;

        if (owner && repoName && fullName && action === 'opened') {
            try {
                const repository = await prisma.repository.findFirst({
                    where: { fullName },
                });

                if (repository) {
                    logger.info({ repositoryId: repository.id, fullName }, 'Repository found in database');

                    await sendMessage(TOPIC, {
                        owner,
                        repo: repoName,
                        prNumber: pr?.number,
                        userId: repository.userId,
                    });

                    logger.info({ owner, repo: repoName, prNumber: pr?.number }, 'Sent PR review message to Kafka');
                } else {
                    logger.warn({ fullName }, 'Repository not found in database');
                }
            } catch (error) {
                logger.error({ error, fullName }, 'Error checking repository');
            }
        }
    }
    if (event === 'ping') {
        console.log('pong');
    }

    res.sendStatus(200);
});

async function main(): Promise<void> {
    try {
        await ensureTopics([TOPIC]);
        logger.info('[Webhook Service] Topics ensured');
    } catch (error) {
        logger.error({ error }, 'Failed to ensure topics, retrying in 5s...');

        setTimeout(() => {
            ensureTopics([TOPIC]).catch((err) => {
                logger.error({ error: err }, 'Failed to ensure topics on retry');
            });
        }, 5000);
    }

    app.listen(PORT, () => {
        logger.info({ port: PORT }, 'Webhook service started');
    });
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
