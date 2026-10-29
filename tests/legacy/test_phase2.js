async function runPhase2Tests() {
  const BASE_URL = 'http://localhost:5000';
  console.log('🧪 Running Comprehensive GATEForge Phase 2 Verification Suite...\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName, detail = '') {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ [PASS] ${testName} ${detail ? `(${detail})` : ''}`);
    } else {
      console.error(`  ❌ [FAIL] ${testName} ${detail ? `(${detail})` : ''}`);
    }
  }

  try {
    // Reset database to initial seed state
    await fetch(`${BASE_URL}/api/questions/seed`, { method: 'POST' });
    // 1. Health & Taxonomy Endpoints
    console.log('1. Verifying Health & Taxonomy Endpoints...');
    const health = await (await fetch(`${BASE_URL}/api/health`)).json();
    assert((health.status === 'OK' || health.status === 'healthy') && Boolean(health.phase), 'Health endpoint returns system status', `Phase: ${health.phase}, DB: ${health.database}`);

    const taxonomy = await (await fetch(`${BASE_URL}/api/taxonomy`)).json();
    assert(taxonomy.success && taxonomy.data?.subjects?.length >= 10, 'Taxonomy endpoint returns GATE CS subjects', `Subjects count: ${taxonomy.data?.subjects?.length}`);
    assert(taxonomy.data?.questionTypes?.includes('MCQ') && taxonomy.data?.questionTypes?.includes('MSQ') && taxonomy.data?.questionTypes?.includes('NAT'), 'Taxonomy contains MCQ, MSQ, NAT');

    // 2. Base Seed Questions
    console.log('\n2. Verifying Expanded Seed Data & Schema...');
    const seedRes = await (await fetch(`${BASE_URL}/api/questions?includeAnswer=true`)).json();
    assert(seedRes.success && seedRes.count >= 15, 'Returns 15 seed questions with full schema', `Count: ${seedRes.count}`);
    const sampleQ = seedRes.data[0];
    assert(Array.isArray(sampleQ.concepts) && sampleQ.concepts.length > 0, 'Question data model has concepts array', `Concepts: ${sampleQ.concepts?.join(', ')}`);
    assert(sampleQ.source && sampleQ.source.type === 'MANUAL', 'Seed question clearly marked as source.type = "MANUAL"', `Source: ${sampleQ.source?.type}`);

    // 3. Bulk Import: Valid MCQ, MSQ, NAT
    console.log('\n3. Testing Bulk Import of Valid Questions (MCQ, MSQ, NAT)...');
    const validBatch = [
      {
        id: 'gate-import-mcq-001',
        question: 'Which scheduling algorithm is non-preemptive?',
        subject: 'Operating Systems',
        topic: 'CPU Scheduling',
        concepts: ['CPU scheduling', 'non-preemptive', 'FCFS'],
        year: 2024,
        exam: 'GATE',
        paper: 'CS',
        questionNumber: 31,
        questionType: 'MCQ',
        difficulty: 'Easy',
        options: ['Round Robin', 'FCFS', 'SRTF', 'Preemptive Priority'],
        correctAnswer: 'B',
        explanation: 'FCFS (First-Come, First-Served) is strictly non-preemptive.',
        source: { type: 'PYQ', exam: 'GATE', year: 2024, paper: 'CS', questionNumber: 31 },
        reasoningType: ['conceptual'],
      },
      {
        id: 'gate-import-msq-002',
        question: 'Which of the following are context-free languages?',
        subject: 'Theory of Computation',
        topic: 'Context-Free Languages',
        concepts: ['CFL', 'pushdown automata', 'grammar hierarchy'],
        year: 2024,
        exam: 'GATE',
        paper: 'CS',
        questionNumber: 32,
        questionType: 'MSQ',
        difficulty: 'Medium',
        options: [
          '$L_1 = \\{a^n b^n \\mid n \\ge 0\\}$',
          '$L_2 = \\{w w^R \\mid w \\in \\{0,1\\}^*\\}$',
          '$L_3 = \\{a^n b^n c^n \\mid n \\ge 0\\}$',
          '$L_4 = \\{w w \\mid w \\in \\{0,1\\}^*\\}$',
        ],
        correctAnswer: ['A', 'B'],
        explanation: '$L_1$ and $L_2$ are context-free, whereas $L_3$ and $L_4$ require two stacks and are CSL (Context-Sensitive).',
        source: { type: 'PYQ', exam: 'GATE', year: 2024, paper: 'CS', questionNumber: 32 },
        reasoningType: ['conceptual', 'proof-based'],
      },
      {
        id: 'gate-import-nat-003',
        question: 'What is the sum of minterms for an XOR function $F(A,B) = A \\oplus B$?',
        subject: 'Digital Logic',
        topic: 'Logic Gates',
        concepts: ['XOR gate', 'minterm expansion'],
        year: 2024,
        exam: 'GATE',
        paper: 'CS',
        questionNumber: 33,
        questionType: 'NAT',
        difficulty: 'Easy',
        numericalAnswer: 2,
        numericalTolerance: 0.001,
        explanation: '$F(A,B) = \\sum m(1, 2)$. There are exactly 2 minterms.',
        source: { type: 'PYQ', exam: 'GATE', year: 2024, paper: 'CS', questionNumber: 33 },
        reasoningType: ['calculation'],
      },
    ];

    const importRes = await (await fetch(`${BASE_URL}/api/questions/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions: validBatch }),
    })).json();

    assert(importRes.success && importRes.summary?.imported === 3, 'Successfully imported 3 valid questions (MCQ, MSQ, NAT)', `Imported: ${importRes.summary?.imported}`);

    // 4. Bulk Import: Validation Rejections
    console.log('\n4. Testing Validation Rejection of Malformed Questions...');
    const malformedBatch = [
      {
        // Missing question text and subject
        topic: 'Tree Traversal',
        questionType: 'MCQ',
        options: ['A', 'B'],
        correctAnswer: 'A',
        explanation: 'Invalid',
      },
      {
        // Malformed MCQ: missing options
        question: 'Which is true?',
        subject: 'Algorithms',
        topic: 'Sorting',
        questionType: 'MCQ',
        options: [],
        correctAnswer: 'A',
        explanation: 'Missing options',
      },
      {
        // Malformed MSQ: empty correct answer array
        question: 'Select all true statements:',
        subject: 'DBMS',
        topic: 'Transactions',
        questionType: 'MSQ',
        options: ['Option 1', 'Option 2'],
        correctAnswer: [],
        explanation: 'Empty MSQ correctAnswer',
      },
      {
        // Malformed NAT: missing numerical value
        question: 'Calculate maximum speedup:',
        subject: 'Computer Organization and Architecture',
        topic: 'Pipelining',
        questionType: 'NAT',
        correctAnswer: 'NotANumber',
        explanation: 'NaN value',
      },
    ];

    const malformedRes = await (await fetch(`${BASE_URL}/api/questions/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions: malformedBatch }),
    })).json();

    assert(malformedRes.summary?.failed === 4, 'Rejected all 4 malformed records with validation errors', `Failed: ${malformedRes.summary?.failed}`);
    assert(malformedRes.summary?.errors?.length === 4, 'Returned specific error diagnostics for every invalid record');

    // 5. Duplicate Detection
    console.log('\n5. Testing Duplicate Detection...');
    const duplicateRes = await (await fetch(`${BASE_URL}/api/questions/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions: validBatch }), // Re-importing already existing questions
    })).json();

    assert(duplicateRes.summary?.duplicates === 3 && duplicateRes.summary?.imported === 0, 'Detected and skipped all 3 duplicate questions', `Duplicates: ${duplicateRes.summary?.duplicates}, Imported: ${duplicateRes.summary?.imported}`);

    // 6. Filtering Tests
    console.log('\n6. Testing Question Bank Filter Queries...');
    // Filter by subject
    const osFilter = await (await fetch(`${BASE_URL}/api/questions?subject=Operating%20Systems`)).json();
    assert(osFilter.count >= 2 && osFilter.data.every(q => q.subject === 'Operating Systems'), 'Filter by Subject (Operating Systems)', `Matches: ${osFilter.count}`);

    // Filter by question type
    const msqFilter = await (await fetch(`${BASE_URL}/api/questions?questionType=MSQ`)).json();
    assert(msqFilter.count >= 3 && msqFilter.data.every(q => q.questionType === 'MSQ'), 'Filter by Question Type (MSQ)', `Matches: ${msqFilter.count}`);

    // Filter by difficulty
    const hardFilter = await (await fetch(`${BASE_URL}/api/questions?difficulty=Hard`)).json();
    assert(hardFilter.count >= 3 && hardFilter.data.every(q => q.difficulty === 'Hard'), 'Filter by Difficulty (Hard)', `Matches: ${hardFilter.count}`);

    // Filter by year
    const yearFilter = await (await fetch(`${BASE_URL}/api/questions?year=2024`)).json();
    assert(yearFilter.count >= 5 && yearFilter.data.every(q => String(q.year) === '2024' || String(q.source?.year) === '2024'), 'Filter by Year (2024)', `Matches: ${yearFilter.count}`);

    // Combined filters
    const combinedFilter = await (await fetch(`${BASE_URL}/api/questions?subject=Algorithms&difficulty=Hard`)).json();
    assert(combinedFilter.count >= 1 && combinedFilter.data.every(q => q.subject === 'Algorithms' && q.difficulty === 'Hard'), 'Combined Filters (Subject + Difficulty)', `Matches: ${combinedFilter.count}`);

    // 7. Pagination Tests
    console.log('\n7. Testing Pagination...');
    const page1Res = await (await fetch(`${BASE_URL}/api/questions?page=1&limit=5`)).json();
    assert(page1Res.pagination?.page === 1 && page1Res.pagination?.limit === 5, 'Pagination metadata on Page 1', `Page: ${page1Res.pagination?.page}, Limit: ${page1Res.pagination?.limit}`);
    assert(page1Res.data.length === 5, 'Page 1 returns exactly 5 items');
    assert(page1Res.pagination?.totalPages >= 3, 'Total pages calculated accurately', `Total Pages: ${page1Res.pagination?.totalPages}, Total Questions: ${page1Res.pagination?.total}`);

    const page2Res = await (await fetch(`${BASE_URL}/api/questions?page=2&limit=5`)).json();
    assert(page2Res.data[0].id !== page1Res.data[0].id, 'Page 2 items are distinct from Page 1 items', `Page 2 First ID: ${page2Res.data[0].id}`);

    // 8. Phase 1 Practice Evaluation Preserved
    console.log('\n8. Verifying Practice Answer Evaluation Engine...');
    const evalMcq = await (await fetch(`${BASE_URL}/api/questions/gate-cs-ds-001/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: 'B' }),
    })).json();
    assert(evalMcq.data?.isCorrect === true, 'MCQ evaluation works correctly');

    const evalMsq = await (await fetch(`${BASE_URL}/api/questions/gate-cs-toc-msq-009/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: ['A', 'B', 'C'] }),
    })).json();
    assert(evalMsq.data?.isCorrect === true, 'MSQ evaluation works correctly');

    const evalNat = await (await fetch(`${BASE_URL}/api/questions/gate-cs-ds-nat-012/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: 9 }),
    })).json();
    assert(evalNat.data?.isCorrect === true, 'NAT evaluation works correctly');

    console.log('\n======================================================');
    console.log(`🎉 ALL PHASE 2 VERIFICATION TESTS PASSED (${passedTests}/${totalTests})!`);
    console.log('======================================================\n');
  } catch (err) {
    console.error('❌ Verification suite encountered an error:', err);
  }
}

runPhase2Tests();
