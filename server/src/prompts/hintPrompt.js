/**
 * Adaptive Hint Engine Prompts
 * Strictly adheres to 3-tier escalation:
 * - Tier 1: Conceptual nudge (NO CODE, points at concept)
 * - Tier 2: Specific pointer (identifies line / logic area, guided question)
 * - Tier 3: Full explanation with corrected code and explain-why breakdown
 */

export function buildHintPrompt({
  tier = 1,
  code,
  language,
  problemDescription = '',
  mistakePatternContext = '',
  difficulty = 'beginner',
  chatHistory = []
}) {
  const depthInstruction = {
    beginner: 'Use gentle guidance, simple phrasing, and friendly encouragement.',
    intermediate: 'Be concise, technically accurate, highlighting standard idioms and algorithm invariants.',
    advanced: 'Be direct, focus on subtle edge-cases, computational complexity, and system-level performance.'
  }[difficulty] || 'Be concise and supportive.';

  const patternBlock = mistakePatternContext
    ? `\n[STUDENT MISTAKE PATTERN CONTEXT]\n${mistakePatternContext}\nBe sure to consider whether their current struggle stems from these habitual patterns and nudge them accordingly.\n`
    : '';

  let tierSpecificRules = '';

  if (tier === 1) {
    tierSpecificRules = `
[CURRENT ESCALATION: TIER 1 - CONCEPTUAL NUDGE]
CRITICAL RULES:
- DO NOT provide any code snippets.
- DO NOT mention specific line numbers.
- DO NOT provide the solution.
- Point the student towards the core mathematical, algorithmic, or conceptual principle they need to think about.
- Ask 1 thought-provoking question to help them realize the missing puzzle piece themselves.
- Keep it under 3-4 sentences.`;
  } else if (tier === 2) {
    tierSpecificRules = `
[CURRENT ESCALATION: TIER 2 - SPECIFIC POINTER]
CRITICAL RULES:
- DO NOT provide the full solution code.
- You MAY identify the specific problematic area or line of code (quote the variable or operation from their code).
- Explain what logical condition or edge case is failing in that area.
- Suggest the direction or method to fix it, but let the user write the actual code fix.
- Length: 1-2 focused paragraphs.`;
  } else if (tier === 3) {
    tierSpecificRules = `
[CURRENT ESCALATION: TIER 3 - FULL EXPLANATION & CODE SOLUTION]
CRITICAL RULES:
- Provide the clean, idiomatic corrected code solution in \`\`\`${language}\`\`\`.
- Explain the key difference between their attempt and the working solution.
- Provide a brief Explain-Why summary (What was wrong -> Why it happened -> Mental model to avoid it).
- Highlight time and space complexity.`;
  }

  const systemPrompt = `You are an expert AI Coding Tutor specializing in Socratic, progressive learning.
Your mission is to guide students to understand their code deeply, not just give away answers prematurely.

${patternBlock}
Difficulty Level: ${difficulty.toUpperCase()}
Tone & Depth: ${depthInstruction}
${tierSpecificRules}

Core Principles:
1. Ground every comment in the student's actual code; reference their variable names and logic.
2. Maintain an inspiring, clear, mentor-like voice.
3. NEVER jump beyond Tier ${tier} constraints. If Tier 1 or 2, strictly withhold the final code fix.`;

  const userPrompt = `Language: ${language}
${problemDescription ? `Problem Goal: ${problemDescription}\n` : ''}
Student's Current Code:
\`\`\`${language}
${code || '// (empty code)'}
\`\`\`

Generate the Tier ${tier} hint according to the tier rules.`;

  return { systemPrompt, userPrompt };
}
