/**
 * Independent Semantic Verification Service for AI-Generated Questions
 * Checkpoint 3C.4: Second-stage semantic verifier
 */

import { AIService, aiService } from './ai.service.js';
import { AIError, IAIStructuredResponse } from './ai.interface.js';
import {
  buildQuestionVerificationPrompt,
  IQuestionVerificationPromptPayload,
  ISemanticVerificationResult,
} from './prompts/verification.prompt.js';
import { validateSemanticVerificationOutput } from '../../validators/semanticVerificationValidator.js';

export interface IQuestionToVerify {
  question: string;
  questionType: 'MCQ' | 'MSQ' | 'NAT';
  options?: Array<{ id: string; text: string }>;
  correctAnswer: string | string[] | number | any;
  numericalAnswer?: { min: number; max: number };
  explanation: string;
  subject: string;
  topic: string;
  subtopic?: string;
  concepts?: string[];
  difficulty?: 'Easy' | 'Medium' | 'Hard';
}

export interface IVerificationOptions {
  requestedSubject?: string;
  requestedTopic?: string;
  requestedDifficulty?: 'Easy' | 'Medium' | 'Hard';
  requestedConcepts?: string[];
  sourcePatternMetadata?: any;
}

export interface ISemanticVerificationResponse {
  success: boolean;
  verification: ISemanticVerificationResult;
  latencyMs?: number;
  provider?: string;
  model?: string;
}

export class SemanticVerificationService {
  private ai: AIService;

  constructor(ai?: AIService) {
    this.ai = ai || aiService;
  }

  /**
   * Performs independent semantic verification on a candidate question.
   */
  public async verifyQuestion(
    question: IQuestionToVerify,
    options?: IVerificationOptions
  ): Promise<ISemanticVerificationResponse> {
    if (!this.ai.isConfigured()) {
      throw new AIError('AI provider is not configured. Please set GEMINI_API_KEY.', 'AI_NOT_CONFIGURED', 503);
    }

    if (!question || typeof question !== 'object') {
      throw new AIError('Question to verify must be a valid object.', 'INVALID_VERIFICATION_INPUT', 400);
    }

    const payload: IQuestionVerificationPromptPayload = {
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

    let response: IAIStructuredResponse<any>;
    try {
      response = await this.ai.generateStructured<any>(prompt, {
        temperature: 0.1,
        timeoutMs: 50000,
      });
    } catch (err: any) {
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
