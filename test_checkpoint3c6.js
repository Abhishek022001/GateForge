/**
 * Comprehensive Automated Verification Suite for GATEForge Checkpoint 3C.6
 * (Controlled Automatic Regeneration: Bounded Retries, Feedback-Driven Correction, Short-Circuiting, Exhaustion Handling)
 */

import { MAX_GENERATION_ATTEMPTS, RETRY_CATEGORIES, formatRetryFeedback } from './backend/src/constants/generation.js';
import { buildQuestionGenerationPrompt } from './backend/src/services/ai/prompts/generation.prompt.js';
import { QuestionGenerationService } from './backend/src/services/ai/questionGeneration.service.js';
import { AIError } from './backend/src/services/ai/ai.interface.js';
import { SIMILARITY_THRESHOLDS } from './backend/src/constants/similarity.js';

const API_BASE = 'http://localhost:5000';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message, detail = '') {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${message} ${detail ? `(${detail})` : ''}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message} ${detail ? `(${detail})` : ''}`);
    failedTests++;
  }
}

// Mock Database for context retrieval & persistence tests
class MockDb {
  constructor(initialQuestions = []) {
    this.questions = new Map(initialQuestions.map((q) => [q.id, { ...q }]));
  }

  findById(id) {
    return this.questions.get(id) || null;
  }

  findAll(filter = {}) {
    let list = Array.from(this.questions.values());
    if (filter.analyzed !== undefined) {
      const isAnalyzed = filter.analyzed === 'true' || filter.analyzed === true;
      list = list.filter((q) => Boolean(q.aiAnalysis?.analyzed) === isAnalyzed);
    }
    if (filter.subject) {
      list = list.filter((q) => (q.subject || '').toLowerCase() === filter.subject.toLowerCase());
    }
    return list;
  }

  create(q) {
    this.questions.set(q.id, { ...q });
    return q;
  }
}

const samplePYQ = {
  id: 'gate-2024-cs-q30',
  subject: 'Databases',
  topic: 'Normalization',
  question: 'Given relation R(A, B, C, D) with FDs: A -> B, B -> C, C -> D, D -> A. What is the highest normal form of R?',
  questionType: 'MCQ',
  options: [
    { id: 'A', text: '1NF only' },
    { id: 'B', text: '2NF only' },
    { id: 'C', text: '3NF only' },
    { id: 'D', text: 'BCNF' },
  ],
  correctAnswer: 'D',
  explanation: 'All attributes are candidate keys. Hence every FD has a superkey on the LHS, which satisfies BCNF.',
  aiAnalysis: {
    analyzed: true,
    concepts: ['functional dependency', 'candidate keys', 'BCNF'],
    reasoningType: ['deductive', 'formal'],
    cognitiveSkill: 'analyze',
    difficultyAssessment: 'Medium',
    questionPattern: 'Given a relational schema and functional dependencies, determine normal form',
    solutionApproach: 'Find all candidate keys and check LHS of each FD',
  },
};

async function runCheckpoint3C6Tests() {
  console.log('===============================================================');
  console.log('GATEForge Checkpoint 3C.6: Controlled Automatic Regeneration Suite');
  console.log('===============================================================\n');

  // -------------------------------------------------------------
  // Section 1: Central Regeneration Configuration & Categories
  // -------------------------------------------------------------
  console.log('[SECTION 1] Central Configuration & Categories');

  assert(
    MAX_GENERATION_ATTEMPTS === 3,
    'MAX_GENERATION_ATTEMPTS is strictly configured to 3',
    `Value: ${MAX_GENERATION_ATTEMPTS}`
  );

  assert(
    RETRY_CATEGORIES.STRUCTURE_INVALID === 'STRUCTURE_INVALID',
    'RETRY_CATEGORIES includes STRUCTURE_INVALID'
  );

  assert(
    RETRY_CATEGORIES.ANSWER_INCORRECT === 'ANSWER_INCORRECT',
    'RETRY_CATEGORIES includes ANSWER_INCORRECT'
  );

  assert(
    RETRY_CATEGORIES.EXPLANATION_INCONSISTENT === 'EXPLANATION_INCONSISTENT',
    'RETRY_CATEGORIES includes EXPLANATION_INCONSISTENT'
  );

  assert(
    RETRY_CATEGORIES.AMBIGUOUS === 'AMBIGUOUS',
    'RETRY_CATEGORIES includes AMBIGUOUS'
  );

  assert(
    RETRY_CATEGORIES.CONCEPT_MISMATCH === 'CONCEPT_MISMATCH',
    'RETRY_CATEGORIES includes CONCEPT_MISMATCH'
  );

  assert(
    RETRY_CATEGORIES.DIFFICULTY_MISMATCH === 'DIFFICULTY_MISMATCH',
    'RETRY_CATEGORIES includes DIFFICULTY_MISMATCH'
  );

  assert(
    RETRY_CATEGORIES.TOO_SIMILAR === 'TOO_SIMILAR',
    'RETRY_CATEGORIES includes TOO_SIMILAR'
  );

  // -------------------------------------------------------------
  // Section 2: Feedback Sanitization & Prompt Formatting
  // -------------------------------------------------------------
  console.log('\n[SECTION 2] Feedback Sanitization & Prompt Formatting');

  const fbStructure = formatRetryFeedback({
    category: RETRY_CATEGORIES.STRUCTURE_INVALID,
    detail: 'MCQ must contain exactly 4 distinct options [A, B, C, D].',
  });
  assert(
    fbStructure.includes('STRUCTURAL INTEGRITY') && fbStructure.includes('options'),
    'formatRetryFeedback produces clear corrective feedback for STRUCTURE_INVALID'
  );

  const fbSimilar = formatRetryFeedback({
    category: RETRY_CATEGORIES.TOO_SIMILAR,
    sourceId: 'gate-2024-cs-q30',
  });
  assert(
    fbSimilar.includes('ORIGINALITY WARNING') && fbSimilar.includes('gate-2024-cs-q30'),
    'formatRetryFeedback produces targeted originality guidance for TOO_SIMILAR'
  );

  const fbAmbiguous = formatRetryFeedback({
    category: RETRY_CATEGORIES.AMBIGUOUS,
    detail: 'Multiple interpretations possible for the term graph height.',
  });
  assert(
    fbAmbiguous.includes('CLARITY & PRECISION') && fbAmbiguous.includes('unambiguous'),
    'formatRetryFeedback produces targeted ambiguity feedback'
  );

  // Check that raw stack traces or long text are sanitized
  const messyDetail = 'Error at Function.execute (/app/server.js:123:45)\n    at processTicksAndRejections\n' + 'A'.repeat(500);
  const fbSanitized = formatRetryFeedback({
    category: RETRY_CATEGORIES.ANSWER_INCORRECT,
    detail: messyDetail,
  });
  assert(
    !fbSanitized.includes('/app/server.js') && fbSanitized.length < 300,
    'formatRetryFeedback strips stack traces and caps length safely'
  );

  // Prompt formatting with feedback
  const promptWithFeedback = buildQuestionGenerationPrompt({
    subject: 'Databases',
    topic: 'Normalization',
    questionType: 'MCQ',
    retryFeedback: fbSimilar,
  });
  assert(
    promptWithFeedback.includes('PREVIOUS ATTEMPT FEEDBACK (CORRECTIVE ACTION REQUIRED)') &&
    promptWithFeedback.includes('ORIGINALITY WARNING'),
    'buildQuestionGenerationPrompt embeds retryFeedback section when provided'
  );

  const promptWithoutFeedback = buildQuestionGenerationPrompt({
    subject: 'Databases',
    topic: 'Normalization',
    questionType: 'MCQ',
  });
  assert(
    !promptWithoutFeedback.includes('PREVIOUS ATTEMPT FEEDBACK'),
    'buildQuestionGenerationPrompt omits feedback section when retryFeedback is absent'
  );

  // -------------------------------------------------------------
  // Section 3: Bounded Regeneration Loop (Mock Scenarios)
  // -------------------------------------------------------------
  console.log('\n[SECTION 3] Bounded Regeneration Loop Unit Scenarios');

  const validQuestionCandidate = {
    question: 'Consider relation R(W, X, Y, Z) with FDs W -> X, X -> Y, Y -> Z. What is the candidate key?',
    questionType: 'MCQ',
    options: [
      { id: 'A', text: 'W' },
      { id: 'B', text: 'X' },
      { id: 'C', text: 'Y' },
      { id: 'D', text: 'Z' },
    ],
    correctAnswer: 'A',
    explanation: 'Closure of W is {W, X, Y, Z}. No other attribute can determine W. Hence W is the unique candidate key.',
    subject: 'Databases',
    topic: 'Normalization',
    concepts: ['candidate keys', 'functional dependency'],
    reasoningType: ['deductive'],
    difficulty: 'Medium',
  };

  // Scenario 1: First Attempt Success (No Retry Needed)
  {
    const mockAi = {
      isConfigured: () => true,
      getProviderName: () => 'MockGemini',
      generateStructured: async () => ({
        data: { ...validQuestionCandidate },
        latencyMs: 120,
        model: 'gemini-mock',
      }),
    };
    const mockVerifier = {
      verifyQuestion: async () => ({
        verification: { valid: true, issues: [], confidence: 0.95 },
        latencyMs: 80,
      }),
    };
    const mockSimilarity = {
      checkSimilarity: () => ({ passed: true, maxSimilarity: 0.2, threshold: 0.75 }),
    };

    const service = new QuestionGenerationService(mockAi, mockVerifier, mockSimilarity, 3);
    const mockDb = new MockDb([samplePYQ]);

    const result = await service.generateQuestionWithContext(
      { subject: 'Databases', questionType: 'MCQ' },
      mockDb
    );

    assert(result.success === true, 'Scenario 1: Single attempt returns success: true');
    assert(result.status === 'VERIFIED', 'Scenario 1: status is VERIFIED');
    assert(result.attemptCount === 1, 'Scenario 1: attemptCount is exactly 1', `Got: ${result.attemptCount}`);
    assert(
      JSON.stringify(result.attemptStatuses) === JSON.stringify(['VERIFIED']),
      'Scenario 1: attemptStatuses is ["VERIFIED"]'
    );
  }

  // Scenario A: Attempt 1 is TOO_SIMILAR -> Attempt 2 is VERIFIED (count = 2)
  {
    let callCount = 0;
    const mockAi = {
      isConfigured: () => true,
      getProviderName: () => 'MockGemini',
      generateStructured: async (prompt) => {
        callCount++;
        return {
          data: {
            ...validQuestionCandidate,
            question: callCount === 1
              ? 'Given relation R(A, B, C, D) with FDs: A -> B, B -> C, C -> D, D -> A. What is the normal form?' // near identical
              : 'Given relation S(P, Q, R) with FD P -> Q. Find candidate key.',
          },
          latencyMs: 150,
          model: 'gemini-mock',
        };
      },
    };
    const mockVerifier = {
      verifyQuestion: async () => ({
        verification: { valid: true, issues: [], confidence: 0.92 },
        latencyMs: 90,
      }),
    };
    const mockSimilarity = {
      checkSimilarity: (q) => {
        if (q.question.includes('R(A, B, C, D)')) {
          return {
            passed: false,
            maxSimilarity: 0.92,
            threshold: 0.75,
            mostSimilarQuestionId: 'gate-2024-cs-q30',
          };
        }
        return {
          passed: true,
          maxSimilarity: 0.25,
          threshold: 0.75,
          mostSimilarQuestionId: null,
        };
      },
    };

    const service = new QuestionGenerationService(mockAi, mockVerifier, mockSimilarity, 3);
    const mockDb = new MockDb([samplePYQ]);

    const result = await service.generateQuestionWithContext(
      { subject: 'Databases', questionType: 'MCQ' },
      mockDb
    );

    assert(result.success === true, 'Scenario A: Retry on TOO_SIMILAR recovers to success: true');
    assert(result.status === 'VERIFIED', 'Scenario A: Final status is VERIFIED');
    assert(result.attemptCount === 2, 'Scenario A: attemptCount is exactly 2', `Got: ${result.attemptCount}`);
    assert(
      JSON.stringify(result.attemptStatuses) === JSON.stringify(['TOO_SIMILAR', 'VERIFIED']),
      'Scenario A: attemptStatuses is ["TOO_SIMILAR", "VERIFIED"]'
    );
  }

  // Scenario B: Multi-Failure Sequence (Attempt 1: Structure Invalid -> Attempt 2: Ambiguous -> Attempt 3: VERIFIED)
  {
    let callCount = 0;
    const mockAi = {
      isConfigured: () => true,
      getProviderName: () => 'MockGemini',
      generateStructured: async (prompt) => {
        callCount++;
        if (callCount === 1) {
          // Structural failure: missing options for MCQ
          return {
            data: {
              question: 'Incomplete question?',
              questionType: 'MCQ',
              options: [], // invalid for MCQ!
              correctAnswer: 'A',
              explanation: 'None',
            },
            latencyMs: 100,
            model: 'gemini-mock',
          };
        }
        if (callCount === 2) {
          // Ambiguous question
          return {
            data: {
              ...validQuestionCandidate,
              question: 'Is normal form good or bad?',
            },
            latencyMs: 100,
            model: 'gemini-mock',
          };
        }
        // Attempt 3: perfect
        return {
          data: { ...validQuestionCandidate },
          latencyMs: 100,
          model: 'gemini-mock',
        };
      },
    };

    let verifierCalls = 0;
    const mockVerifier = {
      verifyQuestion: async (q) => {
        verifierCalls++;
        if (q.question.includes('good or bad')) {
          return {
            verification: {
              valid: false,
              ambiguityDetected: true,
              explanationConsistent: true,
              conceptMatch: true,
              difficultyMatch: true,
              issues: ['Question prompt is subjective and ambiguous.'],
              confidence: 0.9,
            },
            latencyMs: 80,
          };
        }
        return {
          verification: { valid: true, issues: [], confidence: 0.95 },
          latencyMs: 80,
        };
      },
    };

    let similarityCalls = 0;
    const mockSimilarity = {
      checkSimilarity: () => {
        similarityCalls++;
        return { passed: true, maxSimilarity: 0.2, threshold: 0.75 };
      },
    };

    const service = new QuestionGenerationService(mockAi, mockVerifier, mockSimilarity, 3);
    const mockDb = new MockDb([samplePYQ]);

    const result = await service.generateQuestionWithContext(
      { subject: 'Databases', questionType: 'MCQ' },
      mockDb
    );

    assert(result.success === true, 'Scenario B: Multi-failure retry sequence recovers to success');
    assert(result.status === 'VERIFIED', 'Scenario B: Final status is VERIFIED');
    assert(result.attemptCount === 3, 'Scenario B: attemptCount is exactly 3', `Got: ${result.attemptCount}`);
    assert(
      JSON.stringify(result.attemptStatuses) ===
        JSON.stringify(['STRUCTURAL_VALIDATION_FAILED', 'CANDIDATE_REJECTED', 'VERIFIED']),
      'Scenario B: attemptStatuses tracked correctly: [STRUCTURAL_VALIDATION_FAILED, CANDIDATE_REJECTED, VERIFIED]'
    );
    assert(
      verifierCalls === 2,
      'Scenario B: Verifier called only on structurally valid attempts (short-circuit on Attempt 1 verified)',
      `Verifier calls: ${verifierCalls}`
    );
    assert(
      similarityCalls === 1,
      'Scenario B: Similarity checked only on semantically valid attempts (short-circuit on Attempt 2 verified)',
      `Similarity calls: ${similarityCalls}`
    );
  }

  // Scenario C: Exhaustion of All 3 Attempts -> GENERATION_ATTEMPTS_EXHAUSTED
  {
    let callCount = 0;
    const mockAi = {
      isConfigured: () => true,
      getProviderName: () => 'MockGemini',
      generateStructured: async () => {
        callCount++;
        return {
          data: { ...validQuestionCandidate, question: `Broken attempt ${callCount}` },
          latencyMs: 100,
          model: 'gemini-mock',
        };
      },
    };
    const mockVerifier = {
      verifyQuestion: async () => ({
        verification: {
          valid: false,
          ambiguityDetected: false,
          explanationConsistent: false,
          conceptMatch: true,
          difficultyMatch: true,
          issues: ['Answer does not match derivation.'],
          confidence: 0.9,
        },
        latencyMs: 70,
      }),
    };
    const mockSimilarity = {
      checkSimilarity: () => ({ passed: true, maxSimilarity: 0.1, threshold: 0.75 }),
    };

    const service = new QuestionGenerationService(mockAi, mockVerifier, mockSimilarity, 3);
    const mockDb = new MockDb([samplePYQ]);

    const result = await service.generateQuestionWithContext(
      { subject: 'Databases', questionType: 'MCQ' },
      mockDb
    );

    assert(result.success === false, 'Scenario C: Exhaustion returns success: false');
    assert(
      result.status === 'GENERATION_ATTEMPTS_EXHAUSTED',
      'Scenario C: status is GENERATION_ATTEMPTS_EXHAUSTED'
    );
    assert(result.attemptCount === 3, 'Scenario C: attemptCount reached limit (3)', `Got: ${result.attemptCount}`);
    assert(
      JSON.stringify(result.attemptStatuses) ===
        JSON.stringify(['CANDIDATE_REJECTED', 'CANDIDATE_REJECTED', 'CANDIDATE_REJECTED']),
      'Scenario C: attemptStatuses shows all 3 rejections'
    );
    assert(
      Boolean(result.lastFailureReason),
      'Scenario C: lastFailureReason is populated',
      result.lastFailureReason
    );
    assert(result.question === undefined, 'Scenario C: question object is not returned on exhaustion');
  }

  // Scenario D: Non-Retryable Error (AI_AUTH_ERROR or AI_NOT_CONFIGURED)
  {
    let callCount = 0;
    const mockAi = {
      isConfigured: () => true,
      getProviderName: () => 'MockGemini',
      generateStructured: async () => {
        callCount++;
        throw new AIError('API key expired or invalid.', 'AI_AUTH_ERROR', 401);
      },
    };
    const mockVerifier = { verifyQuestion: async () => ({}) };
    const mockSimilarity = { checkSimilarity: () => ({}) };

    const service = new QuestionGenerationService(mockAi, mockVerifier, mockSimilarity, 3);
    const mockDb = new MockDb([samplePYQ]);

    let caughtError = null;
    try {
      await service.generateQuestionWithContext(
        { subject: 'Databases', questionType: 'MCQ' },
        mockDb
      );
    } catch (err) {
      caughtError = err;
    }

    assert(
      caughtError && caughtError.code === 'AI_AUTH_ERROR',
      'Scenario D: AI_AUTH_ERROR is thrown immediately without retrying'
    );
    assert(callCount === 1, 'Scenario D: AI service was called exactly once (no retry on auth error)');
  }

  // Scenario E: Malformed Client Requests Fail Fast (400)
  {
    const service = new QuestionGenerationService();
    const mockDb = new MockDb([samplePYQ]);

    let missingSubjectErr = null;
    try {
      await service.generateQuestionWithContext({ questionType: 'MCQ' }, mockDb);
    } catch (err) {
      missingSubjectErr = err;
    }
    assert(
      missingSubjectErr && missingSubjectErr.code === 'MISSING_REQUIRED_FIELD',
      'Scenario E: Missing subject fails immediately with 400 MISSING_REQUIRED_FIELD'
    );

    let invalidTypeErr = null;
    try {
      await service.generateQuestionWithContext({ subject: 'Databases', questionType: 'INVALID_TYPE' }, mockDb);
    } catch (err) {
      invalidTypeErr = err;
    }
    assert(
      invalidTypeErr && invalidTypeErr.code === 'INVALID_QUESTION_TYPE',
      'Scenario E: Invalid questionType fails immediately with 400 INVALID_QUESTION_TYPE'
    );
  }

  // Scenario F: Official PYQ Context Retrieved Exactly Once Across Retries
  {
    let getContextCallCount = 0;
    // We can spy on pyqEnrichmentService by passing a mock db with a spy
    const spyDb = {
      findAll: () => {
        getContextCallCount++;
        return [samplePYQ];
      },
    };

    let callCount = 0;
    const mockAi = {
      isConfigured: () => true,
      getProviderName: () => 'MockGemini',
      generateStructured: async () => {
        callCount++;
        if (callCount < 3) {
          // Reject to force retry
          return {
            data: {
              question: 'Incomplete',
              questionType: 'MCQ',
              options: [],
              correctAnswer: 'A',
              explanation: 'None',
            },
            latencyMs: 100,
            model: 'gemini-mock',
          };
        }
        return {
          data: { ...validQuestionCandidate },
          latencyMs: 100,
          model: 'gemini-mock',
        };
      },
    };
    const mockVerifier = {
      verifyQuestion: async () => ({ verification: { valid: true, issues: [] }, latencyMs: 50 }),
    };
    const mockSimilarity = {
      checkSimilarity: () => ({ passed: true, maxSimilarity: 0.1, threshold: 0.75 }),
    };

    const service = new QuestionGenerationService(mockAi, mockVerifier, mockSimilarity, 3);
    await service.generateQuestionWithContext({ subject: 'Databases', questionType: 'MCQ' }, spyDb);

    assert(
      getContextCallCount === 1,
      'Scenario F: Database query for official PYQ context is executed exactly once across 3 attempts',
      `DB calls: ${getContextCallCount}`
    );
  }

  // -------------------------------------------------------------
  // Section 4: Live Server Integration & Controlled Live Call
  // -------------------------------------------------------------
  console.log('\n[SECTION 4] Live Server Endpoint Verification (/api/ai/generate-question)');

  try {
    const healthRes = await fetch(`${API_BASE}/api/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200, 'Backend server is running and healthy', `Status: ${healthData.status}`);

    const genRes = await fetch(`${API_BASE}/api/ai/generate-question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: 'Databases',
        topic: 'Relational Model',
        difficulty: 'Medium',
        questionType: 'MCQ',
        concepts: ['relational algebra', 'tuple relational calculus'],
      }),
    });

    const genData = await genRes.json();
    assert(genRes.status === 200, 'POST /api/ai/generate-question returns HTTP 200');
    assert(
      genData.status === 'VERIFIED' || genData.status === 'GENERATION_ATTEMPTS_EXHAUSTED',
      'Response has recognized status (VERIFIED or GENERATION_ATTEMPTS_EXHAUSTED)',
      `Got: ${genData.status}`
    );
    assert(
      typeof genData.attemptCount === 'number' && genData.attemptCount >= 1 && genData.attemptCount <= 3,
      'Response includes attemptCount bounded between 1 and 3',
      `attemptCount: ${genData.attemptCount}`
    );
    assert(
      Array.isArray(genData.attemptStatuses) && genData.attemptStatuses.length === genData.attemptCount,
      'Response includes attemptStatuses matching attemptCount',
      `attemptStatuses: ${JSON.stringify(genData.attemptStatuses)}`
    );

    if (genData.status === 'VERIFIED') {
      assert(Boolean(genData.question), 'VERIFIED response contains question object');
      assert(genData.question.source?.type === 'AI_GENERATED', 'Question is tagged source: { type: "AI_GENERATED" }');
      assert(Boolean(genData.validation?.semanticVerification), 'VERIFIED response contains semanticVerification');
      assert(Boolean(genData.validation?.similarity?.passed), 'VERIFIED response contains similarity check passing');
    }
  } catch (err) {
    console.error('Live integration test error:', err.message);
    assert(false, 'Live integration tests failed to run', err.message);
  }

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`Checkpoint 3C.6 Test Results: ${passedTests}/${totalTests} passed (${failedTests} failed)`);
  console.log('===============================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runCheckpoint3C6Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
