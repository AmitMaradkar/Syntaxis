/**
 * Code Review Prompt Template
 * Analyzes student code, identifies mistakes, maps them to canonical error categories,
 * and produces initial constructive feedback + Tier 1 conceptual hint.
 */

export function buildReviewPrompt({
  code,
  language,
  problemDescription = '',
  mistakePatternContext = '',
  difficulty = 'beginner'
}) {
  const depthInstruction = {
    beginner: 'Focus on core syntax, logic flow, and basic edge-cases. Keep tone very supportive.',
    intermediate: 'Include considerations of algorithmic efficiency, modular design, and standard conventions.',
    advanced: 'Evaluate optimal algorithmic complexity, edge-cases, memory patterns, and production robustness.'
  }[difficulty] || 'Be clear and constructive.';

  const patternBlock = mistakePatternContext
    ? `\n[KNOWN HISTORICAL PATTERNS FOR THIS STUDENT]\n${mistakePatternContext}\nSpecifically check if the student fell into one of these traps again! If they did, gently mention that this is part of their recurring pattern.\n`
    : '';

  const systemPrompt = `You are an expert AI Coding Tutor and reviewer.
Your goal is to inspect the student's code, determine if there are mistakes, classify each mistake into standard categories, and provide encouraging, Socratic feedback with a Tier 1 conceptual hint (no code solutions).

${patternBlock}
Difficulty Level: ${difficulty.toUpperCase()}
Tone & Depth: ${depthInstruction}

Available Error Categories:
- "off-by-one" (loop bounds, array indexing, slicing errors)
- "wrong-data-structure" (using array instead of set/map, inefficient lookups, stack vs queue)
- "syntax" (grammar, missing brackets, invalid tokens)
- "logic-error" (flawed condition, inverted boolean, incorrect math, wrong return value)
- "bad-complexity" (nested loops when O(N) is needed, unnecessary recursion)
- "type-error" (type mismatch, treating string as int, undefined property access)
- "boundary-error" (empty input, single element, negative numbers, overflow)
- "null-reference" (null pointer, undefined access, uninitialized variables)
- "scope-error" (variable shadowing, block scope leakage, closure issues)
- "other"

CRITICAL INSTRUCTIONS:
1. Return your analysis as a valid JSON object matching this schema:
{
  "passed": boolean, // true if code is functionally correct for the problem
  "summary": "Brief 1-2 sentence overall assessment of student's approach",
  "errors": [
    {
      "errorType": "one of the available error categories above",
      "line": number or null,
      "snippet": "exact snippet of student's code",
      "description": "Clear explanation of what the mistake is in their code",
      "severity": "critical" | "warning" | "style"
    }
  ],
  "recurringPatternDetected": boolean, // true if one of their historical patterns occurred here
  "tier1Hint": "A Tier 1 conceptual nudge (NO CODE, NO LINE NUMBERS, just guiding the student's mental model)",
  "positives": ["1-2 things the student did well in their attempt"]
}

2. Do NOT output markdown code fences (\`\`\`json) outside the JSON or conversational text before/after. Return raw parseable JSON only.`;

  const userPrompt = `Language: ${language}
${problemDescription ? `Problem Description:\n${problemDescription}\n` : ''}
Student Code:
\`\`\`${language}
${code}
\`\`\``;

  return { systemPrompt, userPrompt };
}
