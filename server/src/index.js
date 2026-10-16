import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import codeReviewRoutes from './routes/codeReview.js';
import hintRoutes from './routes/hint.js';
import progressRoutes from './routes/progress.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5174;

// Trust proxy (required for Vercel / cloud platforms behind reverse proxies)
app.set('trust proxy', 1);

// Security & utilities middleware
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const clientUrl = process.env.CLIENT_URL;
      if (
        (clientUrl && origin === clientUrl) ||
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true
  })
);
app.use(morgan('dev'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Rate limiter for API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});
app.use('/api/', apiLimiter);

// Route Mounting
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/code-review', codeReviewRoutes);
app.use('/api/code', codeReviewRoutes);
app.use('/api/hint', hintRoutes);
app.use('/api/progress', progressRoutes);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const { isQwenAvailable } = await import('./services/qwenService.js');
  const qwenAvailable = await isQwenAvailable();

  res.json({
    status: 'ok',
    service: 'AI Coding Tutor API',
    time: new Date().toISOString(),
    mongoConnected: mongoose.connection.readyState === 1,
    qwenOptimizerReady: qwenAvailable,
    qwenModel: process.env.QWEN_MODEL || 'qwen3:4b',
    promptSecurityActive: true
  });
});


// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled API Error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Connect to MongoDB (with in-memory fallback for local dev if mongod not running)
async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-coding-tutor';

  try {
    // Attempt standard connection
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
    console.log(`✅ Connected to MongoDB at ${uri}`);
  } catch (initialErr) {
    console.warn(`⚠️ Could not connect to primary MongoDB at ${uri} (${initialErr.message})`);

    // Fallback to in-memory mongodb for frictionless dev
    try {
      console.log('🔄 Initializing in-memory MongoDB runner for zero-config development...');
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const memUri = mongod.getUri();
      await mongoose.connect(memUri);
      console.log(`✅ Connected to in-memory MongoDB at ${memUri}`);
    } catch (memErr) {
      console.error('❌ Failed to start in-memory MongoDB:', memErr.message);
      console.log('Continuing in offline DB mode. Some endpoints requiring DB will error.');
    }
  }
}

// Start Server (skip when running as Vercel serverless function)
if (!process.env.VERCEL) {
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 AI Coding Tutor Server running on http://localhost:${PORT}`);
      console.log(`📡 Ready for AI requests and code tutoring`);
    });
  });
}

export default app;

