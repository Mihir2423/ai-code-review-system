import { type Router as ExpressRouter, Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { getReviewByIdHandler, getReviewEventsHandler, getReviewHistory, getReviewStatsHandler } from './controller.js';

const router: ExpressRouter = Router();

router.get('/history', authMiddleware, getReviewHistory);
router.get('/stats', authMiddleware, getReviewStatsHandler);
router.get('/events/:id', authMiddleware, getReviewEventsHandler);
router.get('/:id', authMiddleware, getReviewByIdHandler);

export default router;
