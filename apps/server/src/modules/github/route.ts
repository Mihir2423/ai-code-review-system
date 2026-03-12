import { type Router as ExpressRouter, Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { connectRepo, getConnectedRepos, getRepositories, getStats } from './controller.js';

const router: ExpressRouter = Router();

router.get('/stats', authMiddleware, getStats);
router.get('/repositories', authMiddleware, getRepositories);
router.get('/connected', authMiddleware, getConnectedRepos);
router.post('/connect', authMiddleware, connectRepo);

export default router;
