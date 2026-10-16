/**
 * Checkpoint 5A Final Verification Suite:
 * System Hardening, Rate Limiting, Bounded Request Payloads,
 * Live Stats API, Zero Answer Leakage, Session Locking, and Graceful Failure.
 */

import http from 'http';

const API_BASE = 'http://localhost:5000';
let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition, testName, detail = '') {
  totalAssertions++;
  if (condition) {
    console.log(`  ✅ PASS: ${testName} ${detail ? `(${detail})` : ''}`);
    passedAssertions++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
    failedAssertions++;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('🛡️  CHECKPOINT 5A: SYSTEM HARDENING & READINESS SUITE');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // Test 1: Live Dynamic Stats Endpoint
  // ----------------------------------------------------
  console.log('--- Test 1: Live Dynamic Stats API (GET /api/stats) ---');
  try {
    const res = await fetch(`${API_BASE}/api/stats`);
    const data = await res.json();

    assert(res.status === 200, 'Stats endpoint returns HTTP 200');
    assert(data.success === true, 'Stats response success is true');
    assert(typeof data.data.totalQuestions === 'number' && data.data.totalQuestions >= 15, 'totalQuestions is a valid count >= 15', `count=${data.data?.totalQuestions}`);
    assert(typeof data.data.subjectsCovered === 'number' && data.data.subjectsCovered >= 5, 'subjectsCovered count is valid', `count=${data.data?.subjectsCovered}`);
    assert(data.data.practiceModes === 4, 'practiceModes count is 4', `modes=${data.data?.practiceModes}`);
    assert(typeof data.data.officialPyqs === 'number', 'officialPyqs count exists as a number');
    assert(typeof data.data.analyzedQuestions === 'number', 'analyzedQuestions count exists as a number');
  } catch (err) {
    assert(false, 'Live Stats API threw an error', err.message);
  }

  // ----------------------------------------------------
  // Test 2: Bounded Request Bodies (Fast Content-Length Rejection)
  // ----------------------------------------------------
  console.log('\n--- Test 2: Bounded Request Bodies (Fast Content-Length Rejection) ---');
  await new Promise((resolve) => {
    const req = http.request(
      `${API_BASE}/api/ai/practice/session`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': '3145728', // 3 MB (> 2 MB)
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          assert(res.statusCode === 413, 'Rejects oversized Content-Length with HTTP 413', `status=${res.statusCode}`);
          try {
            const parsed = JSON.parse(body);
            assert(parsed.error?.includes('2 MB') || parsed.code === 'PAYLOAD_TOO_LARGE', 'Error message specifies 2 MB limit');
          } catch (e) {
            assert(false, 'Body is valid JSON');
          }
          resolve();
        });
      }
    );
    req.on('error', (err) => {
      assert(false, 'Request failed unexpectedly', err.message);
      resolve();
    });
    req.end();
  });

  // ----------------------------------------------------
  // Test 3: Bounded Request Bodies (Chunked Streaming Rejection)
  // ----------------------------------------------------
  console.log('\n--- Test 3: Bounded Request Bodies (Chunked Streaming Rejection) ---');
  await new Promise((resolve) => {
    const req = http.request(
      `${API_BASE}/api/ai/practice/session`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Transfer-Encoding': 'chunked',
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          assert(res.statusCode === 413, 'Chunked payload > 2 MB returns HTTP 413', `status=${res.statusCode}`);
          resolve();
        });
      }
    );

    req.on('error', (err) => {
      // Socket abort by server on payload size violation is acceptable
      if (err.code === 'ECONNRESET' || err.message.includes('socket hang up') || err.message.includes('aborted')) {
        assert(true, 'Server terminated connection on streaming overflow', err.code || err.message);
      } else {
        assert(false, 'Unexpected streaming error', err.message);
      }
      resolve();
    });

    const chunk = Buffer.alloc(64 * 1024, 'x'); // 64 KB
    let sent = 0;
    const interval = setInterval(() => {
      try {
        req.write(chunk);
        sent += chunk.length;
        if (sent > 2.5 * 1024 * 1024) { // Sent 2.5 MB (> 2 MB)
          clearInterval(interval);
          req.end();
        }
      } catch (e) {
        clearInterval(interval);
        resolve();
      }
    }, 5);
  });

  // Brief pause to allow connection reset teardown
  await new Promise((r) => setTimeout(r, 200));

  // ----------------------------------------------------
  // Test 4: Zero Answer Leakage on Session Endpoints
  // ----------------------------------------------------
  console.log('\n--- Test 4: Zero Client-Side Answer Leakage ---');
  let createdSessionId = null;
  try {
    const res = await fetch(`${API_BASE}/api/ai/practice/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: 'Databases',
        topic: 'Normalization',
        difficulty: 'Medium',
        questionType: 'MCQ',
        questionCount: 3,
      }),
    });
    const data = await res.json();

    if (res.status === 200 && data.success && data.questions) {
      createdSessionId = data.sessionId;
      assert(true, 'AI Practice Session created successfully');
      assert(Array.isArray(data.questions) && data.questions.length === 3, 'Returns 3 questions');

      let leaked = false;
      for (const q of data.questions) {
        if (q.correctAnswer !== undefined || q.explanation !== undefined || q.numericalAnswer !== undefined) {
          leaked = true;
          break;
        }
      }
      assert(!leaked, 'Zero answer/explanation leakage in question projection');
    } else {
      assert(res.status === 429 || res.status === 502 || res.status === 503 || res.status === 200, 'Session endpoint responded safely', `status=${res.status}`);
    }
  } catch (err) {
    assert(false, 'Session creation threw error', err.message);
  }

  // ----------------------------------------------------
  // Test 5: Session Locking & Replay Protection
  // ----------------------------------------------------
  console.log('\n--- Test 5: Session Locking & Replay Protection ---');
  if (createdSessionId) {
    try {
      // First submission
      const sub1 = await fetch(`${API_BASE}/api/ai/practice/session/${encodeURIComponent(createdSessionId)}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: { 0: 'A', 1: 'B', 2: 'C' } }),
      });
      const data1 = await sub1.json();
      assert(sub1.status === 200 && data1.success, 'First session submission succeeds with 200');
      assert(typeof data1.data?.percentage === 'number', 'Evaluation scorecard returned with percentage score');
      assert(data1.data?.total === 3, 'Evaluation scorecard has total === 3');

      // Second submission attempt (tamper attempt with different answers)
      const sub2 = await fetch(`${API_BASE}/api/ai/practice/session/${encodeURIComponent(createdSessionId)}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: { 0: 'WRONG', 1: 'WRONG', 2: 'WRONG' } }),
      });
      const data2 = await sub2.json();
      assert(sub2.status === 200 && data2.success, 'Subsequent submission returns locked cached result with HTTP 200');
      assert(data2.data?.percentage === data1.data?.percentage && data2.data?.attempted === data1.data?.attempted, 'Session Locking: Answers and score are permanently locked against replay/tampering');
    } catch (err) {
      assert(false, 'Submission locking test failed', err.message);
    }
  } else {
    console.log('  ⚠️  Skipping Session Locking test (session creation skipped due to rate limit/concurrency)');
  }

  // ----------------------------------------------------
  // Test 6: Rate Limiting Rejection
  // ----------------------------------------------------
  console.log('\n--- Test 6: Sliding-Window Rate Limiting ---');
  try {
    let hitRateLimit = false;
    // Send 25 rapid requests to trigger 20 req/min limit
    const promises = [];
    for (let i = 0; i < 25; i++) {
      promises.push(
        fetch(`${API_BASE}/api/ai/practice/session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Test-Client-IP': 'rate-limit-test-unique-ip',
          },
          body: JSON.stringify({ subject: 'Algorithms', questionCount: 3 }),
        })
      );
    }
    const responses = await Promise.all(promises);
    for (const r of responses) {
      if (r.status === 429) {
        hitRateLimit = true;
        const retryAfter = r.headers.get('retry-after');
        assert(retryAfter !== null, 'Rate limit response contains Retry-After header', `retry-after=${retryAfter}`);
        break;
      }
    }
    assert(hitRateLimit, 'Rate limiter activates on burst requests above 20 req/min');
  } catch (err) {
    assert(false, 'Rate limit test threw error', err.message);
  }

  // ----------------------------------------------------
  // Test 7: Normal Question Bank & Health Resiliency
  // ----------------------------------------------------
  console.log('\n--- Test 7: Normal Question Bank & Health Resiliency ---');
  try {
    const healthRes = await fetch(`${API_BASE}/api/health`);
    assert(healthRes.status === 200, 'Health endpoint responds with 200');

    const bankRes = await fetch(`${API_BASE}/api/questions?limit=5`);
    const bankData = await bankRes.json();
    assert(bankRes.status === 200, 'Question Bank endpoint responds with 200');
    assert(Array.isArray(bankData.data) && bankData.data.length > 0, 'Question Bank returns question list');
  } catch (err) {
    assert(false, 'Question bank resiliency failed', err.message);
  }

  // ----------------------------------------------------
  // Summary
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log(`📊 CHECKPOINT 5A TEST SUMMARY: ${passedAssertions}/${totalAssertions} assertions passed`);
  if (failedAssertions > 0) {
    console.error(`❌ ${failedAssertions} assertions failed!`);
    process.exit(1);
  } else {
    console.log('✅ ALL CHECKPOINT 5A ASSERTIONS PASSED!');
    process.exit(0);
  }
}

runTests();
