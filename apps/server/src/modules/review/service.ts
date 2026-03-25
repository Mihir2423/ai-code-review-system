import prisma from '@repo/db';

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
