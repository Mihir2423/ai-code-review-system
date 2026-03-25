import prisma from '@repo/db';
import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from './auth.js';

export async function authorizeReviewAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const reviewId = req.params.reviewId as string;
    const userId = req.user?.id;

    if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    if (!reviewId) {
        res.status(400).json({ error: 'Review ID required' });
        return;
    }

    const review = await prisma.review.findUnique({
        where: { id: reviewId },
        include: {
            user: {
                select: { userId: true },
            },
        },
    });

    if (!review) {
        res.status(404).json({ error: 'Review not found' });
        return;
    }

    if (review.user.userId !== userId) {
        res.status(403).json({ error: 'Forbidden: You do not have access to this review' });
        return;
    }

    next();
}
