import Session from '../models/Session.js';
import { callLLM } from './llmService.js';
import { buildHintPrompt } from '../prompts/hintPrompt.js';
import { getRecurringPatterns, buildPatternContext } from './mistakeTracker.js';
import { assessDifficulty, getDifficultyPromptModifier } from './difficultyEngine.js';

/**
 * Retrieves the current session and hint tier
 */
export async function getSessionHintState(sessionId) {
  const session = await Session.findById(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }
  return {
    tier: session.hintTier || 0,
    hintsUsed: session.hintsUsed || 0,
    history: session.hintsHistory || [],
    session
  };
}

/**
 * Generates a hint for a given tier (1, 2, or 3) with prompt construction,
 * injecting recurring patterns and difficulty level.
 */
export async function generateTierHint({
  tier,
  userId,
  sessionId,
  code,
  language,
  problemDescription
}) {
  if (tier < 1 || tier > 3) {
    throw new Error('Hint tier must be between 1 and 3');
  }

  // 1. Fetch mistake patterns to inject
  const patterns = await getRecurringPatterns(userId, sessionId, 3);
  const mistakePatternContext = buildPatternContext(patterns);

  // 2. Fetch difficulty level
  const difficultyAssessment = await assessDifficulty(userId);
  const difficultyLevel = difficultyAssessment.level;

  // 3. Build prompt
  const { systemPrompt, userPrompt } = buildHintPrompt({
    tier,
    code,
    language,
    problemDescription,
    mistakePatternContext,
    difficulty: difficultyLevel
  });

  // 4. Call LLM (Google Gemini)
  const hintContent = await callLLM({
    systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: tier === 3 ? 2000 : 800,
    temperature: 0.25
  });

  return {
    tier,
    content: hintContent,
    difficultyLevel,
    patternsInjected: !!mistakePatternContext,
    isMaxTier: tier >= 3
  };
}

/**
 * Escalate hint to next tier (never exceeding 3, never auto-jumping).
 * Accepts current code and language from client to ground hints in actual code.
 * Saves to Session model in DB.
 */
export async function escalateHint({
  userId,
  sessionId,
  code,
  language,
  problemDescription
}) {
  const session = await Session.findOne({ _id: sessionId, userId });
  if (!session) {
    throw new Error('Session not found or unauthorized');
  }

  // Check if code was updated from client
  const incomingCode = typeof code === 'string' ? code.trim() : null;
  const previousCode = (session.code || '').trim();
  const codeChanged = Boolean(incomingCode !== null && incomingCode !== previousCode);

  if (typeof code === 'string') {
    session.code = code;
  }
  if (language) {
    session.language = language;
  }
  if (problemDescription) {
    session.problemDescription = problemDescription;
  }

  let currentTier = session.hintTier || 0;

  // If student modified code after reaching max tier, allow fresh escalation from Tier 1
  if (codeChanged && currentTier >= 3) {
    currentTier = 0;
    session.hintsHistory = [];
  }

  if (currentTier >= 3) {
    return {
      tier: 3,
      isMaxTier: true,
      message: 'Maximum hint tier (Tier 3) already reached.',
      content: session.hintsHistory.find((h) => h.tier === 3)?.content || '',
      hintsUsed: session.hintsUsed || 0,
      hintsHistory: session.hintsHistory || []
    };
  }

  const nextTier = currentTier + 1;

  const hintResult = await generateTierHint({
    tier: nextTier,
    userId,
    sessionId: session._id,
    code: session.code,
    language: session.language,
    problemDescription: session.problemDescription
  });

  // Update session
  session.hintTier = nextTier;
  session.hintsUsed = (session.hintsUsed || 0) + 1;

  if (!session.hintsHistory) {
    session.hintsHistory = [];
  }
  // Replace existing entry for this tier if any, or append
  session.hintsHistory = session.hintsHistory.filter((h) => h.tier !== nextTier);
  session.hintsHistory.push({
    tier: nextTier,
    content: hintResult.content,
    timestamp: new Date()
  });

  await session.save();

  return {
    tier: nextTier,
    content: hintResult.content,
    hintsUsed: session.hintsUsed,
    isMaxTier: nextTier >= 3,
    difficultyLevel: hintResult.difficultyLevel,
    hintsHistory: session.hintsHistory
  };
}
