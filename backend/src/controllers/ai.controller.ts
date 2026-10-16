import { Request, Response } from 'express';
import { aiService } from '../services/ai/ai.service.js';
import { questionAnalysisService } from '../services/ai/questionAnalysis.service.js';
import { patternAggregationService } from '../services/ai/patternAggregation.service.js';
import { questionGenerationService } from '../services/ai/questionGeneration.service.js';
import { questionSimilarityService } from '../services/ai/questionSimilarity.service.js';
import { practiceSessionService } from '../services/ai/practiceSession.service.js';
import { AIError } from '../services/ai/ai.interface.js';

export class AIController {
  public static async getHealth(req: Request, res: Response): Promise<void> {
    try {
      const health = await aiService.getHealth();
      res.status(200).json({
        success: true,
        data: health,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve AI health status.',
        code: 'AI_HEALTH_ERROR',
      });
    }
  }

  public static async testConnection(req: Request, res: Response): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({
        success: false,
        error: 'The /api/ai/test endpoint is disabled in production mode.',
        code: 'ENDPOINT_DISABLED_IN_PRODUCTION',
      });
      return;
    }

    if (!aiService.isConfigured()) {
      res.status(503).json({
        success: false,
        error: 'AI provider is not configured. Please configure GEMINI_API_KEY in backend/.env.',
        code: 'AI_NOT_CONFIGURED',
      });
      return;
    }

    try {
      let customPrompt = typeof req.body?.prompt === 'string' && req.body.prompt.trim()
        ? req.body.prompt.trim()
        : 'Respond with the word OK.';

      if (customPrompt.length > 500) {
        customPrompt = customPrompt.slice(0, 500);
      }

      const result = await aiService.testConnection(customPrompt);
      res.status(200).json({
        success: true,
        message: 'AI Provider connection test successful.',
        data: result,
      });
    } catch (err: any) {
      const status = err instanceof AIError ? err.status : 500;
      const code = err instanceof AIError ? err.code : 'AI_TEST_FAILED';

      res.status(status).json({
        success: false,
        error: err.message || 'AI test request failed.',
        code,
      });
    }
  }

  /**
   * Task 3C.1 Development Endpoint: Tests Question Generation pipeline
   * Controller -> QuestionGenerationService -> AIService -> Gemini
   */
  public static async testGeneration(req: Request, res: Response): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({
        success: false,
        error: 'The /api/ai/generation/test endpoint is disabled in production mode.',
        code: 'ENDPOINT_DISABLED_IN_PRODUCTION',
      });
      return;
    }

    if (!aiService.isConfigured()) {
      res.status(503).json({
        success: false,
        error: 'AI provider is not configured. Please configure GEMINI_API_KEY in backend/.env.',
        code: 'AI_NOT_CONFIGURED',
      });
      return;
    }

    try {
      const body = req.body || {};
      let input: any;

      if (body.subject || body.topic || body.questionType || body.concepts) {
        input = body;
      } else if (typeof body.prompt === 'string' && body.prompt.trim()) {
        input = body.prompt.trim().slice(0, 500);
      } else {
        input = 'Return a JSON object containing {"status":"ok"}.';
      }

      const result = await questionGenerationService.testGeneration(input);
      res.status(200).json({
        success: true,
        message: 'AI Question Generation test pipeline successful.',
        data: result,
      });
    } catch (err: any) {
      const status = err instanceof AIError ? err.status : 500;
      const code = err instanceof AIError ? err.code : 'GENERATION_TEST_FAILED';

      res.status(status).json({
        success: false,
        error: err.message || 'Generation test request failed.',
        code,
      });
    }
  }

  public static async generateQuestion(req: Request, res: Response, db: any): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({
        success: false,
        error: 'The /api/ai/generate-question endpoint is disabled in production mode.',
        code: 'ENDPOINT_DISABLED_IN_PRODUCTION',
      });
      return;
    }

    if (!aiService.isConfigured()) {
      res.status(503).json({
        success: false,
        error: 'AI provider is not configured. Please set GEMINI_API_KEY in backend/.env',
        code: 'AI_NOT_CONFIGURED',
      });
      return;
    }

    try {
      const body = req.body || {};
      const result = await questionGenerationService.generateQuestionWithContext(body, db);
      res.status(200).json({
        success: result.success,
        status: result.status,
        attemptCount: result.attemptCount,
        attemptStatuses: result.attemptStatuses,
        lastFailureReason: result.lastFailureReason,
        question: result.question,
        generationContext: result.generationContext,
        validation: result.validation,
      });
    } catch (err: any) {
      const status = err instanceof AIError ? err.status : 500;
      const code = err instanceof AIError ? err.code : 'GENERATION_FAILED';

      res.status(status).json({
        success: false,
        error: err.message || 'Question generation failed.',
        code,
        validation: err.validation || undefined,
      });
    }
  }

  public static async generatePracticeQuestion(req: Request, res: Response, db: any): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({
        success: false,
        error: 'The /api/ai/practice/generate endpoint is disabled in production mode.',
        code: 'ENDPOINT_DISABLED_IN_PRODUCTION',
      });
      return;
    }

    if (!aiService.isConfigured()) {
      res.status(503).json({
        success: false,
        error: 'AI provider is not configured. Please set GEMINI_API_KEY in backend/.env',
        code: 'AI_NOT_CONFIGURED',
      });
      return;
    }

    try {
      const body = req.body || {};
      const result = await questionGenerationService.generateQuestionWithContext(body, db);

      if (result.status === 'VERIFIED' && result.question) {
        const sessionQuestionId = practiceSessionService.createSession(result.question);
        const sanitizedQuestion = practiceSessionService.getSanitizedQuestion(result.question, sessionQuestionId);

        res.status(200).json({
          success: true,
          status: 'VERIFIED',
          sessionQuestionId,
          question: sanitizedQuestion,
          generationContext: result.generationContext,
          attemptCount: result.attemptCount,
          attemptStatuses: result.attemptStatuses,
          telemetry: result.telemetry,
        });
      } else {
        res.status(200).json({
          success: false,
          status: result.status,
          attemptCount: result.attemptCount,
          attemptStatuses: result.attemptStatuses,
          lastFailureReason: result.lastFailureReason,
          finalFailureCategory: result.finalFailureCategory,
          generationContext: result.generationContext,
          telemetry: result.telemetry,
        });
      }
    } catch (err: any) {
      const status = err instanceof AIError ? err.status : 500;
      const code = err instanceof AIError ? err.code : 'PRACTICE_GENERATION_FAILED';

      res.status(status).json({
        success: false,
        error: err.message || 'Practice question generation failed.',
        code,
      });
    }
  }

  public static async submitPracticeAnswer(req: Request, res: Response): Promise<void> {
    const sessionQuestionId = req.params.sessionQuestionId;

    try {
      const body = req.body || {};
      const evaluation = practiceSessionService.evaluateAnswer(sessionQuestionId, body.answer);

      res.status(200).json({
        success: true,
        sessionQuestionId,
        data: evaluation,
      });
    } catch (err: any) {
      const status = err instanceof AIError ? err.status : 400;
      const code = err instanceof AIError ? err.code : 'ANSWER_EVALUATION_FAILED';

      res.status(status).json({
        success: false,
        error: err.message || 'Answer evaluation failed.',
        code,
      });
    }
  }

  public static async analyzeQuestion(req: Request, res: Response, db: any): Promise<void> {
    const questionId = req.params.id;
    const force = req.query.force === 'true' || Boolean(req.body?.force);

    if (!aiService.isConfigured()) {
      res.status(503).json({
        success: false,
        error: 'AI provider is not configured. Please set GEMINI_API_KEY in backend/.env',
        code: 'AI_NOT_CONFIGURED',
      });
      return;
    }

    const question = typeof db?.findById === 'function' ? db.findById(questionId) : null;
    if (!question) {
      res.status(404).json({
        success: false,
        error: `Question with ID '${questionId}' not found.`,
        code: 'QUESTION_NOT_FOUND',
      });
      return;
    }

    try {
      const result = await questionAnalysisService.analyzeQuestion(question, db, { force });
      res.status(200).json({
        success: true,
        message: result.cached ? 'Loaded cached AI analysis.' : 'AI question analysis completed successfully.',
        data: result,
      });
    } catch (err: any) {
      const status = err instanceof AIError ? err.status : 500;
      const code = err instanceof AIError ? err.code : 'ANALYSIS_FAILED';

      res.status(status).json({
        success: false,
        error: err.message || 'Question analysis failed.',
        code,
      });
    }
  }

  public static async analyzeQuestionsBulk(req: Request, res: Response, db: any): Promise<void> {
    if (!aiService.isConfigured()) {
      res.status(503).json({
        success: false,
        error: 'AI provider is not configured. Please set GEMINI_API_KEY in backend/.env',
        code: 'AI_NOT_CONFIGURED',
      });
      return;
    }

    const questionIds = Array.isArray(req.body?.questionIds)
      ? req.body.questionIds
      : null;

    if (!questionIds || questionIds.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Request body must contain a non-empty "questionIds" array.',
        code: 'INVALID_REQUEST_BODY',
      });
      return;
    }

    const force = Boolean(req.body?.force);
    const concurrency = typeof req.body?.concurrency === 'number' ? req.body.concurrency : 2;

    try {
      const result = await questionAnalysisService.analyzeBulk(questionIds, db, { force, concurrency });
      res.status(200).json({
        success: true,
        message: `Bulk analysis completed. Analyzed: ${result.analyzed}, Skipped (cached): ${result.skipped}, Failed: ${result.failed}.`,
        data: result,
      });
    } catch (err: any) {
      const status = err instanceof AIError ? err.status : 500;
      const code = err instanceof AIError ? err.code : 'BULK_ANALYSIS_FAILED';

      res.status(status).json({
        success: false,
        error: err.message || 'Bulk question analysis failed.',
        code,
      });
    }
  }

  public static async getPatterns(req: Request, res: Response, db: any): Promise<void> {
    try {
      const allQuestions = typeof db?.findAll === 'function' ? db.findAll() : [];
      const summary = patternAggregationService.aggregatePatterns(allQuestions);
      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to aggregate question patterns.',
        code: 'PATTERN_AGGREGATION_ERROR',
      });
    }
  }

  public static async createPracticeSession(req: Request, res: Response, db: any): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({
        success: false,
        error: 'The /api/ai/practice/session endpoint is disabled in production mode.',
        code: 'ENDPOINT_DISABLED_IN_PRODUCTION',
      });
      return;
    }

    if (!aiService.isConfigured()) {
      res.status(503).json({
        success: false,
        error: 'AI provider is not configured. Please set GEMINI_API_KEY in backend/.env',
        code: 'AI_NOT_CONFIGURED',
      });
      return;
    }

    try {
      const body = req.body || {};

      let questionCount = body.questionCount;
      if (questionCount === undefined || questionCount === null) {
        questionCount = 3;
      }
      if (
        typeof questionCount !== 'number' ||
        !Number.isInteger(questionCount) ||
        (questionCount !== 3 && questionCount !== 5)
      ) {
        res.status(400).json({
          success: false,
          error: 'Field "questionCount" must be 3 or 5.',
          code: 'INVALID_QUESTION_COUNT',
        });
        return;
      }

      if (!body.subject || typeof body.subject !== 'string' || !body.subject.trim()) {
        res.status(400).json({
          success: false,
          error: 'Field "subject" is required and must be a non-empty string.',
          code: 'MISSING_REQUIRED_FIELD',
        });
        return;
      }

      const subject = body.subject.trim();
      const topic = body.topic && typeof body.topic === 'string' && body.topic.trim() ? body.topic.trim() : undefined;
      const difficulty = body.difficulty && ['Easy', 'Medium', 'Hard'].includes(body.difficulty)
        ? body.difficulty
        : 'Medium';

      const rawType = (body.questionType || 'Mixed').trim().toUpperCase();
      const validTypes = new Set(['MCQ', 'MSQ', 'NAT', 'MIXED']);
      if (!validTypes.has(rawType)) {
        res.status(400).json({
          success: false,
          error: 'Field "questionType" must be one of: "MCQ", "MSQ", "NAT", "Mixed".',
          code: 'INVALID_QUESTION_TYPE',
        });
        return;
      }

      let targetTypes: Array<'MCQ' | 'MSQ' | 'NAT'> = [];
      if (rawType === 'MCQ') {
        targetTypes = Array(questionCount).fill('MCQ');
      } else if (rawType === 'MSQ') {
        targetTypes = Array(questionCount).fill('MSQ');
      } else if (rawType === 'NAT') {
        targetTypes = Array(questionCount).fill('NAT');
      } else {
        if (questionCount === 3) {
          targetTypes = ['MCQ', 'MSQ', 'NAT'];
        } else {
          targetTypes = ['MCQ', 'MSQ', 'NAT', 'MCQ', 'MSQ'];
        }
      }

      const acceptedQuestions: any[] = [];
      let generationError: any = null;
      const concurrency = 2;
      let nextIndex = 0;

      async function worker() {
        while (nextIndex < targetTypes.length && !generationError) {
          const idx = nextIndex++;
          const targetType = targetTypes[idx];

          try {
            const genPayload = {
              subject,
              topic: topic && topic !== 'Any' && topic !== 'Any Topic' ? topic : undefined,
              difficulty,
              questionType: targetType,
              additionalReferenceQuestions: [...acceptedQuestions],
            };

            const result = await questionGenerationService.generateQuestionWithContext(genPayload, db);

            if (result.status === 'VERIFIED' && result.question) {
              acceptedQuestions.push(result.question);
            } else {
              const code = result.status === 'GENERATION_ATTEMPTS_EXHAUSTED'
                ? 'GENERATION_ATTEMPTS_EXHAUSTED'
                : 'SESSION_GENERATION_FAILED';
              const message = result.status === 'GENERATION_ATTEMPTS_EXHAUSTED'
                ? "We couldn't generate a question that passed all quality checks. Try again."
                : `Failed to generate verified question for type ${targetType}. Status: ${result.status}`;
              generationError = new AIError(message, code, 502);
              return;
            }
          } catch (err) {
            generationError = err;
            return;
          }
        }
      }

      const workers: Promise<void>[] = [];
      const numWorkers = Math.min(concurrency, targetTypes.length);
      for (let w = 0; w < numWorkers; w++) {
        workers.push(worker());
      }
      await Promise.all(workers);

      if (generationError || acceptedQuestions.length !== targetTypes.length) {
        let errCode = 'SESSION_GENERATION_FAILED';
        let errMsg = "We couldn't generate a complete reliable set. Try again.";
        let errStatus = 502;

        if (generationError) {
          if (generationError.code === 'AI_QUOTA_EXCEEDED') {
            errCode = 'AI_QUOTA_EXCEEDED';
            errMsg = 'The AI provider quota has been exhausted. Generation will become available again when the provider quota resets.';
            errStatus = 429;
          } else if (generationError.code === 'AI_RATE_LIMIT' || generationError.code === 'AI_RATE_LIMITED') {
            errCode = 'AI_RATE_LIMITED';
            errMsg = 'AI generation is temporarily rate-limited. Please wait a moment and try again.';
            errStatus = 429;
          } else if (generationError.code === 'AI_NOT_CONFIGURED' || generationError.code === 'AI_SERVICE_UNAVAILABLE') {
            errCode = generationError.code;
            errMsg = 'The AI service is temporarily unavailable. Your Question Bank and normal Practice are still available.';
            errStatus = 503;
          } else if (generationError.code === 'NO_GENERATION_CONTEXT') {
            errCode = 'NO_GENERATION_CONTEXT';
            errMsg = 'Not enough analyzed GATE questions are available for this selection yet.';
            errStatus = 422;
          } else if (generationError.code === 'GENERATION_ATTEMPTS_EXHAUSTED') {
            errCode = 'GENERATION_ATTEMPTS_EXHAUSTED';
            errMsg = "We couldn't generate a question that passed all quality checks. Try again.";
            errStatus = 502;
          }
        }

        if (errStatus === 429) {
          const retryVal = (generationError as any)?.retryAfter ?? (errCode === 'AI_RATE_LIMITED' ? 60 : undefined);
          if (retryVal !== undefined) {
            res.setHeader('Retry-After', String(retryVal));
          }
        }
        res.status(errStatus).json({
          success: false,
          error: errMsg,
          code: errCode,
        });
        return;
      }

      const sessionResult = practiceSessionService.createMultiQuestionSession(
        {
          subject,
          topic,
          difficulty: difficulty as any,
          questionType: rawType as any,
          questionCount: targetTypes.length,
        },
        acceptedQuestions
      );

      res.status(200).json({
        success: true,
        sessionId: sessionResult.sessionId,
        questions: sessionResult.questions,
      });
    } catch (err: any) {
      const status = err instanceof AIError ? err.status : 500;
      const code = err instanceof AIError ? err.code : 'SESSION_GENERATION_FAILED';

      if (status === 429) {
        const retryVal = (err as any)?.retryAfter ?? (code === 'AI_RATE_LIMITED' ? 60 : undefined);
        if (retryVal !== undefined) {
          res.setHeader('Retry-After', String(retryVal));
        }
      }
      res.status(status).json({
        success: false,
        error: (code === 'AI_QUOTA_EXCEEDED')
          ? 'The AI provider quota has been exhausted. Generation will become available again when the provider quota resets.'
          : (err.message || 'Practice session generation failed.'),
        code,
      });
    }
  }

  public static async submitPracticeSession(req: Request, res: Response): Promise<void> {
    const sessionId = req.params.sessionId;

    try {
      const body = req.body || {};
      const submissionResult = practiceSessionService.submitMultiQuestionSession(
        sessionId,
        body.answers || {}
      );

      res.status(200).json({
        success: true,
        sessionId,
        data: submissionResult,
      });
    } catch (err: any) {
      const status = err instanceof AIError ? err.status : 400;
      const code = err instanceof AIError ? err.code : 'SUBMISSION_FAILED';

      res.status(status).json({
        success: false,
        error: err.message || 'Session submission failed.',
        code,
      });
    }
  }
}
