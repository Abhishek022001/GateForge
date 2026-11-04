import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, stopTestServer } from '../setup/testServer.js';

describe('AI Tutor Proxy Endpoints', () => {
  let baseUrl;

  before(async () => {
    baseUrl = await startTestServer();
  });

  after(async () => {
    await stopTestServer();
  });

  it('GET /api/tutor/health should handle proxy connection gracefully', async () => {
    const res = await fetch(`${baseUrl}/api/tutor/health`);
    // If tutor service is running, it returns 200. If offline, the proxy returns 503 TUTOR_SERVICE_OFFLINE
    assert.ok([200, 503].includes(res.status), `Expected status 200 or 503, got ${res.status}`);
    const data = await res.json();
    if (res.status === 503) {
      assert.equal(data.success, false);
      assert.equal(data.code, 'TUTOR_SERVICE_OFFLINE');
    } else {
      assert.ok(data.status);
    }
  });

  it('POST /api/tutor/ask should return structured response or offline code', async () => {
    const res = await fetch(`${baseUrl}/api/tutor/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'What is an AVL tree?' }),
    });

    assert.ok([200, 503].includes(res.status), `Expected status 200 or 503, got ${res.status}`);
    const data = await res.json();
    if (res.status === 503) {
      assert.equal(data.success, false);
      assert.equal(data.code, 'TUTOR_SERVICE_OFFLINE');
    } else {
      assert.ok('is_grounded' in data);
      assert.ok('answer' in data);
    }
  });
});
