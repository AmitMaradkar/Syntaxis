import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const QWEN_MODEL = process.env.QWEN_MODEL || 'qwen3:4b';
const QWEN_ENABLED = process.env.QWEN_ENABLED === 'true' || process.env.QWEN_ENABLED === true;

/**
 * Checks whether Ollama / Qwen model endpoint is reachable and responsive
 */
export async function isQwenAvailable() {
  if (!QWEN_ENABLED) return false;
  try {
    const res = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, { timeout: 1500 });
    if (res.status === 200 && res.data && Array.isArray(res.data.models)) {
      const hasModel = res.data.models.some(
        (m) => m.name && (m.name.includes('qwen') || m.name.includes(QWEN_MODEL))
      );
      return hasModel || res.data.models.length > 0;
    }
    return false;
  } catch (err) {
    return false;
  }
}

/**
 * Parses out <think>...</think> reasoning tags from Qwen3-Thinking outputs
 */
export function parseThinkingOutput(rawText) {
  if (!rawText) return { reasoning: '', finalContent: '' };

  const thinkRegex = /<think>([\s\S]*?)<\/think>/i;
  const match = rawText.match(thinkRegex);

  if (match) {
    const reasoning = match[1].trim();
    const finalContent = rawText.replace(thinkRegex, '').trim();
    return { reasoning, finalContent };
  }

  // If only closing </think> appears
  if (rawText.includes('</think>')) {
    const parts = rawText.split('</think>');
    return {
      reasoning: parts[0].replace('<think>', '').trim(),
      finalContent: parts.slice(1).join('</think>').trim()
    };
  }

  return { reasoning: '', finalContent: rawText.trim() };
}

/**
 * Execute chat completion with Qwen3 via Ollama's API
 */
export async function callQwen({
  systemPrompt,
  messages,
  maxTokens = 1500,
  temperature = 0.2
}) {
  const available = await isQwenAvailable();

  if (!available) {
    return null;
  }

  try {
    const formattedMessages = [];
    if (systemPrompt) {
      formattedMessages.push({ role: 'system', content: systemPrompt });
    }
    for (const msg of messages) {
      formattedMessages.push({
        role: msg.role === 'assistant' || msg.role === 'model' ? 'assistant' : 'user',
        content: msg.content
      });
    }

    const payload = {
      model: QWEN_MODEL,
      messages: formattedMessages,
      stream: false,
      options: {
        temperature,
        num_predict: maxTokens
      }
    };

    const response = await axios.post(`${OLLAMA_BASE_URL}/api/chat`, payload, {
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' }
    });

    const outputText = response.data?.message?.content || '';
    return outputText;
  } catch (err) {
    console.warn(`[Qwen3 Service] Request to Ollama failed (${err.message}).`);
    return null;
  }
}
