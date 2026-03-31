import 'dotenv/config';
import { createAppAuth } from '@octokit/auth-app';
import prisma from '@repo/db';
import { logger } from '@repo/logger';
import { addJob, createEventPublisher, createQueue, createWorker } from '@repo/queue';
import { Octokit } from 'octokit';

const QUEUE_NAME = 'pr-review';
const COMMENT_QUEUE = 'pr-comment';
const CONTEXT_QUEUE = 'pr-context';
const ISSUES_QUEUE = 'pr-issues';
const PR_REVIEW_UPDATE_QUEUE = 'pr-review-update';
const PR_CONVERSATION_QUEUE = 'pr-conversation';

interface PRReviewMessage {
    owner: string;
    repo: string;
    prNumber: number;
    userId: string;
    installationId: string;
    reviewId?: string;
    action?: string;
}

interface PRReviewUpdateMessage {
    owner: string;
    repo: string;
    prNumber: number;
    userId: string;
    installationId: string;
    newCommitSha: string;
    action?: string;
}

interface PRConversationMessage {
    owner: string;
    repo: string;
    prNumber: number;
    commentId: string;
    commentBody: string;
    commenter: string;
    userId: string;
    installationId: string;
}

interface PRDetails {
    prTitle: string;
    prBody: string;
    prUrl: string;
    diff: string;
    commitSha: string;
}

interface CommentMessage {
    owner: string;
    repo: string;
    prNumber: number;
    installationId: string;
    comment: string;
}

interface ReviewIssue {
    file: string;
    line: number;
    severity: 'critical' | 'warning' | 'suggestion';
    description: string;
    oldCode: string;
    newCode: string;
    suggestion: string;
}

interface PRIssuesMessage {
    owner: string;
    repo: string;
    prNumber: number;
    installationId: string;
    commitSha: string;
    issues: ReviewIssue[];
    summary?: string;
    reviewId?: string;
    isUpdate?: boolean;
}

const prReviewQueue = createQueue(QUEUE_NAME);
const commentQueue = createQueue(COMMENT_QUEUE);
const contextQueue = createQueue(CONTEXT_QUEUE);
const prReviewUpdateQueue = createQueue(PR_REVIEW_UPDATE_QUEUE);
const prConversationQueue = createQueue(PR_CONVERSATION_QUEUE);

let prReviewWorker: ReturnType<typeof createWorker>;
let commentWorker: ReturnType<typeof createWorker>;
let issuesWorker: ReturnType<typeof createWorker>;
let prReviewUpdateWorker: ReturnType<typeof createWorker>;
let prConversationWorker: ReturnType<typeof createWorker>;

const eventPublisher = createEventPublisher();

const CHECK_NAME = 'AI Code Review';

async function createCheckRun(owner: string, repo: string, commitSha: string, octokit: Octokit): Promise<number> {
    const { data: checkRun } = await octokit.rest.checks.create({
        owner,
        repo,
        name: CHECK_NAME,
        head_sha: commitSha,
        status: 'in_progress',
        output: {
            title: 'AI Review in Progress',
            summary: 'Analyzing pull request changes...',
        },
    });

    logger.info({ owner, repo, checkRunId: checkRun.id }, 'Created check run');
    return checkRun.id;
}

async function getBotOctokit(installationId: string): Promise<Octokit> {
    const auth = createAppAuth({
        appId: process.env.GITHUB_APP_ID!,
        privateKey: process.env.GITHUB_BOT_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        installationId,
    });

    const { token } = await auth({ type: 'installation' });
    return new Octokit({ auth: token });
}

async function reviewPullRequest(owner: string, repo: string, prNumber: number, octokit: Octokit): Promise<PRDetails> {
    const { data: pr } = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
    });

    logger.info({ prNumber, title: pr.title, author: pr.user?.login }, 'Processing pull request');

    const { data: diff } = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
        mediaType: { format: 'diff' },
    });

    logger.info({ prNumber }, 'Pull request diff retrieved');

    return {
        prTitle: pr.title,
        prBody: pr.body || '',
        prUrl: pr.html_url,
        diff: diff as unknown as string,
        commitSha: pr.head.sha,
    };
}

async function postComment(
    owner: string,
    repo: string,
    prNumber: number,
    comment: string,
    octokit: Octokit,
): Promise<void> {
    await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: comment,
    });

    logger.info({ owner, repo, prNumber }, 'Posted comment to pull request');
}

async function postInlineComment(
    owner: string,
    repo: string,
    prNumber: number,
    commitSha: string,
    issue: ReviewIssue,
    octokit: Octokit,
): Promise<void> {
    const emoji = issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵';

    const oldCode = issue.oldCode || 'N/A';
    const newCode = issue.newCode || 'N/A';
    const side = issue.oldCode && !issue.newCode ? 'LEFT' : 'RIGHT';
    const changeDisplay =
        issue.oldCode && issue.newCode
            ? `\`${oldCode}\` → \`${newCode}\``
            : issue.oldCode
              ? `Removed: \`${oldCode}\``
              : `Added: \`${newCode}\``;

    if (!issue.line || issue.line <= 0) {
        logger.warn({ owner, repo, prNumber, issue }, 'Skipping inline comment: invalid line number');
        return;
    }

    const body = `${emoji} **${issue.severity.toUpperCase()}** at ${issue.file}:${issue.line}\n\n${issue.description}\n\n**Change:** ${changeDisplay}\n\n**Suggestion:** ${issue.suggestion}`;

    await octokit.rest.pulls.createReviewComment({
        owner,
        repo,
        pull_number: prNumber,
        commit_id: commitSha,
        path: issue.file,
        line: issue.line,
        side,
        body,
    });

    logger.info({ owner, repo, prNumber, file: issue.file, line: issue.line }, 'Posted inline comment to pull request');
}

async function startPrReviewWorker(): Promise<void> {
    prReviewWorker = createWorker(QUEUE_NAME, async (job) => {
        const { owner, repo, prNumber, userId, installationId } = job.data as PRReviewMessage;

        logger.info({ owner, repo, prNumber }, 'Received pr-review event');

        if (!installationId) {
            logger.error('No installationId provided in message');
            return;
        }

        let octokit: Octokit;
        try {
            octokit = await getBotOctokit(installationId);
        } catch (error) {
            logger.error(
                {
                    installationId,
                    message: (error as Error).message,
                    stack: (error as Error).stack,
                },
                'Failed to get bot octokit',
            );
            return;
        }

        try {
            const repository = await prisma.repository.findFirst({
                where: { owner, name: repo, userId },
            });

            if (repository) {
                const review = await prisma.review.upsert({
                    where: {
                        repositoryId_prNumber: {
                            repositoryId: repository.id,
                            prNumber,
                        },
                    },
                    create: {
                        repositoryId: repository.id,
                        prNumber,
                        prTitle: `PR #${prNumber}`,
                        prUrl: `https://github.com/${owner}/${repo}/pull/${prNumber}`,
                        review: '',
                        issues: [],
                        status: 'pending',
                    },
                    update: {
                        status: 'pending',
                    },
                });

                await eventPublisher.publishStage(
                    review.id,
                    'REVIEW_STARTED',
                    QUEUE_NAME,
                    'PR Review',
                    'success',
                    `Started reviewing PR #${prNumber}`,
                    { owner, repo },
                );

                const prData = await reviewPullRequest(owner, repo, prNumber, octokit);

                await prisma.review.update({
                    where: { id: review.id },
                    data: {
                        prTitle: prData.prTitle,
                        prUrl: prData.prUrl,
                    },
                });

                await eventPublisher.publishStage(
                    review.id,
                    'PR_DETAILS_FETCHED',
                    QUEUE_NAME,
                    'Fetch PR Details',
                    'success',
                    `Fetched PR details: ${prData.prTitle}`,
                    { prTitle: prData.prTitle, commitSha: prData.commitSha },
                );

                const checkRunId = await createCheckRun(owner, repo, prData.commitSha, octokit);

                await eventPublisher.publishStage(
                    review.id,
                    'CHECK_RUN_CREATED',
                    QUEUE_NAME,
                    'Create Check Run',
                    'success',
                    `Created GitHub check run`,
                    { checkRunId },
                );

                const query = `${prData.prTitle}\n${prData.prBody}`;

                await addJob(
                    contextQueue,
                    'pr-context',
                    {
                        query,
                        repoId: repository.id,
                        owner,
                        repo,
                        prNumber,
                        userId,
                        installationId,
                        diff: prData.diff,
                        commitSha: prData.commitSha,
                        checkRunId,
                        reviewId: review.id,
                    },
                    {
                        jobId: `pr-context-${owner}-${repo}-${prNumber}-${userId}`,
                    },
                );

                await eventPublisher.publishStage(
                    review.id,
                    'CONTEXT_RETRIEVAL_STARTED',
                    QUEUE_NAME,
                    'Queue Context Retrieval',
                    'success',
                    'Queued for context retrieval',
                    { queueName: CONTEXT_QUEUE },
                );

                await addJob(
                    commentQueue,
                    'pr-comment',
                    {
                        owner,
                        repo,
                        prNumber,
                        installationId,
                        comment: `> [!NOTE]
> Currently processing new changes in this PR. This may take a few minutes, please wait...
>
> \`\`\`ascii
>  ________________________________
> < Overly attached code reviewer. >
>  --------------------------------
>   \\\\
>     \\\\   (__/)
>         (•ㅅ•)
>         /　 づ
> \`\`\``,
                    },
                    {
                        jobId: `pr-comment-${owner}-${repo}-${prNumber}-${installationId}`,
                    },
                );

                await eventPublisher.publishStage(
                    review.id,
                    'COMMENT_POSTED',
                    QUEUE_NAME,
                    'Post Initial Comment',
                    'success',
                    'Posted initial processing comment to PR',
                );

                logger.info({ owner, repo, prNumber }, 'Sent initial comment message to queue');
            }
        } catch (error) {
            logger.error({ error, owner, repo, prNumber }, 'Failed to review pull request');

            const repository = await prisma.repository.findFirst({
                where: { owner, name: repo, userId },
            });

            if (repository) {
                const review = await prisma.review.upsert({
                    where: {
                        repositoryId_prNumber: {
                            repositoryId: repository.id,
                            prNumber,
                        },
                    },
                    create: {
                        repositoryId: repository.id,
                        prNumber,
                        prTitle: `PR #${prNumber}`,
                        prUrl: `https://github.com/${owner}/${repo}/pull/${prNumber}`,
                        review: '',
                        status: 'failed',
                    },
                    update: {
                        status: 'failed',
                    },
                });

                await eventPublisher.publishStage(
                    review.id,
                    'REVIEW_FAILED',
                    QUEUE_NAME,
                    'PR Review',
                    'error',
                    `Review failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    { error: String(error) },
                );
            }
        }
    });

    logger.info({ queue: QUEUE_NAME }, 'PR review worker started');
}

async function startCommentWorker(): Promise<void> {
    commentWorker = createWorker(COMMENT_QUEUE, async (job) => {
        const { owner, repo, prNumber, installationId, comment } = job.data as CommentMessage;

        logger.info({ owner, repo, prNumber }, 'Processing pr-comment job');

        if (!installationId) {
            logger.error('No installationId provided in message');
            return;
        }

        let octokit: Octokit;
        try {
            octokit = await getBotOctokit(installationId);
        } catch (error) {
            logger.error({ error, installationId }, 'Failed to get bot octokit');
            return;
        }

        try {
            await postComment(owner, repo, prNumber, comment, octokit);
        } catch (error) {
            logger.error({ error, owner, repo, prNumber }, 'Failed to post comment');
        }
    });

    logger.info({ queue: COMMENT_QUEUE }, 'Comment worker started');
}

async function startIssuesWorker(): Promise<void> {
    issuesWorker = createWorker(ISSUES_QUEUE, async (job) => {
        const { owner, repo, prNumber, installationId, commitSha, issues, summary, reviewId, isUpdate } =
            job.data as PRIssuesMessage;

        logger.info({ owner, repo, prNumber, isUpdate }, 'Processing pr-issues job');

        if (!installationId) {
            logger.error('No installationId provided in message');
            return;
        }

        let octokit: Octokit;
        try {
            octokit = await getBotOctokit(installationId);
        } catch (error) {
            logger.error({ error, installationId }, 'Failed to get bot octokit');
            return;
        }

        let issuesToPost = issues;

        if (isUpdate && reviewId) {
            const existingComments = await prisma.reviewComment.findMany({
                where: {
                    reviewId,
                    status: 'open',
                },
            });

            const existingIssueKeys = new Set(
                existingComments.map(
                    (c: { path: string | null; line: number | null; body: string }) =>
                        `${c.path}:${c.line}:${c.body.substring(0, 30)}`,
                ),
            );

            issuesToPost = issues.filter((issue) => {
                const issueKey = `${issue.file}:${issue.line}:${issue.description.substring(0, 30)}`;
                return !existingIssueKeys.has(issueKey);
            });

            logger.info(
                { total: issues.length, newIssues: issuesToPost.length, existing: existingComments.length },
                'Filtered to only post new issues',
            );
        }

        const failedIssues: { issue: ReviewIssue; error: unknown }[] = [];
        for (const issue of issuesToPost) {
            try {
                await postInlineComment(owner, repo, prNumber, commitSha, issue, octokit);
            } catch (error) {
                logger.error({ error, owner, repo, prNumber, issue }, 'Failed to post inline comment');
                failedIssues.push({ issue, error });
            }
        }

        if (failedIssues.length > 0) {
            logger.error(
                { owner, repo, prNumber, failedCount: failedIssues.length },
                'Some inline comments failed to post',
            );
        }

        if (summary && !isUpdate) {
            try {
                await postComment(owner, repo, prNumber, summary, octokit);
            } catch (error) {
                logger.error({ error, owner, repo, prNumber }, 'Failed to post summary comment');
            }
        }

        if (isUpdate && issuesToPost.length > 0) {
            try {
                await postComment(
                    owner,
                    repo,
                    prNumber,
                    `## 🔄 Review Update\n\nI've reviewed the new changes and found **${issuesToPost.length}** new issue(s) that need attention.\n\n> [!NOTE]\n> ${issuesToPost.length} of ${issues.length} previous issues have been resolved automatically.`,
                    octokit,
                );
            } catch (error) {
                logger.error({ error, owner, repo, prNumber }, 'Failed to post update comment');
            }
        }
    });

    logger.info({ queue: ISSUES_QUEUE }, 'Issues worker started');
}

async function startPrReviewUpdateWorker(): Promise<void> {
    prReviewUpdateWorker = createWorker(PR_REVIEW_UPDATE_QUEUE, async (job) => {
        const { owner, repo, prNumber, userId, installationId, newCommitSha } = job.data as PRReviewUpdateMessage;

        logger.info({ owner, repo, prNumber, newCommitSha }, 'Received pr-review-update event');

        if (!installationId) {
            logger.error('No installationId provided in message');
            return;
        }

        let octokit: Octokit;
        try {
            octokit = await getBotOctokit(installationId);
        } catch (error) {
            logger.error({ error, installationId }, 'Failed to get bot octokit');
            return;
        }

        try {
            const repository = await prisma.repository.findFirst({
                where: { owner, name: repo, userId },
            });

            if (!repository) {
                logger.warn({ owner, repo }, 'Repository not found in database');
                return;
            }

            const existingReview = await prisma.review.findFirst({
                where: {
                    repositoryId: repository.id,
                    prNumber,
                },
                include: {
                    comments: {
                        where: { status: 'open' },
                    },
                },
            });

            if (!existingReview) {
                logger.info({ prNumber }, 'No existing review found, triggering fresh review');
                await addJob(
                    prReviewQueue,
                    'pr-review',
                    {
                        owner,
                        repo: repo,
                        prNumber,
                        userId,
                        installationId,
                        action: 'synchronize',
                    },
                    {
                        jobId: `pr-review-${owner}-${repo}-${prNumber}-synchronize`,
                    },
                );
                return;
            }

            const prData = await reviewPullRequest(owner, repo, prNumber, octokit);

            const previousCommitSha = existingReview.lastReviewedCommitSha;

            const checkRunId = await createCheckRun(owner, repo, prData.commitSha, octokit);

            const openIssues = existingReview.comments;

            const contextQuery = `${prData.prTitle}\n${prData.prBody}`;

            await addJob(contextQueue, 'pr-context', {
                query: contextQuery,
                repoId: repository.id,
                owner,
                repo: repo,
                prNumber,
                userId,
                installationId,
                diff: prData.diff,
                commitSha: prData.commitSha,
                checkRunId,
                reviewId: existingReview.id,
                previousCommitSha,
                openIssues: openIssues.map(
                    (c: {
                        path: string | null;
                        line: number | null;
                        body: string;
                        suggestion: string | null;
                        severity: string;
                    }) => ({
                        path: c.path,
                        line: c.line,
                        body: c.body,
                        suggestion: c.suggestion,
                        severity: c.severity,
                    }),
                ),
                isUpdate: true,
            });

            logger.info({ owner, repo, prNumber }, 'Queued incremental review with previous issues context');
        } catch (error) {
            logger.error({ error, owner, repo, prNumber }, 'Failed to process PR review update');
        }
    });

    logger.info({ queue: PR_REVIEW_UPDATE_QUEUE }, 'PR review update worker started');
}

async function startPrConversationWorker(): Promise<void> {
    prConversationWorker = createWorker(PR_CONVERSATION_QUEUE, async (job) => {
        const { owner, repo, prNumber, commentId, commentBody, commenter, userId, installationId } =
            job.data as PRConversationMessage;

        logger.info({ owner, repo, prNumber, commentId, commenter }, 'Received pr-conversation event');

        if (!installationId) {
            logger.error('No installationId provided in message');
            return;
        }

        let octokit: Octokit;
        try {
            octokit = await getBotOctokit(installationId);
        } catch (error) {
            logger.error({ error, installationId }, 'Failed to get bot octokit');
            return;
        }

        try {
            const repository = await prisma.repository.findFirst({
                where: { owner, name: repo, userId },
            });

            if (!repository) {
                logger.warn({ owner, repo }, 'Repository not found in database');
                return;
            }

            const existingReview = await prisma.review.findFirst({
                where: {
                    repositoryId: repository.id,
                    prNumber,
                },
                include: {
                    comments: true,
                },
            });

            if (!existingReview) {
                await postComment(
                    owner,
                    repo,
                    prNumber,
                    `Hi @${commenter}! I couldn't find an existing review for this PR. Would you like me to start a fresh review?`,
                    octokit,
                );
                return;
            }

            const openComments = existingReview.comments.filter((c: { status: string }) => c.status === 'open');
            const commentLower = commentBody.toLowerCase();
            const isResolutionIntent =
                commentLower.includes('fixed') ||
                commentLower.includes('resolved') ||
                commentLower.includes('dismiss') ||
                commentLower.includes('not important') ||
                commentLower.includes('ignore') ||
                commentLower.includes("won't fix");

            if (isResolutionIntent && openComments.length > 0) {
                const fileMatch = commentBody.match(/(?:file[:\s]*|[/@]?)(\S+\.\w+)/i);
                const lineMatch = commentBody.match(/line[:\s]*(\d+)/i);

                let matchedComment = null;

                if (fileMatch || lineMatch) {
                    const fileName = fileMatch?.[1];
                    const lineNum = lineMatch?.[1];
                    matchedComment = openComments.find((c: { path: string | null; line: number | null }) => {
                        if (fileName && c.path?.includes(fileName)) return true;
                        if (lineNum && c.line === parseInt(lineNum, 10)) return true;
                        return false;
                    });
                }

                if (matchedComment) {
                    await prisma.reviewComment.update({
                        where: { id: matchedComment.id },
                        data: { status: 'resolved' },
                    });

                    await postComment(
                        owner,
                        repo,
                        prNumber,
                        `Got it @${commenter}! I've marked that issue as resolved. Let me know if you need anything else!`,
                        octokit,
                    );
                    logger.info({ prNumber, commentId: matchedComment.id }, 'Resolved issue based on user context');
                    return;
                }

                if (openComments.length === 1) {
                    await prisma.reviewComment.update({
                        where: { id: openComments[0].id },
                        data: { status: 'resolved' },
                    });

                    await postComment(
                        owner,
                        repo,
                        prNumber,
                        `Got it @${commenter}! I've marked that issue as resolved. Let me know if you need anything else!`,
                        octokit,
                    );
                    logger.info({ prNumber, commentId: openComments[0].id }, 'Resolved single open issue');
                    return;
                }

                const issuesList = openComments
                    .map(
                        (c: { id: string; path: string | null; line: number | null; body: string }, idx: number) =>
                            `${idx + 1}. [${c.path || 'general'}:${c.line || 'N/A'}] ${c.body.substring(0, 100)}...`,
                    )
                    .join('\n');

                await postComment(
                    owner,
                    repo,
                    prNumber,
                    `I see you want to resolve or dismiss an issue, but I found **${openComments.length}** open issues. Which one are you referring to?\n\n${issuesList}\n\nPlease specify by:\n- Replying to the specific comment inline\n- Or mentioning the file and line number\n- Or the issue number (1-${openComments.length})`,
                    octokit,
                );
                logger.info({ prNumber, openCount: openComments.length }, 'Asked user to clarify which issue');
                return;
            }

            await postComment(
                owner,
                repo,
                prNumber,
                `Hey @${commenter}! Thanks for your reply. I'm here to help with code review. What would you like me to do?\n\n- Explain any of my previous suggestions?\n- Review new changes you've made?\n- Dismiss or resolve an issue?\n- Something else?\n\nJust let me know!`,
                octokit,
            );

            logger.info({ prNumber, commenter }, 'Responded to user comment');
        } catch (error) {
            logger.error({ error, owner, repo, prNumber }, 'Failed to process PR conversation');
        }
    });

    logger.info({ queue: PR_CONVERSATION_QUEUE }, 'PR conversation worker started');
}

async function main(): Promise<void> {
    logger.info('PR Processor service starting...');

    try {
        await startPrReviewWorker();
        await startCommentWorker();
        await startIssuesWorker();
        await startPrReviewUpdateWorker();
        await startPrConversationWorker();
    } catch (error) {
        logger.error({ error }, 'Failed to start PR processor');

        setTimeout(() => {
            logger.info('Retrying PR Processor startup...');
            main().catch((err) => {
                logger.error({ error: err }, 'Retry failed');
                process.exit(1);
            });
        }, 5000);

        return;
    }
}

main();

process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    await prReviewWorker?.close();
    await commentWorker?.close();
    await issuesWorker?.close();
    await prReviewUpdateWorker?.close();
    await prConversationWorker?.close();
    await prReviewQueue.close();
    await commentQueue.close();
    await contextQueue.close();
    await prReviewUpdateQueue.close();
    await prConversationQueue.close();
    await eventPublisher.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    await prReviewWorker?.close();
    await commentWorker?.close();
    await issuesWorker?.close();
    await prReviewUpdateWorker?.close();
    await prConversationWorker?.close();
    await prReviewQueue.close();
    await commentQueue.close();
    await contextQueue.close();
    await prReviewUpdateQueue.close();
    await prConversationQueue.close();
    await eventPublisher.close();
    process.exit(0);
});
