import { IAIProvider, IAIGenerateOptions, IAITextResponse, IAIStructuredResponse, IAIHealthStatus } from './ai.interface.js';
import { geminiProvider } from './gemini.provider.js';
import { getAIConfig } from '../../config/ai.config.js';

export class AIService {
  private provider: IAIProvider;

  constructor(provider?: IAIProvider) {
    this.provider = provider || geminiProvider;
  }

  public setProvider(provider: IAIProvider): void {
    this.provider = provider;
  }

  public getProviderName(): string {
    return this.provider.providerName;
  }

  public getModelName(): string {
    return this.provider.modelName;
  }

  public isConfigured(): boolean {
    return this.provider.isConfigured();
  }

  public async getHealth(): Promise<IAIHealthStatus> {
    return await this.provider.checkHealth();
  }

  public async testConnection(testPrompt = 'Respond with the word OK.'): Promise<{
    status: 'connected';
    provider: string;
    model: string;
    latencyMs: number;
    response: string;
  }> {
    const result = await this.provider.generateText(testPrompt, {
      temperature: 0.2,
      maxOutputTokens: 200,
    });

    return {
      status: 'connected',
      provider: this.provider.providerName,
      model: result.model,
      latencyMs: result.latencyMs,
      response: result.text.trim(),
    };
  }

  public async generateText(prompt: string, options?: IAIGenerateOptions): Promise<IAITextResponse> {
    return await this.provider.generateText(prompt, options);
  }

  public async generateStructured<T>(prompt: string, options?: IAIGenerateOptions): Promise<IAIStructuredResponse<T>> {
    return await this.provider.generateStructuredOutput<T>(prompt, options);
  }
}

export const aiService = new AIService();
