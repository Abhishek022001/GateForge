import { getAIConfig } from '../../config/ai.config.js';
import {
  AIConfigurationError,
  AIAuthenticationError,
  AIRateLimitError,
  AITimeoutError,
  AIError,
  IAIProvider,
  IAIGenerateOptions,
  IAITextResponse,
  IAIStructuredResponse,
  IAIHealthStatus,
} from './ai.interface.js';
import { parseStructuredJson } from './structuredParser.js';

const FALLBACK_CHAIN: string[] = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b',
];

function sanitizeErrorMessage(rawMessage: string): string {
  if (!rawMessage || typeof rawMessage !== 'string') return 'An unexpected AI service error occurred.';
  return rawMessage
    .replace(/gsk_[a-zA-Z0-9_\-]+/gi, 'gsk_[REDACTED_KEY]')
    .replace(/key=[a-zA-Z0-9_\-]+/gi, 'key=[REDACTED]')
    .replace(/bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED]');
}

export class GroqProvider implements IAIProvider {
  public readonly providerName = 'groq';
  private endpoint = 'https://api.groq.com/openai/v1/chat/completions';
  private _activeModel: string | null = null;

  public get modelName(): string {
    if (this._activeModel) return this._activeModel;
    const config = getAIConfig();
    return config.model || 'openai/gpt-oss-120b';
  }

  public get apiKey(): string {
    const config = getAIConfig();
    return config.apiKey || '';
  }

  public isConfigured(): boolean {
    const key = this.apiKey;
    return Boolean(key && key.length > 5);
  }

  private ensureApiKey(): string {
    if (!this.isConfigured()) {
      throw new AIConfigurationError('Groq API key is not configured. Please set GROQ_API_KEY in backend/.env');
    }
    return this.apiKey;
  }

  private mapError(err: any, status?: number): AIError {
    if (err instanceof AIError) return err;

    if (err?.name === 'AbortError') {
      return new AITimeoutError('Groq API request timed out.');
    }

    if (status === 401) {
      return new AIAuthenticationError('Invalid Groq API Key or unauthorized access.');
    }

    if (status === 429) {
      return new AIRateLimitError('Groq API rate limit exceeded. Please try again shortly.', 30);
    }

    const msg = sanitizeErrorMessage(err?.message || String(err));
    return new AIError(`Groq API Error: ${msg}`, 'AI_PROVIDER_ERROR', status || 500);
  }

  public async generateText(prompt: string, options: IAIGenerateOptions = {}): Promise<IAITextResponse> {
    const apiKey = this.ensureApiKey();
    const config = getAIConfig();
    const model = this.modelName;
    const timeoutMs = options.timeoutMs || config.timeoutMs || 25000;
    const maxRetries = Math.min(2, config.maxRetries || 1);
    const startTime = Date.now();

    console.log(`[AI:Groq] Text generation started (model: ${model})`);

    const messages: Array<{ role: string; content: string }> = [];
    if (options.systemInstruction) {
      messages.push({ role: 'system', content: options.systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });

    const payload = {
      model,
      messages,
      temperature: options.temperature !== undefined ? options.temperature : (config.temperature || 0.7),
      max_tokens: options.maxOutputTokens || 4096,
    };

    let lastError: any = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        console.log(`[AI:Groq] Retrying request (attempt ${attempt + 1}/${maxRetries + 1})...`);
        await new Promise((r) => setTimeout(r, 600 * attempt));
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!res.ok) {
          const errBody: any = await res.json().catch(() => ({}));
          const errMsg = errBody?.error?.message || `HTTP ${res.status} ${res.statusText}`;

          // Auto-fallback across supported Groq models if model is rate-limited (429) or inaccessible (404)
          if (
            res.status === 429 ||
            res.status === 404 ||
            errMsg.includes('does not exist') ||
            errMsg.includes('access') ||
            errMsg.includes('rate_limit') ||
            errMsg.includes('Rate limit') ||
            errMsg.includes('tokens per minute') ||
            errMsg.includes('TPM')
          ) {
            const currentIdx = FALLBACK_CHAIN.indexOf(payload.model);
            const nextModel = FALLBACK_CHAIN[(currentIdx + 1) % FALLBACK_CHAIN.length];
            if (nextModel && nextModel !== payload.model) {
              console.warn(`[AI:Groq] Model ${payload.model} rate-limited or unavailable (HTTP ${res.status}). Auto-rotating to ${nextModel}...`);
              this._activeModel = nextModel;
              payload.model = nextModel;
              continue;
            }
          }

          const mappedErr = this.mapError(new Error(errMsg), res.status);
          if (res.status === 429 || res.status >= 500) {
            lastError = mappedErr;
            if (attempt < maxRetries) continue;
          }
          throw mappedErr;
        }

        const data = await res.json() as any;
        const latencyMs = Date.now() - startTime;
        const text = data.choices?.[0]?.message?.content || '';

        console.log(`[AI:Groq] Request completed in ${latencyMs}ms (model: ${payload.model})`);

        return {
          text,
          model: payload.model,
          latencyMs,
        };
      } catch (err: any) {
        clearTimeout(timer);
        lastError = err;
        if (err?.name !== 'AbortError' && attempt === maxRetries) {
          break;
        }
      }
    }

    const latencyMs = Date.now() - startTime;
    console.error(`[AI:Groq] Request failed after ${latencyMs}ms:`, sanitizeErrorMessage(lastError?.message || lastError));
    throw this.mapError(lastError);
  }

  public async generateStructuredOutput<T>(prompt: string, options: IAIGenerateOptions = {}): Promise<IAIStructuredResponse<T>> {
    const apiKey = this.ensureApiKey();
    const config = getAIConfig();
    const model = this.modelName;
    const timeoutMs = options.timeoutMs || config.timeoutMs || 25000;
    const maxRetries = Math.min(2, config.maxRetries || 1);
    const startTime = Date.now();

    console.log(`[AI:Groq] Structured generation started (model: ${model})`);

    const messages: Array<{ role: string; content: string }> = [];
    const systemInst = (options.systemInstruction ? options.systemInstruction + '\n\n' : '') +
      'CRITICAL: Return valid, well-formed JSON ONLY. No markdown fences, no conversational prose, no markdown codeblocks.';
    messages.push({ role: 'system', content: systemInst });
    messages.push({ role: 'user', content: prompt });

    const payload = {
      model,
      messages,
      temperature: options.temperature !== undefined ? options.temperature : (config.temperature || 0.7),
      max_tokens: options.maxOutputTokens || 4096,
      response_format: { type: 'json_object' },
    };

    let lastError: any = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        console.log(`[AI:Groq] Retrying structured request (attempt ${attempt + 1}/${maxRetries + 1})...`);
        await new Promise((r) => setTimeout(r, 600 * attempt));
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!res.ok) {
          const errBody: any = await res.json().catch(() => ({}));
          const errMsg = errBody?.error?.message || `HTTP ${res.status} ${res.statusText}`;

          // Auto-fallback across supported Groq models if model is rate-limited (429) or inaccessible (404)
          if (
            res.status === 429 ||
            res.status === 404 ||
            errMsg.includes('does not exist') ||
            errMsg.includes('access') ||
            errMsg.includes('rate_limit') ||
            errMsg.includes('Rate limit') ||
            errMsg.includes('tokens per minute') ||
            errMsg.includes('TPM')
          ) {
            const currentIdx = FALLBACK_CHAIN.indexOf(payload.model);
            const nextModel = FALLBACK_CHAIN[(currentIdx + 1) % FALLBACK_CHAIN.length];
            if (nextModel && nextModel !== payload.model) {
              console.warn(`[AI:Groq] Model ${payload.model} rate-limited or unavailable (HTTP ${res.status}). Auto-rotating to ${nextModel}...`);
              this._activeModel = nextModel;
              payload.model = nextModel;
              continue;
            }
          }

          const mappedErr = this.mapError(new Error(errMsg), res.status);
          if (res.status === 429 || res.status >= 500) {
            lastError = mappedErr;
            if (attempt < maxRetries) continue;
          }
          throw mappedErr;
        }

        const data = await res.json() as any;
        const latencyMs = Date.now() - startTime;
        const text = data.choices?.[0]?.message?.content || '';

        const parsed = parseStructuredJson<T>(text);

        console.log(`[AI:Groq] Structured request succeeded in ${latencyMs}ms (model: ${payload.model})`);

        return {
          data: parsed,
          rawText: text,
          model: payload.model,
          latencyMs,
        };
      } catch (err: any) {
        clearTimeout(timer);
        lastError = err;
        if (err?.name !== 'AbortError' && attempt === maxRetries) {
          break;
        }
      }
    }

    const latencyMs = Date.now() - startTime;
    console.error(`[AI:Groq] Structured request failed after ${latencyMs}ms:`, sanitizeErrorMessage(lastError?.message || lastError));
    throw this.mapError(lastError);
  }

  public async checkHealth(): Promise<IAIHealthStatus> {
    const configured = this.isConfigured();
    if (!configured) {
      return {
        configured: false,
        provider: this.providerName,
        model: this.modelName,
        status: 'not_configured',
        details: 'GROQ_API_KEY is not set.',
      };
    }

    return {
      configured: true,
      provider: this.providerName,
      model: this.modelName,
      status: 'ready',
    };
  }
}

export const groqProvider = new GroqProvider();
