import { aiService } from './ai.service.js';
import { AIError } from './ai.interface.js';
import { buildQuestionGenerationPrompt } from './prompts/generation.prompt.js';
import { pyqEnrichmentService, isOfficialPyq } from '../pyqExtraction/pyqEnrichment.service.js';
import { validateGeneratedQuestionStructure } from '../../validators/generationValidator.js';
import { semanticVerificationService } from './semanticVerification.service.js';
import { questionSimilarityService } from './questionSimilarity.service.js';
import { MAX_GENERATION_ATTEMPTS, RETRY_CATEGORIES, formatRetryFeedback } from '../../constants/generation.js';

export function logPerformanceTelemetry(telemetry) {
  const padNum = (num, width) => String(num).padStart(width, ' ');

  console.log(`
AI Generation Performance

Context retrieval:     ${padNum(telemetry.contextRetrievalMs, 6)} ms
Generation:            ${padNum(telemetry.generationMs, 6)} ms
Structural validation: ${padNum(telemetry.structuralValidationMs, 6)} ms
Semantic verification: ${padNum(telemetry.semanticVerificationMs, 6)} ms
Similarity:            ${padNum(telemetry.similarityCheckMs, 6)} ms
Total:                 ${padNum(telemetry.totalMs, 6)} ms

Attempts: ${telemetry.attemptCount}
Status: ${telemetry.finalStatus}${telemetry.rejectionCategory ? `\nRejection category: ${telemetry.rejectionCategory}` : ''}
`);
}

export class QuestionGenerationService {
  constructor(ai, semanticVerifier, similarityService, maxAttempts = MAX_GENERATION_ATTEMPTS) {
    this.ai = ai || aiService;
    this.semanticVerifier = semanticVerifier || semanticVerificationService;
    this.similarityService = similarityService || questionSimilarityService;
    this.maxAttempts = maxAttempts;
  }

  getMaxAttempts() {
    return this.maxAttempts;
  }

  /**
   * Generates an original GATE CS question using Gemini with structured prompt & options normalization.
   */
  async generateQuestion(context) {
    if (!this.ai.isConfigured()) {
      throw new AIError('AI provider is not configured. Please set GROQ_API_KEY.', 'AI_NOT_CONFIGURED', 503);
    }

    const targetType = (context.questionType || 'MCQ').toUpperCase();
    const prompt = buildQuestionGenerationPrompt({
      ...context,
      questionType: targetType,
    });

    const response = await this.ai.generateStructured(prompt, {
      temperature: 0.3,
      timeoutMs: 50000,
    });

    const rawData = response.data;
    if (!rawData || typeof rawData !== 'object' || !rawData.question) {
      throw new AIError('AI model returned an incomplete or invalid question object.', 'INVALID_GENERATED_QUESTION', 502);
    }

    // Normalize Options & Answer based on Question Type
    let normalizedOptions = [];
    let normalizedAnswer = rawData.correctAnswer;

    if (targetType === 'NAT') {
      normalizedOptions = [];
      const num = typeof rawData.correctAnswer === 'number'
        ? rawData.correctAnswer
        : parseFloat(String(rawData.correctAnswer).replace(/[^\d.-]/g, ''));
      normalizedAnswer = !isNaN(num) ? num : rawData.correctAnswer;
    } else {
      // MCQ or MSQ
      if (Array.isArray(rawData.options)) {
        const standardIds = ['A', 'B', 'C', 'D'];
        normalizedOptions = rawData.options.map((opt, idx) => {
          const id = standardIds[idx] || String.fromCharCode(65 + idx);
          if (typeof opt === 'string') {
            return { id, text: opt.trim() };
          }
          return {
            id: opt.id ? String(opt.id).toUpperCase().trim() : id,
            text: opt.text ? String(opt.text).trim() : String(opt).trim(),
          };
        });
      }

      if (targetType === 'MSQ') {
        if (typeof rawData.correctAnswer === 'string') {
          normalizedAnswer = rawData.correctAnswer
            .split(/[,;\s]+/)
            .map((a) => a.trim().toUpperCase())
            .filter(Boolean);
        } else if (Array.isArray(rawData.correctAnswer)) {
          normalizedAnswer = rawData.correctAnswer.map((a) => String(a).trim().toUpperCase());
        }
      } else {
        // MCQ single option ID
        normalizedAnswer = String(rawData.correctAnswer || 'A').trim().toUpperCase();
      }
    }

    const normalizedQuestion = {
      question: String(rawData.question).trim(),
      questionType: targetType,
      options: normalizedOptions,
      correctAnswer: normalizedAnswer,
      explanation: String(rawData.explanation || '').trim(),
      subject: rawData.subject || context.subject || 'Computer Science',
      topic: rawData.topic || context.topic || 'Core Subject',
      subtopic: rawData.subtopic || context.subtopic || '',
      concepts:
        Array.isArray(rawData.concepts) && rawData.concepts.length > 0
          ? rawData.concepts
          : Array.isArray(context.concepts) && context.concepts.length > 0
          ? context.concepts
          : [context.topic || context.subject || 'Core Concepts'],
      reasoningType:
        Array.isArray(rawData.reasoningType) && rawData.reasoningType.length > 0
          ? rawData.reasoningType
          : Array.isArray(context.reasoningType) && context.reasoningType.length > 0
          ? context.reasoningType
          : ['analytical'],
      difficulty: rawData.difficulty || context.difficulty || 'Medium',
    };

    return {
      success: true,
      data: normalizedQuestion,
      latencyMs: response.latencyMs,
      provider: this.ai.getProviderName(),
      model: response.model,
    };
  }

  /**
   * Checkpoint 3C.5 Pipeline:
   * Retrieve context -> Generate question -> Structural validation -> Independent semantic verification -> Similarity safeguard -> Return result.
   */
  async generateQuestionWithContext(request, db) {
    if (!this.ai.isConfigured()) {
      throw new AIError('AI provider is not configured. Please set GROQ_API_KEY.', 'AI_NOT_CONFIGURED', 503);
    }

    if (!request || typeof request !== 'object') {
      throw new AIError('Request body must be a valid JSON object.', 'INVALID_GENERATION_REQUEST', 400);
    }

    if (!request.subject || typeof request.subject !== 'string' || !request.subject.trim()) {
      throw new AIError('Field "subject" is required and must be a non-empty string.', 'MISSING_REQUIRED_FIELD', 400);
    }

    const targetType = (request.questionType || 'MCQ').toUpperCase();
    const validTypes = new Set(['MCQ', 'MSQ', 'NAT']);
    if (!validTypes.has(targetType)) {
      throw new AIError('Field "questionType" must be one of: "MCQ", "MSQ", "NAT".', 'INVALID_QUESTION_TYPE', 400);
    }

    const targetDifficulty = request.difficulty || 'Medium';
    const validDiffs = new Set(['Easy', 'Medium', 'Hard']);
    if (!validDiffs.has(targetDifficulty)) {
      throw new AIError('Field "difficulty" must be one of: "Easy", "Medium", "Hard".', 'INVALID_DIFFICULTY', 400);
    }

    // 1. Retrieve approximately 3–6 relevant analyzed official PYQs
    const limit = Math.max(3, Math.min(6, request.limit || 4));
    const excludeGA = request.subject.toLowerCase() !== 'general aptitude';

    const pipelineStartTime = Date.now();
    let contextRetrievalMs = 0;
    let generationMs = 0;
    let structuralValidationMs = 0;
    let semanticVerificationMs = 0;
    let similarityCheckMs = 0;

    const tContextStart = Date.now();
    const sourceQuestions = pyqEnrichmentService.getGenerationContext(
      {
        subject: request.subject.trim(),
        topic: request.topic?.trim(),
        concepts: request.concepts,
        reasoningType: request.reasoningType,
        difficulty: targetDifficulty,
        limit,
        excludeGA,
        allowDevelopmentFallback: request.allowDevelopmentFallback === true,
      },
      db
    );
    contextRetrievalMs = Date.now() - tContextStart;

    if (!sourceQuestions || sourceQuestions.length === 0) {
      throw new AIError(
        'Not enough analyzed GATE questions are available for this selection yet.',
        'NO_GENERATION_CONTEXT',
        422
      );
    }

    // 2. Build compact context object containing only useful generation information
    const relevantPYQs = sourceQuestions.map((q) => ({
      id: q.id,
      subject: q.subject,
      topic: q.topic,
      concepts: q.concepts || q.aiAnalysis?.concepts || [],
      reasoningType: q.reasoningType || q.aiAnalysis?.reasoningType || [],
      difficulty: q.difficulty || q.aiAnalysis?.difficultyAssessment,
      questionPattern: q.aiAnalysis?.questionPattern,
      solutionApproach: q.aiAnalysis?.solutionApproach,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
    }));

    const allOfficial = sourceQuestions.every(isOfficialPyq);
    const contextMetadata = {
      sourceQuestionIds: relevantPYQs.map((p) => p.id || ''),
      contextCount: relevantPYQs.length,
      groundingType: allOfficial ? 'OFFICIAL_PYQ' : 'DEVELOPMENT_FALLBACK',
      isOfficialGrounding: allOfficial,
      officialReferences: sourceQuestions.map((q) => ({
        id: q.id,
        sourceType: q.source?.type,
        provider: q.source?.provider,
        year: q.year || q.source?.year,
        paper: q.paper || q.source?.paper,
      })),
    };

    const attemptRecords = [];
    let currentRetryFeedback = undefined;
    let lastProvider = this.ai.getProviderName();
    let lastModel = 'gemini';

    // 3. Controlled Automatic Regeneration Loop (Bounded by maxAttempts)
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      console.log(`[AI Generation] Attempt ${attempt}/${this.maxAttempts} for ${request.subject} (${targetType})`);

      // 3a. Prepare generation payload (with retry feedback if regenerating)
      const generationPayload = {
        subject: request.subject.trim(),
        topic: request.topic?.trim() || (sourceQuestions[0]?.topic || 'Core Subject'),
        difficulty: targetDifficulty,
        questionType: targetType,
        concepts: request.concepts && request.concepts.length > 0
          ? request.concepts
          : (sourceQuestions[0]?.concepts || []),
        reasoningType: request.reasoningType && request.reasoningType.length > 0
          ? request.reasoningType
          : (sourceQuestions[0]?.reasoningType || ['analytical']),
        cognitiveSkill: request.cognitiveSkill || sourceQuestions[0]?.aiAnalysis?.cognitiveSkill || 'apply',
        questionPattern: sourceQuestions[0]?.aiAnalysis?.questionPattern,
        relevantPYQs,
        retryFeedback: currentRetryFeedback,
      };

      // 3b. Generate candidate
      let genResult;
      const tGenStart = Date.now();
      try {
        genResult = await this.generateQuestion(generationPayload);
        generationMs += (Date.now() - tGenStart);
        lastProvider = genResult.provider || lastProvider;
        lastModel = genResult.model || lastModel;
      } catch (err) {
        generationMs += (Date.now() - tGenStart);
        // Fail fast immediately on auth, configuration, or provider rate-limit/quota errors
        if (
          err.code === 'AI_NOT_CONFIGURED' ||
          err.code === 'AI_AUTH_ERROR' ||
          err.code === 'AI_RATE_LIMIT' ||
          err.code === 'AI_RATE_LIMITED' ||
          err.code === 'AI_QUOTA_EXCEEDED' ||
          err.status === 429
        ) {
          throw err;
        }

        console.log(`[AI Generation] Attempt ${attempt} failed during generation: ${err.message}`);
        attemptRecords.push({
          attempt,
          status: 'GENERATION_FAILED',
          category: RETRY_CATEGORIES.STRUCTURE_INVALID,
          reason: err.message,
        });

        currentRetryFeedback = formatRetryFeedback({
          category: RETRY_CATEGORIES.STRUCTURE_INVALID,
          detail: 'Output must be a valid, complete JSON object matching the requested question structure.',
        });
        continue;
      }

      const generatedQuestion = genResult.data;
      generatedQuestion.source = { type: 'AI_GENERATED' };

      // 3c. Structural validation
      const tStructStart = Date.now();
      const structuralVal = validateGeneratedQuestionStructure(generatedQuestion, targetType);
      structuralValidationMs += (Date.now() - tStructStart);
      if (!structuralVal.isValid) {
        console.log(`[AI Generation] Attempt ${attempt} failed structural validation: ${structuralVal.errors.join('; ')}`);
        attemptRecords.push({
          attempt,
          status: 'STRUCTURAL_VALIDATION_FAILED',
          category: RETRY_CATEGORIES.STRUCTURE_INVALID,
          reason: structuralVal.errors.join('; '),
        });

        currentRetryFeedback = formatRetryFeedback({
          category: RETRY_CATEGORIES.STRUCTURE_INVALID,
          detail: structuralVal.errors.join('; '),
        });
        continue; // Short-circuits semantic verifier!
      }

      console.log(`[AI Generation] Attempt ${attempt} candidate structurally valid`);

      // 3d. Semantic verification (Checkpoint 3C.4)
      let semanticResult;
      const tVerStart = Date.now();
      try {
        const verifyRes = await this.semanticVerifier.verifyQuestion(
          generatedQuestion,
          {
            requestedSubject: request.subject.trim(),
            requestedTopic: generationPayload.topic,
            requestedDifficulty: targetDifficulty,
            requestedConcepts: generationPayload.concepts,
          }
        );
        semanticVerificationMs += (Date.now() - tVerStart);
        semanticResult = verifyRes.verification;
      } catch (err) {
        semanticVerificationMs += (Date.now() - tVerStart);
        if (
          err.code === 'AI_NOT_CONFIGURED' ||
          err.code === 'AI_AUTH_ERROR' ||
          err.code === 'AI_RATE_LIMIT' ||
          err.code === 'AI_RATE_LIMITED' ||
          err.code === 'AI_QUOTA_EXCEEDED' ||
          err.status === 429
        ) {
          throw err;
        }

        console.log(`[AI Generation] Attempt ${attempt} failed during semantic verification: ${err.message}`);
        attemptRecords.push({
          attempt,
          status: 'SEMANTIC_VERIFICATION_FAILED',
          category: RETRY_CATEGORIES.ANSWER_INCORRECT,
          reason: err.message,
        });

        currentRetryFeedback = formatRetryFeedback({
          category: RETRY_CATEGORIES.ANSWER_INCORRECT,
        });
        continue;
      }

      // Smart Repair for Explanations (Zero-Extra-Call Optimization)
      // If candidate is solvable, answer is correct, type is valid, concept matches, and unambiguous,
      // but explanation has minor flaws, use verifier's corrected explanation without regeneration.
      const canRepairExplanation =
        semanticResult.questionSolvable === true &&
        semanticResult.answerCorrect === true &&
        semanticResult.questionTypeValid === true &&
        semanticResult.conceptMatch === true &&
        !semanticResult.ambiguityDetected &&
        typeof semanticResult.correctedExplanation === 'string' &&
        semanticResult.correctedExplanation.trim().length >= 15;

      if (canRepairExplanation) {
        console.log(`[AI Generation] Attempt ${attempt} explanation repaired in-place using verifier's corrected explanation`);
        generatedQuestion.explanation = semanticResult.correctedExplanation.trim();
        semanticResult.explanationConsistent = true;
        semanticResult.valid = true;
      }

      // Advisory Difficulty: difficultyMatch === false ALONE must NEVER trigger candidate rejection
      if (
        !semanticResult.valid &&
        semanticResult.questionSolvable === true &&
        semanticResult.answerCorrect === true &&
        semanticResult.questionTypeValid === true &&
        semanticResult.conceptMatch === true &&
        !semanticResult.ambiguityDetected &&
        semanticResult.explanationConsistent === true
      ) {
        semanticResult.valid = true;
      }

      if (semanticResult.verifiedDifficulty) {
        generatedQuestion.difficulty = semanticResult.verifiedDifficulty;
      }

      // If semantic verification still failed:
      if (!semanticResult.valid) {
        let category = RETRY_CATEGORIES.ANSWER_INCORRECT;
        if (!semanticResult.questionSolvable) {
          category = RETRY_CATEGORIES.UNSOLVABLE;
        } else if (semanticResult.ambiguityDetected) {
          category = RETRY_CATEGORIES.AMBIGUOUS;
        } else if (!semanticResult.answerCorrect) {
          category = RETRY_CATEGORIES.ANSWER_INCORRECT;
        } else if (!semanticResult.questionTypeValid) {
          category = RETRY_CATEGORIES.QUESTION_TYPE_INVALID;
        } else if (!semanticResult.conceptMatch) {
          category = RETRY_CATEGORIES.CONCEPT_MISMATCH;
        } else if (!semanticResult.explanationConsistent) {
          category = RETRY_CATEGORIES.EXPLANATION_INCONSISTENT;
        }

        console.log(`[AI Generation] Attempt ${attempt} semantic verification failed: ${category} - Issues: ${semanticResult.issues?.join('; ')}`);
        attemptRecords.push({
          attempt,
          status: 'CANDIDATE_REJECTED',
          category,
          reason: semanticResult.issues?.join('; ') || category,
        });

        currentRetryFeedback = formatRetryFeedback({
          category,
          concept: generationPayload.concepts?.[0],
          difficulty: targetDifficulty,
          detail: semanticResult.issues?.join('; '),
        });
        continue; // Short-circuits similarity check!
      }

      console.log(`[AI Generation] Attempt ${attempt} candidate semantically verified`);

      // 3e. Similarity safeguard (Checkpoint 3C.5 & 4B)
      const tSimStart = Date.now();
      const referenceQuestionsForSimilarity = [
        ...relevantPYQs,
        ...(Array.isArray(request.additionalReferenceQuestions) ? request.additionalReferenceQuestions : []),
      ];
      const similarityResult = this.similarityService.checkSimilarity(generatedQuestion, referenceQuestionsForSimilarity);
      similarityCheckMs += (Date.now() - tSimStart);

      if (!similarityResult.passed) {
        console.log(`[AI Generation] Attempt ${attempt} similarity check failed: TOO_SIMILAR (${similarityResult.maxSimilarity} >= ${similarityResult.threshold})`);
        attemptRecords.push({
          attempt,
          status: 'TOO_SIMILAR',
          category: RETRY_CATEGORIES.TOO_SIMILAR,
          reason: `Similarity score ${similarityResult.maxSimilarity} exceeds threshold ${similarityResult.threshold} against ${similarityResult.mostSimilarQuestionId}`,
        });

        currentRetryFeedback = formatRetryFeedback({
          category: RETRY_CATEGORIES.TOO_SIMILAR,
          sourceId: similarityResult.mostSimilarQuestionId || undefined,
        });
        continue;
      }

      // 3f. SUCCESS! First verified candidate accepted, stop immediately
      console.log(`[AI Generation] Attempt ${attempt} candidate fully verified and accepted!`);
      attemptRecords.push({
        attempt,
        status: 'VERIFIED',
      });

      const totalMs = Date.now() - pipelineStartTime;
      const telemetry = {
        contextRetrievalMs,
        generationMs,
        structuralValidationMs,
        semanticVerificationMs,
        similarityCheckMs,
        totalMs,
        attemptCount: attempt,
        finalStatus: 'VERIFIED',
        rejectionCategory: null,
      };
      logPerformanceTelemetry(telemetry);

      return {
        success: true,
        status: 'VERIFIED',
        attemptCount: attempt,
        attemptStatuses: attemptRecords.map((r) => r.status),
        question: generatedQuestion,
        generationContext: contextMetadata,
        validation: {
          structurallyValid: true,
          semanticVerification: semanticResult,
          similarity: {
            passed: true,
            maxSimilarity: similarityResult.maxSimilarity,
            threshold: similarityResult.threshold,
            mostSimilarQuestionId: similarityResult.mostSimilarQuestionId,
          },
        },
        latencyMs: totalMs,
        telemetry,
        provider: lastProvider,
        model: lastModel,
      };
    }

    // 4. All attempts exhausted
    console.log(`[AI Generation] All ${this.maxAttempts} attempts exhausted without producing a verified question.`);
    const totalMs = Date.now() - pipelineStartTime;
    const lastAttempt = attemptRecords[attemptRecords.length - 1];
    const finalFailureCategory = lastAttempt?.category || RETRY_CATEGORIES.STRUCTURE_INVALID;
    const telemetry = {
      contextRetrievalMs,
      generationMs,
      structuralValidationMs,
      semanticVerificationMs,
      similarityCheckMs,
      totalMs,
      attemptCount: this.maxAttempts,
      finalStatus: 'GENERATION_ATTEMPTS_EXHAUSTED',
      rejectionCategory: finalFailureCategory,
    };
    logPerformanceTelemetry(telemetry);

    return {
      success: false,
      status: 'GENERATION_ATTEMPTS_EXHAUSTED',
      attemptCount: this.maxAttempts,
      attemptStatuses: attemptRecords.map((r) => r.status),
      lastFailureReason: lastAttempt?.reason || 'Max attempts reached',
      finalFailureCategory,
      generationContext: contextMetadata,
      latencyMs: totalMs,
      telemetry,
      provider: lastProvider,
      model: lastModel,
    };
  }

  /**
   * Development endpoint helper: Accepts either custom string test prompt or full generation context.
   */
  async testGeneration(input) {
    if (!this.ai.isConfigured()) {
      throw new AIError('AI provider is not configured. Please set GROQ_API_KEY.', 'AI_NOT_CONFIGURED', 503);
    }

    if (input && typeof input === 'object' && (input.subject || input.questionType || input.topic || input.concepts)) {
      return await this.generateQuestion(input);
    }

    const testPrompt = typeof input === 'string' && input.trim()
      ? input.trim()
      : 'Return a JSON object containing {"status":"ok"}.';

    const result = await this.ai.generateStructured(testPrompt, {
      temperature: 0.1,
      timeoutMs: 30000,
      systemInstruction: 'You are an AI service tester. Output valid JSON matching the requested structure.',
    });

    return {
      status: result.data?.status || 'ok',
      provider: this.ai.getProviderName(),
      model: result.model,
      latencyMs: result.latencyMs,
      data: result.data,
    };
  }
}

export const questionGenerationService = new QuestionGenerationService();
