import 'dotenv/config';
import { google } from '@ai-sdk/google';
import prisma from '@repo/db';
import { ensureTopics, kafkaManager, sendMessage } from '@repo/kafka';
import { logger } from '@repo/logger';
import { generateText } from 'ai';

const TOPIC_REVIEW = 'pr.ai-review';
const TOPIC_ISSUES = 'pr.issues';
const TOPIC_COMMENT = 'pr.comment';

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

async function getAccessToken(userId: string): Promise<string | null> {
    try {
        const account = await prisma.account.findFirst({
            where: { userId, providerId: 'github' },
            select: { accessToken: true },
        });
        return account?.accessToken ?? null;
    } catch (error) {
        logger.error({ error, userId }, 'Failed to fetch access token from database');
        return null;
    }
}

interface ReviewIssue {
    file: string;
    line: number;
    severity: 'critical' | 'warning' | 'suggestion';
    description: string;
    diff: string;
    suggestion: string;
}

interface ReviewResult {
    issues: ReviewIssue[];
    summary: string;
    strengths: string;
}

async function generateCodeReview(
    title: string,
    description: string,
    context: string[],
    diff: string,
): Promise<ReviewResult> {
    const prompt = `You are an expert code reviewer. Analyze the following pull request and provide a structured code review.

PR Title: ${title}
PR Description: ${description || 'No description provided'}

Context from Codebase:
${context.join('\n\n')}

Code Changes:
\`\`\`diff
${diff}
\`\`\`

Analyze the changes and return a JSON object with the following structure:
{
  "issues": [
    {
      "file": "filename.ts",
      "line": 42,
      "severity": "critical|warning|suggestion",
      "description": "What's wrong",
      "diff": "the problematic code snippet",
      "suggestion": "how to fix it"
    }
  ],
  "summary": "Brief overview of the changes",
  "strengths": "What's done well"
}

Only include issues if you find actual problems. If no issues found, return empty array.
Return ONLY valid JSON, no markdown formatting.`;

    const { text } = await generateText({
        model: google('gemini-2.5-flash'),
        prompt,
    });

    const cleanedText = text
        .replace(/^```json\n?/, '')
        .replace(/```$/, '')
        .trim();
    const result = JSON.parse(cleanedText) as ReviewResult;
    return result;
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
                logger.info({ repoId, prNumber, issuesCount: review.issues.length }, 'Generated code review');

                if (review.issues.length > 0) {
                    await sendMessage(TOPIC_ISSUES, {
                        owner,
                        repo,
                        prNumber,
                        userId,
                        commitSha,
                        issues: review.issues,
                    });
                    logger.info({ repoId, prNumber, issuesCount: review.issues.length }, 'Sent issues to Kafka');
                }

                const summaryMessage = `## Code Review Summary\n\n${review.summary}\n\n### Strengths\n${review.strengths}\n\n### Issues Found: ${review.issues.length}`;
                await sendMessage(TOPIC_COMMENT, {
                    owner,
                    repo,
                    prNumber,
                    userId,
                    comment: summaryMessage,
                });
                logger.info({ repoId, prNumber }, 'Sent summary to Kafka');
            } catch (error) {
                logger.error({ error, repoId, prNumber }, 'Failed to generate/post review');
            }
        },
    });

    logger.info({ topic: TOPIC_REVIEW }, 'Kafka consumer started');
}

async function main(): Promise<void> {
    logger.info('AI Review Worker service starting...');

    try {
        await ensureTopics([TOPIC_REVIEW, TOPIC_ISSUES, TOPIC_COMMENT]);
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
