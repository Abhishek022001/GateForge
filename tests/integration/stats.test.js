import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, stopTestServer } from '../setup/testServer.js';

describe('Analytics & Stats API', () => {
  let baseUrl;
  const testSessionId = `test-sess-${Date.now()}`;

  before(async () => {
    baseUrl = await startTestServer();
  });

  after(async () => {
    await stopTestServer();
  });

  it('GET /api/stats should return platform statistics and visitor metrics', async () => {
    const res = await fetch(`${baseUrl}/api/stats?sessionId=${testSessionId}`);
    assert.equal(res.status, 200, 'HTTP status should be 200');

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data, 'data should exist');
    assert.ok(typeof body.data.totalQuestions === 'number');
    assert.ok(typeof body.data.subjectsCovered === 'number');
    assert.ok(typeof body.data.practiceModes === 'number');
    assert.ok(body.data.liveUsers >= 1, 'liveUsers should be at least 1');
    assert.ok(body.data.peopleVisitedSoFar >= 1, 'peopleVisitedSoFar should be at least 1');
  });

  it('POST /api/stats/heartbeat should update presence and return current counts', async () => {
    const res = await fetch(`${baseUrl}/api/stats/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': testSessionId,
      },
      body: JSON.stringify({ sessionId: testSessionId }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data);
    assert.equal(typeof body.data.liveUsers, 'number');
  });

  it('POST /api/stats/leave should cleanly disconnect session presence', async () => {
    const res = await fetch(`${baseUrl}/api/stats/leave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId: testSessionId }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
  });
});
