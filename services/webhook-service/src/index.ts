import { logger } from '@repo/logger';
import express from 'express';

const app = express();
const PORT = process.env.PORT || 4000;
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'development-secret';

app.use(express.json());

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'webhook-service' });
});

app.post('/api/webhooks/github', (req, res) => {
    const event = req.headers['x-github-event'] as string;
    const delivery = req.headers['x-github-delivery'] as string;

    logger.info({ event, delivery, body: req.body }, 'GitHub webhook received');

    if (event === 'pull_request') {
        const action = req.body.action;
        const pr = req.body.pull_request;
        const repo = req.body.repository;

        logger.info({ action, pr: pr?.number, repo: repo?.full_name }, 'Pull request event');
    }
    if (event === 'ping') {
        console.log('pong');
    }

    res.sendStatus(200);
});

app.listen(PORT, () => {
    logger.info({ port: PORT }, 'Webhook service started');
});
