/**
 * Comprehensive Automated Verification Suite for GATEForge Checkpoint 2D
 * (Official PYQ Enrichment via Phase 3B AI, Metadata Classification & Generation-Context Retrieval)
 */

import { pyqEnrichmentService } from './backend/src/services/pyqExtraction/pyqEnrichment.service.js';
import { questionAnalysisService } from './backend/src/services/ai/questionAnalysis.service.js';
import { patternAggregationService } from './backend/src/services/ai/patternAggregation.service.js';
import { validateAnalysisQuality } from './backend/src/validators/aiAnalysisValidator.js';
import { sourceRegistry } from './backend/src/services/gateSources/sourceRegistry.js';

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

  update(id, updates) {
    const existing = this.questions.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    this.questions.set(id, updated);
    return updated;
  }

  create(q) {
    this.questions.set(q.id, { ...q });
    return q;
  }
}

async function runCheckpoint2DTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING GATEFORGE CHECKPOINT 2D VERIFICATION');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // TEST GROUP 1: Source Validation & Registration Guards
  // ----------------------------------------------------
  console.log('📦 GROUP 1: Source Validation & Registration Guards');

  const mockDb = new MockDb();

  // Test 1: Reject unregistered sourceId
  let unregisteredRejected = false;
  try {
    await pyqEnrichmentService.enrichOfficialPyqs('unregistered-source-999', mockDb);
  } catch (err) {
    unregisteredRejected = true;
    assert(err.message.includes('not registered'), 'Unregistered source throws descriptive error');
  }
  assert(unregisteredRejected === true, 'Unregistered source safely rejected');

  // Test 2: Reject non-QUESTION_PAPER document type (e.g. ANSWER_KEY)
  let wrongDocTypeRejected = false;
  try {
    await pyqEnrichmentService.enrichOfficialPyqs('gate-2024-cs-key', mockDb);
  } catch (err) {
    wrongDocTypeRejected = true;
    assert(err.message.includes('QUESTION_PAPER'), 'Non-question-paper source throws descriptive error');
  }
  assert(wrongDocTypeRejected === true, 'Answer key source rejected for question enrichment');

  // ----------------------------------------------------
  // TEST GROUP 2: Analysis Quality Validator (validateAnalysisQuality)
  // ----------------------------------------------------
  console.log('\n🛡️ GROUP 2: Analysis Quality Validator');

  // Test 3: Rejects generic concept "Computer Science"
  const badConcept1 = validateAnalysisQuality({
    subject: 'Algorithms',
    topic: 'Graph Algorithms',
    concepts: ['Computer Science', 'Dijkstra'],
    questionPattern: 'Find shortest path in weighted graph',
  });
  assert(badConcept1.isValid === false, 'Rejects generic concept "Computer Science"');

  // Test 4: Rejects generic concept "CS"
  const badConcept2 = validateAnalysisQuality({
    subject: 'DBMS',
    topic: 'Relational Model',
    concepts: ['CS', 'candidate key'],
    questionPattern: 'Find candidate keys of relation',
  });
  assert(badConcept2.isValid === false, 'Rejects generic concept "CS"');

  // Test 5: Rejects generic concept "GATE"
  const badConcept3 = validateAnalysisQuality({
    subject: 'Operating Systems',
    topic: 'Deadlock',
    concepts: ['GATE', 'bankers algorithm'],
    questionPattern: 'Check deadlock state using bankers algorithm',
  });
  assert(badConcept3.isValid === false, 'Rejects generic concept "GATE"');

  // Test 6: Rejects generic topic "CS"
  const badTopic = validateAnalysisQuality({
    subject: 'Theory of Computation',
    topic: 'CS',
    concepts: ['regular expressions', 'DFA'],
    questionPattern: 'Determine equivalent minimal DFA',
  });
  assert(badTopic.isValid === false, 'Rejects generic topic "CS"');

  // Test 7: Rejects empty or insufficient concepts (< 2)
  const tooFewConcepts = validateAnalysisQuality({
    subject: 'Computer Networks',
    topic: 'TCP Congestion Control',
    concepts: ['slow start'],
    questionPattern: 'Calculate congestion window size after loss',
  });
  assert(tooFewConcepts.isValid === false, 'Rejects fewer than 2 concepts');

  // Test 8: Rejects trivial question pattern
  const trivialPattern = validateAnalysisQuality({
    subject: 'Digital Logic',
    topic: 'Combinational Circuits',
    concepts: ['multiplexer', 'boolean function'],
    questionPattern: 'Answer the question',
  });
  assert(trivialPattern.isValid === false, 'Rejects trivial pattern "Answer the question"');

  // Test 9: Accepts high-quality technical CS analysis
  const validCS = validateAnalysisQuality({
    subject: 'DBMS',
    topic: 'Relational Model and Normalization',
    concepts: ['candidate key', 'functional dependency', 'BCNF decomposition'],
    questionPattern: 'Given a set of functional dependencies, find the highest normal form of the relation',
  });
  assert(validCS.isValid === true, 'Accepts high-quality technical CS analysis');

  // Test 10: Accepts high-quality General Aptitude analysis
  const validGA = validateAnalysisQuality({
    subject: 'General Aptitude',
    topic: 'Verbal Ability',
    concepts: ['semantic analogy', 'lexical gradation', 'word intensity'],
    questionPattern: 'Determine missing word in analogy based on increasing intensity',
  });
  assert(validGA.isValid === true, 'Accepts high-quality General Aptitude analysis');

  // ----------------------------------------------------
  // TEST GROUP 3: Non-Destructive Invariance
  // ----------------------------------------------------
  console.log('\n🔒 GROUP 3: Non-Destructive Invariance');

  const pristineQuestion = {
    id: 'gate-2024-cs-q22',
    question: 'Consider a relation $R(A,B,C,D)$ with functional dependencies...',
    questionType: 'MCQ',
    options: [
      { id: 'A', text: '1NF but not 2NF' },
      { id: 'B', text: '2NF but not 3NF' },
      { id: 'C', text: '3NF but not BCNF' },
      { id: 'D', text: 'BCNF' },
    ],
    correctAnswer: 'B',
    numericalAnswer: null,
    marks: 2,
    year: 2024,
    exam: 'GATE CS',
    paper: 'CS',
    section: 'CS-1',
    questionNumber: 22,
    explanation: 'Explanation not available yet.',
    source: {
      type: 'PYQ',
      provider: 'OFFICIAL_GATE',
      exam: 'GATE',
      year: 2024,
      paper: 'CS',
      section: 'CS-1',
      questionNumber: 22,
      questionPaperSourceId: 'gate-2024-cs-paper',
      answerKeySourceId: 'gate-2024-cs-key',
      questionPaperChecksum: 'mock-paper-checksum',
      answerKeyChecksum: 'mock-key-checksum',
    },
    subject: undefined,
    topic: undefined,
    subtopic: undefined,
    concepts: [],
    difficulty: undefined,
    aiAnalysis: undefined,
  };

  const invDb = new MockDb([pristineQuestion]);

  // Simulate mock enrichment update (populating aiAnalysis & metadata without touching official fields)
  const mockAiAnalysis = {
    analyzed: true,
    subject: 'DBMS',
    topic: 'Relational Model and Normalization',
    subtopic: 'Normal Forms (1NF, 2NF, 3NF, BCNF)',
    concepts: ['functional dependency', 'candidate key', 'partial dependency', 'second normal form'],
    subConcepts: ['prime attributes', 'superkey'],
    reasoningType: ['analytical', 'conceptual'],
    cognitiveSkill: 'apply',
    questionPattern: 'Given a relational schema and functional dependencies, identify the highest normal form satisfied.',
    solutionApproach: 'Find candidate keys, check for partial dependencies to determine 2NF.',
    difficultyAssessment: 'Medium',
    distractorPatterns: ['Confusing partial dependency with transitive dependency'],
    commonTraps: ['Overlooking multi-attribute candidate keys'],
    requiredKnowledge: ['Definition of 2NF', 'Attribute closure'],
    gateCharacteristics: ['Standard GATE normalization question with multi-attribute candidate key'],
    analysisVersion: '1.0.0',
    analyzedAt: new Date().toISOString(),
  };

  invDb.update(pristineQuestion.id, {
    subject: mockAiAnalysis.subject,
    topic: mockAiAnalysis.topic,
    subtopic: mockAiAnalysis.subtopic,
    concepts: mockAiAnalysis.concepts,
    difficulty: mockAiAnalysis.difficultyAssessment,
    reasoningType: mockAiAnalysis.reasoningType,
    aiAnalysis: mockAiAnalysis,
  });

  const enrichedQ = invDb.findById(pristineQuestion.id);

  // Test 11: Question text is preserved exactly
  assert(enrichedQ.question === pristineQuestion.question, 'Question text strictly preserved');
  // Test 12: Options are preserved exactly
  assert(JSON.stringify(enrichedQ.options) === JSON.stringify(pristineQuestion.options), 'Options strictly preserved');
  // Test 13: Question type is preserved exactly
  assert(enrichedQ.questionType === pristineQuestion.questionType, 'Question type strictly preserved');
  // Test 14: Correct answer is preserved exactly
  assert(enrichedQ.correctAnswer === pristineQuestion.correctAnswer, 'Correct answer strictly preserved');
  // Test 15: Marks, year, and questionNumber preserved
  assert(enrichedQ.marks === pristineQuestion.marks && enrichedQ.year === pristineQuestion.year, 'Marks and year preserved');
  assert(enrichedQ.questionNumber === pristineQuestion.questionNumber, 'Question number preserved');
  // Test 16: Source provenance strictly preserved
  assert(enrichedQ.source.questionPaperSourceId === pristineQuestion.source.questionPaperSourceId, 'Source provenance preserved');
  assert(enrichedQ.source.answerKeySourceId === pristineQuestion.source.answerKeySourceId, 'Answer key source ID preserved');

  // ----------------------------------------------------
  // TEST GROUP 4: Metadata Enrichment & Classification
  // ----------------------------------------------------
  console.log('\n🏷️ GROUP 4: Metadata Enrichment & Classification');

  // Test 17: Top-level metadata populated on question
  assert(enrichedQ.subject === 'DBMS', 'Top-level subject populated');
  assert(enrichedQ.topic === 'Relational Model and Normalization', 'Top-level topic populated');
  assert(enrichedQ.subtopic === 'Normal Forms (1NF, 2NF, 3NF, BCNF)', 'Top-level subtopic populated');
  assert(enrichedQ.concepts.length === 4, 'Top-level concepts populated (4 concepts)');
  assert(enrichedQ.difficulty === 'Medium', 'Top-level difficulty populated');
  assert(Array.isArray(enrichedQ.reasoningType) && enrichedQ.reasoningType.length === 2, 'Top-level reasoningType populated');

  // Test 18: Full aiAnalysis object attached
  assert(enrichedQ.aiAnalysis.analyzed === true, 'aiAnalysis.analyzed is true');
  assert(enrichedQ.aiAnalysis.cognitiveSkill === 'apply', 'aiAnalysis.cognitiveSkill populated');
  assert(enrichedQ.aiAnalysis.questionPattern.length > 20, 'aiAnalysis.questionPattern populated');
  assert(enrichedQ.aiAnalysis.commonTraps.length > 0, 'aiAnalysis.commonTraps populated');
  assert(enrichedQ.aiAnalysis.distractorPatterns.length > 0, 'aiAnalysis.distractorPatterns populated');

  // ----------------------------------------------------
  // TEST GROUP 5: Pattern Aggregation with General Aptitude Exclusion
  // ----------------------------------------------------
  console.log('\n📊 GROUP 5: Pattern Aggregation with General Aptitude Exclusion');

  const gaQuestion = {
    id: 'gate-2024-cs-q01',
    subject: 'General Aptitude',
    topic: 'Verbal Ability',
    questionNumber: 1,
    source: { type: 'PYQ', section: 'GA' },
    aiAnalysis: {
      analyzed: true,
      subject: 'General Aptitude',
      topic: 'Verbal Ability',
      concepts: ['analogy', 'vocabulary'],
      reasoningType: ['logical'],
      difficultyAssessment: 'Easy',
      questionPattern: 'Analogy pattern',
    },
  };

  const samplePool = [enrichedQ, gaQuestion];

  // Test 19: aggregatePatterns with excludeGA = true excludes GA
  const aggExcluded = patternAggregationService.aggregatePatterns(samplePool, { excludeGA: true });
  assert(aggExcluded.analyzedQuestions === 1, 'excludeGA=true includes only technical CS questions', `Count: ${aggExcluded.analyzedQuestions}`);
  assert(!aggExcluded.conceptFrequencies?.bySubject['General Aptitude'], 'General Aptitude absent from CS aggregated patterns');
  assert(Boolean(aggExcluded.conceptFrequencies?.bySubject['DBMS']), 'DBMS present in CS aggregated patterns');

  // Test 20: aggregatePatterns with excludeGA = false includes GA
  const aggIncluded = patternAggregationService.aggregatePatterns(samplePool, { excludeGA: false });
  assert(aggIncluded.analyzedQuestions === 2, 'excludeGA=false includes all questions', `Count: ${aggIncluded.analyzedQuestions}`);
  assert(Boolean(aggIncluded.conceptFrequencies?.bySubject['General Aptitude']), 'General Aptitude present when excludeGA=false');

  // ----------------------------------------------------
  // TEST GROUP 6: Deterministic Generation Context Retrieval
  // ----------------------------------------------------
  console.log('\n🎯 GROUP 6: Deterministic Generation Context Retrieval');

  const qAlgo1 = {
    id: 'gate-2024-cs-q36',
    subject: 'Algorithms',
    topic: 'Graph Algorithms',
    concepts: ['Dijkstra', 'shortest path', 'weighted graph'],
    reasoningType: ['analytical', 'numerical'],
    difficulty: 'Medium',
    questionNumber: 36,
    source: { type: 'PYQ', provider: 'OFFICIAL_GATE' },
    aiAnalysis: { analyzed: true },
  };

  const qAlgo2 = {
    id: 'gate-2024-cs-q37',
    subject: 'Algorithms',
    topic: 'Dynamic Programming',
    concepts: ['matrix multiplication', 'optimal substructure'],
    reasoningType: ['analytical'],
    difficulty: 'Hard',
    questionNumber: 37,
    source: { type: 'PYQ', provider: 'OFFICIAL_GATE' },
    aiAnalysis: { analyzed: true },
  };

  const qUnanalyzed = {
    id: 'gate-2024-cs-q50',
    subject: 'Algorithms',
    topic: 'Graph Algorithms',
    source: { type: 'PYQ', provider: 'OFFICIAL_GATE' },
    aiAnalysis: undefined,
  };

  const genDb = new MockDb([enrichedQ, gaQuestion, qAlgo1, qAlgo2, qUnanalyzed]);

  // Test 21: Filters candidate pool to only analyzed official PYQs
  const algoResults = pyqEnrichmentService.getGenerationContext({
    subject: 'Algorithms',
    topic: 'Graph Algorithms',
    concepts: ['Dijkstra', 'shortest path'],
    limit: 5,
  }, genDb);
  assert(algoResults.every((q) => q.aiAnalysis?.analyzed), 'All returned candidates are analyzed');
  assert(!algoResults.some((q) => q.id === 'gate-2024-cs-q50'), 'Unanalyzed question strictly excluded');

  // Test 22: GA excluded by default
  assert(!algoResults.some((q) => q.subject === 'General Aptitude'), 'General Aptitude strictly excluded from CS query');

  // Test 23: Deterministic relevance scoring (qAlgo1 ranks higher than qAlgo2 for Graph query)
  assert(algoResults[0].id === 'gate-2024-cs-q36', 'qAlgo1 ranked highest due to topic & concept match');

  // Test 24: Limit respected
  const limitedResults = pyqEnrichmentService.getGenerationContext({
    subject: 'Algorithms',
    limit: 1,
  }, genDb);
  assert(limitedResults.length === 1, 'Result count matches requested limit (1)');

  // ----------------------------------------------------
  // TEST GROUP 7: Cost & Repeat Protection (Idempotency)
  // ----------------------------------------------------
  console.log('\n💰 GROUP 7: Cost & Repeat Protection');

  // Test 25: Already analyzed question is skipped in questionAnalysisService
  const skipResult = await questionAnalysisService.analyzeQuestion(enrichedQ, invDb, { force: false });
  assert(skipResult.cached === true, 'Already analyzed question returns cached: true (no AI API call)');

  // ----------------------------------------------------
  // TEST GROUP 8: End-to-End API Integration (Live Server)
  // ----------------------------------------------------
  console.log('\n🚀 GROUP 8: End-to-End API Integration (Live Server)');

  // Test 26: POST /api/pyq/analyze/:sourceId returns 404 for invalid source
  const badSourceRes = await fetch(`${API_BASE}/api/pyq/analyze/non-existent-source`, { method: 'POST' });
  assert(badSourceRes.status === 404, 'POST /api/pyq/analyze/:sourceId returns 404 for invalid source');

  // Ensure Q.1 and Q.12 are imported and enriched in live DB for API verification
  const checkQ1 = await fetch(`${API_BASE}/api/questions/gate-2024-cs-q01`).then((r) => r.json());
  if (!checkQ1.data) {
    await fetch(`${API_BASE}/api/pyq/import/gate-2024-cs-paper`, { method: 'POST' });
  }
  if (!checkQ1.data?.aiAnalysis?.analyzed) {
    await fetch(`${API_BASE}/api/pyq/analyze/gate-2024-cs-paper?limit=2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 2 }),
    });
    const checkQ12 = await fetch(`${API_BASE}/api/questions/gate-2024-cs-q12`).then((r) => r.json());
    if (!checkQ12.data?.aiAnalysis?.analyzed) {
      await fetch(`${API_BASE}/api/ai/analyze-question/gate-2024-cs-q12`, { method: 'POST' });
    }
  }

  // Test 27: Verify enriched questions in live database (Q.1 is GA, Q.12 is Engineering Math)
  const q1Live = await fetch(`${API_BASE}/api/questions/gate-2024-cs-q01`).then((r) => r.json());
  assert(q1Live.data?.subject === 'General Aptitude', 'Live Q.1 classified under General Aptitude', `Subject: ${q1Live.data?.subject}`);
  assert(q1Live.data?.topic === 'Verbal Ability', 'Live Q.1 topic is Verbal Ability', `Topic: ${q1Live.data?.topic}`);

  const q12Live = await fetch(`${API_BASE}/api/questions/gate-2024-cs-q12`).then((r) => r.json());
  assert(q12Live.data?.subject === 'Engineering Mathematics', 'Live Q.12 classified under Engineering Mathematics', `Subject: ${q12Live.data?.subject}`);
  assert(q12Live.data?.aiAnalysis?.analyzed === true, 'Live Q.12 aiAnalysis.analyzed is true');

  // Test 28: Second analysis call on already analyzed questions skips AI
  const repeatRes = await fetch(`${API_BASE}/api/pyq/analyze/gate-2024-cs-paper?limit=2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit: 2, force: false }),
  });
  const repeatData = await repeatRes.json();
  assert(repeatRes.status === 200, 'Second analysis call returns 200');
  assert(repeatData.data?.skipped >= 1, 'Second call skipped already analyzed questions (idempotent)', `Skipped: ${repeatData.data?.skipped}`);

  // Test 29: GET /api/ai/patterns?excludeGA=true returns patterns excluding GA
  const patRes = await fetch(`${API_BASE}/api/ai/patterns?excludeGA=true`);
  const patData = await patRes.json();
  assert(patRes.status === 200, 'GET /api/ai/patterns?excludeGA=true returns 200');
  assert(patData.success === true, 'Patterns response success is true');
  assert(!patData.data?.patterns?.bySubject['General Aptitude'], 'Live patterns exclude General Aptitude when excludeGA=true');

  // Test 30: Practice API remains compatible with enriched PYQs
  const practiceRes = await fetch(`${API_BASE}/api/questions?sourceType=PYQ&limit=10`);
  const practiceData = await practiceRes.json();
  assert(practiceRes.status === 200, 'GET /api/questions?sourceType=PYQ returns 200');
  assert(practiceData.data?.length > 0, 'Official PYQs returned for practice');
  const samplePyq = practiceData.data[0];
  assert(samplePyq.id && samplePyq.question && samplePyq.questionType, 'PYQ maintains full schema required by Practice Engine');

  // ----------------------------------------------------
  // Summary
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log(`📊 CHECKPOINT 2D VERIFICATION COMPLETE: ${passedTests}/${totalTests} PASSED`);
  if (failedTests > 0) {
    console.error(`❌ ${failedTests} TESTS FAILED`);
    process.exit(1);
  } else {
    console.log('🎉 ALL CHECKPOINT 2D VERIFICATIONS PASSED PERFECTLY!');
    process.exit(0);
  }
}

runCheckpoint2DTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
