import axios from 'axios';
import Session from '../models/Session.js';
import MistakeLog from '../models/MistakeLog.js';
import User from '../models/User.js';
import { callLLM, streamLLM } from '../services/llmService.js';
import { buildReviewPrompt } from '../prompts/reviewPrompt.js';
import { buildExplainWhyPrompt } from '../prompts/explainPrompt.js';
import {
  logMistakes,
  getRecurringPatterns,
  buildPatternContext,
  getMistakeTrends
} from '../services/mistakeTracker.js';
import { escalateHint, generateTierHint } from '../services/hintEngine.js';
import { assessDifficulty, getDifficultyPromptModifier } from '../services/difficultyEngine.js';
import { scanForInjection, sanitizeInput } from '../services/promptGuard.js';
import { decomposeQuestion, executeLeastToMostChain } from '../services/promptOptimizer.js';

const PISTON_API_URL = process.env.PISTON_API_URL || 'https://emkc.org/api/v2/piston';

// Piston language and version mapping
const PISTON_LANGUAGE_MAP = {
  javascript: { language: 'javascript', version: '18.15.0' },
  python: { language: 'python', version: '3.10.0' },
  java: { language: 'java', version: '15.0.2' },
  cpp: { language: 'c++', version: '10.2.0' }
};

/**
 * Resolves the authenticated user or fetches/creates a persistent guest learner in MongoDB
 */
export async function resolveUser(req) {
  if (req.user && req.user._id) {
    return req.user;
  }
  // If not logged in, retrieve or create persistent guest user in MongoDB
  let guest = await User.findOne({ email: 'guest@syntaxis.local' });
  if (!guest) {
    guest = new User({
      username: 'GuestLearner',
      email: 'guest@syntaxis.local',
      password: 'guestpassword123',
      currentDifficulty: 'beginner'
    });
    await guest.save();
    console.log('🌱 Created persistent Guest Learner profile in MongoDB Atlas');
  }
  return guest;
}

/**
 * Robust JSON extractor for LLM output (handles raw json, code fences, or surrounding conversational text)
 */
function extractJson(text) {
  if (!text) return null;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (e) {}

  // Match markdown ```json ... ``` or ```exercise ... ```
  const codeBlockMatch = text.match(/```(?:json|exercise)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch (e) {}
  }

  // Find outermost curly brackets { ... }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1));
    } catch (e) {}
  }

  return null;
}

/**
 * Handles concept Q&A in chat panel:
 * - Explains theory for the requested language
 * - Suggests 2-3 beginner-friendly exercises with actionable exercise blocks
 */
export async function handleChat(req, res) {
  try {
    const { message, language = 'javascript', code = '', stream = false, sessionId } = req.body;
    const user = await resolveUser(req);
    const userId = user._id;

    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    // --- SECURITY LAYER: Screen message for Prompt Injection ---
    const guardScan = await scanForInjection(message);
    if (!guardScan.safe && guardScan.threatLevel === 'high') {
      return res.status(400).json({
        message: 'Security Alert: Prompt policy violation detected.',
        securityBlocked: true,
        reason: guardScan.reason || 'Input attempted to override tutor instructions.'
      });
    }
    const cleanMessage = guardScan.sanitizedInput || message;

    // 1. Fetch user pattern context & difficulty
    let patternContext = '';
    let difficultyLevel = 'beginner';

    if (userId) {
      const patterns = await getRecurringPatterns(userId, sessionId, 3);
      patternContext = buildPatternContext(patterns);

      const diff = await assessDifficulty(userId);
      difficultyLevel = diff.level;
    }

    // --- PROMPT OPTIMIZATION: Check for Least-to-Most decomposition ---
    if (!stream) {
      const decomposition = await decomposeQuestion({
        question: cleanMessage,
        language,
        difficulty: difficultyLevel
      });

      if (decomposition.isComplex && decomposition.subQuestions.length > 1) {
        console.log(`🧠 [Least-to-Most] Decomposed question into ${decomposition.subQuestions.length} sub-problems via Qwen3`);
        const guidedAnswer = await executeLeastToMostChain({
          question: cleanMessage,
          language,
          subQuestions: decomposition.subQuestions,
          pedagogicalGoal: decomposition.pedagogicalGoal,
          difficulty: difficultyLevel
        });

        return res.json({
          reply: guidedAnswer,
          difficultyLevel,
          patternContextInjected: !!patternContext,
          optimizedViaLtM: true,
          subQuestions: decomposition.subQuestions
        });
      }
    }

    const depthModifier = getDifficultyPromptModifier(difficultyLevel);

    const systemPrompt = `You are an elite, encouraging AI Coding Tutor (Syntaxis).
Your role is to teach programming concepts intuitively and suggest targeted hands-on practice.
Language: ${language}
${depthModifier}
${patternContext ? `\n[MISTAKE PATTERNS TO WATCH]: ${patternContext}` : ''}

Key Guidelines:
1. THEORY FIRST: When the student asks about a concept, syntax, data structure, or programming topic (e.g. loops, arrays, recursion, functions):
   - Provide a clear, beginner-friendly conceptual explanation with analogies and short syntax examples in ${language}.
   - Explain why this concept is useful and what common pitfalls beginners run into.

2. SUGGESTED BEGINNER-FRIENDLY EXERCISES:
   - Provide 2 or 3 beginner-friendly practice problems tailored to the concept.
   - For EACH exercise you suggest, include an interactive code block in this exact markdown format:

\`\`\`exercise
{
  "title": "Short Exercise Title",
  "description": "Clear 1-2 sentence problem description for the student to solve.",
  "language": "${language}",
  "starterCode": "// Clean boilerplate with function signature and test call"
}
\`\`\`

3. Do not solve the exercises for them. Let the student load the exercise into their editor and attempt it.
4. Keep the tone inspiring, structured, and easy to read.`;

    const messages = [
      ...(code && !code.includes('// Write your code here')
        ? [{ role: 'user', content: `Current Editor Code:\n\`\`\`${language}\n${sanitizeInput(code)}\n\`\`\`` }]
        : []),
      { role: 'user', content: cleanMessage }
    ];

    if (stream) {

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      await streamLLM({
        systemPrompt,
        messages,
        onToken: (token) => {
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        },
        onComplete: (fullText) => {
          res.write(`data: ${JSON.stringify({ done: true, fullText })}\n\n`);
          res.end();
        },
        onError: (err) => {
          res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
          res.end();
        }
      });
    } else {
      const reply = await callLLM({
        systemPrompt,
        messages,
        maxTokens: 1800
      });

      return res.json({
        reply,
        difficultyLevel,
        patternContextInjected: !!patternContext
      });
    }
  } catch (err) {
    console.error('Chat error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ message: 'Error communicating with AI tutor', error: err.message });
    }
    res.end();
  }
}

/**
 * Handles code submission: runs review, classifies errors, saves to MistakeLog in MongoDB, returns Tier 1 hint
 */
export async function handleCodeReview(req, res) {
  try {
    const { code, language = 'javascript', problemDescription = '', sessionId, title } = req.body;
    const user = await resolveUser(req);
    const userId = user._id;

    if (!code) {
      return res.status(400).json({ message: 'Code is required for review' });
    }

    // --- SECURITY LAYER: Sanitize code and screen problem description ---
    const cleanCode = sanitizeInput(code);
    const descScan = await scanForInjection(problemDescription);
    if (!descScan.safe && descScan.threatLevel === 'high') {
      return res.status(400).json({
        message: 'Security Alert: Prompt injection attempt detected in submission context.',
        securityBlocked: true,
        reason: descScan.reason
      });
    }
    const cleanDescription = descScan.sanitizedInput || problemDescription;

    // 1. Find or create session
    let session;
    if (sessionId) {
      session = await Session.findById(sessionId);
    }

    if (!session) {
      session = new Session({
        userId,
        language,
        problemDescription: cleanDescription || 'Independent Coding Exercise',
        code: cleanCode,
        title: title || 'Coding Exercise',
        startedAt: new Date()
      });
    } else {
      session.code = cleanCode;
      session.language = language;
      if (cleanDescription) session.problemDescription = cleanDescription;
      session.submissions = (session.submissions || 0) + 1;
    }


    // 2. Fetch recurring mistake patterns & difficulty
    const patterns = await getRecurringPatterns(userId, session?._id, 3);
    const patternContext = buildPatternContext(patterns);

    const diff = await assessDifficulty(userId);
    const difficultyLevel = diff.level;

    // 3. Build Review Prompt and call Gemini
    const { systemPrompt, userPrompt } = buildReviewPrompt({
      code: cleanCode,
      language,
      problemDescription: cleanDescription,
      mistakePatternContext: patternContext,
      difficulty: difficultyLevel
    });

    const rawReview = await callLLM({
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 2000,
      temperature: 0.1
    });

    // 4. Parse structured JSON from response
    let reviewData = extractJson(rawReview);

    if (!reviewData) {
      console.warn('Could not parse review output as JSON, constructing fallback:', rawReview.slice(0, 150));
      reviewData = {
        passed: false,
        summary: rawReview.slice(0, 200),
        errors: [
          {
            errorType: 'logic-error',
            snippet: code.slice(0, 100),
            description: 'Needs review: ' + rawReview.slice(0, 300),
            severity: 'warning'
          }
        ],
        tier1Hint: 'Review your basic conditions and ensure your data flow matches expectations.',
        positives: ['Good attempt at formulating the logic.']
      };
    }

    // 5. Ensure errors are logged to MistakeLog in MongoDB Atlas
    let loggedMistakes = [];
    if (reviewData.errors && reviewData.errors.length > 0) {
      loggedMistakes = await logMistakes(userId, session._id, reviewData.errors, language);
      console.log(`✅ [MongoDB Atlas] Logged ${loggedMistakes.length} mistakes into MistakeLog for user ${user.username} (${reviewData.errors.map(e => e.errorType).join(', ')})`);
    } else if (!reviewData.passed) {
      const fallbackError = [
        {
          errorType: 'logic-error',
          description: reviewData.summary || 'Code did not pass verification',
          snippet: code.slice(0, 100),
          severity: 'warning'
        }
      ];
      loggedMistakes = await logMistakes(userId, session._id, fallbackError, language);
      console.log(`✅ [MongoDB Atlas] Logged fallback mistake into MistakeLog for user ${user.username}`);
    }

    // 6. Record Tier 1 hint in Session history
    session.hintTier = 1;
    session.hintsUsed = Math.max(session.hintsUsed || 0, 1);
    session.latestReview = {
      passed: reviewData.passed,
      summary: reviewData.summary,
      errors: reviewData.errors || [],
      timestamp: new Date()
    };

    if (reviewData.passed) {
      session.solved = true;
      session.solvedAt = new Date();
      const duration = Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000);
      session.durationSeconds = duration;
    }

    // Reset hintsHistory for this fresh code submission with the new Tier 1 hint
    session.hintsHistory = [
      {
        tier: 1,
        content: reviewData.tier1Hint || 'Conceptual Nudge: Check your invariants and edge conditions.',
        timestamp: new Date()
      }
    ];

    await session.save();

    // 7. Update difficulty metrics
    const updated = await assessDifficulty(userId);
    const updatedDifficulty = updated.level;

    return res.json({
      sessionId: session._id,
      passed: reviewData.passed,
      summary: reviewData.summary,
      errors: reviewData.errors || [],
      tier1Hint: reviewData.tier1Hint,
      hintsHistory: session.hintsHistory,
      positives: reviewData.positives || [],
      currentTier: 1,
      difficultyLevel: updatedDifficulty,
      patternsInjected: !!patternContext,
      recurringPatternDetected: reviewData.recurringPatternDetected || false,
      loggedMistakesCount: loggedMistakes.length
    });
  } catch (err) {
    console.error('Code review error:', err);
    return res.status(500).json({ message: 'Error processing code review', error: err.message });
  }
}

/**
 * Handles hint escalation (Tier 1 -> Tier 2 -> Tier 3)
 */
export async function handleNextHint(req, res) {
  try {
    const { sessionId, code, language, problemDescription } = req.body;
    const user = await resolveUser(req);
    const userId = user._id;

    if (!sessionId) {
      return res.status(400).json({ message: 'sessionId is required for hint escalation' });
    }

    const result = await escalateHint({
      userId,
      sessionId,
      code,
      language,
      problemDescription
    });

    return res.json({
      sessionId,
      tier: result.tier,
      hint: result.content,
      isMaxTier: result.isMaxTier,
      hintsUsed: result.hintsUsed,
      difficultyLevel: result.difficultyLevel,
      hintsHistory: result.hintsHistory
    });
  } catch (err) {
    console.error('Hint escalation error:', err);
    return res.status(500).json({ message: 'Failed to generate hint', error: err.message });
  }
}

/**
 * Handles Explain-Why breakdown for a specific mistake
 */
export async function handleExplainWhy(req, res) {
  try {
    const { code, language = 'javascript', errorDescription, snippet, line, sessionId } = req.body;
    const user = await resolveUser(req);
    const userId = user._id;

    const patterns = await getRecurringPatterns(userId, sessionId, 3);
    const patternContext = buildPatternContext(patterns);
    const diff = await assessDifficulty(userId);
    const difficulty = diff.level;

    const { systemPrompt, userPrompt } = buildExplainWhyPrompt({
      code,
      language,
      errorDescription,
      snippet,
      line,
      difficulty,
      mistakePatternContext: patternContext
    });

    const explanation = await callLLM({
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 1800,
      temperature: 0.2
    });

    return res.json({
      explanation,
      difficulty
    });
  } catch (err) {
    console.error('Explain-Why error:', err);
    return res.status(500).json({ message: 'Failed to generate Explain-Why analysis', error: err.message });
  }
}

/**
 * Proxies code execution to Piston API with local execution fallback
 */
export async function handleExecuteCode(req, res) {
  try {
    const { code, language = 'javascript', stdin = '' } = req.body;

    if (!code) {
      return res.status(400).json({ message: 'Code is required for execution' });
    }

    const mapping = PISTON_LANGUAGE_MAP[language.toLowerCase()] || {
      language: language.toLowerCase(),
      version: '*'
    };

    const payload = {
      language: mapping.language,
      version: mapping.version,
      files: [
        {
          name: language === 'java' ? 'Solution.java' : `main.${language === 'python' ? 'py' : language === 'cpp' ? 'cpp' : 'js'}`,
          content: code
        }
      ],
      stdin
    };

    try {
      const response = await axios.post(`${PISTON_API_URL}/execute`, payload, {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' }
      });

      const runResult = response.data.run || {};
      return res.json({
        stdout: runResult.stdout || '',
        stderr: runResult.stderr || '',
        output: runResult.output || '',
        code: runResult.code,
        signal: runResult.signal
      });
    } catch (pistonErr) {
      console.warn(`Piston API unavailable or restricted (${pistonErr.response?.status || pistonErr.message}). Engaging local execution fallback...`);

      // Local Fallback for JavaScript
      if (language.toLowerCase() === 'javascript') {
        const vm = await import('node:vm');
        let logs = [];
        const sandbox = {
          console: {
            log: (...args) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
            error: (...args) => logs.push('[Error]: ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
            warn: (...args) => logs.push('[Warn]: ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
            info: (...args) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '))
          },
          setTimeout,
          clearTimeout,
          Math,
          Date,
          Array,
          Object,
          String,
          Number,
          Boolean,
          RegExp,
          Map,
          Set
        };

        try {
          const context = vm.createContext(sandbox);
          const script = new vm.Script(code);
          script.runInContext(context, { timeout: 3000 });
          return res.json({
            stdout: logs.join('\n') || '[Finished with no console output]',
            stderr: '',
            code: 0
          });
        } catch (execErr) {
          return res.json({
            stdout: logs.join('\n'),
            stderr: `${execErr.name}: ${execErr.message}`,
            code: 1
          });
        }
      }

      // Local Fallback for Python
      if (language.toLowerCase() === 'python') {
        const { exec } = await import('node:child_process');
        return new Promise((resolve) => {
          const child = exec('python -', { timeout: 4000 }, (error, stdout, stderr) => {
            if (error && error.killed) {
              return resolve(res.json({ stdout: '', stderr: 'Execution timed out (limit: 4s)', code: 124 }));
            }
            return resolve(res.json({
              stdout: stdout || '',
              stderr: stderr || (error ? error.message : ''),
              code: error ? (error.code || 1) : 0
            }));
          });
          if (child.stdin) {
            child.stdin.write(code);
            child.stdin.end();
          }
        });
      }

      return res.status(200).json({
        stdout: '',
        stderr: `Remote Piston sandbox is currently restricted: ${pistonErr.response?.data?.message || pistonErr.message}. For ${language}, configure a self-hosted PISTON_API_URL in server/.env.`,
        code: 1
      });
    }
  } catch (err) {
    console.error('Execution handler error:', err.message);
    return res.status(500).json({
      message: 'Code execution error',
      stdout: '',
      stderr: err.message
    });
  }
}

/**
 * Fetches user progress, mistake trends, and fluency score for Dashboard
 */
export async function handleGetProgress(req, res) {
  try {
    const { userId } = req.params;
    const effectiveUser = await resolveUser(req);
    const targetUserId = userId === 'me' ? effectiveUser._id : userId;

    // 1. Get mistake trends over last 30 days
    const mistakeTrends = await getMistakeTrends(targetUserId, 30);

    // 2. Fetch recent sessions
    const sessions = await Session.find({ userId: targetUserId })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    // 3. Hints used trend per session
    const hintsUsedTrend = sessions.slice(0, 20).reverse().map((s, index) => ({
      sessionIndex: index + 1,
      title: s.title || `Session ${index + 1}`,
      hintsUsed: s.hintsUsed || 0,
      hintTier: s.hintTier || 0,
      solved: s.solved || false,
      date: new Date(s.createdAt).toLocaleDateString()
    }));

    // 4. Mistake category distribution
    const topPatterns = await getRecurringPatterns(targetUserId, null, 10);

    // 5. Problems solved count & stats
    const totalSessions = sessions.length;
    const problemsSolved = sessions.filter((s) => s.solved).length;
    const successRate = totalSessions > 0 ? problemsSolved / totalSessions : 0;

    // 6. Fluency score calculation
    let mistakeDeclineScore = 0.5;
    if (mistakeTrends.length >= 4) {
      const half = Math.floor(mistakeTrends.length / 2);
      const earlyMistakes = mistakeTrends.slice(0, half).reduce((sum, d) => sum + (d.total || 0), 0) / half;
      const recentMistakes = mistakeTrends.slice(half).reduce((sum, d) => sum + (d.total || 0), 0) / (mistakeTrends.length - half);
      if (earlyMistakes > 0) {
        mistakeDeclineScore = Math.min(1, Math.max(0.1, (earlyMistakes - recentMistakes) / earlyMistakes + 0.5));
      }
    }

    let hintDeclineScore = 0.5;
    if (sessions.length >= 4) {
      const half = Math.floor(sessions.length / 2);
      const recentSessions = sessions.slice(0, half);
      const olderSessions = sessions.slice(half);
      const avgRecentHints = recentSessions.reduce((sum, s) => sum + (s.hintsUsed || 0), 0) / recentSessions.length;
      const avgOlderHints = olderSessions.reduce((sum, s) => sum + (s.hintsUsed || 0), 0) / olderSessions.length;
      if (avgOlderHints > 0) {
        hintDeclineScore = Math.min(1, Math.max(0.1, (avgOlderHints - avgRecentHints) / avgOlderHints + 0.5));
      }
    }

    const volumeScore = Math.min(1, totalSessions / 10);

    const fluencyScore = Math.round(
      (successRate * 35 + mistakeDeclineScore * 30 + hintDeclineScore * 25 + volumeScore * 10) * 10
    ) / 10;

    const difficultyAssessment = await assessDifficulty(targetUserId);

    return res.json({
      fluencyScore: Math.min(100, Math.max(10, Math.round(fluencyScore))),
      problemsSolved,
      totalSessions,
      successRate: Math.round(successRate * 100),
      currentDifficulty: difficultyAssessment.level,
      difficultyMetrics: difficultyAssessment.metrics,
      mistakeTrends,
      hintsUsedTrend,
      categoryDistribution: topPatterns.topUserPatterns || []
    });
  } catch (err) {
    console.error('Error fetching progress:', err);
    return res.status(500).json({ message: 'Failed to fetch progress metrics', error: err.message });
  }
}

/**
 * Get or create current active session (Blank IDE by default)
 */
export async function getActiveSession(req, res) {
  try {
    const user = await resolveUser(req);
    const userId = user._id;

    let session = await Session.findOne({ userId, solved: false }).sort({ updatedAt: -1 });

    if (!session) {
      session = new Session({
        userId,
        language: 'javascript',
        title: 'Blank Coding Workspace',
        problemDescription: '',
        code: '// Write your code here, or ask your AI Tutor in the chat to explain a concept and suggest exercises!',
        startedAt: new Date()
      });
      await session.save();
    }

    return res.json({ session });
  } catch (err) {
    console.error('Error fetching active session:', err);
    return res.status(500).json({ message: 'Failed to retrieve session', error: err.message });
  }
}

/**
 * Creates a brand new clean blank workspace session for the chosen language
 */
export async function handleCreateNewSession(req, res) {
  try {
    const { language = 'javascript' } = req.body;
    const user = await resolveUser(req);
    const userId = user._id;

    // Mark previous unsolved sessions as solved or archived so they don't persist
    await Session.updateMany(
      { userId, solved: false },
      { $set: { solved: true, solvedAt: new Date() } }
    );

    const blankStarters = {
      javascript: '// 💡 Blank JavaScript Workspace\n// Ask your AI Tutor in chat to explain concepts and suggest practice problems!\n',
      python: '# 💡 Blank Python Workspace\n# Ask your AI Tutor in chat to explain concepts and suggest practice problems!\n',
      java: '// 💡 Blank Java Workspace\n// Ask your AI Tutor in chat to explain concepts and suggest practice problems!\npublic class Main {\n    public static void main(String[] args) {\n        \n    }\n}\n',
      cpp: '// 💡 Blank C++ Workspace\n// Ask your AI Tutor in chat to explain concepts and suggest practice problems!\n#include <iostream>\n\nint main() {\n    \n    return 0;\n}\n'
    };

    const starterCode = blankStarters[language.toLowerCase()] || blankStarters.javascript;

    const newSession = new Session({
      userId,
      language,
      title: 'Blank Coding Workspace',
      problemDescription: '',
      code: starterCode,
      startedAt: new Date()
    });

    await newSession.save();
    console.log(`✨ [Session] Created brand new clean session (${language}) for user ${user.username}`);

    return res.json({ session: newSession });
  } catch (err) {
    console.error('Error creating new session:', err);
    return res.status(500).json({ message: 'Failed to create new session', error: err.message });
  }
}


/**
 * Mark session as solved
 */
export async function markSessionSolved(req, res) {
  try {
    const { sessionId } = req.body;
    const user = await resolveUser(req);
    const userId = user._id;

    const session = await Session.findOne({ _id: sessionId });
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    session.solved = true;
    session.solvedAt = new Date();
    const duration = Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000);
    session.durationSeconds = duration;
    await session.save();

    const difficultyAssessment = await assessDifficulty(userId);

    return res.json({
      message: 'Problem marked as solved! Great job.',
      solved: true,
      durationSeconds: duration,
      difficultyLevel: difficultyAssessment.level
    });
  } catch (err) {
    console.error('Error marking session solved:', err);
    return res.status(500).json({ message: 'Failed to update session', error: err.message });
  }
}
