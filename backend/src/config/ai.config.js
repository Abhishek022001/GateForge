import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

export function getAIConfig() {
  const apiKey = (process.env.GROQ_API_KEY || '').trim();
  const provider = 'groq';
  const model = (process.env.AI_MODEL || 'llama-3.3-70b-versatile').trim();
  const timeoutMs = Math.max(1000, parseInt(process.env.AI_REQUEST_TIMEOUT_MS || '25000', 10) || 25000);
  const maxRetries = Math.max(0, parseInt(process.env.AI_MAX_RETRIES || '2', 10) || 2);
  const temperature = 0.7;

  return {
    apiKey,
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
