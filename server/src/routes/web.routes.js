import express from 'express';
import { searchWebHandler } from '../controllers/web.controller.js';

const router = express.Router();

/**
 * Web Intelligence & Search Routes (Phase 8)
 * Development-only endpoints
 */
router.post('/web/search', searchWebHandler);

export default router;
