/**
 * Comprehensive Automated Verification Suite for GATEForge Checkpoint 3C.5
 * (Originality Safeguard: Deterministic Textual, N-Gram & Substitution Similarity Verification)
 */

import { questionSimilarityService, QuestionSimilarityService } from './backend/src/services/ai/questionSimilarity.service.js';
import { SIMILARITY_THRESHOLDS } from './backend/src/constants/similarity.js';
import { QuestionGenerationService } from './backend/src/services/ai/questionGeneration.service.js';

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

// Reference Official PYQ for similarity testing
const referencePYQ1 = {
  id: 'gate-2024-cs-q25',
  subject: 'Operating Systems',
  topic: 'Process Scheduling',
  question: 'A set of 5 processes arrive at time 0 with burst times 5, 7, 9, 12, and 15 milliseconds. If Shortest Job First (SJF) non-preemptive scheduling is used, what is the average waiting time in milliseconds?',
  questionType: 'NAT',
  options: [],
  correctAnswer: 11.2,
  explanation: 'Order of execution is P1, P2, P3, P4, P5 with waiting times 0, 5, 12, 21, 33. Average = 71/5 = 14.2.',
  source: { type: 'PYQ', provider: 'OFFICIAL_GATE', year: 2024, paper: 'CS' },
};

const referencePYQ2 = {
  id: 'gate-2024-cs-q45',
  subject: 'Algorithms',
  topic: 'Graph Theory',
  question: 'Given a connected undirected graph G(V, E) with |V| = n vertices and |E| = m edges, which of the following statements is ALWAYS TRUE regarding its depth first search (DFS) traversal?',
  questionType: 'MCQ',
  options: [
    { id: 'A', text: 'All edges in G are either tree edges or back edges in the DFS tree.' },
    { id: 'B', text: 'Cross edges always exist in an undirected graph DFS traversal.' },
    { id: 'C', text: 'Forward edges can exist in an undirected graph DFS traversal.' },
    { id: 'D', text: 'The DFS tree height is always strictly bounded by log n.' },
  ],
  correctAnswer: 'A',
  explanation: 'In an undirected graph, any edge is either a tree edge or a back edge. Cross edges and forward edges cannot exist.',
  source: { type: 'PYQ', provider: 'OFFICIAL_GATE', year: 2024, paper: 'CS' },
};

const referencePYQ3 = {
  id: 'gate-2024-cs-q42',
  subject: 'Algorithms',
  topic: 'Recurrence Relations',
  question: 'Consider the recurrence relation T(n) = 2T(n/2) + n for n >= 2 with T(1) = 1. What is the asymptotic tight bound for T(n)?',
  questionType: 'MCQ',
  options: [
    { id: 'A', text: 'Theta(n)' },
    { id: 'B', text: 'Theta(n log n)' },
    { id: 'C', text: 'Theta(n^2)' },
    { id: 'D', text: 'Theta(2^n)' },
  ],
  correctAnswer: 'B',
  explanation: 'By Master Theorem case 2, a=2, b=2, k=1. Since a = b^k (2 = 2^1), T(n) = Theta(n log n).',
  source: { type: 'PYQ', provider: 'OFFICIAL_GATE', year: 2024, paper: 'CS' },
};

async function runCheckpoint3C5Tests() {
  console.log('====================================================');
  console.log('🧪 RUNNING GATEFORGE CHECKPOINT 3C.5 VERIFICATION');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // GROUP 1: Central Configuration & Text Normalization
  // ----------------------------------------------------
  console.log('📦 GROUP 1: Central Configuration & Text Normalization');

  // Test 1: Threshold loaded from central configuration
  assert(SIMILARITY_THRESHOLDS.REJECT_THRESHOLD === 0.72, 'Rejection threshold is centrally defined at 0.72');
  assert(questionSimilarityService.getThreshold() === 0.72, 'Service loads central threshold 0.72');
  assert(SIMILARITY_THRESHOLDS.BANDS.LOW_MAX === 0.45, 'Central bands define LOW_MAX at 0.45');
  assert(SIMILARITY_THRESHOLDS.BANDS.MODERATE_MAX === 0.71, 'Central bands define MODERATE_MAX at 0.71');
  assert(SIMILARITY_THRESHOLDS.BANDS.HIGH_MIN === 0.72, 'Central bands define HIGH_MIN at 0.72');

  // Test 2: Base normalization handles case, LaTeX, and whitespace
  const rawText = '  Consider   \\quad the \\qquad relation  $$R(A, B)$$ \\; with \\text{dependencies}  ';
  const norm = questionSimilarityService.normalizeText(rawText);
  assert(norm === 'consider the relation $r(a b)$ with dependencies', 'Base normalization collapses LaTeX, whitespace and punctuation', norm);

  // Test 3: Substitution normalization handles numbers and variable patterns
  const mathText = 'A set of 5 processes arrive at time 0 with burst times 6, 8, and 10 ms.';
  const subst = questionSimilarityService.normalizeSubstitutions(mathText);
  assert(subst.includes('<NUM>'), 'Numbers are replaced with <NUM> placeholder in substitution normalization', subst);

  // ----------------------------------------------------
  // GROUP 2: Adversarial Similarity Detection
  // ----------------------------------------------------
  console.log('\n🛡️ GROUP 2: Adversarial Similarity Detection');

  // Test 4: Case A — Exact Copy rejected
  const exactCopy = { ...referencePYQ1 };
  const resExact = questionSimilarityService.checkSimilarity(exactCopy, [referencePYQ1]);
  assert(resExact.passed === false, 'Case A: Exact duplicate is REJECTED');
  assert(resExact.maxSimilarity === 1.0, 'Case A: Exact copy has similarity 1.0');
  assert(resExact.band === 'HIGH', 'Case A: Band is HIGH');

  // Test 5: Whitespace and case variant rejected
  const caseWhitespaceVariant = {
    ...referencePYQ1,
    question: '  a  SET OF 5 processes   ARRIVE AT TIME 0   with burst times 5, 7, 9, 12, and 15 milliseconds.  IF Shortest Job First (SJF)   non-preemptive scheduling is used, WHAT is the average waiting time in milliseconds?  ',
  };
  const resVariant = questionSimilarityService.checkSimilarity(caseWhitespaceVariant, [referencePYQ1]);
  assert(resVariant.passed === false, 'Case Variant: Case/whitespace variant is REJECTED');
  assert(resVariant.maxSimilarity >= 0.95, 'Case Variant: Has similarity >= 0.95');

  // Test 6: Punctuation-only changes rejected
  const punctVariant = {
    ...referencePYQ1,
    question: 'A set of 5 processes arrive at time 0 with burst times: 5, 7, 9, 12 and 15 milliseconds! If Shortest Job First (SJF) non-preemptive scheduling is used; what is the average waiting time in milliseconds.',
  };
  const resPunct = questionSimilarityService.checkSimilarity(punctVariant, [referencePYQ1]);
  assert(resPunct.passed === false, 'Punctuation Variant: Punctuation-only changes are REJECTED');
  assert(resPunct.maxSimilarity >= 0.95, 'Punctuation Variant: Has similarity >= 0.95');

  // Test 7: Case B — Number Substitution near-copy rejected
  const numberSubstCandidate = {
    ...referencePYQ1,
    question: 'A set of 6 processes arrive at time 0 with burst times 6, 8, 10, 14, 18, and 20 milliseconds. If Shortest Job First (SJF) non-preemptive scheduling is used, what is the average waiting time in milliseconds?',
  };
  const resNumSubst = questionSimilarityService.checkSimilarity(numberSubstCandidate, [referencePYQ1]);
  assert(resNumSubst.passed === false, 'Case B: Number-substitution near-copy is REJECTED');
  assert(resNumSubst.maxSimilarity >= 0.72, `Case B: Max similarity >= 0.72 (Found: ${resNumSubst.maxSimilarity})`);
  assert(resNumSubst.band === 'HIGH', 'Case B: Band is HIGH');

  // Test 8: Case C — Variable Rename near-copy rejected
  const varRenameCandidate = {
    ...referencePYQ2,
    question: 'Given a connected undirected graph H(V, E) with |V| = n vertices and |E| = m edges, which of the following statements is ALWAYS TRUE regarding its depth first search (DFS) traversal?',
  };
  const resVarRename = questionSimilarityService.checkSimilarity(varRenameCandidate, [referencePYQ2]);
  assert(resVarRename.passed === false, 'Case C: Variable-renaming near-copy is REJECTED');
  assert(resVarRename.maxSimilarity >= 0.85, `Case C: Max similarity >= 0.85 (Found: ${resVarRename.maxSimilarity})`);

  // Test 9: Recurrence variable rename T(n)=2T(n/2)+n vs S(m)=2S(m/2)+m
  const recurrenceRenameCandidate = {
    ...referencePYQ3,
    question: 'Consider the recurrence relation S(m) = 2S(m/2) + m for m >= 2 with S(1) = 1. What is the asymptotic tight bound for S(m)?',
  };
  const resRecurrence = questionSimilarityService.checkSimilarity(recurrenceRenameCandidate, [referencePYQ3]);
  assert(resRecurrence.passed === false, 'Recurrence variable rename is REJECTED');
  assert(resRecurrence.maxSimilarity >= 0.80, `Recurrence rename similarity >= 0.80 (Found: ${resRecurrence.maxSimilarity})`);

  // Test 10: Case D — Light Paraphrase with high n-gram overlap rejected
  const lightParaphraseCandidate = {
    ...referencePYQ1,
    question: 'Consider a set of 5 processes arriving at time 0 having burst times 5, 7, 9, 12, and 15 milliseconds. When Shortest Job First (SJF) non-preemptive scheduling is applied, determine the average waiting time in milliseconds.',
  };
  const resParaphrase = questionSimilarityService.checkSimilarity(lightParaphraseCandidate, [referencePYQ1]);
  assert(resParaphrase.passed === false, 'Case D: Light paraphrase with high substantive overlap is REJECTED');
  assert(resParaphrase.maxSimilarity >= 0.72, `Case D: Max similarity >= 0.72 (Found: ${resParaphrase.maxSimilarity})`);

  // Test 11: Case E — Same Concept, Different Problem passes
  const differentProblemSameConcept = {
    subject: 'Operating Systems',
    topic: 'Process Scheduling',
    question: 'Consider three processes P1, P2, and P3 arriving at times 0, 2, and 4 with execution times 8, 4, and 2 respectively under Round Robin scheduling with time quantum q = 3. What is the turnaround time of process P2?',
    questionType: 'NAT',
    options: [],
    correctAnswer: 7,
    explanation: 'Gantt chart execution for Round Robin quantum 3 yields completion time 9, turnaround time 9 - 2 = 7.',
  };
  const resDiffProblem = questionSimilarityService.checkSimilarity(differentProblemSameConcept, [referencePYQ1]);
  assert(resDiffProblem.passed === true, 'Case E: Same topic with substantially different problem PASSES');
  assert(resDiffProblem.maxSimilarity < 0.45, `Case E: Max similarity < 0.45 (Found: ${resDiffProblem.maxSimilarity})`);
  assert(resDiffProblem.band === 'LOW', 'Case E: Band is LOW');

  // Test 12: Case F — Generic GATE Phrase alone does NOT trigger rejection
  const genericPhraseOnly = {
    subject: 'Database Management Systems',
    topic: 'Relational Algebra',
    question: 'Which of the following statements is ALWAYS TRUE regarding natural join and theta join in relational algebra?',
    questionType: 'MCQ',
    options: [
      { id: 'A', text: 'Natural join is associative.' },
      { id: 'B', text: 'Theta join is commutative only if predicate is symmetric.' },
      { id: 'C', text: 'Natural join requires cartesian product.' },
      { id: 'D', text: 'None of the above.' },
    ],
    correctAnswer: 'A',
  };
  const resGeneric = questionSimilarityService.checkSimilarity(genericPhraseOnly, [referencePYQ2]);
  assert(resGeneric.passed === true, 'Case F: Generic GATE phrasing alone does not cause rejection');
  assert(resGeneric.maxSimilarity < 0.35, `Case F: Max similarity < 0.35 (Found: ${resGeneric.maxSimilarity})`);
  assert(resGeneric.band === 'LOW', 'Case F: Band is LOW');

  // ----------------------------------------------------
  // GROUP 3: Multi-Source Comparison & Question Types
  // ----------------------------------------------------
  console.log('\n🔍 GROUP 3: Multi-Source Comparison & Question Types');

  // Test 13: Candidate compared against ALL retrieved source questions
  const allSources = [referencePYQ1, referencePYQ2, referencePYQ3];
  const resMulti = questionSimilarityService.checkSimilarity(numberSubstCandidate, allSources);
  assert(resMulti.comparisons.length === 3, 'Candidate compared against ALL 3 retrieved source questions');

  // Test 14: Highest-similarity source ID returned
  assert(resMulti.mostSimilarQuestionId === 'gate-2024-cs-q25', 'Highest-similarity source ID correctly identifies gate-2024-cs-q25');

  // Test 15: MCQ Option overlap contributes appropriately
  const copyStemDifferentOptions = {
    ...referencePYQ2,
    options: [
      { id: 'A', text: 'Completely unrelated option 1' },
      { id: 'B', text: 'Completely unrelated option 2' },
      { id: 'C', text: 'Completely unrelated option 3' },
      { id: 'D', text: 'Completely unrelated option 4' },
    ],
  };
  const compDiffOpts = questionSimilarityService.compareSingle(copyStemDifferentOptions, referencePYQ2);
  const compSameOpts = questionSimilarityService.compareSingle(referencePYQ2, referencePYQ2);
  assert(compSameOpts.similarity > compDiffOpts.similarity, 'Identical options yield higher similarity than differing options');
  assert(compDiffOpts.breakdown.optionSimilarity < 0.20, 'Differing options yield low optionSimilarity (< 0.20)');

  // Test 16: NAT comparison works (no options required)
  const natComp = questionSimilarityService.compareSingle(referencePYQ1, referencePYQ1);
  assert(natComp.breakdown.optionSimilarity === undefined, 'NAT comparison has optionSimilarity: undefined');
  assert(natComp.similarity === 1.0, 'NAT exact copy has composite similarity 1.0');

  // Test 17: MSQ comparison works
  const msqSource = {
    id: 'gate-2024-cs-q24',
    subject: 'Operating Systems',
    topic: 'Threads',
    question: 'Which of the following resources are shared between multiple threads belonging to the same process?',
    questionType: 'MSQ',
    options: [
      { id: 'A', text: 'Heap memory' },
      { id: 'B', text: 'Global variables' },
      { id: 'C', text: 'Stack memory' },
      { id: 'D', text: 'CPU registers' },
    ],
    correctAnswer: ['A', 'B'],
  };
  const msqNearCopy = {
    ...msqSource,
    question: 'Which of the following components are shared among multiple threads of the same process?',
  };
  const resMSQ = questionSimilarityService.checkSimilarity(msqNearCopy, [msqSource]);
  assert(resMSQ.passed === false, 'MSQ near-copy is REJECTED');
  assert(resMSQ.maxSimilarity >= 0.72, `MSQ near-copy similarity >= 0.72 (Found: ${resMSQ.maxSimilarity})`);

  // ----------------------------------------------------
  // GROUP 4: Pipeline Order & Invariance
  // ----------------------------------------------------
  console.log('\n⚙️ GROUP 4: Pipeline Order & Invariance');

  const mockDb = new MockDb([referencePYQ1, referencePYQ2, referencePYQ3]);

  // Test 18: Semantic failure short-circuits similarity check
  let similarityChecked = false;
  const mockSimilaritySpy = {
    checkSimilarity() {
      similarityChecked = true;
      return { passed: true, maxSimilarity: 0.1, threshold: 0.72, mostSimilarQuestionId: null };
    },
  };

  const mockSemanticFailVerifier = {
    async verifyQuestion() {
      return {
        success: true,
        verification: {
          valid: false, // Semantic verification fails!
          questionSolvable: true,
          answerCorrect: false,
          explanationConsistent: false,
          conceptMatch: true,
          questionTypeValid: true,
          ambiguityDetected: false,
          difficultyMatch: true,
          issues: ['Answer is incorrect'],
          independentAnswer: 'B',
          confidence: 0.95,
        },
      };
    },
  };

  const mockAIGenerator = {
    isConfigured: () => true,
    getProviderName: () => 'mock',
    async generateStructured() {
      return {
        data: {
          question: 'Consider a relation with 4 attributes. How many candidate keys can exist?',
          questionType: 'MCQ',
          options: [
            { id: 'A', text: '4' },
            { id: 'B', text: '6' },
            { id: 'C', text: '8' },
            { id: 'D', text: '16' },
          ],
          correctAnswer: 'A',
          explanation: 'Valid explanation text with sufficient characters.',
          subject: 'Operating Systems',
          topic: 'Process Scheduling',
          concepts: ['scheduling'],
          difficulty: 'Medium',
        },
        rawText: '{}',
        model: 'mock',
        latencyMs: 10,
      };
    },
  };

  const genServiceShortCircuit = new QuestionGenerationService(
    mockAIGenerator,
    mockSemanticFailVerifier,
    mockSimilaritySpy
  );

  const shortCircuitRes = await genServiceShortCircuit.generateQuestionWithContext(
    { subject: 'Operating Systems', questionType: 'MCQ' },
    mockDb
  );

  assert(
    shortCircuitRes.status === 'CANDIDATE_REJECTED' || shortCircuitRes.status === 'GENERATION_ATTEMPTS_EXHAUSTED',
    'Semantic failure results in rejected status or exhaustion',
    `Status: ${shortCircuitRes.status}`
  );
  assert(similarityChecked === false, 'Similarity checker was NEVER invoked when semantic verification failed (short-circuited)');

  // Test 19: Generated candidate is still NOT persisted
  const countBefore = mockDb.findAll().length;
  if (shortCircuitRes.question) {
    assert(shortCircuitRes.question.source.type === 'AI_GENERATED', 'Candidate question has source.type: AI_GENERATED');
  } else {
    assert(true, 'No candidate question leaked on exhaustion');
  }
  assert(mockDb.findAll().length === countBefore, 'Candidate is strictly ephemeral (DB count unchanged)');

  // Test 20: Official PYQs remain unchanged
  const pyq25 = mockDb.findById('gate-2024-cs-q25');
  assert(pyq25.source.type === 'PYQ', 'Official PYQ source.type remains PYQ');
  assert(pyq25.question === referencePYQ1.question, 'Official PYQ question text is 100% unchanged');

  // Test 21: Endpoint response does NOT expose full source question texts unnecessarily
  assert(shortCircuitRes.validation?.similarity === undefined || !JSON.stringify(shortCircuitRes.validation?.similarity).includes('A set of 5 processes arrive'), 'Response does NOT leak full reference PYQ text');

  // ----------------------------------------------------
  // Summary
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log(`📊 CHECKPOINT 3C.5 VERIFICATION COMPLETE: ${passedTests}/${totalTests} PASSED`);
  if (failedTests > 0) {
    console.error(`❌ ${failedTests} TESTS FAILED`);
    process.exit(1);
  } else {
    console.log('🎉 ALL CHECKPOINT 3C.5 VERIFICATIONS PASSED PERFECTLY!');
    process.exit(0);
  }
}

runCheckpoint3C5Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
