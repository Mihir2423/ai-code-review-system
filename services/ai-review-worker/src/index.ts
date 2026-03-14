import 'dotenv/config';

import { generateCodeReview, type ReviewIssue } from '@repo/ai';
import prisma from '@repo/db';
import { ensureTopics, kafkaManager, sendMessageWithKey } from '@repo/kafka';
import { logger } from '@repo/logger';

const TOPIC_REVIEW = 'pr.ai-review';
const TOPIC_ISSUES = 'pr.issues';

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

function findLineNumberInDiff(diff: string, file: string, code: string): number {
    const lines = diff.split('\n');
    let currentFile = '';
    let hunkStartLine = 0;
    const searchCode = code.substring(0, 30).trim();

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

    return 1;
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

async function startConsumer(): Promise<void> {
    const consumer = kafkaManager.consumer({
        groupId: 'ai-review-worker',
        sessionTimeout: 300000,
        heartbeatInterval: 30000,
    });

    await consumer.connect();
    logger.info('[AI Review Worker] Consumer connected to Kafka');

    await consumer.subscribe({ topic: TOPIC_REVIEW, fromBeginning: false });

    await consumer.run({
        eachMessage: async ({ message }) => {
            const value = message.value?.toString();
            if (!value) return;

            const reviewMessage = JSON.parse(value) as AIReviewMessage;
            logger.info({ reviewMessage, offset: message.offset }, 'Received AI review event');

            const { title, description, context, diff, repoId, owner, repo, prNumber, userId, commitSha } =
                reviewMessage;

            if (!userId) {
                logger.error('No userId provided in message');
                return;
            }

            try {
                logger.info({ repoId, prNumber }, 'Generating code review...');
                const review = await generateCodeReview(title, description, context, diff);

                const uniqueIssues = deduplicateIssues(review.issues);

                const issuesWithLines = uniqueIssues.map((issue) => {
                    const resolvedLine = findLineNumberInDiff(diff, issue.file, issue.newCode || issue.oldCode);
                    return {
                        ...issue,
                        line: resolvedLine,
                    };
                });

                logger.info(
                    { repoId, prNumber, totalIssues: review.issues.length, uniqueIssues: uniqueIssues.length },
                    'Deduplicated and resolved line numbers for issues',
                );

                const messageKey = `${owner}/${repo}/${prNumber}`;

                const summaryMessage = `## Code Review Summary\n\n${review.summary}\n\n### Strengths\n${review.strengths}\n\n### Issues Found: ${uniqueIssues.length}`;

                await sendMessageWithKey(
                    TOPIC_ISSUES,
                    {
                        owner,
                        repo,
                        prNumber,
                        userId,
                        commitSha,
                        issues: issuesWithLines,
                        summary: summaryMessage,
                    },
                    messageKey,
                );
                logger.info(
                    { repoId, prNumber, issuesCount: issuesWithLines.length },
                    'Sent issues and summary to Kafka',
                );

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
                        issues: issuesWithLines.map((i) => `${i.file}:${i.line} - ${i.description}`),
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
        },
    });

    logger.info({ topic: TOPIC_REVIEW }, 'Kafka consumer started');
}

async function main(): Promise<void> {
    logger.info('AI Review Worker service starting...');

    try {
        await ensureTopics([TOPIC_REVIEW, TOPIC_ISSUES]);
        logger.info('[AI Review Worker] Topics ensured');

        await startConsumer();
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
    await kafkaManager.disconnect();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    await kafkaManager.disconnect();
    process.exit(0);
});
