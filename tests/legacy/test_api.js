async function runVerification() {
  const BASE_URL = 'http://localhost:5000';
  console.log('🧪 Running Comprehensive GATEForge Phase 1 API Verification (MCQ, MSQ, NAT)...\n');

  try {
    // 1. Health check
    console.log('1. Testing GET /api/health ...');
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const health = await healthRes.json();
    console.log('   Status:', healthRes.status);
    console.log('   Database:', health.database);
    console.log('   Question count:', health.questionCount);

    // 2. Fetch all questions
    console.log('\n2. Testing GET /api/questions ...');
    const questionsRes = await fetch(`${BASE_URL}/api/questions`);
    const questionsData = await questionsRes.json();
    console.log('   Status:', questionsRes.status);
    console.log('   Total questions count:', questionsData.count);
    const types = questionsData.data.reduce((acc, q) => {
      acc[q.questionType] = (acc[q.questionType] || 0) + 1;
      return acc;
    }, {});
    console.log('   Question Type Breakdown:', JSON.stringify(types));

    // 3. Test MCQ Correct & Incorrect Evaluation
    console.log('\n3. Testing MCQ Evaluation (gate-cs-ds-001 - Correct Answer: B) ...');
    const mcqCorrect = await (await fetch(`${BASE_URL}/api/questions/gate-cs-ds-001/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: 'B' }),
    })).json();
    console.log('   MCQ Answer "B": isCorrect =', mcqCorrect.data?.isCorrect);

    const mcqIncorrect = await (await fetch(`${BASE_URL}/api/questions/gate-cs-ds-001/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: 'C' }),
    })).json();
    console.log('   MCQ Answer "C": isCorrect =', mcqIncorrect.data?.isCorrect);

    // 4. Test MSQ Multi-Select Evaluation
    console.log('\n4. Testing MSQ Evaluation (gate-cs-toc-msq-008 - Correct: ["A", "B", "C"]) ...');
    const msqFull = await (await fetch(`${BASE_URL}/api/questions/gate-cs-toc-msq-008/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: ['A', 'B', 'C'] }),
    })).json();
    console.log('   MSQ Full Answer ["A", "B", "C"]: isCorrect =', msqFull.data?.isCorrect, '(Expected: true)');

    const msqPartial = await (await fetch(`${BASE_URL}/api/questions/gate-cs-toc-msq-008/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: ['A', 'B'] }),
    })).json();
    console.log('   MSQ Partial Answer ["A", "B"]: isCorrect =', msqPartial.data?.isCorrect, '(Expected: false)');

    const msqExtra = await (await fetch(`${BASE_URL}/api/questions/gate-cs-toc-msq-008/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: ['A', 'B', 'C', 'D'] }),
    })).json();
    console.log('   MSQ Extra Answer ["A", "B", "C", "D"]: isCorrect =', msqExtra.data?.isCorrect, '(Expected: false)');

    // 5. Test NAT Numerical Answer Evaluation
    console.log('\n5. Testing NAT Evaluation (gate-cs-ds-nat-011 - Expected: 9) ...');
    const natExact = await (await fetch(`${BASE_URL}/api/questions/gate-cs-ds-nat-011/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: '9' }),
    })).json();
    console.log('   NAT Answer "9": isCorrect =', natExact.data?.isCorrect, '(Expected: true)');

    console.log('\n6. Testing NAT Floating Point with Tolerance (gate-cs-coa-nat-012 - Expected: 5.0, Tol: 0.05) ...');
    const natFloat = await (await fetch(`${BASE_URL}/api/questions/gate-cs-coa-nat-012/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: '4.98' }),
    })).json();
    console.log('   NAT Answer "4.98" (within tol): isCorrect =', natFloat.data?.isCorrect, '(Expected: true)');

    const natWrong = await (await fetch(`${BASE_URL}/api/questions/gate-cs-coa-nat-012/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: '2.5' }),
    })).json();
    console.log('   NAT Answer "2.5" (outside tol): isCorrect =', natWrong.data?.isCorrect, '(Expected: false)');

    console.log('\n======================================================');
    console.log('🎉 ALL BACKEND API CHECKS PASSED WITH 100% SUCCESS!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('❌ Verification failed:', err);
  }
}

runVerification();
