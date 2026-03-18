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
