import prisma from '@repo/db';
import type { ReviewStats } from '@repo/types';

export interface ReviewHistoryItem {
    id: string;
    prNumber: number;
    prTitle: string;
    prUrl: string;
    review: string;
    issues: string[];
    status: string;
    createdAt: Date;
    updatedAt: Date;
    repository: {
        id: string;
        name: string;
        owner: string;
        fullName: string;
    };
}

export interface ReviewEventItem {
    id: string;
    reviewId: string;
    type: string;
    queueName: string | null;
    stage: string | null;
    status: string;
    message: string;
    details: string | null;
    createdAt: Date;
}

export async function getUserReviewHistory(userId: string): Promise<ReviewHistoryItem[]> {
    const reviews = await prisma.review.findMany({
        where: {
            user: {
                userId,
            },
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    owner: true,
                    fullName: true,
                },
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
    });

    return reviews.map((review: (typeof reviews)[number]) => ({
        ...review,
        repository: review.user,
    }));
}

export async function getUserReviewStats(userId: string): Promise<ReviewStats> {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const reviews = await prisma.review.findMany({
        where: {
            user: {
                userId,
            },
        },
    });

    const total = reviews.length;
    const thisWeek = reviews.filter((r) => new Date(r.createdAt) >= oneWeekAgo).length;
    const thisMonth = reviews.filter((r) => new Date(r.createdAt) >= oneMonthAgo).length;
    const completed = reviews.filter((r) => r.status === 'completed').length;
    const pending = reviews.filter((r) => r.status === 'pending').length;
    const failed = reviews.filter((r) => r.status === 'failed').length;

    let critical = 0;
    let warning = 0;
    let suggestion = 0;
    let totalIssues = 0;
    const fileIssueCount: Record<string, number> = {};

    for (const review of reviews) {
        for (const issueJson of review.issues) {
            try {
                const issue = JSON.parse(issueJson);
                totalIssues++;
                const severity = issue.severity?.toLowerCase() || 'warning';
                if (severity === 'critical') critical++;
                else if (severity === 'warning') warning++;
                else suggestion++;

                if (issue.file) {
                    fileIssueCount[issue.file] = (fileIssueCount[issue.file] || 0) + 1;
                }
            } catch {
                // Skip invalid JSON
            }
        }
    }

    const avgIssuesPerReview = total > 0 ? Math.round((totalIssues / total) * 10) / 10 : 0;

    const weeks: string[] = [];
    const weekCounts: number[] = [];
    for (let i = 6; i >= 0; i--) {
        const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
        const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const weekLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        weeks.push(weekLabel);
        weekCounts.push(
            reviews.filter((r) => {
                const d = new Date(r.createdAt);
                return d >= weekStart && d < weekEnd;
            }).length,
        );
    }

    const issuesByFile = Object.entries(fileIssueCount)
        .map(([file, count]) => ({ file, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    return {
        total,
        thisWeek,
        thisMonth,
        completed,
        pending,
        failed,
        avgIssuesPerReview,
        critical,
        warning,
        suggestion,
        trend: weeks.map((week, i) => ({ week, count: weekCounts[i] })),
        issuesByFile,
    };
}

export async function getReviewEvents(reviewId: string, userId: string): Promise<ReviewEventItem[]> {
    const review = await prisma.review.findUnique({
        where: { id: reviewId },
        include: {
            user: {
                select: { userId: true },
            },
        },
    });

    if (!review || review.user.userId !== userId) {
        return [];
    }

    const events = await prisma.reviewEvent.findMany({
        where: { reviewId },
        orderBy: { createdAt: 'asc' },
    });

    return events;
}

export async function getReviewById(reviewId: string, userId: string): Promise<ReviewHistoryItem | null> {
    const review = await prisma.review.findUnique({
        where: { id: reviewId },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    owner: true,
                    fullName: true,
                    userId: true,
                },
            },
        },
    });

    if (!review || review.user.userId !== userId) {
        return null;
    }

    const { userId: _, ...userWithoutUserId } = review.user;
    return {
        ...review,
        repository: userWithoutUserId,
    };
}
