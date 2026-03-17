import { type Router as ExpressRouter, Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { getConnectedRepos, getStats } from './controller.js';

const router: ExpressRouter = Router();

router.get('/stats', authMiddleware, getStats);
router.get('/connected', authMiddleware, getConnectedRepos);

export default router;
