import { geminiProvider } from './gemini.provider.js';

export class AIService {
  constructor(provider) {
    this.provider = provider || geminiProvider;
  }

  setProvider(provider) {
    this.provider = provider;
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
