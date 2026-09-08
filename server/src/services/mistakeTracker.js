import mongoose from 'mongoose';
import MistakeLog, { ERROR_CATEGORIES } from '../models/MistakeLog.js';

/**
 * Validates and normalizes errorType into allowed canonical categories
 */
export function normalizeErrorType(type) {
  if (!type) return 'other';
  const clean = String(type).toLowerCase().trim().replace(/[\s_]+/g, '-');
  if (ERROR_CATEGORIES.includes(clean)) {
    return clean;
  }
  // Loose matching fallbacks
  if (clean.includes('bound') || clean.includes('index') || clean.includes('off-by')) return 'off-by-one';
  if (clean.includes('structure') || clean.includes('array') || clean.includes('map')) return 'wrong-data-structure';
  if (clean.includes('syntax') || clean.includes('bracket') || clean.includes('semicolon')) return 'syntax';
  if (clean.includes('logic') || clean.includes('condition') || clean.includes('boolean')) return 'logic-error';
  if (clean.includes('complex') || clean.includes('o(n') || clean.includes('time') || clean.includes('perf')) return 'bad-complexity';
  if (clean.includes('type') || clean.includes('cast') || clean.includes('parse')) return 'type-error';
  if (clean.includes('null') || clean.includes('undefined') || clean.includes('nil')) return 'null-reference';
  if (clean.includes('scope') || clean.includes('shadow') || clean.includes('global')) return 'scope-error';
  return 'other';
}

/**
 * Persists an array of classified errors into MistakeLog
 */
export async function logMistakes(userId, sessionId, errors = [], language = 'javascript') {
  if (!errors || errors.length === 0) return [];

  const documents = errors.map((err) => ({
    userId,
    sessionId,
    errorType: normalizeErrorType(err.errorType),
    description: err.description || '',
    snippet: err.snippet || '',
    line: typeof err.line === 'number' ? err.line : undefined,
    language
  }));

  try {
    const saved = await MistakeLog.insertMany(documents);
    return saved;
  } catch (err) {
    console.error('Failed to log mistakes to MongoDB:', err.message);
    return [];
  }
}

/**
 * Fetches top recurring error types for the user and current session
 * Aggregates both session-specific and overall recent user patterns
 */
export async function getRecurringPatterns(userId, sessionId, limit = 3) {
  try {
    const userObjId = new mongoose.Types.ObjectId(String(userId));

    // Aggregate top error types for this user across recent sessions
    const pipeline = [
      {
        $match: {
          userId: userObjId
        }
      },
      {
        $group: {
          _id: '$errorType',
          count: { $sum: 1 },
          lastOccurred: { $max: '$timestamp' },
          sampleSnippet: { $first: '$snippet' }
        }
      },
      { $sort: { count: -1, lastOccurred: -1 } },
      { $limit: limit }
    ];

    const results = await MistakeLog.aggregate(pipeline);

    // Also get session-specific count if sessionId is provided
    let sessionResults = [];
    if (sessionId) {
      sessionResults = await MistakeLog.aggregate([
        {
          $match: {
            sessionId: new mongoose.Types.ObjectId(String(sessionId))
          }
        },
        {
          $group: {
            _id: '$errorType',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]);
    }

    return {
      topUserPatterns: results.map((r) => ({
        errorType: r._id,
        count: r.count,
        lastOccurred: r.lastOccurred,
        sampleSnippet: r.sampleSnippet
      })),
      sessionPatterns: sessionResults.map((r) => ({
        errorType: r._id,
        count: r.count
      }))
    };
  } catch (err) {
    console.error('Error fetching recurring patterns:', err.message);
    return { topUserPatterns: [], sessionPatterns: [] };
  }
}

/**
 * Formats recurring patterns into a concise injection string for LLM prompts
 * Matches specification: "This user has repeatedly made X and Y type errors. Watch for and call out these patterns."
 */
export function buildPatternContext({ topUserPatterns = [], sessionPatterns = [] }) {
  if ((!topUserPatterns || topUserPatterns.length === 0) && (!sessionPatterns || sessionPatterns.length === 0)) {
    return '';
  }

  const sessionHighlights = sessionPatterns
    .filter((p) => p.count >= 2)
    .map((p) => `${p.errorType} (${p.count} times in this session)`);

  const userHighlights = topUserPatterns
    .filter((p) => p.count >= 2)
    .map((p) => `${p.errorType} (${p.count} historical occurrences)`);

  const combined = [...new Set([...sessionHighlights, ...userHighlights])];

  if (combined.length === 0) {
    if (topUserPatterns.length > 0) {
      return `Historical watch: Student previously encountered ${topUserPatterns[0].errorType}.`;
    }
    return '';
  }

  return `This user has repeatedly made ${combined.join(' and ')} errors. Watch for and call out these patterns in their code.`;
}

/**
 * Fetch mistake trend time-series for progress dashboard
 */
export async function getMistakeTrends(userId, days = 30) {
  try {
    const userObjId = new mongoose.Types.ObjectId(String(userId));
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    const trends = await MistakeLog.aggregate([
      {
        $match: {
          userId: userObjId,
          timestamp: { $gte: sinceDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            errorType: '$errorType'
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.date': 1 }
      }
    ]);

    // Group by date for Recharts format
    const dateMap = {};
    trends.forEach((item) => {
      const date = item._id.date;
      const type = item._id.errorType;
      if (!dateMap[date]) {
        dateMap[date] = { date, total: 0 };
      }
      dateMap[date][type] = item.count;
      dateMap[date].total += item.count;
    });

    return Object.values(dateMap);
  } catch (err) {
    console.error('Error getting mistake trends:', err.message);
    return [];
  }
}
