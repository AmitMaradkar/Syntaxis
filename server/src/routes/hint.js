import express from 'express';
import { handleNextHint } from '../controllers/tutorController.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Escalate hint tier (Tier 1 -> Tier 2 -> Tier 3)
router.post('/next', optionalAuthMiddleware, handleNextHint);

export default router;
