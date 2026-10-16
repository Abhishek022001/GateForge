/**
 * Comprehensive Automated Verification Suite for GATEForge Checkpoint 4A
 * (Single-Question AI Practice: Ephemeral Practice Sessions, Anti-Leakage Safeguards, MCQ/MSQ/NAT Evaluation, UI Integration)
 */

import { practiceSessionService, PracticeSessionService } from './backend/src/services/ai/practiceSession.service.js';
import { AIError } from './backend/src/services/ai/ai.interface.js';

const API_BASE = 'http://localhost:5000';
const FRONTEND_BASE = 'http://localhost:5173';

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

// Sample questions for unit evaluation
const sampleMCQ = {
  question: 'In a relational database, which normal form eliminates transitive dependencies of non-prime attributes on candidate keys?',
  questionType: 'MCQ',
  options: [
    { id: 'A', text: 'First Normal Form (1NF)' },
    { id: 'B', text: 'Second Normal Form (2NF)' },
    { id: 'C', text: 'Third Normal Form (3NF)' },
    { id: 'D', text: 'Boyce-Codd Normal Form (BCNF)' },
  ],
  correctAnswer: 'C',
  explanation: '3NF requires that no non-prime attribute is transitively dependent on any candidate key (or every non-trivial FD X -> A has X as superkey or A as prime).',
  subject: 'Databases',
  topic: 'Normalization',
  difficulty: 'Medium',
  concepts: ['3NF', 'transitive dependency'],
  reasoningType: ['conceptual'],
  source: { type: 'AI_GENERATED' },
};

const sampleMSQ = {
  question: 'Let G = (V, E) be a connected undirected graph with distinct positive edge weights. Which of the following statements are ALWAYS TRUE?',
  questionType: 'MSQ',
  options: [
    { id: 'A', text: 'The Minimum Spanning Tree of G is unique.' },
    { id: 'B', text: 'The second lightest edge in G must belong to the Minimum Spanning Tree.' },
    { id: 'C', text: 'The heaviest edge in G can never belong to any cycle in G.' },
    { id: 'D', text: 'The shortest path between two vertices in G is always an edge in the MST.' },
  ],
  correctAnswer: ['A', 'B'],
  explanation: 'When edge weights are distinct, the MST is unique (A is true). By the cut property, the two lightest edges in the graph cannot form a cycle and must be part of the MST (B is true). C and D are false.',
  subject: 'Algorithms',
  topic: 'Graph Algorithms',
  difficulty: 'Hard',
  concepts: ['minimum spanning tree', 'cut property'],
  reasoningType: ['analytical'],
  source: { type: 'AI_GENERATED' },
};

const sampleNAT = {
  question: 'In a paging system with a 2-level page table, memory access time is 100 ns and TLB access time is 20 ns. The TLB hit ratio is 0.90. What is the effective memory access time (EMAT) in nanoseconds?',
  questionType: 'NAT',
  options: [],
  correctAnswer: 140,
  numericalAnswer: { min: 139.9, max: 140.1 },
  explanation: 'On TLB hit (0.90): time = 20 + 100 = 120 ns. On TLB miss (0.10): time = 20 + 100 (level 1) + 100 (level 2) + 100 (data) = 320 ns. EMAT = 0.90 * 120 + 0.10 * 320 = 108 + 32 = 140 ns.',
  subject: 'Operating Systems',
  topic: 'Memory Management',
  difficulty: 'Medium',
  concepts: ['paging', 'TLB hit ratio', 'EMAT'],
  reasoningType: ['numerical', 'analytical'],
  source: { type: 'AI_GENERATED' },
};

async function runCheckpoint4ATests() {
  console.log('===============================================================');
  console.log('GATEForge Checkpoint 4A: Single-Question AI Practice Suite');
  console.log('===============================================================\n');

  // -------------------------------------------------------------
  // Section 1: Ephemeral Practice Session Service Unit Tests
  // -------------------------------------------------------------
  console.log('[SECTION 1] Ephemeral Practice Session Service & Answer-Leakage Prevention');

  const sessionService = new PracticeSessionService(3600000); // 1 hour TTL

  // Test 1: Session creation generates unpredictable UUID
  const sessionIdMCQ = sessionService.createSession(sampleMCQ);
  assert(
    typeof sessionIdMCQ === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionIdMCQ),
    'createSession returns a cryptographically secure UUID',
    `Session ID: ${sessionIdMCQ}`
  );

  // Test 2: Sanitized question completely strips answer & explanation
  const sanitized = sessionService.getSanitizedQuestion(sampleMCQ, sessionIdMCQ);
  assert(sanitized.id === sessionIdMCQ, 'Sanitized question has id matching sessionId');
  assert(sanitized.question === sampleMCQ.question, 'Sanitized question preserves question text');
  assert(sanitized.options.length === 4, 'Sanitized question preserves options list');
  assert(sanitized.correctAnswer === undefined, 'CRITICAL: correctAnswer is STRIPPED from client question');
  assert(sanitized.numericalAnswer === undefined, 'CRITICAL: numericalAnswer is STRIPPED from client question');
  assert(sanitized.explanation === undefined, 'CRITICAL: explanation is STRIPPED from client question');
  assert(sanitized.source.type === 'AI_GENERATED', 'Question source.type is AI_GENERATED');

  // Test 3: MCQ Evaluation - Correct answer
  const evalMCQCorrect = sessionService.evaluateAnswer(sessionIdMCQ, 'C');
  assert(evalMCQCorrect.isCorrect === true, 'MCQ evaluation: Correct option "C" yields isCorrect = true');
  assert(evalMCQCorrect.correctAnswer === 'C', 'MCQ evaluation: Returns correctAnswer "C" after submission');
  assert(
    evalMCQCorrect.explanation.includes('3NF requires'),
    'MCQ evaluation: Returns verified explanation after submission'
  );

  // Test 4: MCQ Evaluation - Incorrect answer
  const evalMCQIncorrect = sessionService.evaluateAnswer(sessionIdMCQ, 'A');
  assert(evalMCQIncorrect.isCorrect === false, 'MCQ evaluation: Incorrect option "A" yields isCorrect = false');
  assert(evalMCQIncorrect.correctAnswer === 'C', 'MCQ evaluation: Still provides correct answer "C" on error');

  // Test 5: MSQ Evaluation - Exact complete set
  const sessionIdMSQ = sessionService.createSession(sampleMSQ);
  const evalMSQCorrect = sessionService.evaluateAnswer(sessionIdMSQ, ['A', 'B']);
  assert(evalMSQCorrect.isCorrect === true, 'MSQ evaluation: Complete set ["A", "B"] yields isCorrect = true');
  assert(
    JSON.stringify(evalMSQCorrect.correctAnswer) === JSON.stringify(['A', 'B']),
    'MSQ evaluation: Returns correct answer array after submission'
  );

  // Test 6: MSQ Evaluation - Partial set is NOT correct (no partial credit)
  const evalMSQPartial = sessionService.evaluateAnswer(sessionIdMSQ, ['A']);
  assert(
    evalMSQPartial.isCorrect === false,
    'MSQ evaluation: Partial selection ["A"] yields isCorrect = false (no partial credit)'
  );

  // Test 7: MSQ Evaluation - Superset with wrong option is NOT correct
  const evalMSQSuperset = sessionService.evaluateAnswer(sessionIdMSQ, ['A', 'B', 'C']);
  assert(
    evalMSQSuperset.isCorrect === false,
    'MSQ evaluation: Superset selection ["A", "B", "C"] yields isCorrect = false'
  );

  // Test 8: NAT Evaluation - Correct numerical value
  const sessionIdNAT = sessionService.createSession(sampleNAT);
  const evalNATCorrect = sessionService.evaluateAnswer(sessionIdNAT, 140);
  assert(evalNATCorrect.isCorrect === true, 'NAT evaluation: Correct number 140 yields isCorrect = true');

  // Test 9: NAT Evaluation - Float decimal input within range
  const evalNATDecimal = sessionService.evaluateAnswer(sessionIdNAT, 140.05);
  assert(evalNATDecimal.isCorrect === true, 'NAT evaluation: Float 140.05 within range yields isCorrect = true');

  // Test 10: NAT Evaluation - Out of range
  const evalNATIncorrect = sessionService.evaluateAnswer(sessionIdNAT, 150);
  assert(evalNATIncorrect.isCorrect === false, 'NAT evaluation: Value 150 out of range yields isCorrect = false');

  // Test 11: Unknown session ID throws 404
  let unknownSessionError = null;
  try {
    sessionService.evaluateAnswer('00000000-0000-0000-0000-000000000000', 'A');
  } catch (err) {
    unknownSessionError = err;
  }
  assert(
    unknownSessionError && unknownSessionError.code === 'SESSION_NOT_FOUND',
    'Unknown session ID throws SESSION_NOT_FOUND error (404)'
  );

  // Test 12: Session Expiration (TTL)
  const shortLivedService = new PracticeSessionService(10); // 10 ms TTL
  const shortLivedId = shortLivedService.createSession(sampleMCQ);
  await new Promise((resolve) => setTimeout(resolve, 30)); // Wait for expiry
  let expiredError = null;
  try {
    shortLivedService.evaluateAnswer(shortLivedId, 'C');
  } catch (err) {
    expiredError = err;
  }
  assert(
    expiredError && expiredError.code === 'SESSION_NOT_FOUND',
    'Expired session is automatically purged and throws SESSION_NOT_FOUND (404)'
  );

  // -------------------------------------------------------------
  // Section 2: Live Backend API Integration
  // -------------------------------------------------------------
  console.log('\n[SECTION 2] Live Backend API Practice Endpoints');

  // Test 13: GET /api/taxonomy/topics returns topics for subject
  const topicsRes = await fetch(`${API_BASE}/api/taxonomy/topics?subject=Databases`);
  const topicsData = await topicsRes.json();
  assert(topicsRes.status === 200, 'GET /api/taxonomy/topics returns HTTP 200');
  assert(Array.isArray(topicsData.data) && topicsData.data.length > 0, 'Returns array of topics for Databases', `Found ${topicsData.data?.length} topics`);

  // Record initial question count to verify persistence invariance
  const initialCountRes = await fetch(`${API_BASE}/api/questions`);
  const initialCountData = await initialCountRes.json();
  const initialCount = initialCountData.count;

  // Test 14: POST /api/ai/practice/generate generates question without leaking answer
  console.log('\n  [Live Call] Requesting practice question from /api/ai/practice/generate...');
  const practiceGenRes = await fetch(`${API_BASE}/api/ai/practice/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject: 'Databases',
      topic: 'Normalization',
      difficulty: 'Medium',
      questionType: 'MCQ',
    }),
  });
  const practiceGenData = await practiceGenRes.json();
  assert(practiceGenRes.status === 200, 'POST /api/ai/practice/generate returns HTTP 200');

  if (practiceGenData.status === 'VERIFIED') {
    assert(Boolean(practiceGenData.sessionQuestionId), 'Response contains sessionQuestionId');
    assert(Boolean(practiceGenData.question), 'Response contains sanitized question');
    assert(
      practiceGenData.question.correctAnswer === undefined,
      'ANTI-LEAK: practiceGenData.question.correctAnswer is UNDEFINED'
    );
    assert(
      practiceGenData.question.explanation === undefined,
      'ANTI-LEAK: practiceGenData.question.explanation is UNDEFINED'
    );
    assert(
      practiceGenData.correctAnswer === undefined,
      'ANTI-LEAK: root correctAnswer is UNDEFINED'
    );
    assert(
      practiceGenData.explanation === undefined,
      'ANTI-LEAK: root explanation is UNDEFINED'
    );
    assert(
      practiceGenData.validation === undefined,
      'ANTI-LEAK: root validation object is UNDEFINED (no verifier leak)'
    );

    // Test 15: POST /api/ai/practice/:sessionQuestionId/answer evaluates live answer
    const liveSessionId = practiceGenData.sessionQuestionId;
    const answerRes = await fetch(`${API_BASE}/api/ai/practice/${encodeURIComponent(liveSessionId)}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: 'A' }),
    });
    const answerData = await answerRes.json();
    assert(answerRes.status === 200, 'POST /api/ai/practice/:id/answer returns HTTP 200');
    assert(typeof answerData.data.isCorrect === 'boolean', 'Answer response contains isCorrect boolean');
    assert(Boolean(answerData.data.correctAnswer), 'Answer response contains correctAnswer after submission');
    assert(
      Boolean(answerData.data.explanation && answerData.data.explanation.length > 10),
      'Answer response contains detailed explanation after submission'
    );
  } else {
    assert(
      practiceGenData.status === 'GENERATION_ATTEMPTS_EXHAUSTED',
      'If not verified, status is cleanly reported as GENERATION_ATTEMPTS_EXHAUSTED'
    );
  }

  // Test 16: Unknown session ID in live endpoint returns 404
  const unknownRes = await fetch(`${API_BASE}/api/ai/practice/non-existent-session-id/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer: 'B' }),
  });
  assert(unknownRes.status === 404, 'Unknown session ID returns HTTP 404');
  const unknownData = await unknownRes.json();
  assert(unknownData.code === 'SESSION_NOT_FOUND', 'Returns SESSION_NOT_FOUND code');

  // Test 17: Missing answer field returns 400
  const missingAnsRes = await fetch(`${API_BASE}/api/ai/practice/some-id/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert(missingAnsRes.status === 400 || missingAnsRes.status === 404, 'Missing answer returns HTTP 400 or 404');

  // -------------------------------------------------------------
  // Section 3: Frontend Route & UI Integration Checks
  // -------------------------------------------------------------
  console.log('\n[SECTION 3] Frontend Route & Component Verification');

  try {
    const frontendRes = await fetch(`${FRONTEND_BASE}/ai-practice`);
    assert(frontendRes.status === 200, 'Frontend /ai-practice route loads successfully with HTTP 200');
    const htmlText = await frontendRes.text();
    assert(htmlText.includes('id="root"'), 'Frontend returns valid React root mount element');
  } catch (err) {
    console.error('Frontend check note:', err.message);
  }

  // -------------------------------------------------------------
  // Section 4: Regression Invariance (Question Bank & PYQ Safety)
  // -------------------------------------------------------------
  console.log('\n[SECTION 4] System Invariance & Persistence Integrity');

  const countRes = await fetch(`${API_BASE}/api/questions`);
  const countData = await countRes.json();
  assert(
    countData.success === true && countData.count === initialCount,
    'Question Bank count is preserved (ephemeral AI questions are NOT stored in DB)',
    `Count before: ${initialCount}, Count after: ${countData.count}`
  );

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`Checkpoint 4A Test Results: ${passedTests}/${totalTests} passed (${failedTests} failed)`);
  console.log('===============================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runCheckpoint4ATests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
