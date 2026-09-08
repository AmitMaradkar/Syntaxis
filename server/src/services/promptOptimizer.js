import { callQwen, parseThinkingOutput, isQwenAvailable } from './qwenService.js';
import { callLLM } from './llmService.js';
import {
  buildDecompositionPrompt,
  buildSequentialStepPrompt
} from '../prompts/optimizerPrompts.js';

/**
 * Decomposes a complex student question into structured, progressive sub-problems
 * using Qwen3-4B-Thinking (Least-to-Most decomposition stage).
 */
export async function decomposeQuestion({ question, language = 'javascript', difficulty = 'beginner' }) {
  const qwenReady = await isQwenAvailable();
  if (!qwenReady) {
    return { isComplex: false, subQuestions: [] };
  }

  const { systemPrompt, userPrompt } = buildDecompositionPrompt({ question, language, difficulty });

  try {
    const rawOutput = await callQwen({
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 500,
      temperature: 0.1
    });

    if (!rawOutput) {
      return { isComplex: false, subQuestions: [] };
    }

    const { finalContent } = parseThinkingOutput(rawOutput);
    const jsonMatch = finalContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        isComplex: parsed.isComplex !== false && Array.isArray(parsed.subQuestions) && parsed.subQuestions.length > 1,
        subQuestions: parsed.subQuestions || [],
        pedagogicalGoal: parsed.pedagogicalGoal || ''
      };
    }
  } catch (err) {
    console.warn('[PromptOptimizer] Question decomposition error:', err.message);
  }

  return { isComplex: false, subQuestions: [] };
}

/**
 * Executes the Least-to-Most sequential solving chain:
 * 1. Takes the decomposed sub-problems from Qwen3
 * 2. Solves each progressively via Gemini, chaining previous answers
 * 3. Returns the synthesized holistic tutorial response
 */
export async function executeLeastToMostChain({
  question,
  language = 'javascript',
  subQuestions = [],
  pedagogicalGoal = '',
  difficulty = 'beginner'
}) {
  const stepSolutions = [];

  for (let i = 0; i < subQuestions.length; i++) {
    const subQ = subQuestions[i];
    const { systemPrompt, userPrompt } = buildSequentialStepPrompt({
      originalQuestion: question,
      currentSubQuestion: subQ,
      stepIndex: i,
      totalSteps: subQuestions.length,
      previousAnswers: stepSolutions,
      language
    });

    const stepResult = await callLLM({
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 1000,
      temperature: 0.2
    });

    stepSolutions.push(stepResult.trim());
  }

  // Synthesize into a well-structured final master tutorial
  const finalMarkdown = [
    `### 🎯 Guided Breakdown: ${pedagogicalGoal || question}`,
    `> Applying **Least-to-Most** progression to build intuitive understanding from first principles.`,
    '',
    ...subQuestions.map((sq, idx) => {
      return `#### 🔹 Step ${idx + 1}: ${sq.replace(/^\d+\.\s*/, '')}\n\n${stepSolutions[idx] || ''}\n`;
    }),
    `---`,
    `💡 **Key Takeaway:** Always master the foundational boundary or data structure before building out full algorithmic logic.`
  ].join('\n\n');

  return finalMarkdown;
}
