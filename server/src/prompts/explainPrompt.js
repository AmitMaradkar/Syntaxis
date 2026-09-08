/**
 * Explain-Why Prompt Template
 * Requires LLM to answer 3 core questions for mistakes:
 * 1. What's wrong (grounded in user's submitted code, quoting exact lines/vars)
 * 2. Why it happens (underlying concept/mechanism)
 * 3. Mental model to prevent it next time
 */

export function buildExplainWhyPrompt({ code, language, errorDescription, snippet, line, difficulty = 'beginner', mistakePatternContext = '' }) {
  const depthInstruction = {
    beginner: 'Keep concepts approachable, use intuitive analogies, explain any tricky jargon simply.',
    intermediate: 'Be precise about runtime mechanics, memory, semantics, and standard idiomatic patterns.',
    advanced: 'Deep dive into language specifications, internal engine behavior, performance tradeoffs, and architectural design.'
  }[difficulty] || 'Keep concepts approachable.';

  const patternBlock = mistakePatternContext
    ? `\n[HISTORICAL PATTERN CONTEXT]\n${mistakePatternContext}\nDirectly relate this mistake to their known habit if applicable!\n`
    : '';

  const userPrompt = `Language: ${language}
${line ? `Target Line: ${line}` : ''}
${errorDescription ? `Issue: ${errorDescription}` : ''}
${snippet ? `Code Snippet:\n\`\`\`${language}\n${snippet}\n\`\`\`` : ''}

Full Code:
\`\`\`${language}
${code}
\`\`\`

Provide the "Explain-Why" analysis following the required 3-part structure.`;

  const systemPrompt = `You are an elite, empathetic AI Coding Tutor.
Your goal is not just to fix code, but to build durable developer intuition and mental models.

${patternBlock}
Difficulty Level: ${difficulty.toUpperCase()}
Instruction Depth: ${depthInstruction}

Format your response using clear markdown with these exact three sections:

### 1. What's Wrong
- Pinpoint the exact line or variable from the student's code.
- Quote their exact code: \`example_code()\`.
- Clearly describe what the current code actually does vs. what was intended.

### 2. Why It Happens
- Unpack the underlying computing concept or language rule that caused this behavior.
- Explain the mechanism step-by-step (e.g. how the call stack, pointers, reference equality, loop bounds, or types work in ${language}).

### 3. Mental Model to Remember
- Provide a memorable rule of thumb, analogy, or mental checklist the developer can use before writing similar code in the future.
- One actionable self-check question they can ask themselves next time.

Tone: Encouraging, concise, laser-focused on teaching. Do not lecture unnecessarily.`;

  return { systemPrompt, userPrompt };
}
