import 'dotenv/config';
import prisma from '@repo/db';
import { ensureTopics, kafkaManager } from '@repo/kafka';
import { logger } from '@repo/logger';
import { Octokit } from 'octokit';

const TOPIC_ISSUES = 'pr.issues';

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
    userId: string;
    commitSha: string;
    issues: ReviewIssue[];
    summary?: string;
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

    const { data: pr } = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
    });
    const latestCommitSha = pr.head.sha;

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

    const body = `${emoji} **${issue.severity.toUpperCase()}** at ${issue.file}:${issue.line}\n\n${issue.description}\n\n**Change:** ${changeDisplay}\n\n**Suggestion:** ${issue.suggestion}`;

    await octokit.rest.pulls.createReviewComment({
        owner,
        repo,
        pull_number: prNumber,
        commit_id: latestCommitSha,
        path: issue.file,
        line: issue.line,
        side,
        body,
    });

    logger.info({ owner, repo, prNumber, file: issue.file, line: issue.line }, 'Posted inline comment to pull request');
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

            const { owner, repo, prNumber, userId, commitSha, issues, summary } = prIssues;

            if (!userId) {
                logger.error('No userId provided in message');
                return;
            }

            const accessToken = await getAccessToken(userId);
            if (!accessToken) {
                logger.error({ userId }, 'No GitHub access token found for user');
                return;
            }

            const failedIssues: { issue: ReviewIssue; error: unknown }[] = [];
            for (const issue of issues) {
                try {
                    await postInlineComment(owner, repo, prNumber, commitSha, issue, accessToken);
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
                    await postComment(owner, repo, prNumber, summary, accessToken);
                } catch (error) {
                    logger.error({ error, owner, repo, prNumber }, 'Failed to post summary comment');
                }
            }
        },
    });

    logger.info({ topic: TOPIC_ISSUES }, 'Issues consumer started');
}

async function main(): Promise<void> {
    logger.info('GitHub Comment service starting...');

    try {
        await ensureTopics([TOPIC_ISSUES]);
        logger.info('[GitHub Comment Service] Topics ensured');

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
