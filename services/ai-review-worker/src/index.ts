import 'dotenv/config';

import { generateCodeReview, type ReviewIssue } from '@repo/ai';
import prisma from '@repo/db';
import { logger } from '@repo/logger';
import { addJob, createQueue, createWorker } from '@repo/queue';
import type { IssueWithMetadata } from '@repo/types';

const QUEUE_NAME = 'pr-ai-review';
const ISSUES_QUEUE = 'pr-issues';

interface AIReviewMessage {
    title: string;
    description: string;
    context: string[];
    diff: string;
    repoId: string;
    owner: string;
    repo: string;
    prNumber: number;
    userId: string;
    commitSha: string;
}

const aiReviewQueue = createQueue(QUEUE_NAME);
const issuesQueue = createQueue(ISSUES_QUEUE);

function stripMarkdownFences(code: string): string {
    return code
        .replace(/^```[\w]*\n?/gm, '')
        .replace(/```$/gm, '')
        .trim();
}

function findLineNumberInDiff(diff: string, file: string, code: string): number | null {
    const cleanCode = stripMarkdownFences(code);
    const searchCode = cleanCode.substring(0, 30).trim();
    const lines = diff.split('\n');
    let currentFile = '';
    let hunkStartLine = 0;

    for (const line of lines) {
        if (line.startsWith('diff --git')) {
            const match = line.match(/b\/(.+)/);
            if (match && match[1]) currentFile = match[1];
        } else if (line.startsWith('@@')) {
            const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)/);
            if (match && match[1]) hunkStartLine = parseInt(match[1], 10);
        } else if (currentFile === file && line.includes(searchCode)) {
            return hunkStartLine;
        } else if (currentFile === file && (line.startsWith('+') || line.startsWith(' '))) {
            hunkStartLine++;
        }
    }

    return null;
}

function buildIssueComment(issue: ReviewIssue & { line: number }): string {
    const emoji = issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵';

    const oldCode = issue.oldCode || 'N/A';
    const newCode = issue.newCode || 'N/A';
    const changeDisplay =
        issue.oldCode && issue.newCode
            ? `\`${oldCode}\` → \`${newCode}\``
            : issue.oldCode
              ? `Removed: \`${oldCode}\``
              : `Added: \`${newCode}\``;

    return `${emoji} **${issue.severity.toUpperCase()}** at ${issue.file}:${issue.line}\n\n${issue.description}\n\n**Change:** ${changeDisplay}\n\n**Suggestion:** ${issue.suggestion}`;
}

function createIssueHash(issue: ReviewIssue): string {
    return `${issue.file}:${issue.line}:${issue.description.substring(0, 50)}`;
}

function deduplicateIssues(issues: ReviewIssue[]): ReviewIssue[] {
    const seen = new Set<string>();
    const deduplicated: ReviewIssue[] = [];

    for (const issue of issues) {
        const hash = createIssueHash(issue);
        if (!seen.has(hash)) {
            seen.add(hash);
            deduplicated.push(issue);
        } else {
            logger.warn({ issue }, 'Duplicate issue found, skipping');
        }
    }

    return deduplicated;
}

async function startWorker(): Promise<void> {
    const worker = createWorker(QUEUE_NAME, async (job) => {
        const reviewMessage = job.data as AIReviewMessage;
        logger.info({ reviewMessage }, 'Received AI review event');

        const { title, description, context, diff, repoId, owner, repo, prNumber, userId, commitSha } = reviewMessage;

        if (!userId) {
            logger.error('No userId provided in message');
            return;
        }

        try {
            logger.info({ repoId, prNumber }, 'Generating code review...');
            const review = await generateCodeReview(title, description, context, diff);

            const uniqueIssues = deduplicateIssues(review.issues);

            const issuesWithLines = uniqueIssues
                .map((issue) => {
                    const line = findLineNumberInDiff(diff, issue.file, issue.newCode || issue.oldCode);
                    return line !== null ? { ...issue, line } : null;
                })
                .filter((issue): issue is NonNullable<typeof issue> => issue !== null);

            logger.info(
                { repoId, prNumber, totalIssues: review.issues.length, uniqueIssues: uniqueIssues.length },
                'Deduplicated and resolved line numbers for issues',
            );

            const summaryMessage = `## Code Review Summary\n\n${review.summary}\n\n### Strengths\n${review.strengths}\n\n### Issues Found: ${uniqueIssues.length}`;

            await addJob(issuesQueue, 'pr-issues', {
                owner,
                repo,
                prNumber,
                userId,
                commitSha,
                issues: issuesWithLines,
                summary: summaryMessage,
            });
            logger.info({ repoId, prNumber, issuesCount: issuesWithLines.length }, 'Sent issues and summary to queue');

            let issuesWithMetadata: IssueWithMetadata[] = [];
            try {
                issuesWithMetadata = issuesWithLines.map((issue) => {
                    const severity =
                        issue.severity === 'critical' || issue.severity === 'warning' || issue.severity === 'suggestion'
                            ? issue.severity
                            : 'warning';
                    const commentBody = buildIssueComment({
                        ...issue,
                        severity,
                    });
                    return {
                        file: issue.file,
                        line: issue.line,
                        severity: issue.severity,
                        description: issue.description,
                        commentBody,
                        diff: {
                            oldCode: issue.oldCode || '',
                            newCode: issue.newCode || '',
                        },
                    };
                });
            } catch (metadataError) {
                logger.error({ metadataError }, 'Failed to create issues metadata, using fallback');
                issuesWithMetadata = issuesWithLines.map((issue) => ({
                    file: issue.file,
                    line: issue.line,
                    severity: issue.severity,
                    description: issue.description,
                    commentBody: `${issue.file}:${issue.line} - ${issue.description}`,
                    diff: {
                        oldCode: issue.oldCode || '',
                        newCode: issue.newCode || '',
                    },
                }));
            }

            await prisma.review.update({
                where: {
                    repositoryId_prNumber: {
                        repositoryId: repoId,
                        prNumber,
                    },
                },
                data: {
                    status: 'completed',
                    review: summaryMessage,
                    issues: issuesWithMetadata.map((i) => JSON.stringify(i)),
                },
            });
            logger.info({ repoId, prNumber }, 'Updated review status to completed');
        } catch (error) {
            logger.error(
                { error: String(error), repoId, prNumber, stack: error instanceof Error ? error.stack : undefined },
                'Failed to generate/post review',
            );

            await prisma.review
                .update({
                    where: {
                        repositoryId_prNumber: {
                            repositoryId: repoId,
                            prNumber,
                        },
                    },
                    data: {
                        status: 'failed',
                    },
                })
                .catch((err: unknown) => {
                    logger.error({ err, repoId, prNumber }, 'Failed to update review status to failed');
                });
        }
    });

    logger.info({ queue: QUEUE_NAME }, 'Queue worker started');
}

async function main(): Promise<void> {
    logger.info('AI Review Worker service starting...');

    try {
        await startWorker();
    } catch (error) {
        logger.error({ error }, 'Failed to start AI Review Worker');

        setTimeout(() => {
            logger.info('Retrying AI Review Worker startup...');
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
    await aiReviewQueue.close();
    await issuesQueue.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    await aiReviewQueue.close();
    await issuesQueue.close();
    process.exit(0);
});
