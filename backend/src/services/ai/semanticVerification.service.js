/**
 * Independent Semantic Verification Service for AI-Generated Questions
 * Checkpoint 3C.4: Second-stage semantic verifier (ESM)
 */

import { aiService } from './ai.service.js';
import { AIError } from './ai.interface.js';
import { buildQuestionVerificationPrompt } from './prompts/verification.prompt.js';
import { validateSemanticVerificationOutput } from '../../validators/semanticVerificationValidator.js';

export class SemanticVerificationService {
  constructor(ai) {
    this.ai = ai || aiService;
  }

  /**
   * Performs independent semantic verification on a candidate question.
   */
  async verifyQuestion(question, options) {
    if (!this.ai.isConfigured()) {
      throw new AIError('AI provider is not configured. Please set GROQ_API_KEY.', 'AI_NOT_CONFIGURED', 503);
    }

    if (!question || typeof question !== 'object') {
      throw new AIError('Question to verify must be a valid object.', 'INVALID_VERIFICATION_INPUT', 400);
    }

    const payload = {
      question: question.question,
      questionType: question.questionType,
      options: question.options,
      correctAnswer: question.correctAnswer,
      numericalAnswer: question.numericalAnswer,
      explanation: question.explanation,
      subject: options?.requestedSubject || question.subject || 'Computer Science',
      topic: options?.requestedTopic || question.topic || 'Core Topic',
      subtopic: question.subtopic,
      concepts: options?.requestedConcepts && options.requestedConcepts.length > 0
        ? options.requestedConcepts
        : question.concepts,
      difficulty: options?.requestedDifficulty || question.difficulty || 'Medium',
      sourcePatternMetadata: options?.sourcePatternMetadata,
    };

    const prompt = buildQuestionVerificationPrompt(payload);

    let response;
    try {
      response = await this.ai.generateStructured(prompt, {
        temperature: 0.1,
        timeoutMs: 50000,
      });
    } catch (err) {
      if (err instanceof AIError) {
        throw err;
      }
      throw new AIError(`AI provider failed during verification: ${err.message}`, 'AI_PROVIDER_ERROR', 500);
    }

    const rawData = response.data;
    const validation = validateSemanticVerificationOutput(rawData);

    if (!validation.isValid || !validation.sanitized) {
      throw new AIError(
        `Verifier returned invalid or malformed response: ${validation.errors.join('; ')}`,
        'VERIFIER_RESPONSE_INVALID',
        502
      );
    }

    return {
      success: true,
      verification: validation.sanitized,
      latencyMs: response.latencyMs,
      provider: this.ai.getProviderName(),
      model: response.model,
    };
  }
}

export const semanticVerificationService = new SemanticVerificationService();
