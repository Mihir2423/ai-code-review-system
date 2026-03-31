import prisma from '@repo/db';
import { logger } from '@repo/logger';
import { addJob, createQueue } from '@repo/queue';
import crypto from 'crypto';
import express from 'express';

const QUEUE_NAME = 'pr-review';
const REPO_INDEX_QUEUE_NAME = 'repo-index';
const PR_REVIEW_UPDATE_QUEUE = 'pr-review-update';
const PR_CONVERSATION_QUEUE = 'pr-conversation';

const prReviewQueue = createQueue(QUEUE_NAME);
const repoIndexQueue = createQueue(REPO_INDEX_QUEUE_NAME);
const prReviewUpdateQueue = createQueue(PR_REVIEW_UPDATE_QUEUE);
const prConversationQueue = createQueue(PR_CONVERSATION_QUEUE);

const WEBHOOK_SECRET = process.env.GITHUB_BOT_WEBHOOK_SECRET;

function verifySignature(req: express.Request): boolean {
    if (!WEBHOOK_SECRET) {
        logger.warn('GITHUB_BOT_WEBHOOK_SECRET not configured, skipping signature verification');
        return true;
    }
    const signature = req.headers['x-hub-signature-256'] as string;
    if (!signature) return false;
    const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
    const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

async function upsertRepositories(repos: any[], installationRecordId: string, userId: string, installationId: string) {
    const results = await Promise.all(
        repos.map(async (repo: any) => {
            const repository = await prisma.repository.upsert({
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
            });

            const branch = await prisma.repositoryBranch.upsert({
                where: {
                    repositoryId_name: {
                        repositoryId: repository.id,
                        name: repo.default_branch || 'main',
                    },
                },
                update: {},
                create: {
                    repositoryId: repository.id,
                    name: repo.default_branch || 'main',
                    latestCommitSha: '',
                    isDefault: true,
                },
            });

            const existingJob = await prisma.repoIndexingJob.findFirst({
                where: { branchId: branch.id },
                orderBy: { createdAt: 'desc' },
            });

            if (!existingJob || existingJob.status !== 'processing') {
                const indexingJob = await prisma.repoIndexingJob.create({
                    data: {
                        repositoryId: repository.id,
                        branchId: branch.id,
                        commitSha: '',
                        status: 'pending',
                    },
                });

                await addJob(repoIndexQueue, 'repo-index', {
                    repoId: repository.id,
                    branchId: branch.id,
                    jobId: indexingJob.id,
                    owner: repository.owner,
                    repo: repository.name,
                    url: repository.url,
                    userId: repository.userId,
                    installationId,
                });
            }

            return repository;
        }),
    );

    return results;
}

const router = express.Router();

router.post('/github', async (req, res) => {
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
                    await upsertRepositories(
                        repositories,
                        installationRecord.id,
                        account.userId,
                        installation.installationId,
                    );
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
            await upsertRepositories(
                repositories_added,
                installationRecord.id,
                installationRecord.userId,
                installation.id,
            );
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

        if (owner && repoName && fullName && action === 'opened') {
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
                            action: 'opened',
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

        if (owner && repoName && fullName && action === 'synchronize') {
            try {
                const repository = await prisma.repository.findFirst({
                    where: { fullName },
                    include: { installation: true },
                });

                if (repository) {
                    await addJob(
                        prReviewUpdateQueue,
                        'pr-review-update',
                        {
                            owner,
                            repo: repoName,
                            prNumber: pr?.number,
                            userId: repository.userId,
                            installationId: repository.installation.installationId,
                            newCommitSha: pr?.head?.sha,
                            action: 'synchronize',
                        },
                        {
                            jobId: `pr-review-update-${owner}-${repoName}-${pr?.number}-${action}`,
                        },
                    );
                    logger.info({ owner, repo: repoName, prNumber: pr?.number, action }, 'PR update review queued');
                } else {
                    logger.warn({ fullName }, 'Repository not found in database');
                }
            } catch (error) {
                logger.error({ error, fullName }, 'Error processing PR synchronize event');
            }
        }
    }

    if (event === 'issue_comment') {
        const { action, issue, repository: repo, comment } = req.body;

        if (action !== 'created') {
            return res.sendStatus(200);
        }

        if (!issue?.pull_request) {
            logger.info({ issueNumber: issue?.number }, 'Comment is not on a PR, skipping');
            return res.sendStatus(200);
        }

        const owner = repo?.owner?.login;
        const repoName = repo?.name;
        const fullName = repo?.full_name;
        const prNumber = issue?.number;
        const commentBody = comment?.body || '';
        const commenter = comment?.user?.login;

        if (!owner || !repoName || !fullName || !prNumber) {
            logger.warn({ event }, 'Missing required fields for issue_comment');
            return res.sendStatus(200);
        }

        if (commenter?.includes('[bot]')) {
            logger.info({ commenter }, 'Skipping bot comment');
            return res.sendStatus(200);
        }

        try {
            const repository = await prisma.repository.findFirst({
                where: { fullName },
                include: { installation: true },
            });

            if (repository) {
                await addJob(
                    prConversationQueue,
                    'pr-conversation',
                    {
                        owner,
                        repo: repoName,
                        prNumber,
                        commentId: comment?.id,
                        commentBody,
                        commenter,
                        userId: repository.userId,
                        installationId: repository.installation.installationId,
                    },
                    {
                        jobId: `pr-conversation-${owner}-${repoName}-${prNumber}-${comment?.id}`,
                    },
                );
                logger.info({ owner, repo: repoName, prNumber, commentId: comment?.id }, 'PR conversation queued');
            } else {
                logger.warn({ fullName }, 'Repository not found in database');
            }
        } catch (error) {
            logger.error({ error, fullName, prNumber }, 'Error processing issue_comment event');
        }
    }

    if (event === 'create') {
        const { ref_type, ref, repository, ref: branchName } = req.body;

        if (ref_type === 'branch') {
            const fullName = repository?.full_name;
            const newCommitSha = req.body.commits?.[0]?.id ?? '';

            if (!fullName || !branchName) {
                logger.warn({ event, ref_type }, 'Missing branch info in create event');
                return res.sendStatus(200);
            }

            try {
                const repositoryRecord = await prisma.repository.findFirst({
                    where: { fullName },
                    include: { branches: true },
                });

                if (!repositoryRecord) {
                    logger.warn({ fullName }, 'Repository not found in database');
                    return res.sendStatus(200);
                }

                const defaultBranch = repositoryRecord.branches.find((b) => b.isDefault);

                const branch = await prisma.repositoryBranch.upsert({
                    where: {
                        repositoryId_name: {
                            repositoryId: repositoryRecord.id,
                            name: branchName,
                        },
                    },
                    update: { latestCommitSha: newCommitSha },
                    create: {
                        repositoryId: repositoryRecord.id,
                        name: branchName,
                        latestCommitSha: newCommitSha,
                        isDefault: false,
                    },
                });

                if (defaultBranch && defaultBranch.indexingStatus === 'indexed') {
                    await prisma.repositoryBranch.update({
                        where: { id: branch.id },
                        data: {
                            indexingStatus: 'indexed',
                            latestCommitSha: newCommitSha,
                        },
                    });
                    logger.info(
                        { repo: fullName, branch: branchName },
                        'Branch marked as indexed (copied from default branch)',
                    );
                } else {
                    const indexingJob = await prisma.repoIndexingJob.create({
                        data: {
                            repositoryId: repositoryRecord.id,
                            branchId: branch.id,
                            commitSha: newCommitSha,
                            status: 'pending',
                        },
                    });

                    await addJob(repoIndexQueue, 'repo-index', {
                        repoId: repositoryRecord.id,
                        branchId: branch.id,
                        jobId: indexingJob.id,
                        owner: repositoryRecord.owner,
                        repo: repositoryRecord.name,
                        url: repositoryRecord.url,
                        userId: repositoryRecord.userId,
                        installationId: repositoryRecord.installationId,
                        baseCommitSha: defaultBranch?.latestCommitSha ?? '',
                        headCommitSha: newCommitSha,
                    });

                    logger.info(
                        { repo: fullName, branch: branchName, jobId: indexingJob.id },
                        'Branch indexing job created',
                    );
                }
            } catch (error) {
                logger.error({ error, fullName, branchName }, 'Error processing branch create event');
            }
        }
    }

    if (event === 'push') {
        const { repository, ref, before, after, commits } = req.body;

        const fullName = repository?.full_name;
        const branchName = ref?.replace('refs/heads/', '');
        const oldCommitSha = before;
        const newCommitSha = after;

        if (!fullName || !branchName) {
            logger.warn({ event }, 'Missing repo or branch info in push event');
            return res.sendStatus(200);
        }

        if (oldCommitSha === newCommitSha) {
            logger.info({ repo: fullName, branch: branchName }, 'No new commits, skipping indexing');
            return res.sendStatus(200);
        }

        try {
            const repositoryRecord = await prisma.repository.findFirst({
                where: { fullName },
                include: { branches: true },
            });

            if (!repositoryRecord) {
                logger.warn({ fullName }, 'Repository not found in database');
                return res.sendStatus(200);
            }

            const branch = repositoryRecord.branches.find((b) => b.name === branchName);

            let actualBranch = branch;
            if (!actualBranch) {
                logger.warn({ fullName, branch: branchName }, 'Branch not found in database, creating new');
                actualBranch = await prisma.repositoryBranch.create({
                    data: {
                        repositoryId: repositoryRecord.id,
                        name: branchName,
                        latestCommitSha: newCommitSha,
                        isDefault: false,
                    },
                });
            }

            await prisma.repositoryBranch.update({
                where: { id: actualBranch.id },
                data: { latestCommitSha: newCommitSha },
            });

            const createdJob = await prisma.repoIndexingJob.create({
                data: {
                    repositoryId: repositoryRecord.id,
                    branchId: actualBranch.id,
                    commitSha: newCommitSha,
                    status: 'pending',
                },
            });

            await addJob(repoIndexQueue, 'repo-index', {
                repoId: repositoryRecord.id,
                branchId: actualBranch.id,
                jobId: createdJob.id,
                owner: repositoryRecord.owner,
                repo: repositoryRecord.name,
                url: repositoryRecord.url,
                userId: repositoryRecord.userId,
                installationId: repositoryRecord.installationId,
                baseCommitSha: oldCommitSha,
                headCommitSha: newCommitSha,
            });

            logger.info(
                {
                    repo: fullName,
                    branch: branchName,
                    jobId: createdJob.id,
                    oldSha: oldCommitSha,
                    newSha: newCommitSha,
                },
                'Push event - diff-based indexing job created',
            );
        } catch (error) {
            logger.error({ error, fullName, branchName }, 'Error processing push event');
        }
    }

    if (event === 'ping') {
        logger.info('GitHub App ping received');
    }

    res.sendStatus(200);
});

export { router as webhookRoutes, prReviewQueue, prReviewUpdateQueue, prConversationQueue };

process.on('SIGTERM', async () => {
    await prReviewQueue.close();
    await prReviewUpdateQueue.close();
    await prConversationQueue.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    await prReviewQueue.close();
    await prReviewUpdateQueue.close();
    await prConversationQueue.close();
    process.exit(0);
});
