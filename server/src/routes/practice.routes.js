import { Router } from 'express';
import {
  createSessionHandler,
  getSessionHandler,
  submitAnswerHandler,
  completeSessionHandler,
  getPracticeHistoryHandler,
  getPracticeWeakTopicsHandler,
} from '../controllers/practice.controller.js';

const router = Router();

// Practice session routes
router.post('/practice/sessions', createSessionHandler);
router.get('/practice/sessions/:sessionId', getSessionHandler);
router.post('/practice/sessions/:sessionId/answer', submitAnswerHandler);
router.post('/practice/sessions/:sessionId/complete', completeSessionHandler);

// Candidate practice history & analytics
router.get('/users/:userId/practice-history', getPracticeHistoryHandler);
router.get('/users/:userId/practice-weak-topics', getPracticeWeakTopicsHandler);

export default router;
