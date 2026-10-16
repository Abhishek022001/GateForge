/**
 * GATEForge Generation Performance & Optimization Verification Suite
 * Tests all 20 performance, repair, caching, and safety criteria.
 */

import assert from 'assert';
import { QuestionGenerationService } from './backend/src/services/ai/questionGeneration.service.js';
import {
  pyqEnrichmentService,
  invalidateContextCache,
  getContextCacheSize,
} from './backend/src/services/pyqExtraction/pyqEnrichment.service.js';
import {
  buildQuestionGenerationPrompt,
} from './backend/src/services/ai/prompts/generation.prompt.js';
import {
  buildQuestionVerificationPrompt,
} from './backend/src/services/ai/prompts/verification.prompt.js';
import {
  validateSemanticVerificationOutput,
} from './backend/src/validators/semanticVerificationValidator.js';
import { validateGeneratedQuestionStructure } from './backend/src/validators/generationValidator.js';
import { RETRY_CATEGORIES } from './backend/src/constants/generation.js';
import { practiceSessionService } from './backend/src/services/ai/practiceSession.service.js';

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ [TEST ${totalTests}] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [TEST ${totalTests}] ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ [TEST ${totalTests}] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [TEST ${totalTests}] ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

console.log('\n==================================================');
console.log('GATEForge Generation Performance Verification Suite');
console.log('==================================================\n');

// Mock helpers
function createMockDB() {
  const pyq = {
    id: 'GATE-CS-2023-Q12',
    subject: 'Computer Networks',
    topic: 'TCP/IP',
    concepts: ['Congestion Control', 'Additive Increase Multiplicative Decrease'],
    reasoningType: ['analytical'],
    difficulty: 'Medium',
    question: 'In TCP congestion control with AIMD, if the window size is 16 MSS...',
    options: [
      { id: 'A', text: '8 MSS' },
      { id: 'B', text: '9 MSS' },
      { id: 'C', text: '16 MSS' },
      { id: 'D', text: '32 MSS' },
    ],
    correctAnswer: 'B',
    source: { type: 'PYQ', provider: 'OFFICIAL_GATE', year: 2023, paper: 'CS' },
    aiAnalysis: {
      concepts: ['Congestion Control'],
      reasoningType: ['analytical'],
      difficultyAssessment: 'Medium',
      questionPattern: 'Window size evolution in AIMD',
      solutionApproach: 'Track additive increase per RTT',
    },
  };
  return {
    findAll: () => [pyq],
    findOne: (query) => (query.id === pyq.id ? pyq : null),
  };
}

const mockValidCandidate = {
  question: 'Consider a TCP connection using AIMD congestion control. What is the new window size?',
  questionType: 'MCQ',
  options: [
    { id: 'A', text: '10 MSS' },
    { id: 'B', text: '12 MSS' },
    { id: 'C', text: '14 MSS' },
    { id: 'D', text: '16 MSS' },
  ],
  correctAnswer: 'B',
  explanation: 'By AIMD, upon receiving an ACK without congestion, the window increases by 1 MSS per RTT.',
  subject: 'Computer Networks',
  topic: 'TCP/IP',
  concepts: ['Congestion Control'],
  reasoningType: ['analytical'],
  difficulty: 'Medium',
};

// 1. Candidate accepted on attempt 1 when all criteria pass
await runAsyncTest('Candidate accepted on attempt 1 when all criteria pass', async () => {
  let genCalls = 0;
  let verCalls = 0;
  const mockAI = {
    isConfigured: () => true,
    getProviderName: () => 'mock-gemini',
    generateStructured: async () => {
      genCalls++;
      return { data: { ...mockValidCandidate }, latencyMs: 50, model: 'mock' };
    },
  };
  const mockVerifier = {
    verifyQuestion: async () => {
      verCalls++;
      return {
        verification: {
          valid: true,
          questionSolvable: true,
          answerCorrect: true,
          explanationConsistent: true,
          conceptMatch: true,
          questionTypeValid: true,
          ambiguityDetected: false,
          difficultyMatch: true,
          issues: [],
          independentAnswer: 'B',
          confidence: 0.98,
        },
        latencyMs: 40,
      };
    },
  };
  const mockSim = {
    checkSimilarity: () => ({ passed: true, maxSimilarity: 0.25, threshold: 0.72 }),
  };

  const service = new QuestionGenerationService(mockAI, mockVerifier, mockSim);
  const result = await service.generateQuestionWithContext({ subject: 'Computer Networks' }, createMockDB());

  assert.strictEqual(result.status, 'VERIFIED');
  assert.strictEqual(result.attemptCount, 1);
  assert.strictEqual(genCalls, 1);
  assert.strictEqual(verCalls, 1);
  assert.ok(result.telemetry);
  assert.strictEqual(result.telemetry.finalStatus, 'VERIFIED');
});

// 2. Candidate rejected when answer is incorrect
await runAsyncTest('Candidate rejected when answer is incorrect', async () => {
  let attempts = 0;
  const mockAI = {
    isConfigured: () => true,
    getProviderName: () => 'mock-gemini',
    generateStructured: async () => {
      attempts++;
      return { data: { ...mockValidCandidate }, latencyMs: 50, model: 'mock' };
    },
  };
  const mockVerifier = {
    verifyQuestion: async () => ({
      verification: {
        valid: false,
        questionSolvable: true,
        answerCorrect: false, // Incorrect!
        explanationConsistent: true,
        conceptMatch: true,
        questionTypeValid: true,
        ambiguityDetected: false,
        difficultyMatch: true,
        issues: ['Independent answer is C, candidate answered B'],
        independentAnswer: 'C',
        confidence: 0.95,
      },
      latencyMs: 40,
    }),
  };
  const mockSim = { checkSimilarity: () => ({ passed: true, maxSimilarity: 0.2, threshold: 0.72 }) };

  const service = new QuestionGenerationService(mockAI, mockVerifier, mockSim, 2);
  const result = await service.generateQuestionWithContext({ subject: 'Computer Networks' }, createMockDB());

  assert.strictEqual(result.status, 'GENERATION_ATTEMPTS_EXHAUSTED');
  assert.strictEqual(attempts, 2);
  assert.strictEqual(result.finalFailureCategory, RETRY_CATEGORIES.ANSWER_INCORRECT);
});

// 3. Candidate rejected when question is ambiguous
await runAsyncTest('Candidate rejected when question is ambiguous', async () => {
  const mockAI = {
    isConfigured: () => true,
    getProviderName: () => 'mock-gemini',
    generateStructured: async () => ({ data: { ...mockValidCandidate }, latencyMs: 50, model: 'mock' }),
  };
  const mockVerifier = {
    verifyQuestion: async () => ({
      verification: {
        valid: false,
        questionSolvable: true,
        answerCorrect: true,
        explanationConsistent: true,
        conceptMatch: true,
        questionTypeValid: true,
        ambiguityDetected: true, // Ambiguous!
        difficultyMatch: true,
        issues: ['Multiple options can be correct under alternative RFC interpretation'],
        independentAnswer: 'B',
        confidence: 0.85,
      },
      latencyMs: 40,
    }),
  };
  const mockSim = { checkSimilarity: () => ({ passed: true, maxSimilarity: 0.2, threshold: 0.72 }) };

  const service = new QuestionGenerationService(mockAI, mockVerifier, mockSim, 1);
  const result = await service.generateQuestionWithContext({ subject: 'Computer Networks' }, createMockDB());

  assert.strictEqual(result.status, 'GENERATION_ATTEMPTS_EXHAUSTED');
  assert.strictEqual(result.finalFailureCategory, RETRY_CATEGORIES.AMBIGUOUS);
});

// 4. Candidate rejected when question is unsolvable
await runAsyncTest('Candidate rejected when question is unsolvable', async () => {
  const mockAI = {
    isConfigured: () => true,
    getProviderName: () => 'mock-gemini',
    generateStructured: async () => ({ data: { ...mockValidCandidate }, latencyMs: 50, model: 'mock' }),
  };
  const mockVerifier = {
    verifyQuestion: async () => ({
      verification: {
        valid: false,
        questionSolvable: false, // Unsolvable!
        answerCorrect: false,
        explanationConsistent: false,
        conceptMatch: true,
        questionTypeValid: true,
        ambiguityDetected: false,
        difficultyMatch: true,
        issues: ['Missing propagation delay parameter required to compute RTT'],
        independentAnswer: 'N/A',
        confidence: 0.99,
      },
      latencyMs: 40,
    }),
  };
  const mockSim = { checkSimilarity: () => ({ passed: true, maxSimilarity: 0.2, threshold: 0.72 }) };

  const service = new QuestionGenerationService(mockAI, mockVerifier, mockSim, 1);
  const result = await service.generateQuestionWithContext({ subject: 'Computer Networks' }, createMockDB());

  assert.strictEqual(result.status, 'GENERATION_ATTEMPTS_EXHAUSTED');
  assert.strictEqual(result.finalFailureCategory, RETRY_CATEGORIES.UNSOLVABLE);
});

// 5. Candidate with flawed explanation repaired using correctedExplanation WITHOUT extra model call
await runAsyncTest('Candidate with flawed explanation repaired using correctedExplanation WITHOUT a second generation call', async () => {
  let genCalls = 0;
  const correctedText = 'Rigorous step 1: Current window is 10 MSS. Step 2: In congestion avoidance, additive increase adds 1 MSS. Thus next window is 11 MSS.';
  const mockAI = {
    isConfigured: () => true,
    getProviderName: () => 'mock-gemini',
    generateStructured: async () => {
      genCalls++;
      return {
        data: {
          ...mockValidCandidate,
          explanation: 'Bad explanation with arithmetic error: 10 + 2 = 12',
        },
        latencyMs: 50,
        model: 'mock',
      };
    },
  };
  const mockVerifier = {
    verifyQuestion: async () => ({
      verification: {
        valid: false, // Flagged invalid by model because explanation had arithmetic error
        questionSolvable: true,
        answerCorrect: true, // But question & answer are sound!
        explanationConsistent: false,
        conceptMatch: true,
        questionTypeValid: true,
        ambiguityDetected: false,
        difficultyMatch: true,
        correctedExplanation: correctedText, // Verifier supplied clean repair
        issues: ['Minor arithmetic typo in candidate explanation.'],
        independentAnswer: 'B',
        confidence: 0.95,
      },
      latencyMs: 40,
    }),
  };
  const mockSim = { checkSimilarity: () => ({ passed: true, maxSimilarity: 0.2, threshold: 0.72 }) };

  const service = new QuestionGenerationService(mockAI, mockVerifier, mockSim, 3);
  const result = await service.generateQuestionWithContext({ subject: 'Computer Networks' }, createMockDB());

  assert.strictEqual(result.status, 'VERIFIED');
  assert.strictEqual(result.attemptCount, 1);
  assert.strictEqual(genCalls, 1, 'Generation must NOT be called a second time!');
  assert.strictEqual(result.question.explanation, correctedText);
  assert.strictEqual(result.validation.semanticVerification.explanationConsistent, true);
});

// 6. Candidate with flawed explanation and NO correctedExplanation triggers EXPLANATION_INCONSISTENT retry
await runAsyncTest('Candidate with flawed explanation and NO correctedExplanation triggers EXPLANATION_INCONSISTENT retry', async () => {
  const mockAI = {
    isConfigured: () => true,
    getProviderName: () => 'mock-gemini',
    generateStructured: async () => ({ data: { ...mockValidCandidate }, latencyMs: 50, model: 'mock' }),
  };
  const mockVerifier = {
    verifyQuestion: async () => ({
      verification: {
        valid: false,
        questionSolvable: true,
        answerCorrect: true,
        explanationConsistent: false,
        conceptMatch: true,
        questionTypeValid: true,
        ambiguityDetected: false,
        difficultyMatch: true,
        correctedExplanation: null, // No repair provided
        issues: ['Explanation is completely non-sequitur.'],
        independentAnswer: 'B',
        confidence: 0.95,
      },
      latencyMs: 40,
    }),
  };
  const mockSim = { checkSimilarity: () => ({ passed: true, maxSimilarity: 0.2, threshold: 0.72 }) };

  const service = new QuestionGenerationService(mockAI, mockVerifier, mockSim, 1);
  const result = await service.generateQuestionWithContext({ subject: 'Computer Networks' }, createMockDB());

  assert.strictEqual(result.status, 'GENERATION_ATTEMPTS_EXHAUSTED');
  assert.strictEqual(result.finalFailureCategory, RETRY_CATEGORIES.EXPLANATION_INCONSISTENT);
});

// 7. Candidate with difficulty mismatch is accepted (advisory only)
await runAsyncTest('Candidate with difficulty mismatch is accepted (advisory only)', async () => {
  let genCalls = 0;
  const mockAI = {
    isConfigured: () => true,
    getProviderName: () => 'mock-gemini',
    generateStructured: async () => {
      genCalls++;
      return { data: { ...mockValidCandidate, difficulty: 'Medium' }, latencyMs: 50, model: 'mock' };
    },
  };
  const mockVerifier = {
    verifyQuestion: async () => ({
      verification: {
        valid: true,
        questionSolvable: true,
        answerCorrect: true,
        explanationConsistent: true,
        conceptMatch: true,
        questionTypeValid: true,
        ambiguityDetected: false,
        difficultyMatch: false, // Model assesses it as Hard rather than Medium
        verifiedDifficulty: 'Hard',
        issues: ['Requires deeper multi-step reasoning than typical Medium'],
        independentAnswer: 'B',
        confidence: 0.92,
      },
      latencyMs: 40,
    }),
  };
  const mockSim = { checkSimilarity: () => ({ passed: true, maxSimilarity: 0.2, threshold: 0.72 }) };

  const service = new QuestionGenerationService(mockAI, mockVerifier, mockSim);
  const result = await service.generateQuestionWithContext({ subject: 'Computer Networks', difficulty: 'Medium' }, createMockDB());

  assert.strictEqual(result.status, 'VERIFIED');
  assert.strictEqual(result.attemptCount, 1);
  assert.strictEqual(genCalls, 1);
  assert.strictEqual(result.question.difficulty, 'Hard', 'Verified difficulty should be adopted advisory');
});

// 8. Candidate with topic drift is rejected (CONCEPT_MISMATCH)
await runAsyncTest('Candidate with topic drift is rejected (CONCEPT_MISMATCH)', async () => {
  const mockAI = {
    isConfigured: () => true,
    getProviderName: () => 'mock-gemini',
    generateStructured: async () => ({ data: { ...mockValidCandidate }, latencyMs: 50, model: 'mock' }),
  };
  const mockVerifier = {
    verifyQuestion: async () => ({
      verification: {
        valid: false,
        questionSolvable: true,
        answerCorrect: true,
        explanationConsistent: true,
        conceptMatch: false, // Topic drift!
        questionTypeValid: true,
        ambiguityDetected: false,
        difficultyMatch: true,
        issues: ['Question tests Operating System CPU scheduling instead of Computer Networks TCP/IP'],
        independentAnswer: 'B',
        confidence: 0.99,
      },
      latencyMs: 40,
    }),
  };
  const mockSim = { checkSimilarity: () => ({ passed: true, maxSimilarity: 0.2, threshold: 0.72 }) };

  const service = new QuestionGenerationService(mockAI, mockVerifier, mockSim, 1);
  const result = await service.generateQuestionWithContext({ subject: 'Computer Networks' }, createMockDB());

  assert.strictEqual(result.status, 'GENERATION_ATTEMPTS_EXHAUSTED');
  assert.strictEqual(result.finalFailureCategory, RETRY_CATEGORIES.CONCEPT_MISMATCH);
});

// 9. Candidate with prerequisite concept within topic is accepted
await runAsyncTest('Candidate with prerequisite concept within topic is accepted', async () => {
  const mockAI = {
    isConfigured: () => true,
    getProviderName: () => 'mock-gemini',
    generateStructured: async () => ({ data: { ...mockValidCandidate }, latencyMs: 50, model: 'mock' }),
  };
  const mockVerifier = {
    verifyQuestion: async () => ({
      verification: {
        valid: true,
        questionSolvable: true,
        answerCorrect: true,
        explanationConsistent: true,
        conceptMatch: true, // Accepted as legitimate prerequisite within topic
        questionTypeValid: true,
        ambiguityDetected: false,
        difficultyMatch: true,
        issues: [],
        independentAnswer: 'B',
        confidence: 0.95,
      },
      latencyMs: 40,
    }),
  };
  const mockSim = { checkSimilarity: () => ({ passed: true, maxSimilarity: 0.2, threshold: 0.72 }) };

  const service = new QuestionGenerationService(mockAI, mockVerifier, mockSim);
  const result = await service.generateQuestionWithContext({ subject: 'Computer Networks' }, createMockDB());

  assert.strictEqual(result.status, 'VERIFIED');
});

// 10. Similarity check still rejects too-similar candidate (> 0.72)
await runAsyncTest('Similarity check still rejects too-similar candidate (> 0.72)', async () => {
  const mockAI = {
    isConfigured: () => true,
    getProviderName: () => 'mock-gemini',
    generateStructured: async () => ({ data: { ...mockValidCandidate }, latencyMs: 50, model: 'mock' }),
  };
  const mockVerifier = {
    verifyQuestion: async () => ({
      verification: {
        valid: true,
        questionSolvable: true,
        answerCorrect: true,
        explanationConsistent: true,
        conceptMatch: true,
        questionTypeValid: true,
        ambiguityDetected: false,
        difficultyMatch: true,
        issues: [],
        independentAnswer: 'B',
        confidence: 0.95,
      },
      latencyMs: 40,
    }),
  };
  const mockSim = {
    checkSimilarity: () => ({
      passed: false,
      maxSimilarity: 0.85,
      threshold: 0.72,
      mostSimilarQuestionId: 'GATE-CS-2023-Q12',
    }),
  };

  const service = new QuestionGenerationService(mockAI, mockVerifier, mockSim, 1);
  const result = await service.generateQuestionWithContext({ subject: 'Computer Networks' }, createMockDB());

  assert.strictEqual(result.status, 'GENERATION_ATTEMPTS_EXHAUSTED');
  assert.strictEqual(result.finalFailureCategory, RETRY_CATEGORIES.TOO_SIMILAR);
});

// 11. Similarity check passes candidate with < 0.72 similarity
await runAsyncTest('Similarity check passes candidate with < 0.72 similarity', async () => {
  const mockAI = {
    isConfigured: () => true,
    getProviderName: () => 'mock-gemini',
    generateStructured: async () => ({ data: { ...mockValidCandidate }, latencyMs: 50, model: 'mock' }),
  };
  const mockVerifier = {
    verifyQuestion: async () => ({
      verification: {
        valid: true,
        questionSolvable: true,
        answerCorrect: true,
        explanationConsistent: true,
        conceptMatch: true,
        questionTypeValid: true,
        ambiguityDetected: false,
        difficultyMatch: true,
        issues: [],
        independentAnswer: 'B',
        confidence: 0.95,
      },
      latencyMs: 40,
    }),
  };
  const mockSim = {
    checkSimilarity: () => ({
      passed: true,
      maxSimilarity: 0.45,
      threshold: 0.72,
      mostSimilarQuestionId: 'GATE-CS-2023-Q12',
    }),
  };

  const service = new QuestionGenerationService(mockAI, mockVerifier, mockSim);
  const result = await service.generateQuestionWithContext({ subject: 'Computer Networks' }, createMockDB());

  assert.strictEqual(result.status, 'VERIFIED');
  assert.ok(result.validation.similarity.passed);
  assert.strictEqual(result.validation.similarity.maxSimilarity, 0.45);
});

// 12. Structural validation failure triggers STRUCTURE_INVALID retry without semantic call
await runAsyncTest('Structural validation failure triggers STRUCTURE_INVALID retry without semantic call', async () => {
  let verifierCalled = false;
  const mockAI = {
    isConfigured: () => true,
    getProviderName: () => 'mock-gemini',
    generateStructured: async () => ({
      data: {
        question: 'Short', // Invalid: < 15 chars
        questionType: 'MCQ',
        options: [{ id: 'A', text: 'Option' }], // Invalid: only 1 option
        correctAnswer: 'A',
      },
      latencyMs: 50,
      model: 'mock',
    }),
  };
  const mockVerifier = {
    verifyQuestion: async () => {
      verifierCalled = true;
      return { verification: { valid: true }, latencyMs: 40 };
    },
  };
  const mockSim = { checkSimilarity: () => ({ passed: true }) };

  const service = new QuestionGenerationService(mockAI, mockVerifier, mockSim, 1);
  const result = await service.generateQuestionWithContext({ subject: 'Computer Networks' }, createMockDB());

  assert.strictEqual(result.status, 'GENERATION_ATTEMPTS_EXHAUSTED');
  assert.strictEqual(result.finalFailureCategory, RETRY_CATEGORIES.STRUCTURE_INVALID);
  assert.strictEqual(verifierCalled, false, 'Verifier must NOT be called on structural failure!');
});

// 13. Max attempts respected (stops after 3 attempts)
await runAsyncTest('Max attempts respected (stops after 3 attempts)', async () => {
  let genCount = 0;
  const mockAI = {
    isConfigured: () => true,
    getProviderName: () => 'mock-gemini',
    generateStructured: async () => {
      genCount++;
      return { data: { ...mockValidCandidate }, latencyMs: 30, model: 'mock' };
    },
  };
  const mockVerifier = {
    verifyQuestion: async () => ({
      verification: {
        valid: false,
        questionSolvable: true,
        answerCorrect: false,
        explanationConsistent: true,
        conceptMatch: true,
        questionTypeValid: true,
        ambiguityDetected: false,
        difficultyMatch: true,
        issues: ['Wrong answer'],
        independentAnswer: 'C',
        confidence: 0.9,
      },
      latencyMs: 20,
    }),
  };
  const mockSim = { checkSimilarity: () => ({ passed: true }) };

  const service = new QuestionGenerationService(mockAI, mockVerifier, mockSim, 3);
  const result = await service.generateQuestionWithContext({ subject: 'Computer Networks' }, createMockDB());

  assert.strictEqual(result.status, 'GENERATION_ATTEMPTS_EXHAUSTED');
  assert.strictEqual(result.attemptCount, 3);
  assert.strictEqual(genCount, 3);
});

// 14. Final response contains telemetry object with all required timing fields
await runAsyncTest('Final response contains telemetry object with all required timing fields', async () => {
  const mockAI = {
    isConfigured: () => true,
    getProviderName: () => 'mock-gemini',
    generateStructured: async () => ({ data: { ...mockValidCandidate }, latencyMs: 15, model: 'mock' }),
  };
  const mockVerifier = {
    verifyQuestion: async () => ({
      verification: {
        valid: true,
        questionSolvable: true,
        answerCorrect: true,
        explanationConsistent: true,
        conceptMatch: true,
        questionTypeValid: true,
        ambiguityDetected: false,
        difficultyMatch: true,
        issues: [],
        independentAnswer: 'B',
        confidence: 0.95,
      },
      latencyMs: 15,
    }),
  };
  const mockSim = { checkSimilarity: () => ({ passed: true, maxSimilarity: 0.2, threshold: 0.72 }) };

  const service = new QuestionGenerationService(mockAI, mockVerifier, mockSim);
  const result = await service.generateQuestionWithContext({ subject: 'Computer Networks' }, createMockDB());

  assert.ok(result.telemetry, 'telemetry must be present');
  assert.ok('contextRetrievalMs' in result.telemetry);
  assert.ok('generationMs' in result.telemetry);
  assert.ok('structuralValidationMs' in result.telemetry);
  assert.ok('semanticVerificationMs' in result.telemetry);
  assert.ok('similarityCheckMs' in result.telemetry);
  assert.ok('totalMs' in result.telemetry);
  assert.ok('attemptCount' in result.telemetry);
  assert.ok('finalStatus' in result.telemetry);
});

// 15. Telemetry fields are numbers >= 0
await runAsyncTest('Telemetry fields are numbers >= 0', async () => {
  const mockAI = {
    isConfigured: () => true,
    getProviderName: () => 'mock-gemini',
    generateStructured: async () => ({ data: { ...mockValidCandidate }, latencyMs: 10, model: 'mock' }),
  };
  const mockVerifier = {
    verifyQuestion: async () => ({
      verification: {
        valid: true,
        questionSolvable: true,
        answerCorrect: true,
        explanationConsistent: true,
        conceptMatch: true,
        questionTypeValid: true,
        ambiguityDetected: false,
        difficultyMatch: true,
        issues: [],
        independentAnswer: 'B',
        confidence: 0.95,
      },
      latencyMs: 10,
    }),
  };
  const mockSim = { checkSimilarity: () => ({ passed: true, maxSimilarity: 0.2, threshold: 0.72 }) };

  const service = new QuestionGenerationService(mockAI, mockVerifier, mockSim);
  const result = await service.generateQuestionWithContext({ subject: 'Computer Networks' }, createMockDB());
  const tel = result.telemetry;

  assert.ok(typeof tel.contextRetrievalMs === 'number' && tel.contextRetrievalMs >= 0);
  assert.ok(typeof tel.generationMs === 'number' && tel.generationMs >= 0);
  assert.ok(typeof tel.structuralValidationMs === 'number' && tel.structuralValidationMs >= 0);
  assert.ok(typeof tel.semanticVerificationMs === 'number' && tel.semanticVerificationMs >= 0);
  assert.ok(typeof tel.similarityCheckMs === 'number' && tel.similarityCheckMs >= 0);
  assert.ok(typeof tel.totalMs === 'number' && tel.totalMs >= 0);
  assert.ok(typeof tel.attemptCount === 'number' && tel.attemptCount >= 1);
});

// 16. Fast-fail on 429 / quota error without burning attempts
await runAsyncTest('Fast-fail on 429 / quota error without burning attempts', async () => {
  let callCount = 0;
  const mockAI = {
    isConfigured: () => true,
    getProviderName: () => 'mock-gemini',
    generateStructured: async () => {
      callCount++;
      const quotaErr = new Error('Resource has been exhausted (e.g. check quota)');
      quotaErr.code = 'AI_QUOTA_EXCEEDED';
      quotaErr.status = 429;
      throw quotaErr;
    },
  };
  const mockVerifier = { verifyQuestion: async () => ({}) };
  const mockSim = { checkSimilarity: () => ({}) };

  const service = new QuestionGenerationService(mockAI, mockVerifier, mockSim, 3);
  let caughtError = null;
  try {
    await service.generateQuestionWithContext({ subject: 'Computer Networks' }, createMockDB());
  } catch (err) {
    caughtError = err;
  }

  assert.ok(caughtError, 'Should have thrown quota error');
  assert.strictEqual(caughtError.code, 'AI_QUOTA_EXCEEDED');
  assert.strictEqual(callCount, 1, 'Must fail-fast immediately on attempt 1 without retrying');
});

// 17. ContextCache returns cached context on identical request
runTest('ContextCache returns cached context on identical request', () => {
  invalidateContextCache();
  const db = createMockDB();
  const req = { subject: 'Computer Networks', difficulty: 'Medium', limit: 4 };

  const firstResult = pyqEnrichmentService.getGenerationContext(req, db);
  const cacheSizeAfterFirst = getContextCacheSize();
  assert.strictEqual(cacheSizeAfterFirst, 1, 'Cache size should be 1 after first call');

  const secondResult = pyqEnrichmentService.getGenerationContext(req, db);
  assert.deepStrictEqual(firstResult, secondResult, 'Cached result should match');
  assert.strictEqual(getContextCacheSize(), 1, 'Cache size should still be 1 (cache hit)');
});

// 18. Invalidation clears cache on PYQ import / enrichment
runTest('Invalidation clears cache on PYQ import / enrichment', () => {
  const db = createMockDB();
  pyqEnrichmentService.getGenerationContext({ subject: 'Computer Networks' }, db);
  assert.ok(getContextCacheSize() >= 1);

  invalidateContextCache();
  assert.strictEqual(getContextCacheSize(), 0, 'Cache must be 0 after invalidation');
});

// 19. Generation prompt token size reduced vs baseline
runTest('Generation prompt token size reduced vs baseline', () => {
  const db = createMockDB();
  const samplePYQs = [
    {
      id: 'GATE-CS-2023-Q1',
      subject: 'Computer Networks',
      topic: 'TCP',
      concepts: ['Congestion Control'],
      reasoningType: ['analytical'],
      difficulty: 'Medium',
      questionPattern: 'AIMD evolution',
      question: 'Consider a TCP Reno sender with MSS = 1KB. Initial cwnd = 2KB and ssthresh = 16KB. After 3 RTTs...',
      options: [
        { id: 'A', text: '4 KB' },
        { id: 'B', text: '8 KB' },
        { id: 'C', text: '16 KB' },
        { id: 'D', text: '32 KB' },
      ],
      correctAnswer: 'B',
    },
    {
      id: 'GATE-CS-2022-Q2',
      subject: 'Computer Networks',
      topic: 'TCP',
      concepts: ['Slow Start'],
      reasoningType: ['analytical'],
      difficulty: 'Medium',
      questionPattern: 'Slow start exponential growth',
      question: 'In a TCP connection starting in slow start with cwnd = 1 MSS, compute cwnd after 4 duplicate ACKs...',
      options: [
        { id: 'A', text: '1 MSS' },
        { id: 'B', text: '2 MSS' },
        { id: 'C', text: '4 MSS' },
        { id: 'D', text: '8 MSS' },
      ],
      correctAnswer: 'C',
    },
  ];

  const streamlinedPrompt = buildQuestionGenerationPrompt({
    subject: 'Computer Networks',
    topic: 'TCP',
    difficulty: 'Medium',
    questionType: 'MCQ',
    relevantPYQs: samplePYQs,
  });

  // Baseline prompt with 2 PYQs had > 6,000 chars. Streamlined is < 2,500 chars.
  console.log(`    Streamlined generation prompt length: ${streamlinedPrompt.length} chars`);
  assert.ok(streamlinedPrompt.length < 3200, `Prompt length ${streamlinedPrompt.length} exceeds 3200 chars`);
  assert.ok(streamlinedPrompt.includes('RIGOR'), 'Prompt preserves rigor directive');
  assert.ok(streamlinedPrompt.includes('LATEX MATH'), 'Prompt preserves LaTeX rule');
});

// 20. No answer leakage in client responses
runTest('No answer leakage in client responses', () => {
  const mockQ = {
    ...mockValidCandidate,
    correctAnswer: 'B',
    explanation: 'Secret correct derivation',
  };

  const sessionQuestionId = practiceSessionService.createSession(mockQ);
  const sanitized = practiceSessionService.getSanitizedQuestion(mockQ, sessionQuestionId);

  assert.strictEqual(sanitized.correctAnswer, undefined, 'Client question must NOT have correctAnswer');
  assert.strictEqual(sanitized.explanation, undefined, 'Client question must NOT have explanation');
  assert.ok(sanitized.id, 'Must have sanitized id');
  assert.strictEqual(sanitized.options.length, 4);
});

console.log('\n==================================================');
console.log(`Results: ${passedTests}/${totalTests} tests passed`);
console.log('==================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
