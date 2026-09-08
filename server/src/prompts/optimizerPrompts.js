/**
 * System and task prompts for Least-to-Most decomposition and synthesis
 */

export function buildDecompositionPrompt({ question, language = 'javascript', difficulty = 'beginner' }) {
  const systemPrompt = `You are an expert computational pedagogue.
Your objective is to apply "Least-to-Most" prompting decomposition to complex programming questions.
Break down the student's question or task into 2 to 4 progressive, ordered sub-problems:
- Sub-problem 1 must be the simplest foundational concept or invariant needed (the "Least").
- Intermediate sub-problems connect the concept to the data structure or logic.
- The final sub-problem arrives at the full implementation/answer (the "Most").

Output strictly a JSON object with this format:
{
  "isComplex": true, // false if question is trivial, greeting, or 1-liner
  "subQuestions": [
    "1. Simplest foundational concept",
    "2. How to apply it to data/state",
    "3. Complete implementation or edge-case handling"
  ],
  "pedagogicalGoal": "One sentence summary of the core insight the student should gain"
}
Do not include any other markdown or conversational filler outside the JSON.`;

  const userPrompt = `Target Language: ${language}
Difficulty Level: ${difficulty}
Student Question:
"""
${question}
"""`;

  return { systemPrompt, userPrompt };
}

export function buildSequentialStepPrompt({
  originalQuestion,
  currentSubQuestion,
  stepIndex,
  totalSteps,
  previousAnswers,
  language = 'javascript'
}) {
  const previousContext = previousAnswers && previousAnswers.length > 0
    ? `\nPrior Sub-problem Insights:\n${previousAnswers.map((a, i) => `[Step ${i + 1} Solution]: ${a}`).join('\n\n')}\n`
    : '';

  const systemPrompt = `You are a Socratic AI Tutor solving a multi-step learning path using Least-to-Most reasoning.
You are addressing Step ${stepIndex + 1} of ${totalSteps}.
Build directly upon the prior steps. Keep explanations crisp, pedagogical, and focused on intuition.
Language: ${language}`;

  const userPrompt = `Original Overall Question: "${originalQuestion}"
${previousContext}
Current Step (${stepIndex + 1}/${totalSteps}) to address:
${currentSubQuestion}

Explain this step clearly, providing code or visual mental models as appropriate.`;

  return { systemPrompt, userPrompt };
}
