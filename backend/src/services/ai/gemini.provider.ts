import { GoogleGenAI } from '@google/genai';
import { getAIConfig, isAIConfigured } from '../../config/ai.config.js';
import {
  IAIProvider,
  IAIGenerateOptions,
  IAITextResponse,
  IAIStructuredResponse,
  IAIHealthStatus,
  AIConfigurationError,
  AIAuthenticationError,
  AIRateLimitError,
  AIQuotaExceededError,
  AITimeoutError,
  AIError,
} from './ai.interface.js';
import { parseStructuredJson } from './structuredParser.js';

/**
 * Sanitizes error messages to ensure no API keys, credentials, or sensitive headers are exposed.
 */
function sanitizeErrorMessage(rawMessage: string): string {
  if (!rawMessage || typeof rawMessage !== 'string') return 'An unexpected AI service error occurred.';
  return rawMessage
    .replace(/key=[a-zA-Z0-9_\-]+/gi, 'key=[REDACTED]')
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]')
    .replace(/bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED]')
    .replace(/AQ\.[a-zA-Z0-9_\-]+/g, '[REDACTED_TOKEN]');
}

export class GeminiProvider implements IAIProvider {
  public readonly providerName = 'gemini';
  private client: GoogleGenAI | null = null;
  private currentApiKey: string = '';

  constructor() {
    this.initClient();
  }

  get modelName(): string {
    return getAIConfig().model;
  }

  private initClient(): void {
    const config = getAIConfig();
    if (config.apiKey && config.apiKey !== this.currentApiKey) {
      try {
        this.client = new GoogleGenAI({ apiKey: config.apiKey });
        this.currentApiKey = config.apiKey;
      } catch (err: any) {
        console.error('[AI] Failed to initialize GoogleGenAI client:', sanitizeErrorMessage(err.message));
        this.client = null;
      }
    }
  }

  public isConfigured(): boolean {
    return isAIConfigured();
  }

  private ensureClient(): GoogleGenAI {
    this.initClient();
    if (!this.client || !this.isConfigured()) {
      throw new AIConfigurationError('Gemini API key is not configured. Please set GEMINI_API_KEY in backend/.env');
    }
    return this.client;
  }

  public parseRetryDelay(err: any): number | undefined {
    // 1. Check err.details for RetryInfo (e.g. { retryDelay: "48s" })
    if (Array.isArray(err?.details)) {
      for (const d of err.details) {
        if (d?.['@type']?.includes('RetryInfo') && d.retryDelay) {
          const match = String(d.retryDelay).match(/^([\d.]+)s?$/i);
          if (match) {
            const val = Math.round(parseFloat(match[1]));
            if (!isNaN(val) && val > 0) return val;
          }
        }
      }
    }

    // 2. Check err.message / string for "retry in Xs" or "retry after Xs"
    const raw = err?.message || String(err || '');
    const match = raw.match(/retry (?:in|after) ([\d.]+)s/i);
    if (match) {
      const val = Math.round(parseFloat(match[1]));
      if (!isNaN(val) && val > 0) return val;
    }

    return undefined;
  }

  private mapError(err: any): AIError {
    const rawMsg = err?.message || String(err);
    const sanitized = sanitizeErrorMessage(rawMsg);

    if (
      sanitized.includes('API_KEY_INVALID') ||
      sanitized.includes('API key not valid') ||
      sanitized.includes('UNAUTHENTICATED') ||
      err?.status === 401 ||
      err?.status === 403
    ) {
      return new AIAuthenticationError('Invalid Gemini API Key or authentication failed.');
    }
    const lowerSanitized = sanitized.toLowerCase();
    const isRateOrQuota =
      err?.status === 429 ||
      err?.statusCode === 429 ||
      lowerSanitized.includes('resource_exhausted') ||
      lowerSanitized.includes('429') ||
      lowerSanitized.includes('quota') ||
      lowerSanitized.includes('rate limit') ||
      lowerSanitized.includes('too many requests');

    if (isRateOrQuota) {
      const retryDelay = this.parseRetryDelay(err);

      // Distinguish permanent daily/project quota exhaustion vs temporary/burst throttling
      const isDailyQuota =
        lowerSanitized.includes('limit: 500') ||
        lowerSanitized.includes('perday') ||
        lowerSanitized.includes('daily') ||
        lowerSanitized.includes('generaterequestsperday') ||
        (lowerSanitized.includes('daily quota') && !lowerSanitized.includes('perminute'));

      if (isDailyQuota) {
        // Daily quota exhausted: do NOT pretend it will recover in 60s
        return new AIQuotaExceededError(
          'The AI provider quota has been exhausted. Generation will become available again when the provider quota resets.',
          retryDelay // undefined unless provider explicitly specified a long reset window
        );
      }

      // Temporary / burst throttling (e.g. 15 RPM, "retry in 48s")
      return new AIRateLimitError(
        'AI generation is temporarily rate-limited. Please try again shortly.',
        retryDelay !== undefined ? retryDelay : 60 // Safe fallback: 60s
      );
    }
    if (
      sanitized.includes('timeout') ||
      sanitized.includes('aborted') ||
      err?.name === 'AbortError' ||
      err?.code === 'ETIMEDOUT'
    ) {
      return new AITimeoutError('Gemini API request timed out.');
    }

    return new AIError(`Gemini request failed: ${sanitized}`, 'AI_PROVIDER_ERROR', err?.status || 500);
  }

  /**
   * Only retry transient server errors (HTTP 503 / temporary demand spikes / socket drops).
   * Explicitly NEVER retry client errors (400, 401, 403, 404, parsing errors).
   */
  private isTransient(err: any): boolean {
    const status = err?.status;
    if (status === 400 || status === 401 || status === 403 || status === 404 || status === 422) {
      return false;
    }
    const msg = err?.message || String(err);
    return (
      msg.includes('503') ||
      msg.includes('high demand') ||
      msg.includes('UNAVAILABLE') ||
      msg.includes('ECONNRESET') ||
      msg.includes('ETIMEDOUT')
    );
  }

  public async generateText(prompt: string, options: IAIGenerateOptions = {}): Promise<IAITextResponse> {
    const client = this.ensureClient();
    const config = getAIConfig();
    const model = this.modelName;
    const timeoutMs = options.timeoutMs || config.timeoutMs;
    const maxRetries = Math.min(2, config.maxRetries);
    const startTime = Date.now();

    console.log(`[AI] Request started (provider: ${this.providerName}, model: ${model})`);

    let lastError: any = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        console.log(`[AI] Retrying transient request (attempt ${attempt + 1}/${maxRetries + 1})...`);
        await new Promise((r) => setTimeout(r, 800 * attempt));
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await client.models.generateContent({
          model,
          contents: prompt,
          config: {
            temperature: options.temperature !== undefined ? options.temperature : config.temperature,
            maxOutputTokens: options.maxOutputTokens,
            systemInstruction: options.systemInstruction,
            abortSignal: controller.signal,
          },
        });

        clearTimeout(timer);
        const latencyMs = Date.now() - startTime;
        const text =
          (typeof (response as any).text === 'function' ? (response as any).text() : response.text) ||
          (response as any).candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') ||
          '';

        console.log(`[AI] Request completed in ${latencyMs}ms (provider: ${this.providerName})`);

        return {
          text,
          model,
          latencyMs,
        };
      } catch (err: any) {
        clearTimeout(timer);
        lastError = err;
        if (!this.isTransient(err) || attempt === maxRetries) {
          break;
        }
      }
    }

    const latencyMs = Date.now() - startTime;
    console.error(`[AI] Request failed after ${latencyMs}ms:`, sanitizeErrorMessage(lastError?.message || lastError));
    throw this.mapError(lastError);
  }

  public async generateStructuredOutput<T>(
    prompt: string,
    options: IAIGenerateOptions = {}
  ): Promise<IAIStructuredResponse<T>> {
    const client = this.ensureClient();
    const config = getAIConfig();
    const model = this.modelName;
    const timeoutMs = options.timeoutMs || config.timeoutMs;
    const maxRetries = Math.min(2, config.maxRetries);
    const startTime = Date.now();

    console.log(`[AI] Structured request started (provider: ${this.providerName}, model: ${model})`);

    let lastError: any = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        console.log(`[AI] Retrying structured request (attempt ${attempt + 1}/${maxRetries + 1})...`);
        await new Promise((r) => setTimeout(r, 800 * attempt));
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await client.models.generateContent({
          model,
          contents: prompt,
          config: {
            temperature: options.temperature !== undefined ? options.temperature : config.temperature,
            maxOutputTokens: options.maxOutputTokens,
            systemInstruction: options.systemInstruction,
            responseMimeType: 'application/json',
            abortSignal: controller.signal,
          },
        });

        clearTimeout(timer);
        const latencyMs = Date.now() - startTime;
        const rawText =
          (typeof (response as any).text === 'function' ? (response as any).text() : response.text) ||
          (response as any).candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') ||
          '';
        const data = parseStructuredJson<T>(rawText);

        console.log(`[AI] Structured request completed in ${latencyMs}ms (provider: ${this.providerName})`);

        return {
          data,
          rawText,
          model,
          latencyMs,
        };
      } catch (err: any) {
        clearTimeout(timer);
        lastError = err;
        if (!this.isTransient(err) || attempt === maxRetries) {
          break;
        }
      }
    }

    const latencyMs = Date.now() - startTime;
    console.error(`[AI] Structured request failed after ${latencyMs}ms:`, sanitizeErrorMessage(lastError?.message || lastError));
    throw this.mapError(lastError);
  }

  public async checkHealth(): Promise<IAIHealthStatus> {
    const configured = this.isConfigured();
    const model = this.modelName;

    if (!configured) {
      return {
        configured: false,
        provider: this.providerName,
        model,
        status: 'not_configured',
        details: 'GEMINI_API_KEY is not set in environment variables.',
      };
    }

    return {
      configured: true,
      provider: this.providerName,
      model,
      status: 'ready',
    };
  }
}

export const geminiProvider = new GeminiProvider();
