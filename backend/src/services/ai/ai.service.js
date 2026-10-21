import { geminiProvider } from './gemini.provider.js';
import { groqProvider } from './groq.provider.js';
import { getAIConfig } from '../../config/ai.config.js';

export class AIService {
  constructor(provider) {
    this._customProvider = provider || null;
  }

  get provider() {
    if (this._customProvider) return this._customProvider;
    const config = getAIConfig();
    if (config.provider === 'groq') {
      return groqProvider;
    }
    return geminiProvider;
  }

  setProvider(provider) {
    this._customProvider = provider;
  }

  getProviderName() {
    return this.provider.providerName;
  }

  getModelName() {
    return this.provider.modelName;
  }

  isConfigured() {
    return this.provider.isConfigured();
  }

  async getHealth() {
    return await this.provider.checkHealth();
  }

  async testConnection(testPrompt = 'Respond with the word OK.') {
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

  async generateText(prompt, options) {
    return await this.provider.generateText(prompt, options);
  }

  async generateStructured(prompt, options) {
    return await this.provider.generateStructuredOutput(prompt, options);
  }
}

export const aiService = new AIService();
