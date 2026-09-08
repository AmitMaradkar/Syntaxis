import express from 'express';
import {
  handleCodeReview,
  handleExecuteCode,
  handleExplainWhy,
  getActiveSession,
  handleCreateNewSession,
  markSessionSolved
} from '../controllers/tutorController.js';

import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Submit code for review and Tier 1 hint
router.post('/', optionalAuthMiddleware, handleCodeReview);

// Execute code via Piston sandbox
router.post('/execute', handleExecuteCode);

// Explain-Why 3-part breakdown
router.post('/explain-why', optionalAuthMiddleware, handleExplainWhy);

// Session state management
router.get('/session/active', optionalAuthMiddleware, getActiveSession);
router.post('/session/new', optionalAuthMiddleware, handleCreateNewSession);
router.post('/session/mark-solved', optionalAuthMiddleware, markSessionSolved);


export default router;
