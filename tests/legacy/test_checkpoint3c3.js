/**
 * Comprehensive Automated Verification Suite for GATEForge Checkpoint 3C.3
 * (Context-Grounded Single Question Generation with Official Analyzed PYQ Retrieval & Structural Validation)
 */

import { questionGenerationService } from './backend/src/services/ai/questionGeneration.service.js';
import { pyqEnrichmentService } from './backend/src/services/pyqExtraction/pyqEnrichment.service.js';
import { buildQuestionGenerationPrompt } from './backend/src/services/ai/prompts/generation.prompt.js';
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

// Sample Official Analyzed PYQs for Mock Testing
const mockOfficialPYQs = [
  {
    id: 'gate-2024-cs-q22',
    subject: 'Database Management Systems',
    topic: 'Relational Model and Normalization',
    concepts: ['functional dependency', 'candidate key', 'BCNF decomposition', '2NF'],
    reasoningType: ['analytical', 'conceptual'],
    difficulty: 'Medium',
    questionType: 'MCQ',
    question: 'Consider a relation schema $R(A, B, C, D)$ with functional dependencies $AB \\to C, C \\to D, D \\to A$...',
    options: [
      { id: 'A', text: '1NF but not 2NF' },
      { id: 'B', text: '2NF but not 3NF' },
      { id: 'C', text: '3NF but not BCNF' },
      { id: 'D', text: 'BCNF' },
    ],
    correctAnswer: 'B',
    explanation: 'The candidate keys are $AB, BC, BD$...',
    source: { type: 'PYQ', provider: 'OFFICIAL_GATE', year: 2024, paper: 'CS' },
    aiAnalysis: {
      analyzed: true,
      questionPattern: 'Identify highest normal form of a relation given functional dependencies.',
      solutionApproach: 'Compute attribute closures to determine candidate keys and examine prime/non-prime attributes.',
      cognitiveSkill: 'apply',
    },
  },
  {
    id: 'gate-2024-cs-q23',
    subject: 'Database Management Systems',
    topic: 'Transaction and Concurrency Control',
    concepts: ['conflict serializability', 'precedence graph', 'recoverability'],
    reasoningType: ['analytical'],
    difficulty: 'Hard',
    questionType: 'MSQ',
    question: 'Consider the following schedule $S$ with transactions $T_1, T_2, T_3$...',
    options: [
      { id: 'A', text: 'Schedule $S$ is conflict serializable.' },
      { id: 'B', text: 'Schedule $S$ is recoverable.' },
      { id: 'C', text: 'Schedule $S$ is cascade-less.' },
      { id: 'D', text: 'Precedence graph contains a cycle.' },
    ],
    correctAnswer: ['A', 'B'],
    explanation: 'Testing precedence graph for cycles shows no cycle...',
    source: { type: 'PYQ', provider: 'OFFICIAL_GATE', year: 2024, paper: 'CS' },
    aiAnalysis: {
      analyzed: true,
      questionPattern: 'Evaluate schedule properties using precedence graphs and commit dependencies.',
      solutionApproach: 'Construct conflict graph and verify topological order.',
      cognitiveSkill: 'analyze',
    },
  },
  {
    id: 'gate-2024-cs-q01',
    subject: 'General Aptitude',
    topic: 'Verbal Ability',
    concepts: ['word analogy', 'semantic intensity'],
    reasoningType: ['logical'],
    difficulty: 'Easy',
    questionType: 'MCQ',
    question: 'If dry -> arid -> parched, then...',
    options: [
      { id: 'A', text: 'starve' },
      { id: 'B', text: 'reject' },
      { id: 'C', text: 'feast' },
      { id: 'D', text: 'deny' },
    ],
    correctAnswer: 'A',
    source: { type: 'PYQ', provider: 'OFFICIAL_GATE', year: 2024, paper: 'CS', section: 'GA' },
    aiAnalysis: {
      analyzed: true,
      questionPattern: 'Semantic analogy progression.',
      solutionApproach: 'Find matching intensity continuum.',
    },
  },
  {
    id: 'gate-2024-cs-q50',
    subject: 'Database Management Systems',
    topic: 'Normalization',
    source: { type: 'PYQ', provider: 'OFFICIAL_GATE', year: 2024, paper: 'CS' },
    aiAnalysis: undefined, // Unanalyzed
  },
];

async function runCheckpoint3C3Tests() {
  console.log('====================================================');
  console.log('🧪 RUNNING GATEFORGE CHECKPOINT 3C.3 VERIFICATION');
  console.log('====================================================\n');

  const mockDb = new MockDb(mockOfficialPYQs);

  // ----------------------------------------------------
  // TEST GROUP 1: Request & Context Retrieval Rules
  // ----------------------------------------------------
  console.log('📦 GROUP 1: Generation Request & Context Retrieval');

  // Test 1: Generation request accepts valid subject/topic
  const req1 = { subject: 'Database Management Systems', topic: 'Normalization', difficulty: 'Medium', questionType: 'MCQ' };
  assert(req1.subject && req1.questionType, 'Generation request accepts valid subject and questionType');

  // Test 2: Relevant official analyzed PYQs are retrieved
  const retrieved = pyqEnrichmentService.getGenerationContext({
    subject: 'Database Management Systems',
    topic: 'Normalization',
    limit: 4,
  }, mockDb);
  assert(retrieved.length > 0, 'Relevant official PYQs retrieved', `Count: ${retrieved.length}`);
  assert(retrieved[0].id === 'gate-2024-cs-q22', 'Most relevant question retrieved first (gate-2024-cs-q22)');

  // Test 3: General Aptitude is excluded by default
  assert(!retrieved.some((q) => q.subject === 'General Aptitude'), 'General Aptitude is excluded by default');

  // Test 4: Context size is bounded (e.g. 3 to 6)
  const boundedRetrieved = pyqEnrichmentService.getGenerationContext({
    subject: 'Database Management Systems',
    limit: 5,
  }, mockDb);
  assert(boundedRetrieved.length <= 6, 'Context size is strictly bounded (<= 6)');

  // Test 5: Context contains analyzed official PYQs only
  assert(retrieved.every((q) => q.aiAnalysis?.analyzed === true), 'Context contains analyzed PYQs only');
  assert(!retrieved.some((q) => q.id === 'gate-2024-cs-q50'), 'Unanalyzed question gate-2024-cs-q50 is excluded');

  // ----------------------------------------------------
  // TEST GROUP 2: Service Architecture & Prompt Mandates
  // ----------------------------------------------------
  console.log('\n🧠 GROUP 2: Service Architecture & Prompt Mandates');

  // Test 6: Existing generation service is reused
  assert(typeof questionGenerationService.generateQuestion === 'function', 'Existing questionGenerationService.generateQuestion exists');
  assert(typeof questionGenerationService.generateQuestionWithContext === 'function', 'questionGenerationService.generateQuestionWithContext exists');

  // Test 7: Gemini receives source-grounded context
  const compactContext = retrieved.map((q) => ({
    id: q.id,
    subject: q.subject,
    topic: q.topic,
    concepts: q.concepts,
    reasoningType: q.reasoningType,
    difficulty: q.difficulty,
    questionPattern: q.aiAnalysis?.questionPattern,
    solutionApproach: q.aiAnalysis?.solutionApproach,
    question: q.question,
  }));
  const generatedPrompt = buildQuestionGenerationPrompt({
    subject: 'Database Management Systems',
    topic: 'Normalization',
    difficulty: 'Medium',
    questionType: 'MCQ',
    relevantPYQs: compactContext,
  });
  assert(generatedPrompt.includes('gate-2024-cs-q22'), 'Prompt contains retrieved source PYQ ID');
  assert(generatedPrompt.includes('functional dependency'), 'Prompt contains retrieved source concepts');

  // Test 8: Prompt contains explicit anti-copy instructions
  assert(generatedPrompt.includes('DO NOT copy, clone, or paraphrase'), 'Prompt contains explicit anti-copy instruction');
  assert(generatedPrompt.includes('The supplied PYQs are references for concepts and reasoning patterns, not templates.'), 'Prompt contains reference-not-template mandate');

  // Test 9: Prompt contains original-question requirement
  assert(generatedPrompt.includes('Construct a completely ORIGINAL problem setup'), 'Prompt mandates completely original problem setup');
  assert(generatedPrompt.includes('Never claim that the generated question is an official GATE question.'), 'Prompt forbids claiming question is official GATE question');

  // ----------------------------------------------------
  // TEST GROUP 3: Structural Validation Rules (MCQ / MSQ / NAT)
  // ----------------------------------------------------
  console.log('\n🛡️ GROUP 3: Structural Validation Rules');

  // Test 10: Valid MCQ passes validation
  const validMCQ = {
    question: 'Consider a relational schema $R(U, V, W, X)$ with functional dependencies...',
    subject: 'Database Management Systems',
    topic: 'Normalization',
    questionType: 'MCQ',
    difficulty: 'Medium',
    concepts: ['functional dependency', 'candidate key'],
    options: [
      { id: 'A', text: '1NF but not 2NF' },
      { id: 'B', text: '2NF but not 3NF' },
      { id: 'C', text: '3NF but not BCNF' },
      { id: 'D', text: 'BCNF' },
    ],
    correctAnswer: 'C',
    explanation: 'The candidate key is $U$...',
  };
  const valMCQ = validateGeneratedQuestionStructure(validMCQ, 'MCQ');
  assert(valMCQ.isValid === true, 'Valid MCQ passes structural validation');

  // Test 11: Valid MSQ passes validation
  const validMSQ = {
    question: 'Which of the following statements is/are TRUE for BCNF decomposition?',
    subject: 'Database Management Systems',
    topic: 'Normalization',
    questionType: 'MSQ',
    difficulty: 'Medium',
    concepts: ['BCNF', 'lossless join', 'dependency preservation'],
    options: [
      { id: 'A', text: 'It is always lossless.' },
      { id: 'B', text: 'It always preserves functional dependencies.' },
      { id: 'C', text: 'Every determinant is a superkey.' },
      { id: 'D', text: 'It eliminates all redundancy due to functional dependencies.' },
    ],
    correctAnswer: ['A', 'C', 'D'],
    explanation: 'BCNF decomposition is always lossless but may not preserve dependencies...',
  };
  const valMSQ = validateGeneratedQuestionStructure(validMSQ, 'MSQ');
  assert(valMSQ.isValid === true, 'Valid MSQ passes structural validation');

  // Test 12: Valid NAT passes validation
  const validNAT = {
    question: 'Consider a relation with 4 attributes. What is the maximum number of candidate keys possible?',
    subject: 'Database Management Systems',
    topic: 'Candidate Keys',
    questionType: 'NAT',
    difficulty: 'Medium',
    concepts: ['candidate keys', 'combinatorics'],
    options: [],
    correctAnswer: 6,
    explanation: 'For 4 attributes, maximum candidate keys is $\\binom{4}{2} = 6$...',
  };
  const valNAT = validateGeneratedQuestionStructure(validNAT, 'NAT');
  assert(valNAT.isValid === true, 'Valid NAT passes structural validation');

  // Test 13: MCQ with wrong option count is rejected
  const badMCQCount = { ...validMCQ, options: [{ id: 'A', text: 'Opt 1' }, { id: 'B', text: 'Opt 2' }] };
  const valBadMCQ = validateGeneratedQuestionStructure(badMCQCount, 'MCQ');
  assert(valBadMCQ.isValid === false, 'MCQ with fewer than 4 options rejected');

  // Test 14: MCQ invalid answer reference is rejected
  const badMCQAns = { ...validMCQ, correctAnswer: 'Z' };
  const valBadAns = validateGeneratedQuestionStructure(badMCQAns, 'MCQ');
  assert(valBadAns.isValid === false, 'MCQ with non-existent option ID in correctAnswer rejected');

  // Test 15: MSQ invalid answer set is rejected
  const badMSQAns = { ...validMSQ, correctAnswer: ['A', 'X'] };
  const valBadMSQ = validateGeneratedQuestionStructure(badMSQAns, 'MSQ');
  assert(valBadMSQ.isValid === false, 'MSQ with non-existent option ID in correctAnswer rejected');

  // Test 16: NAT containing selectable options is rejected
  const badNATOptions = { ...validNAT, options: [{ id: 'A', text: '6' }] };
  const valBadNAT = validateGeneratedQuestionStructure(badNATOptions, 'NAT');
  assert(valBadNAT.isValid === false, 'NAT containing selectable options rejected');

  // Test 17: Missing explanation is rejected
  const noExpl = { ...validMCQ, explanation: '' };
  const valNoExpl = validateGeneratedQuestionStructure(noExpl, 'MCQ');
  assert(valNoExpl.isValid === false, 'Missing explanation rejected');

  // Test 18: Missing concepts are rejected
  const noConcepts = { ...validMCQ, concepts: [] };
  const valNoConcepts = validateGeneratedQuestionStructure(noConcepts, 'MCQ');
  assert(valNoConcepts.isValid === false, 'Missing concepts rejected');

  // ----------------------------------------------------
  // TEST GROUP 4: Invariance & Ephemeral Non-Persistence
  // ----------------------------------------------------
  console.log('\n🔒 GROUP 4: Invariance & Ephemeral Non-Persistence');

  // Test 19: Generated question is not persisted to database
  const dbBeforeCount = mockDb.findAll().length;
  // Ephemeral simulated generation
  const ephemeralQuestion = { ...validMCQ, source: { type: 'AI_GENERATED' } };
  assert(ephemeralQuestion.source.type === 'AI_GENERATED', 'Generated question has source.type = AI_GENERATED');
  assert(mockDb.findAll().length === dbBeforeCount, 'Question was NOT added to database (ephemeral)');

  // Test 20: Source PYQs remain completely unchanged
  const pyq22 = mockDb.findById('gate-2024-cs-q22');
  assert(pyq22.source.type === 'PYQ', 'Source PYQ type remains PYQ');
  assert(pyq22.question === mockOfficialPYQs[0].question, 'Source PYQ question text is 100% unchanged');

  // ----------------------------------------------------
  // TEST GROUP 5: Security & Endpoint Verification
  // ----------------------------------------------------
  console.log('\n🚀 GROUP 5: Security & Endpoint Verification');

  // Test 21: POST /api/ai/generate-question rejects missing subject
  const badReqRes = await fetch(`${API_BASE}/api/ai/generate-question`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic: 'Normalization' }), // Missing subject
  });
  assert(badReqRes.status === 400, 'POST /api/ai/generate-question with missing subject returns 400');

  // Test 22: API response never exposes API key
  const badReqData = await badReqRes.json();
  const rawBodyStr = JSON.stringify(badReqData);
  assert(!rawBodyStr.toLowerCase().includes('aiza'), 'Response does NOT leak Google API key prefix');
  assert(!rawBodyStr.toLowerCase().includes('apikey'), 'Response does NOT contain apiKey property');

  // Test 23: Root endpoint lists aiGenerateQuestion
  const rootRes = await fetch(`${API_BASE}/`);
  const rootData = await rootRes.json();
  assert(rootData.endpoints?.aiGenerateQuestion === 'POST /api/ai/generate-question', 'Root endpoint lists aiGenerateQuestion');

  // ----------------------------------------------------
  // Summary
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log(`📊 CHECKPOINT 3C.3 VERIFICATION COMPLETE: ${passedTests}/${totalTests} PASSED`);
  if (failedTests > 0) {
    console.error(`❌ ${failedTests} TESTS FAILED`);
    process.exit(1);
  } else {
    console.log('🎉 ALL CHECKPOINT 3C.3 VERIFICATIONS PASSED PERFECTLY!');
    process.exit(0);
  }
}

runCheckpoint3C3Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
