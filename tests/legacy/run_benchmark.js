/**
 * GATEForge Performance Benchmark Script
 * Tests:
 * 1. Single question: MCQ
 * 2. Single question: MSQ
 * 3. Single question: NAT
 * 4. 3-question Mixed session
 */

const BASE_URL = 'http://localhost:5000';

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runBenchmark() {
  console.log('\n==================================================');
  console.log('GATEForge AI Generation Pipeline Benchmark');
  console.log('==================================================\n');

  const benchmarkResults = [];

  // Scenario 1: Single MCQ
  console.log('--- [Scenario 1] Single Question: MCQ (Algorithms) ---');
  const t1Start = Date.now();
  const res1 = await fetchJSON(`${BASE_URL}/api/ai/generate-question`, {
    method: 'POST',
    body: JSON.stringify({
      subject: 'Algorithms',
      questionType: 'MCQ',
      difficulty: 'Medium',
    }),
  });
  const t1Total = Date.now() - t1Start;
  console.log(`Status: ${res1.status}, Success: ${res1.data?.success}, Pipeline Status: ${res1.data?.status}`);
  console.log(`Wall Clock Time: ${t1Total} ms`);
  if (res1.data?.telemetry) {
    console.log(`Telemetry: Attempts=${res1.data.attemptCount}, Gen=${res1.data.telemetry.generationMs}ms, Ver=${res1.data.telemetry.semanticVerificationMs}ms, Total=${res1.data.telemetry.totalMs}ms`);
  }
  benchmarkResults.push({
    scenario: 'Single MCQ',
    status: res1.data?.status || (res1.ok ? 'SUCCESS' : 'FAILED'),
    attempts: res1.data?.attemptCount || 1,
    wallClockMs: t1Total,
    telemetry: res1.data?.telemetry,
  });

  // Brief pause to stay safely under burst limits
  console.log('\nPacing pause (3s)...');
  await sleep(3000);

  // Scenario 2: Single MSQ
  console.log('\n--- [Scenario 2] Single Question: MSQ (Algorithms) ---');
  const t2Start = Date.now();
  const res2 = await fetchJSON(`${BASE_URL}/api/ai/generate-question`, {
    method: 'POST',
    body: JSON.stringify({
      subject: 'Algorithms',
      questionType: 'MSQ',
      difficulty: 'Medium',
    }),
  });
  const t2Total = Date.now() - t2Start;
  console.log(`Status: ${res2.status}, Success: ${res2.data?.success}, Pipeline Status: ${res2.data?.status}`);
  console.log(`Wall Clock Time: ${t2Total} ms`);
  if (res2.data?.telemetry) {
    console.log(`Telemetry: Attempts=${res2.data.attemptCount}, Gen=${res2.data.telemetry.generationMs}ms, Ver=${res2.data.telemetry.semanticVerificationMs}ms, Total=${res2.data.telemetry.totalMs}ms`);
  }
  benchmarkResults.push({
    scenario: 'Single MSQ',
    status: res2.data?.status || (res2.ok ? 'SUCCESS' : 'FAILED'),
    attempts: res2.data?.attemptCount || 1,
    wallClockMs: t2Total,
    telemetry: res2.data?.telemetry,
  });

  // Brief pause
  console.log('\nPacing pause (3s)...');
  await sleep(3000);

  // Scenario 3: Single NAT
  console.log('\n--- [Scenario 3] Single Question: NAT (Algorithms) ---');
  const t3Start = Date.now();
  const res3 = await fetchJSON(`${BASE_URL}/api/ai/generate-question`, {
    method: 'POST',
    body: JSON.stringify({
      subject: 'Algorithms',
      questionType: 'NAT',
      difficulty: 'Medium',
    }),
  });
  const t3Total = Date.now() - t3Start;
  console.log(`Status: ${res3.status}, Success: ${res3.data?.success}, Pipeline Status: ${res3.data?.status}`);
  console.log(`Wall Clock Time: ${t3Total} ms`);
  if (res3.data?.telemetry) {
    console.log(`Telemetry: Attempts=${res3.data.attemptCount}, Gen=${res3.data.telemetry.generationMs}ms, Ver=${res3.data.telemetry.semanticVerificationMs}ms, Total=${res3.data.telemetry.totalMs}ms`);
  }
  benchmarkResults.push({
    scenario: 'Single NAT',
    status: res3.data?.status || (res3.ok ? 'SUCCESS' : 'FAILED'),
    attempts: res3.data?.attemptCount || 1,
    wallClockMs: t3Total,
    telemetry: res3.data?.telemetry,
  });

  // Brief pause
  console.log('\nPacing pause (3s)...');
  await sleep(3000);

  // Scenario 4: 3-question Mixed Practice Session
  console.log('\n--- [Scenario 4] 3-Question Mixed Session (Algorithms) ---');
  const t4Start = Date.now();
  const res4 = await fetchJSON(`${BASE_URL}/api/ai/practice/session`, {
    method: 'POST',
    body: JSON.stringify({
      subject: 'Algorithms',
      questionType: 'Mixed',
      difficulty: 'Medium',
      questionCount: 3,
    }),
  });
  const t4Total = Date.now() - t4Start;
  console.log(`Status: ${res4.status}, Success: ${res4.data?.success}`);
  console.log(`Wall Clock Time: ${t4Total} ms`);
  if (res4.data?.questions) {
    console.log(`Questions Returned: ${res4.data.questions.length}`);
    const types = res4.data.questions.map((q) => q.questionType);
    console.log(`Types: ${types.join(', ')}`);
  } else {
    console.log(`Error: ${res4.data?.error || res4.data?.code}`);
  }
  benchmarkResults.push({
    scenario: '3-Question Mixed Session',
    status: res4.data?.success ? 'VERIFIED_SET' : (res4.data?.code || `HTTP_${res4.status}`),
    attempts: 3,
    wallClockMs: t4Total,
    questionsCount: res4.data?.questions?.length || 0,
  });

  console.log('\n==================================================');
  console.log('BENCHMARK SUMMARY');
  console.log('==================================================');
  console.table(benchmarkResults);
}

runBenchmark().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
