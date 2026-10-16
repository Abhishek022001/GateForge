import { aiService } from '../services/ai/ai.service.js';
import { questionAnalysisService } from '../services/ai/questionAnalysis.service.js';
import { patternAggregationService } from '../services/ai/patternAggregation.service.js';
import { questionGenerationService } from '../services/ai/questionGeneration.service.js';
import { questionSimilarityService } from '../services/ai/questionSimilarity.service.js';
import { practiceSessionService } from '../services/ai/practiceSession.service.js';
import { AIError } from '../services/ai/ai.interface.js';

export class AIController {
  static async getHealth(req, res) {
    try {
      const health = await aiService.getHealth();
      res.status(200).json({
        success: true,
        data: health,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve AI health status.',
        code: 'AI_HEALTH_ERROR',
      });
    }
  }

  static async testConnection(req, res) {
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
    } catch (err) {
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
  static async testGeneration(req, res) {
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
      let input;

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
    } catch (err) {
      const status = err instanceof AIError ? err.status : 500;
      const code = err instanceof AIError ? err.code : 'GENERATION_TEST_FAILED';

      res.status(status).json({
        success: false,
        error: err.message || 'Generation test request failed.',
        code,
      });
    }
  }

  static async generateQuestion(req, res, db) {
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
    } catch (err) {
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

  static async generatePracticeQuestion(req, res, db) {
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
    } catch (err) {
      const status = err instanceof AIError ? err.status : 500;
      const code = err instanceof AIError ? err.code : 'PRACTICE_GENERATION_FAILED';

      res.status(status).json({
        success: false,
        error: err.message || 'Practice question generation failed.',
        code,
      });
    }
  }

  static async submitPracticeAnswer(req, res) {
    const sessionQuestionId = req.params.sessionQuestionId;

    try {
      const body = req.body || {};
      const evaluation = practiceSessionService.evaluateAnswer(sessionQuestionId, body.answer);

      res.status(200).json({
        success: true,
        sessionQuestionId,
        data: evaluation,
      });
    } catch (err) {
      const status = err instanceof AIError ? err.status : 400;
      const code = err instanceof AIError ? err.code : 'ANSWER_EVALUATION_FAILED';

      res.status(status).json({
        success: false,
        error: err.message || 'Answer evaluation failed.',
        code,
      });
    }
  }

  static async analyzeQuestion(req, res, db) {
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
    } catch (err) {
      const status = err instanceof AIError ? err.status : 500;
      const code = err instanceof AIError ? err.code : 'ANALYSIS_FAILED';

      res.status(status).json({
        success: false,
        error: err.message || 'Question analysis failed.',
        code,
      });
    }
  }

  static async analyzeQuestionsBulk(req, res, db) {
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
    } catch (err) {
      const status = err instanceof AIError ? err.status : 500;
      const code = err instanceof AIError ? err.code : 'BULK_ANALYSIS_FAILED';

      res.status(status).json({
        success: false,
        error: err.message || 'Bulk question analysis failed.',
        code,
      });
    }
  }

  static async getPatterns(req, res, db) {
    try {
      const allQuestions = typeof db?.findAll === 'function' ? db.findAll() : [];
      const summary = patternAggregationService.aggregatePatterns(allQuestions);
      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: 'Failed to aggregate question patterns.',
        code: 'PATTERN_AGGREGATION_ERROR',
      });
    }
  }

  static async createPracticeSession(req, res, db) {
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

      let targetTypes = [];
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

      const acceptedQuestions = [];
      let generationError = null;
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
              generationError = new AIError(
                `Failed to generate verified question for type ${targetType}. Status: ${result.status}`,
                'SESSION_GENERATION_FAILED',
                502
              );
              return;
            }
          } catch (err) {
            generationError = err;
            return;
          }
        }
      }

      const workers = [];
      const numWorkers = Math.min(concurrency, targetTypes.length);
      for (let w = 0; w < numWorkers; w++) {
        workers.push(worker());
      }
      await Promise.all(workers);

      if (generationError || acceptedQuestions.length !== targetTypes.length) {
        res.status(502).json({
          success: false,
          error: "We couldn't generate a complete reliable set. Try again.",
          code: 'SESSION_GENERATION_FAILED',
        });
        return;
      }

      const sessionResult = practiceSessionService.createMultiQuestionSession(
        {
          subject,
          topic,
          difficulty,
          questionType: rawType,
          questionCount: targetTypes.length,
        },
        acceptedQuestions
      );

      res.status(200).json({
        success: true,
        sessionId: sessionResult.sessionId,
        questions: sessionResult.questions,
      });
    } catch (err) {
      const status = err instanceof AIError ? err.status : 500;
      const code = err instanceof AIError ? err.code : 'SESSION_GENERATION_FAILED';

      res.status(status).json({
        success: false,
        error: err.message || 'Practice session generation failed.',
        code,
      });
    }
  }

  static async submitPracticeSession(req, res) {
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
    } catch (err) {
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
