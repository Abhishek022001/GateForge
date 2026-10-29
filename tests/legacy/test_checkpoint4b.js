/**
 * Comprehensive Automated Verification Suite for GATEForge Checkpoint 4B
 * (Multi-Question AI Practice Sessions: 3/5 Questions, Mixed/Specific Types,
 * Controlled Concurrency, Same-Session Duplicate Protection, Anti-Leakage, Session Locking)
 */

import { practiceSessionService, PracticeSessionService } from './backend/src/services/ai/practiceSession.service.js';
import { questionSimilarityService } from './backend/src/services/ai/questionSimilarity.service.js';
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

// Sample test questions for unit tests
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
  explanation: '3NF requires that no non-prime attribute is transitively dependent on any candidate key.',
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
  explanation: 'When edge weights are distinct, the MST is unique (A is true). By the cut property, the two lightest edges must belong to the MST (B is true).',
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
  explanation: 'EMAT = 0.90 * (20 + 100) + 0.10 * (20 + 100 + 100 + 100) = 108 + 32 = 140 ns.',
  subject: 'Operating Systems',
  topic: 'Memory Management',
  difficulty: 'Medium',
  concepts: ['paging', 'TLB hit ratio', 'EMAT'],
  reasoningType: ['numerical', 'analytical'],
  source: { type: 'AI_GENERATED' },
};

async function runCheckpoint4BTests() {
  console.log('===============================================================');
  console.log('GATEForge Checkpoint 4B: Multi-Question AI Practice Suite');
  console.log('===============================================================\n');

  // -------------------------------------------------------------
  // Section 1: Ephemeral Multi-Question Practice Session Unit Tests
  // -------------------------------------------------------------
  console.log('[SECTION 1] Ephemeral Multi-Question Practice Session Unit Tests');

  const unitService = new PracticeSessionService(3600000); // 1 hour TTL

  // Test 1: Create multi-question session generates valid session ID & question IDs
  const createResult = unitService.createMultiQuestionSession(
    { subject: 'Databases', difficulty: 'Medium', questionCount: 3, questionType: 'Mixed' },
    [sampleMCQ, sampleMSQ, sampleNAT]
  );
  assert(
    typeof createResult.sessionId === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(createResult.sessionId),
    'createMultiQuestionSession returns a cryptographically secure UUID sessionId',
    `Session ID: ${createResult.sessionId}`
  );
  assert(createResult.questions.length === 3, 'Returns exactly 3 questions');

  // Test 2: Anti-leak check on sanitized questions
  for (let i = 0; i < createResult.questions.length; i++) {
    const q = createResult.questions[i];
    assert(
      typeof q.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q.id),
      `Question ${i + 1} has unique UUID id`
    );
    assert(q.correctAnswer === undefined, `ANTI-LEAK: Question ${i + 1} correctAnswer is UNDEFINED`);
    assert(q.numericalAnswer === undefined, `ANTI-LEAK: Question ${i + 1} numericalAnswer is UNDEFINED`);
    assert(q.explanation === undefined, `ANTI-LEAK: Question ${i + 1} explanation is UNDEFINED`);
    assert(q.source && q.source.type === 'AI_GENERATED', `Question ${i + 1} marked as AI_GENERATED`);
  }

  // Test 3: Session retrieval
  const sessionEntry = unitService.getMultiQuestionSession(createResult.sessionId);
  assert(sessionEntry !== null, 'getMultiQuestionSession retrieves active session entry');
  assert(sessionEntry.questions.length === 3, 'Session entry contains 3 questions');
  assert(sessionEntry.submitted === false, 'Session initially has submitted === false');

  // Test 4: Submit session with ALL correct answers
  const qIdMCQ = createResult.questions[0].id;
  const qIdMSQ = createResult.questions[1].id;
  const qIdNAT = createResult.questions[2].id;

  const allCorrectSubmission = unitService.submitMultiQuestionSession(createResult.sessionId, {
    [qIdMCQ]: 'C',
    [qIdMSQ]: ['A', 'B'],
    [qIdNAT]: 140,
  });

  assert(allCorrectSubmission.total === 3, 'Submission result total is 3');
  assert(allCorrectSubmission.attempted === 3, 'Submission result attempted is 3');
  assert(allCorrectSubmission.unanswered === 0, 'Submission result unanswered is 0');
  assert(allCorrectSubmission.correct === 3, 'Submission result correct is 3');
  assert(allCorrectSubmission.incorrect === 0, 'Submission result incorrect is 0');
  assert(allCorrectSubmission.percentage === 100, 'Submission result percentage is 100%');
  assert(allCorrectSubmission.results.length === 3, 'Submission contains 3 detailed result cards');

  // Test 5: Session Locking (submitting again returns identical cached result and prevents answer tampering)
  const lockedSubmission = unitService.submitMultiQuestionSession(createResult.sessionId, {
    [qIdMCQ]: 'A', // Attempted tamper to wrong answer
    [qIdMSQ]: ['A'],
    [qIdNAT]: 999,
  });
  assert(
    lockedSubmission.correct === 3 && lockedSubmission.percentage === 100,
    'SESSION LOCKING: Subsequent submit returns identical cached result without tampering'
  );

  // Test 6: Submit session with PARTIAL / SKIPPED answers
  const partialSession = unitService.createMultiQuestionSession(
    { subject: 'Databases', difficulty: 'Medium', questionCount: 3, questionType: 'Mixed' },
    [sampleMCQ, sampleMSQ, sampleNAT]
  );
  const pIdMCQ = partialSession.questions[0].id;
  const pIdMSQ = partialSession.questions[1].id;
  const pIdNAT = partialSession.questions[2].id;

  const partialSubmission = unitService.submitMultiQuestionSession(partialSession.sessionId, {
    [pIdMCQ]: 'C', // Correct
    // pIdMSQ is SKIPPED (unanswered)
    [pIdNAT]: 999, // Attempted but incorrect
  });

  assert(partialSubmission.total === 3, 'Partial submission total is 3');
  assert(partialSubmission.attempted === 2, 'Partial submission attempted is 2');
  assert(partialSubmission.unanswered === 1, 'Partial submission unanswered is 1');
  assert(partialSubmission.correct === 1, 'Partial submission correct is 1');
  assert(partialSubmission.incorrect === 1, 'Partial submission incorrect is 1');
  assert(partialSubmission.percentage === 33, 'Partial submission percentage is 33% (1/3)');

  // Verify unanswered question card details
  const unansweredCard = partialSubmission.results.find((r) => r.questionId === pIdMSQ);
  assert(unansweredCard.isAttempted === false, 'Unanswered card has isAttempted === false');
  assert(unansweredCard.isCorrect === false, 'Unanswered card has isCorrect === false');
  assert(unansweredCard.userAnswer === null, 'Unanswered card has userAnswer === null');
  assert(Boolean(unansweredCard.explanation), 'Unanswered card still reveals explanation after submit');

  // Test 7: MSQ Evaluation logic (complete set, partial, superset)
  const msqExact = unitService.evaluateQuestionAnswer(sampleMSQ, ['A', 'B']);
  assert(msqExact.isCorrect === true, 'MSQ Evaluation: Exact complete set ["A", "B"] is correct');

  const msqPartial = unitService.evaluateQuestionAnswer(sampleMSQ, ['A']);
  assert(msqPartial.isCorrect === false, 'MSQ Evaluation: Partial selection ["A"] is incorrect (no partial credit)');

  const msqSuperset = unitService.evaluateQuestionAnswer(sampleMSQ, ['A', 'B', 'C']);
  assert(msqSuperset.isCorrect === false, 'MSQ Evaluation: Superset ["A", "B", "C"] is incorrect');

  // Test 8: NAT Evaluation logic (exact, within range, out of range)
  const natExact = unitService.evaluateQuestionAnswer(sampleNAT, 140);
  assert(natExact.isCorrect === true, 'NAT Evaluation: Exact number 140 is correct');

  const natWithinRange = unitService.evaluateQuestionAnswer(sampleNAT, 140.05);
  assert(natWithinRange.isCorrect === true, 'NAT Evaluation: Float 140.05 within tolerance range is correct');

  const natOutOfRange = unitService.evaluateQuestionAnswer(sampleNAT, 145);
  assert(natOutOfRange.isCorrect === false, 'NAT Evaluation: Value 145 out of tolerance range is incorrect');

  // Test 9: Unknown session ID throws 404
  let unknownSessionError = null;
  try {
    unitService.submitMultiQuestionSession('00000000-0000-0000-0000-000000000000', {});
  } catch (err) {
    unknownSessionError = err;
  }
  assert(
    unknownSessionError && unknownSessionError.code === 'SESSION_NOT_FOUND',
    'Unknown session ID throws SESSION_NOT_FOUND error (404)'
  );

  // Test 10: Expired session throws 404
  const shortService = new PracticeSessionService(10); // 10 ms TTL
  const shortSession = shortService.createMultiQuestionSession({}, [sampleMCQ]);
  await new Promise((resolve) => setTimeout(resolve, 30)); // Wait for TTL expiry
  let expiredError = null;
  try {
    shortService.submitMultiQuestionSession(shortSession.sessionId, {});
  } catch (err) {
    expiredError = err;
  }
  assert(
    expiredError && expiredError.code === 'SESSION_NOT_FOUND',
    'Expired session is purged and throws SESSION_NOT_FOUND (404)'
  );

  // -------------------------------------------------------------
  // Section 2: Same-Session Duplicate Protection Unit Tests
  // -------------------------------------------------------------
  console.log('\n[SECTION 2] Same-Session Duplicate Protection');

  // Candidate identical or near-identical to sampleMCQ
  const duplicateMCQ = {
    ...sampleMCQ,
    question: 'In a relational database, which normal form eliminates transitive dependencies of non-prime attributes on candidate keys?',
  };
  const simCheckDuplicate = questionSimilarityService.checkSimilarity(duplicateMCQ, [sampleMCQ]);
  assert(
    simCheckDuplicate.passed === false,
    'Same-session duplicate check REJECTS identical/near-duplicate candidate question',
    `Similarity: ${simCheckDuplicate.maxSimilarity}`
  );

  // Candidate distinctly different
  const distinctQuestion = {
    ...sampleNAT,
    question: 'Calculate the total number of non-isomorphic spanning trees of a complete graph K4 with 4 labeled vertices.',
    topic: 'Graph Theory',
  };
  const simCheckDistinct = questionSimilarityService.checkSimilarity(distinctQuestion, [sampleMCQ]);
  assert(
    simCheckDistinct.passed === true,
    'Same-session duplicate check ACCEPTS distinctly different candidate question',
    `Similarity: ${simCheckDistinct.maxSimilarity}`
  );

  // -------------------------------------------------------------
  // Section 3: Live Backend API Parameter Validation & Guardrails
  // -------------------------------------------------------------
  console.log('\n[SECTION 3] Live Backend API Parameter Validation & Guardrails');

  // Test 11: questionCount > 5 rejected (HTTP 400)
  const countOverRes = await fetch(`${API_BASE}/api/ai/practice/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject: 'Databases', questionCount: 10 }),
  });
  assert(countOverRes.status === 400, 'questionCount > 5 is rejected with HTTP 400');
  const countOverData = await countOverRes.json();
  assert(countOverData.code === 'INVALID_QUESTION_COUNT', 'Returns INVALID_QUESTION_COUNT error code');

  // Test 12: questionCount <= 0 rejected (HTTP 400)
  const countZeroRes = await fetch(`${API_BASE}/api/ai/practice/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject: 'Databases', questionCount: 0 }),
  });
  assert(countZeroRes.status === 400, 'questionCount <= 0 is rejected with HTTP 400');
  const countZeroData = await countZeroRes.json();
  assert(countZeroData.code === 'INVALID_QUESTION_COUNT', 'Returns INVALID_QUESTION_COUNT error code for 0');

  // Test 13: questionCount not 3 or 5 (e.g. 4) rejected (HTTP 400)
  const countFourRes = await fetch(`${API_BASE}/api/ai/practice/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject: 'Databases', questionCount: 4 }),
  });
  assert(countFourRes.status === 400, 'questionCount = 4 is rejected with HTTP 400');

  // Test 14: Missing subject rejected (HTTP 400)
  const missingSubjectRes = await fetch(`${API_BASE}/api/ai/practice/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionCount: 3 }),
  });
  assert(missingSubjectRes.status === 400, 'Missing subject is rejected with HTTP 400');
  const missingSubjectData = await missingSubjectRes.json();
  assert(missingSubjectData.code === 'MISSING_REQUIRED_FIELD', 'Returns MISSING_REQUIRED_FIELD error code');

  // Test 15: Invalid questionType rejected (HTTP 400)
  const invalidTypeRes = await fetch(`${API_BASE}/api/ai/practice/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject: 'Databases', questionCount: 3, questionType: 'TRUE_FALSE' }),
  });
  assert(invalidTypeRes.status === 400, 'Invalid questionType is rejected with HTTP 400');
  const invalidTypeData = await invalidTypeRes.json();
  assert(invalidTypeData.code === 'INVALID_QUESTION_TYPE', 'Returns INVALID_QUESTION_TYPE error code');

  // -------------------------------------------------------------
  // Section 4: Live Session Generation & Submission Tests
  // -------------------------------------------------------------
  console.log('\n[SECTION 4] Live Multi-Question Session Generation & Submission');

  // Record initial Question Bank count to verify database invariance
  const initialCountRes = await fetch(`${API_BASE}/api/questions`);
  const initialCountData = await initialCountRes.json();
  const initialCount = initialCountData.count;

  // Test 16: Live 3-Question Mixed Session Generation
  console.log('  [Live Call] Requesting 3-question Mixed practice session from /api/ai/practice/session...');
  const t0 = Date.now();
  const sessionGenRes = await fetch(`${API_BASE}/api/ai/practice/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject: 'Algorithms',
      difficulty: 'Medium',
      questionType: 'Mixed',
      questionCount: 3,
    }),
  });
  const sessionGenData = await sessionGenRes.json();
  const genDuration = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`  [Live Call] Completed in ${genDuration}s. HTTP Status: ${sessionGenRes.status}`);

  assert(sessionGenRes.status === 200, 'POST /api/ai/practice/session returns HTTP 200');
  assert(sessionGenData.success === true, 'Response indicates success: true');
  assert(Boolean(sessionGenData.sessionId), 'Response contains sessionId', `Session ID: ${sessionGenData.sessionId}`);
  assert(
    Array.isArray(sessionGenData.questions) && sessionGenData.questions.length === 3,
    'Response contains exactly 3 questions'
  );

  const liveQuestions = sessionGenData.questions || [];

  // Verify Mixed distribution: 1 MCQ, 1 MSQ, 1 NAT
  const countByType = { MCQ: 0, MSQ: 0, NAT: 0 };
  liveQuestions.forEach((q) => {
    countByType[q.questionType] = (countByType[q.questionType] || 0) + 1;
  });
  assert(
    countByType.MCQ === 1 && countByType.MSQ === 1 && countByType.NAT === 1,
    'Mixed 3-question session has exactly 1 MCQ, 1 MSQ, and 1 NAT',
    `Found: MCQ=${countByType.MCQ}, MSQ=${countByType.MSQ}, NAT=${countByType.NAT}`
  );

  // Anti-leak check on all live questions
  let anyLeaked = false;
  liveQuestions.forEach((q, idx) => {
    if (q.correctAnswer !== undefined || q.numericalAnswer !== undefined || q.explanation !== undefined) {
      anyLeaked = true;
    }
  });
  assert(
    !anyLeaked,
    'CRITICAL ANTI-LEAK: None of the live questions leak correctAnswer, numericalAnswer, or explanation'
  );

  // Live Submission Test
  if (sessionGenData.sessionId && liveQuestions.length === 3) {
    console.log('\n  [Live Call] Submitting answers to /api/ai/practice/session/:sessionId/submit...');
    const q1 = liveQuestions[0]; // MCQ
    const q2 = liveQuestions[1]; // MSQ (leave skipped)
    const q3 = liveQuestions[2]; // NAT

    const submitRes = await fetch(`${API_BASE}/api/ai/practice/session/${sessionGenData.sessionId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answers: {
          [q1.id]: 'A', // Sample answer for Q1
          // Q2 skipped
          [q3.id]: '10', // Sample answer for Q3
        },
      }),
    });
    const submitData = await submitRes.json();
    assert(submitRes.status === 200, 'POST /api/ai/practice/session/:sessionId/submit returns HTTP 200');
    assert(submitData.success === true, 'Submit response success === true');
    assert(submitData.data.total === 3, 'Submit response total is 3');
    assert(submitData.data.attempted === 2, 'Submit response attempted is 2');
    assert(submitData.data.unanswered === 1, 'Submit response unanswered is 1');
    assert(typeof submitData.data.correct === 'number', 'Submit response contains correct count');
    assert(typeof submitData.data.incorrect === 'number', 'Submit response contains incorrect count');
    assert(typeof submitData.data.percentage === 'number', 'Submit response contains percentage score');
    assert(Array.isArray(submitData.data.results) && submitData.data.results.length === 3, 'Returns 3 review cards');

    // Verify each review card has explanation and answers after submit
    const reviewCard1 = submitData.data.results.find((r) => r.questionId === q1.id);
    assert(Boolean(reviewCard1.correctAnswer), 'Review card contains correctAnswer after submit');
    assert(Boolean(reviewCard1.explanation), 'Review card contains explanation after submit');

    // Live Session Locking Test: Re-submitting should return the same locked result
    const reSubmitRes = await fetch(`${API_BASE}/api/ai/practice/session/${sessionGenData.sessionId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answers: {
          [q1.id]: 'B',
          [q2.id]: ['A', 'B'],
          [q3.id]: '999',
        },
      }),
    });
    const reSubmitData = await reSubmitRes.json();
    assert(
      reSubmitData.data.attempted === 2 && reSubmitData.data.unanswered === 1,
      'LIVE SESSION LOCKING: Re-submission preserves original answers and evaluation without mutation'
    );
  }

  // -------------------------------------------------------------
  // Section 5: Frontend Route & UI Integration
  // -------------------------------------------------------------
  console.log('\n[SECTION 5] Frontend Route & UI Integration');

  try {
    const frontendRes = await fetch(`${FRONTEND_BASE}/ai-practice`);
    assert(frontendRes.status === 200, 'Frontend /ai-practice route loads successfully with HTTP 200');
    const htmlText = await frontendRes.text();
    assert(htmlText.includes('id="root"'), 'Frontend returns valid React root mount element');
  } catch (err) {
    console.error('Frontend check note:', err.message);
  }

  // -------------------------------------------------------------
  // Section 6: Persistence Invariance & Backward Compatibility
  // -------------------------------------------------------------
  console.log('\n[SECTION 6] Persistence Invariance & Backward Compatibility');

  // Persistence Invariance: DB count must not change
  const finalCountRes = await fetch(`${API_BASE}/api/questions`);
  const finalCountData = await finalCountRes.json();
  assert(
    finalCountData.success === true && finalCountData.count === initialCount,
    'Question Bank count is preserved (ephemeral multi-question practice is NOT stored in DB)',
    `Count before: ${initialCount}, Count after: ${finalCountData.count}`
  );

  // Backward compatibility: Checkpoint 4A single-question practice endpoint
  const singleGenRes = await fetch(`${API_BASE}/api/ai/practice/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject: 'Databases',
      topic: 'Normalization',
      difficulty: 'Medium',
      questionType: 'MCQ',
    }),
  });
  assert(singleGenRes.status === 200, 'Backward compatibility: POST /api/ai/practice/generate returns HTTP 200');
  const singleGenData = await singleGenRes.json();
  assert(
    singleGenData.status === 'VERIFIED' || singleGenData.status === 'GENERATION_ATTEMPTS_EXHAUSTED',
    'Single-question practice returns valid status'
  );

  // Taxonomy endpoint
  const taxonomyRes = await fetch(`${API_BASE}/api/taxonomy/topics?subject=Databases`);
  assert(taxonomyRes.status === 200, 'GET /api/taxonomy/topics?subject=Databases returns HTTP 200');

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`Checkpoint 4B Test Results: ${passedTests}/${totalTests} passed (${failedTests} failed)`);
  console.log('===============================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runCheckpoint4BTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
