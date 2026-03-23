import 'dotenv/config';
import prisma from '@repo/db';
import { createPubSub } from '@repo/redis';
import cors from 'cors';
import express from 'express';
import type { Server as HttpServer } from 'http';
import { authenticateUser } from './middleware/auth.js';
import { authorizeReviewAccess } from './middleware/authorize.js';

const EVENTS_CHANNEL_PREFIX = 'review-events:';

interface SSEClient {
    id: string;
    reviewId: string;
    res: express.Response;
}

interface ReviewEventPayload {
    reviewId: string;
    type: string;
    queueName: string;
    stage: string;
    status: 'pending' | 'success' | 'error';
    message: string;
    details?: Record<string, unknown>;
}

async function saveEventToDb(event: ReviewEventPayload): Promise<void> {
    try {
        await prisma.reviewEvent.create({
            data: {
                reviewId: event.reviewId,
                type: event.type,
                queueName: event.queueName,
                stage: event.stage,
                status: event.status,
                message: event.message,
                details: event.details ? JSON.stringify(event.details) : null,
            },
        });
    } catch (err) {
        console.error('Failed to save event to DB:', err);
    }
}

const clients = new Map<string, SSEClient>();
const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];

app.use(
    cors({
        origin: allowedOrigins,
        credentials: true,
    }),
);

app.use(express.json());

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', clients: clients.size });
});

app.get('/stream/:reviewId', authenticateUser, authorizeReviewAccess, (req, res) => {
    const reviewId = req.params.reviewId as string;

    if (!reviewId) {
        res.status(400).json({ error: 'Review ID required' });
        return;
    }

    const clientId = `${reviewId}:${Date.now()}`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write(`data: ${JSON.stringify({ type: 'connected', reviewId })}\n\n`);

    clients.set(clientId, { id: clientId, reviewId, res });

    const keepAlive = setInterval(() => {
        res.write(': keepalive\n\n');
    }, 30000);

    req.on('close', () => {
        clearInterval(keepAlive);
        clients.delete(clientId);
    });
});

async function startPubSub(): Promise<void> {
    const subscriber = createPubSub();

    await subscriber.psubscribe(`${EVENTS_CHANNEL_PREFIX}*`);

    subscriber.on('pmessage', (_pattern: string, channel: string, message: string) => {
        const reviewId = channel.replace(EVENTS_CHANNEL_PREFIX, '');

        try {
            const event: ReviewEventPayload = JSON.parse(message);
            saveEventToDb(event);

            for (const [clientId, client] of clients) {
                if (client.reviewId === reviewId) {
                    try {
                        client.res.write(`data: ${JSON.stringify(event)}\n\n`);
                    } catch {
                        clients.delete(clientId);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to parse event:', err);
        }
    });

    console.log('Subscribed to Redis pub/sub channels');
}

const PORT = process.env.STREAMING_PORT || 5002;

const server: HttpServer = app.listen(PORT, () => {
    console.log(`Streaming service running on port ${PORT}`);
    startPubSub().catch(console.error);
});

process.on('SIGTERM', () => {
    console.log('Shutting down...');
    server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
    console.log('Shutting down...');
    server.close(() => process.exit(0));
});
