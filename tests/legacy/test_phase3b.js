/**
 * Comprehensive Automated Verification Suite for GATEForge Phase 3B
 * (AI Question Intelligence & Pedagogical Pattern Analysis Layer)
 */

const API_BASE = 'http://localhost:5000';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

async function runPhase3BTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING GATEFORGE PHASE 3B AUTOMATED VERIFICATION');
  console.log('====================================================\n');

  // Reset database before tests
  await fetch(`${API_BASE}/api/questions/seed`, { method: 'POST' });

  // ----------------------------------------------------
  // TEST GROUP 1: Health & AI Provider Status
  // ----------------------------------------------------
  console.log('📋 GROUP 1: Server & AI Infrastructure Health');
  const healthRes = await (await fetch(`${API_BASE}/api/health`)).json();
  assert(healthRes.status === 'OK' || healthRes.status === 'healthy', 'Backend status is healthy or OK');
  assert(healthRes.phase.includes('3B'), 'Phase is reported as Phase 3B');
  assert(healthRes.aiConfigured === true, 'AI is reported as configured');

  const aiHealthRes = await (await fetch(`${API_BASE}/api/ai/health`)).json();
  assert(aiHealthRes.success === true, 'GET /api/ai/health returns success: true');
  assert(aiHealthRes.data?.status === 'ready', 'AI health status is "ready"');
  assert(aiHealthRes.data?.provider === 'gemini', 'AI provider is "gemini"');
  assert(aiHealthRes.data?.model === 'gemini-flash-lite-latest', 'AI model is "gemini-flash-lite-latest"');

  // ----------------------------------------------------
  // TEST GROUP 2: Initial Pattern Analytics
  // ----------------------------------------------------
  console.log('\n📊 GROUP 2: Initial Pattern Aggregation State');
  const initialPatterns = await (await fetch(`${API_BASE}/api/ai/patterns`)).json();
  assert(initialPatterns.success === true, 'GET /api/ai/patterns returns success');
  assert(initialPatterns.data?.totalQuestions === 15, 'Total questions count is 15');
  assert(initialPatterns.data?.analyzedQuestions === 0, 'Initial analyzed count is 0');
  assert(initialPatterns.data?.unanalyzedQuestions === 15, 'Initial unanalyzed count is 15');
  assert(initialPatterns.data?.coveragePercentage === 0, 'Initial coverage is 0%');

  // ----------------------------------------------------
  // TEST GROUP 3: Single Question AI Analysis
  // ----------------------------------------------------
  console.log('\n🧠 GROUP 3: Single Question AI Analysis (gate-cs-ds-001)');
  const analyzeRes = await (await fetch(`${API_BASE}/api/ai/analyze-question/gate-cs-ds-001`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })).json();

  assert(analyzeRes.success === true, 'POST /api/ai/analyze-question/:id succeeds');
  assert(analyzeRes.data?.cached === false, 'First analysis is NOT cached (fresh generation)');
  const a1 = analyzeRes.data?.aiAnalysis;
  assert(a1?.analyzed === true, 'aiAnalysis.analyzed is true');
  assert(Array.isArray(a1?.concepts) && a1.concepts.length >= 1, 'aiAnalysis.concepts is non-empty array');
  assert(Array.isArray(a1?.subConcepts), 'aiAnalysis.subConcepts is an array');
  assert(Array.isArray(a1?.reasoningType) && a1.reasoningType.length >= 1, 'aiAnalysis.reasoningType is non-empty array');
  assert(['recall', 'understand', 'apply', 'analyze', 'evaluate'].includes(a1?.cognitiveSkill), `Cognitive skill "${a1?.cognitiveSkill}" is valid taxonomy`);
  assert(typeof a1?.questionPattern === 'string' && a1.questionPattern.length > 10, 'aiAnalysis.questionPattern describes problem archetype');
  assert(typeof a1?.solutionApproach === 'string' && a1.solutionApproach.length > 10, 'aiAnalysis.solutionApproach describes abstract method');
  assert(['Easy', 'Medium', 'Hard'].includes(a1?.difficultyAssessment), 'aiAnalysis.difficultyAssessment is Easy/Medium/Hard');
  assert(Array.isArray(a1?.commonTraps), 'aiAnalysis.commonTraps is array');
  assert(a1?.analysisVersion === '3b-v1', 'aiAnalysis.analysisVersion is "3b-v1"');
  assert(Boolean(a1?.analyzedAt), 'aiAnalysis.analyzedAt timestamp is set');

  // Verify original question integrity
  const q1 = await (await fetch(`${API_BASE}/api/questions/gate-cs-ds-001?includeAnswer=true`)).json();
  assert(q1.data?.question.includes('AVL tree'), 'Original question text is 100% preserved');
  assert(q1.data?.correctAnswer === 'B', 'Original correct answer is preserved');
  assert(q1.data?.options.length === 4, 'Original 4 options are preserved');
  assert(q1.data?.aiAnalysis?.analyzed === true, 'Database has persisted aiAnalysis');

  // ----------------------------------------------------
  // TEST GROUP 4: Caching & Cost-Control
  // ----------------------------------------------------
  console.log('\n⚡ GROUP 4: Analysis Caching & Force Re-analysis');
  const cacheStart = Date.now();
  const cachedRes = await (await fetch(`${API_BASE}/api/ai/analyze-question/gate-cs-ds-001`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })).json();
  const cacheLatency = Date.now() - cacheStart;

  assert(cachedRes.data?.cached === true, 'Subsequent call returns cached: true');
  assert(cacheLatency < 100, `Cached response returned in ${cacheLatency}ms (< 100ms)`);

  // Force re-analysis
  const forceRes = await (await fetch(`${API_BASE}/api/ai/analyze-question/gate-cs-ds-001?force=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })).json();
  assert(forceRes.data?.cached === false, 'Forced call returns cached: false (re-generated)');

  // ----------------------------------------------------
  // TEST GROUP 5: Bulk Analysis with Concurrency Control
  // ----------------------------------------------------
  console.log('\n📦 GROUP 5: Bulk Question Analysis & Concurrency');
  const bulkRes = await (await fetch(`${API_BASE}/api/ai/analyze-questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      questionIds: ['gate-cs-algo-002', 'gate-cs-dbms-003', 'non-existent-id'],
      force: true,
      concurrency: 2,
    }),
  })).json();

  assert(bulkRes.success === true, 'Bulk analysis returns success: true');
  assert(bulkRes.data?.total === 3, 'Bulk total processed is 3');
  assert(bulkRes.data?.analyzed === 2, '2 valid questions analyzed successfully');
  assert(bulkRes.data?.failed === 1, '1 invalid question ID failed gracefully without halting batch');

  // ----------------------------------------------------
  // TEST GROUP 6: Pattern Aggregation Verification
  // ----------------------------------------------------
  console.log('\n📈 GROUP 6: Aggregate Pattern Analytics Verification');
  const patternsRes = await (await fetch(`${API_BASE}/api/ai/patterns`)).json();
  const p = patternsRes.data;

  assert(p.analyzedQuestions === 3, `Analyzed count is 3 (was ${p.analyzedQuestions})`);
  assert(p.coveragePercentage === 20, `Coverage percentage is 20% (3/15)`);
  assert(p.conceptFrequencies?.topGlobal?.length >= 3, 'Global concept frequency map has entries');
  assert(Object.keys(p.conceptFrequencies?.bySubject || {}).length >= 2, 'Subject concept breakdown has subjects');
  assert(p.reasoningTypeDistribution.length >= 1, 'Reasoning type distribution has data');
  assert(p.commonQuestionPatterns.length === 3, 'Common question patterns catalog has 3 archetype records');

  // ----------------------------------------------------
  // TEST GROUP 7: Question Bank AI Status Filtering
  // ----------------------------------------------------
  console.log('\n🔍 GROUP 7: Question Bank AI Filtering');
  const analyzedFilterRes = await (await fetch(`${API_BASE}/api/questions?analyzed=true`)).json();
  assert(analyzedFilterRes.count === 3, 'Filter ?analyzed=true returns exactly 3 analyzed questions');

  const unanalyzedFilterRes = await (await fetch(`${API_BASE}/api/questions?analyzed=false`)).json();
  assert(unanalyzedFilterRes.count === 12, 'Filter ?analyzed=false returns exactly 12 unanalyzed questions');

  // ----------------------------------------------------
  // TEST GROUP 8: Phase 1 & 2 Regression (Practice & Evaluation)
  // ----------------------------------------------------
  console.log('\n🛡️ GROUP 8: Phase 1 & 2 Regression Tests');
  const mcqEval = await (await fetch(`${API_BASE}/api/questions/gate-cs-ds-001/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer: 'B' }),
  })).json();
  assert(mcqEval.data?.isCorrect === true, 'MCQ evaluation evaluates correct answer properly');

  const msqEval = await (await fetch(`${API_BASE}/api/questions/gate-cs-toc-msq-009/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer: ['A', 'B', 'C'] }),
  })).json();
  assert(msqEval.data?.isCorrect === true, 'MSQ evaluation evaluates multiple choice array properly');

  const natEval = await (await fetch(`${API_BASE}/api/questions/gate-cs-ds-nat-012/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer: 9 }),
  })).json();
  assert(natEval.data?.isCorrect === true, 'NAT numerical evaluation works with tolerance');

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log(`🏁 PHASE 3B TESTS COMPLETE: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPhase3BTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
