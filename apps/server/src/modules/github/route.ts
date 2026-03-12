import { type Router as ExpressRouter, Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { getRepositories, getStats } from './controller.js';

const router: ExpressRouter = Router();

router.get('/stats', authMiddleware, getStats);
router.get('/repositories', authMiddleware, getRepositories);

export default router;
