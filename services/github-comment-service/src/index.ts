import 'dotenv/config';

import { createAppAuth } from '@octokit/auth-app';
import { logger } from '@repo/logger';
import { createWorker } from '@repo/queue';
import { Octokit } from 'octokit';

const ISSUES_QUEUE = 'pr-issues';
const COMMENT_QUEUE = 'pr-comment';

let issuesWorker: ReturnType<typeof createWorker>;
let commentWorker: ReturnType<typeof createWorker>;

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

async function startIssuesWorker(): Promise<void> {
    issuesWorker = createWorker(ISSUES_QUEUE, async (job) => {
        const { owner, repo, prNumber, installationId, commitSha, issues, summary } = job.data as PRIssuesMessage;

        logger.info({ owner, repo, prNumber }, 'Processing pr-issues job');

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

        const failedIssues: { issue: ReviewIssue; error: unknown }[] = [];
        for (const issue of issues) {
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

        if (summary) {
            try {
                await postComment(owner, repo, prNumber, summary, octokit);
            } catch (error) {
                logger.error({ error, owner, repo, prNumber }, 'Failed to post summary comment');
            }
        }
    });

    logger.info({ queue: ISSUES_QUEUE }, 'Issues worker started');
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

async function main(): Promise<void> {
    logger.info('GitHub Comment service starting...');

    try {
        await startIssuesWorker();
        await startCommentWorker();
    } catch (error) {
        logger.error({ error }, 'Failed to start GitHub Comment service');

        setTimeout(() => {
            logger.info('Retrying GitHub Comment service startup...');
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
    await issuesWorker?.close();
    await commentWorker?.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    await issuesWorker?.close();
    await commentWorker?.close();
    process.exit(0);
});
