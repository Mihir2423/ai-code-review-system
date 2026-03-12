import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { FailResponse, SuccessResponse } from '../../utils/response-helpers.js';
import { getAllRepositories, getGitHubStats } from './service.js';

export async function getStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const userId = req.user?.id;

        if (!userId) {
            res.status(StatusCodes.UNAUTHORIZED).json(
                new FailResponse.Builder().withMessage('Unauthorized').withContent({ error: 'Unauthorized' }).build(),
            );
            return;
        }

        const stats = await getGitHubStats(userId);
        res.status(StatusCodes.OK).json(
            new SuccessResponse.Builder().withMessage('GitHub stats fetched successfully').withContent(stats).build(),
        );
    } catch (error) {
        if (error instanceof Error && error.message === 'GitHub account not connected') {
            res.status(StatusCodes.UNAUTHORIZED).json(
                new FailResponse.Builder()
                    .withMessage('GitHub account not connected')
                    .withContent({ error: 'GitHub account not connected' })
                    .build(),
            );
            return;
        }

        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(
            new FailResponse.Builder()
                .withMessage('Failed to fetch GitHub stats')
                .withContent({ error: error instanceof Error ? error.message : 'Unknown error' })
                .build(),
        );
    }
}

export async function getRepositories(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const userId = req.user?.id;

        if (!userId) {
            res.status(StatusCodes.UNAUTHORIZED).json(
                new FailResponse.Builder().withMessage('Unauthorized').withContent({ error: 'Unauthorized' }).build(),
            );
            return;
        }

        const repositories = await getAllRepositories(userId);
        res.status(StatusCodes.OK).json(
            new SuccessResponse.Builder()
                .withMessage('Repositories fetched successfully')
                .withContent(repositories)
                .build(),
        );
    } catch (error) {
        if (error instanceof Error && error.message === 'GitHub account not connected') {
            res.status(StatusCodes.UNAUTHORIZED).json(
                new FailResponse.Builder()
                    .withMessage('GitHub account not connected')
                    .withContent({ error: 'GitHub account not connected' })
                    .build(),
            );
            return;
        }

        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(
            new FailResponse.Builder()
                .withMessage('Failed to fetch repositories')
                .withContent({ error: error instanceof Error ? error.message : 'Unknown error' })
                .build(),
        );
    }
}
