import express from 'express';
import { handleGetProgress } from '../controllers/tutorController.js';
import { optionalAuthMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Fetch progress metrics and mistake trends (works for logged-in and guest users)
router.get('/:userId', optionalAuthMiddleware, handleGetProgress);

export default router;
