import 'dotenv/config';

import { createAppAuth } from '@octokit/auth-app';
import { generateCodeReview, type ReviewIssue } from '@repo/ai';
import prisma from '@repo/db';
import { logger } from '@repo/logger';
import { addJob, createQueue, createWorker } from '@repo/queue';
import type { IssueWithMetadata } from '@repo/types';
import { Octokit } from 'octokit';

const QUEUE_NAME = 'pr-ai-review';
const ISSUES_QUEUE = 'pr-issues';
const CHECK_NAME = 'AI Code Review';

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
    installationId: string;
    commitSha: string;
    checkRunId?: number;
}

const aiReviewQueue = createQueue(QUEUE_NAME);
const issuesQueue = createQueue(ISSUES_QUEUE);

let aiReviewWorker: ReturnType<typeof createWorker>;

async function getBotOctokit(installationId: string): Promise<Octokit> {
    const auth = createAppAuth({
        appId: process.env.GITHUB_APP_ID!,
        privateKey: process.env.GITHUB_BOT_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        installationId,
    });

    const { token } = await auth({ type: 'installation' });
    return new Octokit({ auth: token });
}

async function updateCheckRun(
    owner: string,
    repo: string,
    checkRunId: number,
    conclusion: 'success' | 'neutral' | 'failure',
    summary: string,
    issues: ReviewIssue[],
    octokit: Octokit,
): Promise<void> {
    const annotations = issues.map(
        (
            issue,
        ): {
            path: string;
            start_line: number;
            end_line: number;
            annotation_level: 'failure' | 'warning' | 'notice';
            message: string;
            raw_details: string;
        } => ({
            path: issue.file,
            start_line: issue.line,
            end_line: issue.line,
            annotation_level:
                issue.severity === 'critical' ? 'failure' : issue.severity === 'warning' ? 'warning' : 'notice',
            message: `${issue.severity.toUpperCase()}: ${issue.description}`,
            raw_details: issue.suggestion,
        }),
    );

    const hasCriticalOrWarning = issues.some((i) => i.severity === 'critical' || i.severity === 'warning');

    await octokit.rest.checks.update({
        owner,
        repo,
        check_run_id: checkRunId,
        status: 'completed',
        conclusion: hasCriticalOrWarning ? conclusion : 'success',
        output: {
            title: `Review Complete - ${issues.length} issues found`,
            summary,
            annotations: annotations.slice(0, 50),
        },
    });

    logger.info({ owner, repo, checkRunId, conclusion }, 'Updated check run');
}

function stripMarkdownFences(code: string): string {
    return code
        .replace(/^```[\w]*\n?/gm, '')
        .replace(/```$/gm, '')
        .trim();
}

function extractFilesFromDiff(diff: string): Set<string> {
    const files = new Set<string>();
    for (const line of diff.split('\n')) {
        if (line.startsWith('diff --git')) {
            const match = line.match(/b\/(.+)/);
            if (match?.[1]) files.add(match[1]);
        }
    }
    return files;
}

function findLineNumberInDiff(diff: string, file: string, code: string): number | null {
    const cleanCode = stripMarkdownFences(code);
    const searchVariants = [
        cleanCode.substring(0, 30).trim(),
        cleanCode.substring(0, 20).trim(),
        cleanCode.substring(0, 15).trim(),
    ];
    logger.debug({ file, searchVariants }, 'Searching for line number in diff');

    const lines = diff.split('\n');
    let currentFile = '';
    let hunkStartLine = 0;

    for (const line of lines) {
        if (line.startsWith('diff --git')) {
            const match = line.match(/b\/(.+)/);
            if (match && match[1]) {
                currentFile = match[1];
                logger.debug({ diffLine: line, extractedFile: currentFile }, 'Extracted file from diff');
            }
        } else if (line.startsWith('@@')) {
            const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)/);
            if (match && match[1]) hunkStartLine = parseInt(match[1], 10);
            logger.debug({ hunkStartLine, currentFile }, 'Found hunk header');
        } else if (currentFile === file) {
            for (const variant of searchVariants) {
                if (variant && line.includes(variant)) {
                    logger.debug(
                        { foundLine: hunkStartLine, matchedLine: line.substring(0, 50) },
                        'Found matching line',
                    );
                    return hunkStartLine;
                }
            }
            if (line.startsWith('+') || line.startsWith(' ')) {
                hunkStartLine++;
            }
        }
    }

    logger.warn({ file, searchVariants }, 'Could not find line number in diff');
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
    aiReviewWorker = createWorker(QUEUE_NAME, async (job) => {
        const reviewMessage = job.data as AIReviewMessage;
        logger.info({ reviewMessage }, 'Received AI review event');

        const {
            title,
            description,
            context,
            diff,
            repoId,
            owner,
            repo,
            prNumber,
            userId,
            installationId,
            commitSha,
            checkRunId,
        } = reviewMessage;

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
            logger.info({ repoId, prNumber }, 'Generating code review...');
            const review = await generateCodeReview(title, description, context, diff);

            const uniqueIssues = deduplicateIssues(review.issues);

            const diffFiles = extractFilesFromDiff(diff);

            const inDiffIssues = uniqueIssues.filter((issue) => diffFiles.has(issue.file));
            const outOfDiffIssues = uniqueIssues.filter((issue) => {
                if (!diffFiles.has(issue.file)) {
                    logger.info(
                        { file: issue.file },
                        'Issue refers to a file not in the diff — will include in summary instead of inline comment',
                    );
                    return true;
                }
                return false;
            });

            const issuesWithLines = inDiffIssues
                .map((issue) => {
                    const diffLine = findLineNumberInDiff(diff, issue.file, issue.newCode || issue.oldCode);
                    const line = diffLine !== null ? diffLine : issue.line;
                    logger.info(
                        {
                            file: issue.file,
                            line,
                            diffLine,
                            aiLine: issue.line,
                            codeSnippet: (issue.newCode || issue.oldCode).substring(0, 50),
                        },
                        'Resolved issue line number',
                    );
                    return line !== null && line > 0 ? { ...issue, line } : null;
                })
                .filter((issue): issue is NonNullable<typeof issue> => issue !== null);

            logger.info(
                { repoId, prNumber, totalIssues: review.issues.length, uniqueIssues: uniqueIssues.length },
                'Deduplicated and resolved line numbers for issues',
            );

            const outOfDiffSection =
                outOfDiffIssues.length > 0
                    ? `\n\n### Related Issues (files not directly changed)\n${outOfDiffIssues
                          .map((issue) => {
                              const emoji =
                                  issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵';
                              return `- ${emoji} **${issue.severity.toUpperCase()}** \`${issue.file}\`: ${issue.description}\n  > **Suggestion:** ${issue.suggestion}`;
                          })
                          .join('\n')}`
                    : '';
            const summaryMessage =
                `## Code Review Summary\n\n${review.summary}\n\n### Strengths\n${review.strengths}\n\n` +
                `### Issues Found: ${uniqueIssues.length}` +
                outOfDiffSection;
            await addJob(issuesQueue, 'pr-issues', {
                owner,
                repo,
                prNumber,
                installationId,
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

            await prisma.review.upsert({
                where: {
                    repositoryId_prNumber: {
                        repositoryId: repoId,
                        prNumber,
                    },
                },
                create: {
                    repositoryId: repoId,
                    prNumber,
                    prTitle: title,
                    prUrl: `https://github.com/${owner}/${repo}/pull/${prNumber}`,
                    status: 'completed',
                    review: summaryMessage,
                    issues: issuesWithMetadata.map((i) => JSON.stringify(i)),
                },
                update: {
                    status: 'completed',
                    review: summaryMessage,
                    issues: issuesWithMetadata.map((i) => JSON.stringify(i)),
                },
            });
            logger.info({ repoId, prNumber }, 'Updated review status to completed');

            if (checkRunId) {
                const hasCritical = uniqueIssues.some((i) => i.severity === 'critical');
                const hasWarning = uniqueIssues.some((i) => i.severity === 'warning');

                try {
                    await updateCheckRun(
                        owner,
                        repo,
                        checkRunId,
                        hasCritical ? 'failure' : hasWarning ? 'neutral' : 'success',
                        `AI Code Review found ${uniqueIssues.length} issues:\n- ${uniqueIssues.filter((i) => i.severity === 'critical').length} critical\n- ${uniqueIssues.filter((i) => i.severity === 'warning').length} warnings\n- ${uniqueIssues.filter((i) => i.severity === 'suggestion').length} suggestions\n\n${review.summary}`,
                        uniqueIssues,
                        octokit,
                    );
                } catch (error) {
                    logger.error({ error, checkRunId }, 'Failed to update check run');
                }
            }
        } catch (error) {
            logger.error(
                { error: String(error), repoId, prNumber, stack: error instanceof Error ? error.stack : undefined },
                'Failed to generate/post review',
            );

            await prisma.review
                .upsert({
                    where: {
                        repositoryId_prNumber: {
                            repositoryId: repoId,
                            prNumber,
                        },
                    },
                    create: {
                        repositoryId: repoId,
                        prNumber,
                        prTitle: title,
                        prUrl: `https://github.com/${owner}/${repo}/pull/${prNumber}`,
                        status: 'failed',
                        review: '',
                        issues: [],
                    },
                    update: {
                        status: 'failed',
                    },
                })
                .catch((err: unknown) => {
                    logger.error({ err, repoId, prNumber }, 'Failed to update review status to failed');
                });

            if (checkRunId) {
                try {
                    await updateCheckRun(
                        owner,
                        repo,
                        checkRunId,
                        'failure',
                        `AI Code Review failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        [],
                        octokit,
                    );
                } catch (updateError) {
                    logger.error({ error: updateError, checkRunId }, 'Failed to update check run to failure');
                }
            }
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
    await aiReviewWorker?.close();
    await aiReviewQueue.close();
    await issuesQueue.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    await aiReviewWorker?.close();
    await aiReviewQueue.close();
    await issuesQueue.close();
    process.exit(0);
});
