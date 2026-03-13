import 'dotenv/config';
import prisma from '@repo/db';
import { ensureTopics, kafkaManager } from '@repo/kafka';
import { logger } from '@repo/logger';
import { Octokit } from 'octokit';

const TOPIC_COMMENT = 'pr.comment';
const TOPIC_ISSUES = 'pr.issues';

interface ReviewIssue {
    file: string;
    line: number;
    severity: 'critical' | 'warning' | 'suggestion';
    description: string;
    diff: string;
    suggestion: string;
}

interface PRCommentMessage {
    owner: string;
    repo: string;
    prNumber: number;
    userId: string;
    comment: string;
}

interface PRIssuesMessage {
    owner: string;
    repo: string;
    prNumber: number;
    userId: string;
    commitSha: string;
    issues: ReviewIssue[];
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

async function postComment(
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

    logger.info({ owner, repo, prNumber }, 'Posted comment to pull request');
}

async function postInlineComment(
    owner: string,
    repo: string,
    prNumber: number,
    commitSha: string,
    issue: ReviewIssue,
    accessToken: string,
): Promise<void> {
    const octokit = new Octokit({ auth: accessToken });

    const emoji = issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵';
    const body = `${emoji} **${issue.severity.toUpperCase()}** at ${issue.file}:${issue.line}\n\n${issue.description}\n\n<details>\n<summary>Problematic Code</summary>\n\n\`\`\`diff\n${issue.diff}\n\`\`\`\n\n</details>\n\n**Suggestion:** ${issue.suggestion}`;

    await octokit.rest.pulls.createReviewComment({
        owner,
        repo,
        pull_number: prNumber,
        commit_id: commitSha,
        path: issue.file,
        line: issue.line,
        side: 'RIGHT',
        body,
    });

    logger.info({ owner, repo, prNumber, file: issue.file, line: issue.line }, 'Posted inline comment to pull request');
}

async function startCommentConsumer(): Promise<void> {
    const consumer = kafkaManager.consumer({
        groupId: 'github-comment-service-comment',
        sessionTimeout: 300000,
        heartbeatInterval: 30000,
    });

    await consumer.connect();
    logger.info('[GitHub Comment Service] Comment consumer connected to Kafka');

    await consumer.subscribe({ topic: TOPIC_COMMENT, fromBeginning: false });

    await consumer.run({
        eachMessage: async ({ message }) => {
            const value = message.value?.toString();
            if (!value) return;

            const prComment = JSON.parse(value) as PRCommentMessage;
            logger.info({ prComment, offset: message.offset }, 'Received pr-comment event');

            const { owner, repo, prNumber, userId, comment } = prComment;

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
                await postComment(owner, repo, prNumber, comment, accessToken);
            } catch (error) {
                logger.error({ error, owner, repo, prNumber }, 'Failed to post comment');
            }
        },
    });

    logger.info({ topic: TOPIC_COMMENT }, 'Comment consumer started');
}

async function startIssuesConsumer(): Promise<void> {
    const consumer = kafkaManager.consumer({
        groupId: 'github-comment-service-issues',
        sessionTimeout: 300000,
        heartbeatInterval: 30000,
    });

    await consumer.connect();
    logger.info('[GitHub Comment Service] Issues consumer connected to Kafka');

    await consumer.subscribe({ topic: TOPIC_ISSUES, fromBeginning: false });

    await consumer.run({
        eachMessage: async ({ message }) => {
            const value = message.value?.toString();
            if (!value) return;

            const prIssues = JSON.parse(value) as PRIssuesMessage;
            logger.info({ prIssues, offset: message.offset }, 'Received pr-issues event');

            const { owner, repo, prNumber, userId, commitSha, issues } = prIssues;

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
                for (const issue of issues) {
                    await postInlineComment(owner, repo, prNumber, commitSha, issue, accessToken);
                }
            } catch (error) {
                logger.error({ error, owner, repo, prNumber }, 'Failed to post inline comments');
            }
        },
    });

    logger.info({ topic: TOPIC_ISSUES }, 'Issues consumer started');
}

async function main(): Promise<void> {
    logger.info('GitHub Comment service starting...');

    try {
        await ensureTopics([TOPIC_COMMENT, TOPIC_ISSUES]);
        logger.info('[GitHub Comment Service] Topics ensured');

        await startCommentConsumer();
        await startIssuesConsumer();
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
    await kafkaManager.disconnect();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    await kafkaManager.disconnect();
    process.exit(0);
});
