// Vercel serverless entry point
// This file imports the configured Express app and ensures
// the DB connection is established before handling requests.

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

import app from './index.js';

// Ensure DB is connected for each serverless invocation
let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('⚠️ MONGODB_URI not set');
    return;
  }

  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      isConnected = true;
      console.log('✅ Connected to MongoDB (serverless)');
    } else {
      isConnected = true;
    }
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
  }
}

// Wrap the app to ensure DB connection
const handler = async (req, res) => {
  await connectDB();
  return app(req, res);
};

export default handler;
