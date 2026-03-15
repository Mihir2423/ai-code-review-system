import { logger } from '@repo/logger';
import cors from 'cors';
import express from 'express';
import 'dotenv/config';
import { ensureTopics, kafkaManager } from '@repo/kafka';
import { authMiddleware } from './middleware/auth.js';
import { githubRoutes, reviewRoutes } from './modules/index.js';

const app = express();
const PORT = process.env.PORT || 5001;

app.use(
    cors({
        origin: ['http://localhost:3000'],
        credentials: true,
    }),
);

app.use(express.json());

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'server' });
});

app.use('/api/github', authMiddleware, githubRoutes);
app.use('/api/review', authMiddleware, reviewRoutes);

async function start() {
    try {
        await ensureTopics(['repo.index']);
        logger.info('[Server] Kafka topics ensured');
    } catch (error) {
        logger.error({ error }, 'Failed to ensure Kafka topics, retrying in 5s...');
        setTimeout(() => {
            ensureTopics(['repo.index']).catch((err) => {
                logger.error({ error: err }, 'Failed to ensure Kafka topics on retry');
            });
        }, 5000);
    }

    try {
        await kafkaManager.getProducer();
        logger.info('[Server] Kafka producer connected');
    } catch (error) {
        logger.error({ error }, 'Failed to connect Kafka producer, retrying in 5s...');
        setTimeout(() => {
            kafkaManager
                .getProducer()
                .then(() => {
                    logger.info('[Server] Kafka producer connected on retry');
                })
                .catch((err) => {
                    logger.error({ error: err }, 'Failed to connect Kafka producer on retry');
                });
        }, 5000);
    }

    app.listen(PORT, () => {
        logger.info({ port: PORT }, 'Server started');
    });
}

start();

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
