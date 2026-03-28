import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { FailResponse, SuccessResponse } from '../../utils/response-helpers.js';
import { getReviewById, getReviewEvents, getUserReviewHistory, getUserReviewStats } from './service.js';

export async function getReviewHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const userId = req.user?.id;

        if (!userId) {
            res.status(StatusCodes.UNAUTHORIZED).json(
                new FailResponse.Builder().withMessage('Unauthorized').withContent({ error: 'Unauthorized' }).build(),
            );
            return;
        }

        const reviews = await getUserReviewHistory(userId);
        res.status(StatusCodes.OK).json(
            new SuccessResponse.Builder()
                .withMessage('Review history fetched successfully')
                .withContent(reviews)
                .build(),
        );
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(
            new FailResponse.Builder()
                .withMessage('Failed to fetch review history')
                .withContent({ error: error instanceof Error ? error.message : 'Unknown error' })
                .build(),
        );
    }
}

export async function getReviewStatsHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const userId = req.user?.id;

        if (!userId) {
            res.status(StatusCodes.UNAUTHORIZED).json(
                new FailResponse.Builder().withMessage('Unauthorized').withContent({ error: 'Unauthorized' }).build(),
            );
            return;
        }

        const stats = await getUserReviewStats(userId);
        res.status(StatusCodes.OK).json(
            new SuccessResponse.Builder().withMessage('Review stats fetched successfully').withContent(stats).build(),
        );
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(
            new FailResponse.Builder()
                .withMessage('Failed to fetch review stats')
                .withContent({ error: error instanceof Error ? error.message : 'Unknown error' })
                .build(),
        );
    }
}

export async function getReviewEventsHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const userId = req.user?.id;
        const { id } = req.params as { id: string };

        if (!userId) {
            res.status(StatusCodes.UNAUTHORIZED).json(
                new FailResponse.Builder().withMessage('Unauthorized').withContent({ error: 'Unauthorized' }).build(),
            );
            return;
        }

        if (!id) {
            res.status(StatusCodes.BAD_REQUEST).json(
                new FailResponse.Builder()
                    .withMessage('Review ID required')
                    .withContent({ error: 'Review ID required' })
                    .build(),
            );
            return;
        }

        const events = await getReviewEvents(id, userId);
        res.status(StatusCodes.OK).json(
            new SuccessResponse.Builder().withMessage('Review events fetched successfully').withContent(events).build(),
        );
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(
            new FailResponse.Builder()
                .withMessage('Failed to fetch review events')
                .withContent({ error: error instanceof Error ? error.message : 'Unknown error' })
                .build(),
        );
    }
}

export async function getReviewByIdHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const userId = req.user?.id;
        const { id } = req.params as { id: string };

        if (!userId) {
            res.status(StatusCodes.UNAUTHORIZED).json(
                new FailResponse.Builder().withMessage('Unauthorized').withContent({ error: 'Unauthorized' }).build(),
            );
            return;
        }

        if (!id) {
            res.status(StatusCodes.BAD_REQUEST).json(
                new FailResponse.Builder()
                    .withMessage('Review ID required')
                    .withContent({ error: 'Review ID required' })
                    .build(),
            );
            return;
        }

        const review = await getReviewById(id, userId);
        if (!review) {
            res.status(StatusCodes.NOT_FOUND).json(
                new FailResponse.Builder()
                    .withMessage('Review not found')
                    .withContent({ error: 'Review not found' })
                    .build(),
            );
            return;
        }

        res.status(StatusCodes.OK).json(
            new SuccessResponse.Builder().withMessage('Review fetched successfully').withContent(review).build(),
        );
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(
            new FailResponse.Builder()
                .withMessage('Failed to fetch review')
                .withContent({ error: error instanceof Error ? error.message : 'Unknown error' })
                .build(),
        );
    }
}
