import { Router } from 'express';
import { handleChatMessage } from '../controllers/chat.controller.js';

const router = Router();

// POST /api/chat
router.post('/chat', handleChatMessage);

export default router;
