import 'dotenv/config';
import prisma from '@repo/db';
import { logger } from '@repo/logger';
import { addJob, createQueue } from '@repo/queue';
import crypto from 'crypto';
import express from 'express';

const QUEUE_NAME = 'pr-review';
const REPO_INDEX_QUEUE_NAME = 'repo-index';

const app = express();
const PORT = process.env.PORT || 4000;
const WEBHOOK_SECRET = process.env.GITHUB_BOT_WEBHOOK_SECRET!;
const prReviewQueue = createQueue(QUEUE_NAME);
const repoIndexQueue = createQueue(REPO_INDEX_QUEUE_NAME);

app.use(express.json());

function verifySignature(req: express.Request): boolean {
    const signature = req.headers['x-hub-signature-256'] as string;
    if (!signature) return false;
    const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
    const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

async function upsertRepositories(repos: any[], installationRecordId: string, userId: string) {
    const results = await Promise.all(
        repos.map((repo: any) =>
            prisma.repository.upsert({
                where: { githubId: String(repo.id) },
                update: {
                    name: repo.name,
                    fullName: repo.full_name,
                    owner: repo.full_name.split('/')[0],
                    isPrivate: repo.private,
                    installationId: installationRecordId,
                    userId,
                },
                create: {
                    githubId: String(repo.id),
                    name: repo.name,
                    fullName: repo.full_name,
                    owner: repo.full_name.split('/')[0],
                    url: `https://github.com/${repo.full_name}`,
                    isPrivate: repo.private,
                    installationId: installationRecordId,
                    userId,
                },
            }),
        ),
    );

    const installationRecord = await prisma.installation.findUnique({
        where: { id: installationRecordId },
    });

    if (installationRecord) {
        await Promise.all(
            results.map((repository: any) =>
                addJob(repoIndexQueue, 'repo-index', {
                    repoId: repository.id,
                    owner: repository.owner,
                    repo: repository.name,
                    url: repository.url,
                    userId: repository.userId,
                    installationId: installationRecord.installationId,
                }),
            ),
        );
    }

    return results;
}

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'webhook-service' });
});

app.post('/api/webhooks/github', async (req, res) => {
    if (!verifySignature(req)) {
        logger.warn('Invalid webhook signature');
        return res.sendStatus(401);
    }

    const event = req.headers['x-github-event'] as string;
    const delivery = req.headers['x-github-delivery'] as string;
    logger.info({ event, delivery }, 'GitHub webhook received');
    logger.info({ event, body: req.body }, 'Github details');

    if (event === 'installation') {
        const { action, installation } = req.body;

        if (action === 'created') {
            const account = await prisma.account.findFirst({
                where: {
                    providerId: 'github',
                    accountId: String(installation.account.id),
                },
            });

            if (account) {
                const installationRecord = await prisma.installation.upsert({
                    where: { installationId: String(installation.id) },
                    create: {
                        installationId: String(installation.id),
                        accountLogin: installation.account.login,
                        accountType: installation.account.type,
                        userId: account.userId,
                    },
                    update: {
                        suspended: false,
                    },
                });
                logger.info({ installationId: installation.id }, 'Installation created');

                const repositories: any[] = req.body.repositories ?? [];
                if (repositories.length) {
                    await upsertRepositories(repositories, installationRecord.id, account.userId);
                    logger.info(
                        { count: repositories.length, installationId: installation.id },
                        'Initial repositories synced',
                    );
                }
            } else {
                logger.warn({ githubAccountId: installation.account.id }, 'No matching account found for installation');
            }
        }

        if (action === 'suspend') {
            await prisma.installation.updateMany({
                where: { installationId: String(installation.id) },
                data: { suspended: true },
            });
            logger.info({ installationId: installation.id }, 'Installation suspended');
        }

        if (action === 'unsuspend') {
            await prisma.installation.updateMany({
                where: { installationId: String(installation.id) },
                data: { suspended: false },
            });
            logger.info({ installationId: installation.id }, 'Installation unsuspended');
        }

        if (action === 'deleted') {
            await prisma.installation.deleteMany({
                where: { installationId: String(installation.id) },
            });
            logger.info({ installationId: installation.id }, 'Installation deleted');
        }
    }

    if (event === 'installation_repositories') {
        const { installation, repositories_added, repositories_removed } = req.body;

        const installationRecord = await prisma.installation.findUnique({
            where: { installationId: String(installation.id) },
        });

        if (!installationRecord) {
            logger.warn({ installationId: installation.id }, 'Installation not found, skipping repo sync');
            return res.sendStatus(200);
        }

        if (repositories_added?.length) {
            await upsertRepositories(repositories_added, installationRecord.id, installationRecord.userId);
            logger.info({ count: repositories_added.length, installationId: installation.id }, 'Repositories upserted');
        }

        if (repositories_removed?.length) {
            await prisma.repository.deleteMany({
                where: {
                    githubId: { in: repositories_removed.map((r: any) => String(r.id)) },
                    installationId: installationRecord.id,
                },
            });
            logger.info(
                { count: repositories_removed.length, installationId: installation.id },
                'Repositories removed',
            );
        }
    }

    if (event === 'pull_request') {
        const { action, pull_request: pr, repository: repo } = req.body;

        const owner = repo?.owner?.login;
        const repoName = repo?.name;
        const fullName = repo?.full_name;

        if (owner && repoName && fullName && (action === 'opened' || action === 'synchronize')) {
            try {
                const repository = await prisma.repository.findFirst({
                    where: { fullName },
                    include: { installation: true },
                });

                if (repository) {
                    await addJob(
                        prReviewQueue,
                        'pr-review',
                        {
                            owner,
                            repo: repoName,
                            prNumber: pr?.number,
                            userId: repository.userId,
                            installationId: repository.installation.installationId,
                        },
                        {
                            jobId: `pr-review-${owner}-${repoName}-${pr?.number}-${action}`,
                        },
                    );
                    logger.info({ owner, repo: repoName, prNumber: pr?.number, action }, 'PR review queued');
                } else {
                    logger.warn({ fullName }, 'Repository not found in database');
                }
            } catch (error) {
                logger.error({ error, fullName }, 'Error processing PR event');
            }
        }
    }

    if (event === 'ping') {
        logger.info('GitHub App ping received');
    }

    res.sendStatus(200);
});

async function main(): Promise<void> {
    app.listen(PORT, () => {
        logger.info({ port: PORT }, 'Webhook service started');
    });
}

main();

process.on('SIGTERM', async () => {
    await prReviewQueue.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    await prReviewQueue.close();
    process.exit(0);
});
