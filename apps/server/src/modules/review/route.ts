import { type Router as ExpressRouter, Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { getReviewByIdHandler, getReviewEventsHandler, getReviewHistory } from './controller.js';

const router: ExpressRouter = Router();

router.get('/history', authMiddleware, getReviewHistory);
router.get('/events/:id', authMiddleware, getReviewEventsHandler);
router.get('/:id', authMiddleware, getReviewByIdHandler);

export default router;
