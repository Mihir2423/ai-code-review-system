import { type Router as ExpressRouter, Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { connectRepo, getConnectedRepos, getRepositories, getStats, reindexRepo } from './controller.js';

const router: ExpressRouter = Router();

router.get('/stats', authMiddleware, getStats);
router.get('/repositories', authMiddleware, getRepositories);
router.get('/connected', authMiddleware, getConnectedRepos);
router.post('/connect', authMiddleware, connectRepo);
router.post('/reindex', authMiddleware, reindexRepo);

export default router;
