import { logger } from '@repo/logger';
import cors from 'cors';
import express from 'express';
import 'dotenv/config';
import { authMiddleware } from './middleware/auth.js';
import { githubRoutes, prReviewQueue, reviewRoutes, webhookRoutes } from './modules/index.js';

const app = express();
const PORT = process.env.PORT || 5001;

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'https://ai-code-review-system-auqo.onrender.com',
];

app.use(
    cors({
        origin: allowedOrigins,
        credentials: true,
    }),
);

app.use(express.json());

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'server' });
});

app.use('/api/github', authMiddleware, githubRoutes);
app.use('/api/review', authMiddleware, reviewRoutes);
app.use('/api/webhooks', webhookRoutes);

async function start() {
    app.listen(PORT, () => {
        logger.info({ port: PORT }, 'Server started');
    });
}

start();

process.on('SIGTERM', async () => {
    await prReviewQueue.close();
    logger.info('Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', async () => {
    await prReviewQueue.close();
    logger.info('Received SIGINT, shutting down gracefully...');
    process.exit(0);
});
