import 'dotenv/config';
import { google } from '@ai-sdk/google';
import prisma from '@repo/db';
import { ensureTopics, kafkaManager } from '@repo/kafka';
import { logger } from '@repo/logger';
import { generateText } from 'ai';
import { Octokit } from 'octokit';

const TOPIC = 'pr.ai-review';

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

async function generateCodeReview(
    title: string,
    description: string,
    context: string[],
    diff: string,
): Promise<string> {
    const prompt = `You are an expert code reviewer. Analyze the following pull request and provide a detailed, constructive code review.

PR Title: ${title}
PR Description: ${description || 'No description provided'}

Context from Codebase:
${context.join('\n\n')}

Code Changes:
\`\`\`diff
${diff}
\`\`\`

Please provide:
1. **Walkthrough**: A file-by-file explanation of the changes.
2. **Sequence Diagram**: A Mermaid JS sequence diagram visualizing the flow of the changes (if applicable). Use \`\`\`mermaid ... \`\`\` block. **IMPORTANT**: Ensure the Mermaid syntax is valid. Do not use special characters (like quotes, braces, parentheses) inside Note text or labels as it breaks rendering. Keep the diagram simple.
3. **Summary**: Brief overview.
4. **Strengths**: What's done well.
5. **Issues**: Bugs, security concerns, code smells.
6. **Suggestions**: Specific code improvements.
7. **Poem**: A short, creative poem summarizing the changes at the very end.

Format your response in markdown.`;

    const { text } = await generateText({
        model: google('gemini-2.5-flash'),
        prompt,
    });

    return text;
}

async function postReviewComment(
    owner: string,
    repo: string,
    prNumber: number,
    comment: string,
    accessToken: string,
): Promise<void> {
    const octokit = new Octokit({ auth: accessToken });

    await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: comment,
    });

    logger.info({ owner, repo, prNumber }, 'Posted review comment to pull request');
}

async function startConsumer(): Promise<void> {
    const consumer = kafkaManager.consumer({
        groupId: 'ai-review-worker',
        sessionTimeout: 300000,
        heartbeatInterval: 30000,
    });

    await consumer.connect();
    logger.info('[AI Review Worker] Consumer connected to Kafka');

    await consumer.subscribe({ topic: TOPIC, fromBeginning: false });

    await consumer.run({
        eachMessage: async ({ message }) => {
            const value = message.value?.toString();
            if (!value) return;

            const reviewMessage = JSON.parse(value) as AIReviewMessage;
            logger.info({ reviewMessage, offset: message.offset }, 'Received AI review event');

            const { title, description, context, diff, repoId, owner, repo, prNumber, userId } = reviewMessage;

            if (!userId) {
                logger.error('No userId provided in message');
                return;
            }

            const accessToken = await getAccessToken(userId);
            if (!accessToken) {
                logger.error({ userId }, 'No GitHub access token found for user');
                return;
            }

            try {
                logger.info({ repoId, prNumber }, 'Generating code review...');
                const review = await generateCodeReview(title, description, context, diff);
                logger.info({ repoId, prNumber, reviewLength: review.length }, 'Generated code review');

                await postReviewComment(owner, repo, prNumber, review, accessToken);
                logger.info({ repoId, prNumber }, 'Posted review comment');
            } catch (error) {
                logger.error({ error, repoId, prNumber }, 'Failed to generate/post review');
            }
        },
    });

    logger.info({ topic: TOPIC }, 'Kafka consumer started');
}

async function main(): Promise<void> {
    logger.info('AI Review Worker service starting...');

    try {
        await ensureTopics([TOPIC]);
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
