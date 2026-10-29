import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, stopTestServer } from '../setup/testServer.js';

describe('Questions Bank & Answer Evaluation API', () => {
  let baseUrl;

  before(async () => {
    baseUrl = await startTestServer();
  });

  after(async () => {
    await stopTestServer();
  });

  it('GET /api/questions should return question list with pagination and answer sanitization', async () => {
    const res = await fetch(`${baseUrl}/api/questions?page=1&limit=10`);
    assert.equal(res.status, 200, 'HTTP status should be 200');

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data), 'data should be an array of questions');
    assert.ok(body.data.length > 0, 'data array should not be empty');
    assert.ok(body.pagination, 'pagination metadata should exist');
    assert.equal(body.pagination.page, 1);
    assert.equal(body.pagination.limit, 10);

    // Security & Anti-Cheat: Answers should NOT be revealed in the general question bank
    const firstQ = body.data[0];
    assert.equal(firstQ.correctAnswer, undefined, 'correctAnswer should not be leaked in public list');
    assert.equal(firstQ.explanation, undefined, 'explanation should not be leaked in public list');
  });

  it('GET /api/questions?subject=Algorithms should filter by subject', async () => {
    const res = await fetch(`${baseUrl}/api/questions?subject=Algorithms`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.length > 0);
    for (const q of body.data) {
      assert.equal(q.subject.toLowerCase(), 'algorithms');
    }
  });

  it('GET /api/questions/:id should return single question by ID', async () => {
    const res = await fetch(`${baseUrl}/api/questions/gate-cs-ds-001`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.id, 'gate-cs-ds-001');
    assert.ok(body.data.question);
    assert.ok(Array.isArray(body.data.options));
  });

  it('POST /api/questions/:id/answer should evaluate MCQ correctly', async () => {
    // Test Correct Answer 'B'
    const correctRes = await fetch(`${baseUrl}/api/questions/gate-cs-ds-001/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: 'B' }),
    });
    assert.equal(correctRes.status, 200);
    const correctBody = await correctRes.json();
    assert.equal(correctBody.success, true);
    assert.equal(correctBody.data.isCorrect, true, 'MCQ answer B should be marked correct');
    assert.equal(correctBody.data.correctAnswer, 'B');
    assert.ok(correctBody.data.explanation, 'Explanation should be returned upon answer submission');

    // Test Incorrect Answer 'C'
    const incorrectRes = await fetch(`${baseUrl}/api/questions/gate-cs-ds-001/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: 'C' }),
    });
    assert.equal(incorrectRes.status, 200);
    const incorrectBody = await incorrectRes.json();
    assert.equal(incorrectBody.data.isCorrect, false, 'MCQ answer C should be marked incorrect');
  });

  it('POST /api/questions/:id/answer should evaluate MSQ multiple-choice options', async () => {
    // Full match ["A", "B", "C"]
    const fullRes = await fetch(`${baseUrl}/api/questions/gate-cs-toc-msq-009/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: ['A', 'B', 'C'] }),
    });
    const fullBody = await fullRes.json();
    assert.equal(fullBody.data.isCorrect, true, 'Full MSQ selection should be correct');

    // Partial match ["A", "B"] (GATE rule: MSQ requires ALL correct options)
    const partialRes = await fetch(`${baseUrl}/api/questions/gate-cs-toc-msq-009/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: ['A', 'B'] }),
    });
    const partialBody = await partialRes.json();
    assert.equal(partialBody.data.isCorrect, false, 'Partial MSQ selection should be incorrect');
  });

  it('POST /api/questions/:id/answer should evaluate NAT numerical answers', async () => {
    // Exact NAT match (gate-cs-ds-nat-012, answer: 9)
    const exactRes = await fetch(`${baseUrl}/api/questions/gate-cs-ds-nat-012/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: '9' }),
    });
    const exactBody = await exactRes.json();
    assert.equal(exactBody.data.isCorrect, true);

    // NAT match for gate-cs-coa-nat-013 (Expected: 5)
    const correctRes = await fetch(`${baseUrl}/api/questions/gate-cs-coa-nat-013/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: '5' }),
    });
    const correctBody = await correctRes.json();
    assert.equal(correctBody.data.isCorrect, true, 'Correct numeric value should be true');

    // NAT wrong answer (provided: 2.5)
    const wrongRes = await fetch(`${baseUrl}/api/questions/gate-cs-coa-nat-013/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: '2.5' }),
    });
    const wrongBody = await wrongRes.json();
    assert.equal(wrongBody.data.isCorrect, false, 'Incorrect numeric value should be false');
  });
});
