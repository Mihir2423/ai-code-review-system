import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { FailResponse, SuccessResponse } from '../../utils/response-helpers.js';
import { connectRepository, getAllRepositories, getConnectedRepositories, getGitHubStats } from './service.js';

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
        const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

        if (!userId) {
            res.status(StatusCodes.UNAUTHORIZED).json(
                new FailResponse.Builder().withMessage('Unauthorized').withContent({ error: 'Unauthorized' }).build(),
            );
            return;
        }

        const repositories = await getAllRepositories(userId, cursor);
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

export async function connectRepo(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const userId = req.user?.id;
        const { owner, repo } = req.body;

        if (!userId) {
            res.status(StatusCodes.UNAUTHORIZED).json(
                new FailResponse.Builder().withMessage('Unauthorized').withContent({ error: 'Unauthorized' }).build(),
            );
            return;
        }

        if (!owner || !repo) {
            res.status(StatusCodes.BAD_REQUEST).json(
                new FailResponse.Builder()
                    .withMessage('Owner and repo are required')
                    .withContent({ error: 'Owner and repo are required' })
                    .build(),
            );
            return;
        }

        const repository = await connectRepository(userId, owner, repo);
        res.status(StatusCodes.OK).json(
            new SuccessResponse.Builder()
                .withMessage('Repository connected successfully')
                .withContent(repository)
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
                .withMessage('Failed to connect repository')
                .withContent({ error: error instanceof Error ? error.message : 'Unknown error' })
                .build(),
        );
    }
}

export async function getConnectedRepos(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const userId = req.user?.id;

        if (!userId) {
            res.status(StatusCodes.UNAUTHORIZED).json(
                new FailResponse.Builder().withMessage('Unauthorized').withContent({ error: 'Unauthorized' }).build(),
            );
            return;
        }

        const repositories = await getConnectedRepositories(userId);
        res.status(StatusCodes.OK).json(
            new SuccessResponse.Builder()
                .withMessage('Connected repositories fetched successfully')
                .withContent(repositories)
                .build(),
        );
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(
            new FailResponse.Builder()
                .withMessage('Failed to fetch connected repositories')
                .withContent({ error: error instanceof Error ? error.message : 'Unknown error' })
                .build(),
        );
    }
}
