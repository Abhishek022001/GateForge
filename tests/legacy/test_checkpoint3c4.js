/**
 * Comprehensive Automated Verification Suite for GATEForge Checkpoint 3C.4
 * (Independent Semantic Verification & Adversarial Auditing for AI-Generated Questions)
 */

import { QuestionGenerationService } from './backend/src/services/ai/questionGeneration.service.js';
import { SemanticVerificationService } from './backend/src/services/ai/semanticVerification.service.js';
import { buildQuestionVerificationPrompt } from './backend/src/services/ai/prompts/verification.prompt.js';
import { validateSemanticVerificationOutput } from './backend/src/validators/semanticVerificationValidator.js';
import { validateGeneratedQuestionStructure } from './backend/src/validators/generationValidator.js';

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

// Mock AI Service for deterministic verification tests
class MockAIService {
  constructor(cannedResponse) {
    this.cannedResponse = cannedResponse;
    this.lastPrompt = null;
    this.callCount = 0;
  }

  isConfigured() {
    return true;
  }

  getProviderName() {
    return 'mock-provider';
  }

  async generateStructured(prompt, options) {
    this.callCount++;
    this.lastPrompt = prompt;
    return {
      data: typeof this.cannedResponse === 'function' ? this.cannedResponse(prompt) : this.cannedResponse,
      rawText: JSON.stringify(this.cannedResponse),
      model: 'mock-gemini',
      latencyMs: 42,
    };
  }
}

// Mock Database for persistence invariance tests
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

const mockOfficialPYQ = {
  id: 'gate-2024-cs-q22',
  subject: 'Database Management Systems',
  topic: 'Normalization',
  concepts: ['functional dependency', 'BCNF'],
  reasoningType: ['analytical'],
  difficulty: 'Medium',
  questionType: 'MCQ',
  question: 'Consider relation R with FDs...',
  options: [
    { id: 'A', text: '1NF' },
    { id: 'B', text: '2NF' },
    { id: 'C', text: '3NF' },
    { id: 'D', text: 'BCNF' },
  ],
  correctAnswer: 'B',
  source: { type: 'PYQ', provider: 'OFFICIAL_GATE', year: 2024, paper: 'CS' },
  aiAnalysis: {
    analyzed: true,
    questionPattern: 'Identify normal form',
    solutionApproach: 'Closure analysis',
  },
};

async function runCheckpoint3C4Tests() {
  console.log('====================================================');
  console.log('🧪 RUNNING GATEFORGE CHECKPOINT 3C.4 VERIFICATION');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // GROUP 1: Verifier Schema & Output Validation
  // ----------------------------------------------------
  console.log('📦 GROUP 1: Semantic Verifier Output Schema Validation');

  const validVerifierOutput = {
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
  };

  const valRes = validateSemanticVerificationOutput(validVerifierOutput);
  assert(valRes.isValid === true, 'Valid verifier output passes schema validator');
  assert(valRes.sanitized?.valid === true, 'Sanitized output maintains valid = true');

  // Test: Malformed verifier output (missing boolean fields)
  const malformed1 = { ...validVerifierOutput };
  delete malformed1.answerCorrect;
  const valMal1 = validateSemanticVerificationOutput(malformed1);
  assert(valMal1.isValid === false, 'Malformed verifier output (missing answerCorrect) rejected');

  // Test: Malformed verifier output (confidence out of range)
  const malformed2 = { ...validVerifierOutput, confidence: 1.5 };
  const valMal2 = validateSemanticVerificationOutput(malformed2);
  assert(valMal2.isValid === false, 'Verifier output with confidence > 1.0 rejected');

  // Test: Malformed verifier output (missing independentAnswer)
  const malformed3 = { ...validVerifierOutput };
  delete malformed3.independentAnswer;
  const valMal3 = validateSemanticVerificationOutput(malformed3);
  assert(valMal3.isValid === false, 'Verifier output missing independentAnswer rejected');

  // Test: Sanity check override - if criteria failed but valid was true
  const inconsistentOutput = {
    ...validVerifierOutput,
    valid: true,
    answerCorrect: false, // contradiction!
  };
  const valInconsistent = validateSemanticVerificationOutput(inconsistentOutput);
  assert(valInconsistent.isValid === true, 'Inconsistent output is handled by integrity check');
  assert(valInconsistent.sanitized?.valid === false, 'Sanity check overrides valid to false when answerCorrect is false');

  // ----------------------------------------------------
  // GROUP 2: Adversarial Candidate Tests (Unit / Mocked AI)
  // ----------------------------------------------------
  console.log('\n🛡️ GROUP 2: Adversarial Candidate Tests & Failure Detection');

  // Test 4: Correct MCQ passes
  const correctMCQ = {
    question: 'What is 2 + 2 in standard integer arithmetic?',
    questionType: 'MCQ',
    options: [
      { id: 'A', text: '3' },
      { id: 'B', text: '4' },
      { id: 'C', text: '5' },
      { id: 'D', text: '6' },
    ],
    correctAnswer: 'B',
    explanation: 'In standard arithmetic, 2 + 2 = 4.',
    subject: 'Engineering Mathematics',
    topic: 'Discrete Mathematics',
    concepts: ['basic arithmetic'],
    difficulty: 'Easy',
  };

  const mockAIServiceMCQ = new MockAIService({
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
    confidence: 0.99,
  });

  const verifierMCQ = new SemanticVerificationService(mockAIServiceMCQ);
  const resMCQ = await verifierMCQ.verifyQuestion(correctMCQ);
  assert(resMCQ.verification.valid === true, 'Correct MCQ is verified as VALID');
  assert(resMCQ.verification.answerCorrect === true, 'Correct MCQ has answerCorrect = true');
  assert(resMCQ.verification.independentAnswer === 'B', 'Independent answer is "B"');

  // Test 5: Adversarial - Wrong Answer MCQ (2 + 2 = ?, proposed answer: A)
  const wrongAnswerMCQ = {
    ...correctMCQ,
    correctAnswer: 'A', // Proposed answer is 3!
  };
  const mockAIWrongAns = new MockAIService({
    valid: false,
    questionSolvable: true,
    answerCorrect: false,
    explanationConsistent: false,
    conceptMatch: true,
    questionTypeValid: true,
    ambiguityDetected: false,
    difficultyMatch: true,
    issues: ['Proposed answer A (3) is mathematically incorrect. The correct answer is B (4).'],
    independentAnswer: 'B',
    confidence: 0.98,
  });
  const verifierWrongAns = new SemanticVerificationService(mockAIWrongAns);
  const resWrongAns = await verifierWrongAns.verifyQuestion(wrongAnswerMCQ);
  assert(resWrongAns.verification.valid === false, 'Wrong Answer MCQ is REJECTED');
  assert(resWrongAns.verification.answerCorrect === false, 'Wrong Answer MCQ has answerCorrect = false');

  // Test 6: Adversarial - Ambiguous MCQ (two options defensibly correct)
  const mockAIAmbiguous = new MockAIService({
    valid: false,
    questionSolvable: true,
    answerCorrect: false,
    explanationConsistent: true,
    conceptMatch: true,
    questionTypeValid: true,
    ambiguityDetected: true,
    difficultyMatch: true,
    issues: ['Both options A and B are mathematically equivalent and correct.'],
    independentAnswer: 'A',
    confidence: 0.91,
  });
  const verifierAmbiguous = new SemanticVerificationService(mockAIAmbiguous);
  const resAmbiguous = await verifierAmbiguous.verifyQuestion(correctMCQ);
  assert(resAmbiguous.verification.valid === false, 'Ambiguous MCQ is REJECTED');
  assert(resAmbiguous.verification.ambiguityDetected === true, 'Ambiguous MCQ has ambiguityDetected = true');

  // Test 7: Correct MSQ complete set passes
  const correctMSQ = {
    question: 'Which of the following are prime numbers?',
    questionType: 'MSQ',
    options: [
      { id: 'A', text: '2' },
      { id: 'B', text: '3' },
      { id: 'C', text: '4' },
      { id: 'D', text: '6' },
    ],
    correctAnswer: ['A', 'B'],
    explanation: '2 and 3 are prime; 4 and 6 are composite.',
    subject: 'Engineering Mathematics',
    topic: 'Discrete Mathematics',
    concepts: ['number theory', 'prime numbers'],
    difficulty: 'Easy',
  };
  const mockAIMSGPass = new MockAIService({
    valid: true,
    questionSolvable: true,
    answerCorrect: true,
    explanationConsistent: true,
    conceptMatch: true,
    questionTypeValid: true,
    ambiguityDetected: false,
    difficultyMatch: true,
    issues: [],
    independentAnswer: ['A', 'B'],
    confidence: 0.97,
  });
  const verifierMSQPass = new SemanticVerificationService(mockAIMSGPass);
  const resMSQPass = await verifierMSQPass.verifyQuestion(correctMSQ);
  assert(resMSQPass.verification.valid === true, 'Correct MSQ complete set is verified as VALID');
  assert(resMSQPass.verification.answerCorrect === true, 'Correct MSQ has answerCorrect = true');

  // Test 8: Adversarial - MSQ missing a correct option (generator proposed only ['A'], but B is also prime)
  const mockAIMissingOpt = new MockAIService({
    valid: false,
    questionSolvable: true,
    answerCorrect: false,
    explanationConsistent: false,
    conceptMatch: true,
    questionTypeValid: true,
    ambiguityDetected: false,
    difficultyMatch: true,
    issues: ['Proposed answer is missing correct option B.'],
    independentAnswer: ['A', 'B'],
    confidence: 0.95,
  });
  const verifierMissingOpt = new SemanticVerificationService(mockAIMissingOpt);
  const resMissingOpt = await verifierMissingOpt.verifyQuestion({ ...correctMSQ, correctAnswer: ['A'] });
  assert(resMissingOpt.verification.valid === false, 'MSQ missing a correct option is REJECTED');
  assert(resMissingOpt.verification.answerCorrect === false, 'MSQ missing option has answerCorrect = false');

  // Test 9: Adversarial - MSQ containing an incorrect selected option (generator proposed ['A', 'B', 'C'])
  const mockAIWrongOpt = new MockAIService({
    valid: false,
    questionSolvable: true,
    answerCorrect: false,
    explanationConsistent: false,
    conceptMatch: true,
    questionTypeValid: true,
    ambiguityDetected: false,
    difficultyMatch: true,
    issues: ['Proposed answer includes option C (4) which is not a prime number.'],
    independentAnswer: ['A', 'B'],
    confidence: 0.96,
  });
  const verifierWrongOpt = new SemanticVerificationService(mockAIWrongOpt);
  const resWrongOpt = await verifierWrongOpt.verifyQuestion({ ...correctMSQ, correctAnswer: ['A', 'B', 'C'] });
  assert(resWrongOpt.verification.valid === false, 'MSQ with incorrect selected option is REJECTED');
  assert(resWrongOpt.verification.answerCorrect === false, 'MSQ with incorrect option has answerCorrect = false');

  // Test 10: Correct NAT passes
  const correctNAT = {
    question: 'Evaluate 4 * 4.',
    questionType: 'NAT',
    options: [],
    correctAnswer: 16,
    explanation: '4 multiplied by 4 equals 16.',
    subject: 'Engineering Mathematics',
    topic: 'Arithmetic',
    concepts: ['multiplication'],
    difficulty: 'Easy',
  };
  const mockAINATPass = new MockAIService({
    valid: true,
    questionSolvable: true,
    answerCorrect: true,
    explanationConsistent: true,
    conceptMatch: true,
    questionTypeValid: true,
    ambiguityDetected: false,
    difficultyMatch: true,
    issues: [],
    independentAnswer: 16,
    confidence: 0.99,
  });
  const verifierNATPass = new SemanticVerificationService(mockAINATPass);
  const resNATPass = await verifierNATPass.verifyQuestion(correctNAT);
  assert(resNATPass.verification.valid === true, 'Correct NAT is verified as VALID');
  assert(resNATPass.verification.independentAnswer === 16, 'Independent NAT answer is 16');

  // Test 11: Adversarial - Incorrect NAT calculation (evaluates to 16, proposed is 12)
  const mockAIWrongNAT = new MockAIService({
    valid: false,
    questionSolvable: true,
    answerCorrect: false,
    explanationConsistent: false,
    conceptMatch: true,
    questionTypeValid: true,
    ambiguityDetected: false,
    difficultyMatch: true,
    issues: ['Mathematical calculation yields 16, but proposed answer is 12.'],
    independentAnswer: 16,
    confidence: 0.98,
  });
  const verifierWrongNAT = new SemanticVerificationService(mockAIWrongNAT);
  const resWrongNAT = await verifierWrongNAT.verifyQuestion({ ...correctNAT, correctAnswer: 12 });
  assert(resWrongNAT.verification.valid === false, 'Incorrect NAT calculation is REJECTED');
  assert(resWrongNAT.verification.answerCorrect === false, 'Wrong NAT calculation has answerCorrect = false');

  // Test 12: Adversarial - NAT missing necessary information
  const mockAIUnsolvableNAT = new MockAIService({
    valid: false,
    questionSolvable: false,
    answerCorrect: false,
    explanationConsistent: false,
    conceptMatch: true,
    questionTypeValid: true,
    ambiguityDetected: true,
    difficultyMatch: true,
    issues: ['The problem statement does not provide the required coefficient to compute the answer.'],
    independentAnswer: 'UNSOLVABLE',
    confidence: 0.93,
  });
  const verifierUnsolvable = new SemanticVerificationService(mockAIUnsolvableNAT);
  const resUnsolvable = await verifierUnsolvable.verifyQuestion({
    ...correctNAT,
    question: 'Evaluate $a * 4$ where $a$ is unstated.',
  });
  assert(resUnsolvable.verification.valid === false, 'Unsolvable NAT question is REJECTED');
  assert(resUnsolvable.verification.questionSolvable === false, 'Unsolvable NAT has questionSolvable = false');

  // Test 13: Adversarial - Correct answer with incorrect explanation
  const mockAIBadExpl = new MockAIService({
    valid: false,
    questionSolvable: true,
    answerCorrect: true, // Answer is right
    explanationConsistent: false, // Explanation is wrong
    conceptMatch: true,
    questionTypeValid: true,
    ambiguityDetected: false,
    difficultyMatch: true,
    issues: ['The proposed answer is numerically correct, but the explanation contains a false mathematical claim.'],
    independentAnswer: 16,
    confidence: 0.94,
  });
  const verifierBadExpl = new SemanticVerificationService(mockAIBadExpl);
  const resBadExpl = await verifierBadExpl.verifyQuestion({
    ...correctNAT,
    explanation: '4 * 4 is 16 because 4 + 4 is 16.', // False reasoning
  });
  assert(resBadExpl.verification.valid === false, 'Correct answer with flawed explanation is REJECTED');
  assert(resBadExpl.verification.explanationConsistent === false, 'Flawed explanation has explanationConsistent = false');

  // Test 14: Adversarial - Topic / Concept Drift
  const mockAIDrift = new MockAIService({
    valid: false,
    questionSolvable: true,
    answerCorrect: true,
    explanationConsistent: true,
    conceptMatch: false, // Drifted!
    questionTypeValid: true,
    ambiguityDetected: false,
    difficultyMatch: true,
    issues: ['Requested topic was DBMS Normalization, but question tests TCP Congestion Control.'],
    independentAnswer: 'A',
    confidence: 0.96,
  });
  const verifierDrift = new SemanticVerificationService(mockAIDrift);
  const resDrift = await verifierDrift.verifyQuestion(
    {
      question: 'In TCP Reno, what happens upon receiving 3 duplicate ACKs?',
      questionType: 'MCQ',
      options: [
        { id: 'A', text: 'Fast Retransmit and Fast Recovery' },
        { id: 'B', text: 'Slow Start' },
        { id: 'C', text: 'Reset Connection' },
        { id: 'D', text: 'Increase cwnd to max' },
      ],
      correctAnswer: 'A',
      explanation: 'TCP Reno enters fast recovery on 3 dup ACKs.',
      subject: 'Computer Networks',
      topic: 'TCP',
      concepts: ['TCP Reno', 'congestion control'],
      difficulty: 'Medium',
    },
    { requestedSubject: 'Database Management Systems', requestedTopic: 'Normalization' }
  );
  assert(resDrift.verification.valid === false, 'Concept drift question is REJECTED');
  assert(resDrift.verification.conceptMatch === false, 'Concept drift has conceptMatch = false');

  // Test 15: Structural failure prevents unnecessary semantic verification
  let verifierInvoked = false;
  const mockVerifierNeverCalled = {
    async verifyQuestion() {
      verifierInvoked = true;
      return { success: true, verification: validVerifierOutput };
    },
  };
  const mockAIGeneratorBadStructure = new MockAIService({
    question: 'Short', // Violates min length
    subject: 'DBMS',
    topic: 'Normalization',
    questionType: 'MCQ',
    options: [], // Violates 4 options requirement
    correctAnswer: 'A',
    explanation: 'Too short',
  });
  const genServiceBadStruct = new QuestionGenerationService(mockAIGeneratorBadStructure, mockVerifierNeverCalled);
  const mockDb = new MockDb([mockOfficialPYQ]);

  let structuralFailed = false;
  try {
    const res = await genServiceBadStruct.generateQuestionWithContext(
      { subject: 'Database Management Systems', questionType: 'MCQ' },
      mockDb
    );
    if (res.status === 'GENERATION_ATTEMPTS_EXHAUSTED' || res.status === 'STRUCTURAL_VALIDATION_FAILED') {
      structuralFailed = true;
      assert(true, 'Structural validation failure caught and handled in regeneration pipeline');
    }
  } catch (err) {
    if (err.code === 'STRUCTURAL_VALIDATION_FAILED') {
      structuralFailed = true;
      assert(true, 'Throws STRUCTURAL_VALIDATION_FAILED on structural errors');
    }
  }
  assert(structuralFailed === true, 'Structural validation failure detected');
  assert(verifierInvoked === false, 'Semantic verifier was NEVER invoked when structural validation failed');

  // Test 16: Malformed verifier JSON is rejected with VERIFIER_RESPONSE_INVALID
  const mockAIMalformedJSON = new MockAIService('This is not a JSON object');
  const verifierMalformed = new SemanticVerificationService(mockAIMalformedJSON);
  try {
    await verifierMalformed.verifyQuestion(correctMCQ);
    assert(false, 'Should have thrown error on malformed JSON');
  } catch (err) {
    assert(err.code === 'VERIFIER_RESPONSE_INVALID', 'Malformed verifier output throws VERIFIER_RESPONSE_INVALID');
  }

  // Test 17: Verifier prompt receives candidate details and no DB internals or API keys
  const promptText = buildQuestionVerificationPrompt({
    question: 'What is BCNF?',
    questionType: 'MCQ',
    options: [{ id: 'A', text: 'Strict normal form' }],
    correctAnswer: 'A',
    explanation: 'Every determinant is superkey.',
    subject: 'DBMS',
    topic: 'Normalization',
  });
  assert(promptText.includes('What is BCNF?'), 'Prompt contains question text');
  assert(promptText.includes('Independently solve the question from first principles first'), 'Prompt mandates independent solving');
  assert(!promptText.includes('_id'), 'Prompt does NOT contain MongoDB _id internals');
  assert(!promptText.includes('GEMINI_API_KEY'), 'Prompt does NOT expose API secrets');

  // Test 18: Generated question is still NOT persisted
  const countBefore = mockDb.findAll().length;
  const mockAIGenGood = new MockAIService({
    question: 'Consider a relation $R(A, B, C)$ with $A \\to B, B \\to C$. What is the highest normal form of $R$?',
    questionType: 'MCQ',
    options: [
      { id: 'A', text: '1NF' },
      { id: 'B', text: '2NF' },
      { id: 'C', text: '3NF' },
      { id: 'D', text: 'BCNF' },
    ],
    correctAnswer: 'B',
    explanation: 'Candidate key is A. Transitive dependency $A \\to B \\to C$ exists, so it is in 2NF but not 3NF.',
    subject: 'Database Management Systems',
    topic: 'Normalization',
    concepts: ['functional dependency', '2NF', '3NF'],
    difficulty: 'Medium',
  });
  const mockVerifierGood = {
    async verifyQuestion() {
      return { success: true, verification: validVerifierOutput };
    },
  };
  const genServiceGood = new QuestionGenerationService(mockAIGenGood, mockVerifierGood);
  const genOutput = await genServiceGood.generateQuestionWithContext(
    { subject: 'Database Management Systems', questionType: 'MCQ' },
    mockDb
  );
  assert(genOutput.question.source.type === 'AI_GENERATED', 'Generated question source.type is AI_GENERATED');
  assert(mockDb.findAll().length === countBefore, 'Database count is unchanged; candidate is ephemeral');

  // Test 19: Original PYQs remain unchanged
  const pyq22 = mockDb.findById('gate-2024-cs-q22');
  assert(pyq22.source.type === 'PYQ', 'Original PYQ source.type remains PYQ');
  assert(pyq22.question === mockOfficialPYQ.question, 'Original PYQ question text is 100% unchanged');

  // ----------------------------------------------------
  // GROUP 3: Live API Endpoint Verification
  // ----------------------------------------------------
  console.log('\n🚀 GROUP 3: Live API Endpoint Integration & Security');

  // Test 20: Missing subject returns 400
  const badReqRes = await fetch(`${API_BASE}/api/ai/generate-question`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic: 'Normalization' }),
  });
  assert(badReqRes.status === 400, 'POST /api/ai/generate-question with missing subject returns 400');

  // Test 21: No API key exposed in error or response
  const badReqData = await badReqRes.json();
  const rawBodyStr = JSON.stringify(badReqData);
  assert(!rawBodyStr.toLowerCase().includes('aiza'), 'Response does NOT leak Google API key prefix');
  assert(!rawBodyStr.toLowerCase().includes('apikey'), 'Response does NOT contain apiKey property');

  // Test 22: Root endpoint still lists aiGenerateQuestion
  const rootRes = await fetch(`${API_BASE}/`);
  const rootData = await rootRes.json();
  assert(rootData.endpoints?.aiGenerateQuestion === 'POST /api/ai/generate-question', 'Root endpoint lists aiGenerateQuestion');

  // ----------------------------------------------------
  // Summary
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log(`📊 CHECKPOINT 3C.4 VERIFICATION COMPLETE: ${passedTests}/${totalTests} PASSED`);
  if (failedTests > 0) {
    console.error(`❌ ${failedTests} TESTS FAILED`);
    process.exit(1);
  } else {
    console.log('🎉 ALL CHECKPOINT 3C.4 VERIFICATIONS PASSED PERFECTLY!');
    process.exit(0);
  }
}

runCheckpoint3C4Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
  process.exit(1);
});
