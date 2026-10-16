import { IQuestion, IAIAnalysis } from '../../types/question.types.js';
import { aiService } from './ai.service.js';
import { buildQuestionAnalysisPrompt } from './prompts/analysis.prompt.js';
import { validateAIAnalysis } from '../../validators/aiAnalysisValidator.js';
import { AIResponseParsingError, AIError } from './ai.interface.js';

export const CURRENT_ANALYSIS_VERSION = '3b-v1';

export interface IAnalyzeQuestionOptions {
  force?: boolean;
}

export interface IAnalyzeQuestionResult {
  success: boolean;
  questionId: string;
  aiAnalysis: IAIAnalysis;
  cached: boolean;
  latencyMs?: number;
}

export interface IBulkAnalyzeOptions {
  force?: boolean;
  concurrency?: number;
}

export interface IBulkAnalyzeItemResult {
  questionId: string;
  status: 'analyzed' | 'skipped' | 'failed';
  aiAnalysis?: IAIAnalysis;
  error?: string;
  cached?: boolean;
  latencyMs?: number;
}

export interface IBulkAnalyzeResult {
  total: number;
  analyzed: number;
  skipped: number;
  failed: number;
  results: IBulkAnalyzeItemResult[];
}

export class QuestionAnalysisService {
  public readonly version = CURRENT_ANALYSIS_VERSION;

  /**
   * Analyzes an individual question using Gemini and saves aiAnalysis.
   * If already analyzed and force is not true, returns cached analysis.
   */
  public async analyzeQuestion(
    question: IQuestion,
    db: any,
    options: IAnalyzeQuestionOptions = {}
  ): Promise<IAnalyzeQuestionResult> {
    if (!question || !question.id) {
      throw new AIError('Invalid question provided for analysis.', 'INVALID_QUESTION_DATA', 400);
    }

    // Cost-Control Check: Return cached analysis if already analyzed and force re-analysis not requested
    if (question.aiAnalysis?.analyzed && !options.force) {
      return {
        success: true,
        questionId: question.id,
        aiAnalysis: question.aiAnalysis,
        cached: true,
      };
    }

    // Build prompt containing only relevant pedagogical question content
    const prompt = buildQuestionAnalysisPrompt({
      question: question.question,
      subject: question.subject,
      topic: question.topic,
      subtopic: question.subtopic,
      questionType: question.questionType,
      options: question.options,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      section: question.section || question.source?.section,
      questionNumber: question.questionNumber || question.source?.questionNumber,
      source: question.source,
    } as any);

    const response = await aiService.generateStructured<any>(prompt, {
      temperature: 0.2,
      timeoutMs: 35000,
    });

    // Validate structured output
    const validation = validateAIAnalysis(response.data);
    if (!validation.isValid || !validation.sanitized) {
      throw new AIResponseParsingError(
        `AI analysis output failed validation: ${validation.errors.join('; ')}`,
        response.rawText
      );
    }

    const aiAnalysis: IAIAnalysis = {
      analyzed: true,
      ...validation.sanitized,
      analysisVersion: this.version,
      analyzedAt: new Date().toISOString(),
    };

    // Attach aiAnalysis and populate previously undefined metadata without modifying authoritative official fields
    question.aiAnalysis = aiAnalysis;
    const updates: Partial<IQuestion> = { aiAnalysis };

    if (!question.subject && aiAnalysis.subject) {
      question.subject = aiAnalysis.subject;
      updates.subject = aiAnalysis.subject;
    }
    if (!question.topic && aiAnalysis.topic) {
      question.topic = aiAnalysis.topic;
      updates.topic = aiAnalysis.topic;
    }
    if (!question.subtopic && aiAnalysis.subtopic) {
      question.subtopic = aiAnalysis.subtopic;
      updates.subtopic = aiAnalysis.subtopic;
    }
    if ((!question.concepts || question.concepts.length === 0) && aiAnalysis.concepts) {
      question.concepts = aiAnalysis.concepts;
      updates.concepts = aiAnalysis.concepts;
    }
    if (!question.difficulty && aiAnalysis.difficultyAssessment) {
      question.difficulty = aiAnalysis.difficultyAssessment;
      updates.difficulty = aiAnalysis.difficultyAssessment;
    }
    if ((!question.reasoningType || question.reasoningType.length === 0) && aiAnalysis.reasoningType) {
      question.reasoningType = aiAnalysis.reasoningType;
      updates.reasoningType = aiAnalysis.reasoningType;
    }

    if (typeof db?.update === 'function') {
      db.update(question.id, updates);
    } else if (typeof db?.questions?.set === 'function') {
      db.questions.set(question.id, { ...question, ...updates });
    }

    return {
      success: true,
      questionId: question.id,
      aiAnalysis,
      cached: false,
      latencyMs: response.latencyMs,
    };
  }

  /**
   * Analyzes a batch of questions with controlled concurrency.
   * Tolerates individual failures without corrupting the batch.
   */
  public async analyzeBulk(
    questionIds: string[],
    db: any,
    options: IBulkAnalyzeOptions = {}
  ): Promise<IBulkAnalyzeResult> {
    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      throw new AIError('Field "questionIds" must be a non-empty array.', 'INVALID_BULK_INPUT', 400);
    }

    const concurrency = Math.max(1, Math.min(3, options.concurrency || 2));
    const results: IBulkAnalyzeItemResult[] = [];
    let analyzedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    // Process in chunks to strictly control concurrency
    for (let i = 0; i < questionIds.length; i += concurrency) {
      const chunk = questionIds.slice(i, i + concurrency);

      const chunkPromises = chunk.map(async (id) => {
        const question = typeof db?.findById === 'function' ? db.findById(id) : null;
        if (!question) {
          failedCount++;
          return {
            questionId: id,
            status: 'failed' as const,
            error: `Question with ID '${id}' not found in database.`,
          };
        }

        // Skip if already analyzed and not forcing
        if (question.aiAnalysis?.analyzed && !options.force) {
          skippedCount++;
          return {
            questionId: id,
            status: 'skipped' as const,
            aiAnalysis: question.aiAnalysis,
            cached: true,
          };
        }

        try {
          const outcome = await this.analyzeQuestion(question, db, options);
          analyzedCount++;
          return {
            questionId: id,
            status: 'analyzed' as const,
            aiAnalysis: outcome.aiAnalysis,
            cached: outcome.cached,
            latencyMs: outcome.latencyMs,
          };
        } catch (err: any) {
          failedCount++;
          return {
            questionId: id,
            status: 'failed' as const,
            error: err.message || 'Analysis failed.',
          };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    return {
      total: questionIds.length,
      analyzed: analyzedCount,
      skipped: skippedCount,
      failed: failedCount,
      results,
    };
  }
}

export const questionAnalysisService = new QuestionAnalysisService();
