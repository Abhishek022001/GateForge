import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

export function getAIConfig() {
  const groqKey = (process.env.GROQ_API_KEY || '').trim();
  const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
  const explicitProvider = (process.env.AI_PROVIDER || '').trim().toLowerCase();

  let provider = 'gemini';
  let apiKey = geminiKey;
  let defaultModel = 'gemini-flash-lite-latest';

  // If GROQ_API_KEY is present or explicitly selected, use Groq for 10x faster inference
  if (explicitProvider === 'groq' || (!explicitProvider && groqKey)) {
    provider = 'groq';
    apiKey = groqKey;
    defaultModel = 'llama-3.3-70b-versatile';
  } else if (!apiKey && groqKey) {
    provider = 'groq';
    apiKey = groqKey;
    defaultModel = 'llama-3.3-70b-versatile';
  }

  const model = (process.env.AI_MODEL || defaultModel).trim();
  const timeoutMs = Math.max(1000, parseInt(process.env.AI_REQUEST_TIMEOUT_MS || '25000', 10) || 25000);
  const maxRetries = Math.max(0, parseInt(process.env.AI_MAX_RETRIES || '2', 10) || 2);
  const temperature = 0.7;

  return {
    apiKey,
    groqApiKey: groqKey,
    geminiApiKey: geminiKey,
    provider,
    model,
    timeoutMs,
    maxRetries,
    temperature,
  };
}

export function isAIConfigured() {
  const config = getAIConfig();
  return Boolean(config.apiKey && config.apiKey.length > 5);
}

export function getAISafeConfig() {
  const config = getAIConfig();
  return {
    configured: isAIConfigured(),
    provider: config.provider,
    model: config.model,
    timeoutMs: config.timeoutMs,
  };
}
