import mongoose from 'mongoose';
import Session from '../models/Session.js';
import User from '../models/User.js';

/**
 * Evaluates rolling performance over the last 5 sessions:
 * - Success rate (solved boolean)
 * - Average hints used per problem
 * - Time taken per problem
 * Automatically computes inferred level: 'beginner' | 'intermediate' | 'advanced'
 */
export async function assessDifficulty(userId) {
  try {
    const userObjId = new mongoose.Types.ObjectId(String(userId));

    // Fetch the last 5 completed or submitted sessions
    const recentSessions = await Session.find({ userId: userObjId })
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean();

    if (!recentSessions || recentSessions.length === 0) {
      return {
        level: 'beginner',
        score: 0.2,
        metrics: {
          samples: 0,
          successRate: 0,
          avgHintsUsed: 0,
          avgDurationSeconds: 0
        }
      };
    }

    const totalSamples = recentSessions.length;
    const solvedCount = recentSessions.filter((s) => s.solved).length;
    const successRate = solvedCount / totalSamples;

    const totalHints = recentSessions.reduce((sum, s) => sum + (s.hintsUsed || 0), 0);
    const avgHintsUsed = totalHints / totalSamples;

    const totalDuration = recentSessions.reduce((sum, s) => sum + (s.durationSeconds || 60), 0);
    const avgDurationSeconds = totalDuration / totalSamples;

    // Hint score: 0 hints = 1.0, 1 hint = 0.7, 2 hints = 0.4, 3+ hints = 0.1
    const hintFactor = Math.max(0, 1 - avgHintsUsed / 3);

    // Speed score: fast solve under 3 minutes = 1.0, 10 minutes = 0.5, >20 minutes = 0.2
    const speedFactor = Math.min(1, Math.max(0.1, 1 - avgDurationSeconds / 1200));

    // Weighted fluency score:
    // Success rate: 45%, Independent solving (fewer hints): 35%, Speed: 20%
    const compositeScore = successRate * 0.45 + hintFactor * 0.35 + speedFactor * 0.2;

    let inferredLevel = 'beginner';
    if (compositeScore >= 0.75 && totalSamples >= 3) {
      inferredLevel = 'advanced';
    } else if (compositeScore >= 0.45 && totalSamples >= 2) {
      inferredLevel = 'intermediate';
    } else {
      inferredLevel = 'beginner';
    }

    // Persist updated difficulty onto User profile if it changed
    await User.findByIdAndUpdate(userObjId, { currentDifficulty: inferredLevel });

    return {
      level: inferredLevel,
      score: Math.round(compositeScore * 100) / 100,
      metrics: {
        samples: totalSamples,
        successRate: Math.round(successRate * 100),
        avgHintsUsed: Math.round(avgHintsUsed * 10) / 10,
        avgDurationSeconds: Math.round(avgDurationSeconds)
      }
    };
  } catch (err) {
    console.error('Error assessing difficulty:', err.message);
    return {
      level: 'beginner',
      score: 0.3,
      metrics: { samples: 0, successRate: 0, avgHintsUsed: 0, avgDurationSeconds: 0 }
    };
  }
}

/**
 * Returns the prompt instruction based on inferred difficulty level
 */
export function getDifficultyPromptModifier(level = 'beginner') {
  switch (level) {
    case 'advanced':
      return 'Target Level: ADVANCED. Assume high proficiency with programming concepts. Focus on algorithm optimality, computational complexity, subtle memory and concurrency implications, and architectural elegance. Avoid explaining rudimentary syntax.';
    case 'intermediate':
      return 'Target Level: INTERMEDIATE. Assume understanding of fundamentals like variables, functions, and loops. Focus on idioms, clean control flow, data structure choice tradeoffs, and standard library best practices.';
    case 'beginner':
    default:
      return 'Target Level: BEGINNER. Use friendly, accessible explanations. Build intuition from scratch with clear real-world metaphors. Never assume mastery of complex syntax or hidden language behaviors.';
  }
}
