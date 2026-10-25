import dotenv from 'dotenv';
dotenv.config();

export interface IAIConfig {
  apiKey: string;
  provider: 'groq';
  model: string;
  timeoutMs: number;
  maxRetries: number;
  temperature: number;
}

export interface IAISafeConfig {
  configured: boolean;
  provider: string;
  model: string;
  timeoutMs: number;
}

export function getAIConfig(): IAIConfig {
  const apiKey = (process.env.GROQ_API_KEY || '').trim();
  const provider = 'groq';
  const model = (process.env.AI_MODEL || 'openai/gpt-oss-120b').trim();
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

export function isAIConfigured(): boolean {
  const config = getAIConfig();
  return Boolean(config.apiKey && config.apiKey.length > 5);
}

export function getAISafeConfig(): IAISafeConfig {
  const config = getAIConfig();
  return {
    configured: isAIConfigured(),
    provider: config.provider,
    model: config.model,
    timeoutMs: config.timeoutMs,
  };
}
