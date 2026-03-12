import { type Router as ExpressRouter, Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { getStats } from './controller.js';

const router: ExpressRouter = Router();

router.get('/stats', authMiddleware, getStats);

export default router;
