import express from 'express';
import { handleChat } from '../controllers/tutorController.js';
import { optionalAuthMiddleware } from '../middleware/auth.js';

const router = express.Router();

// General Q&A about concepts (works with auth or optional demo mode)
router.post('/', optionalAuthMiddleware, handleChat);

export default router;
