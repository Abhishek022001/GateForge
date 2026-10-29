import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, stopTestServer, getBaseUrl } from '../setup/testServer.js';

describe('Health & Root API Endpoints', () => {
  let baseUrl;

  before(async () => {
    baseUrl = await startTestServer();
  });

  after(async () => {
    await stopTestServer();
  });

  it('GET /api/health should return HTTP 200 with status OK and system metadata', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200, 'HTTP status should be 200');

    const data = await res.json();
    assert.equal(data.status, 'OK', 'Status should be OK');
    assert.equal(data.message, 'Your API is running');
    assert.equal(data.healthy, true);
    assert.ok(data.timestamp, 'Timestamp should be present');
    assert.ok(data.application.includes('GATEForge'), 'Application name should include GATEForge');
    assert.ok(data.phase, 'Phase should be present');
    assert.equal(typeof data.questionCount, 'number', 'questionCount should be numeric');
    assert.equal(typeof data.aiConfigured, 'boolean', 'aiConfigured should be boolean');
  });

  it('HEAD /api/health should respond with HTTP 200 for keep-alive pingers', async () => {
    const res = await fetch(`${baseUrl}/api/health`, { method: 'HEAD' });
    assert.equal(res.status, 200, 'HEAD /api/health status should be 200');
  });

  it('GET /health (root alias) should return HTTP 200', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200, 'GET /health status should be 200');

    const data = await res.json();
    assert.equal(data.status, 'OK');
  });

  it('GET / should return HTTP 200 (serving frontend SPA or API info fallback)', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200, 'Root status should be 200');

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      assert.ok(data.name.includes('GATEForge'), 'Root API name should include GATEForge');
    } else {
      const text = await res.text();
      assert.ok(text.includes('GATEForge') || text.includes('html'), 'Frontend HTML should contain GATEForge');
    }
  });

  it('GET /api/unknown-route should return HTTP 404 with error payload', async () => {
    const res = await fetch(`${baseUrl}/api/unknown-endpoint-that-does-not-exist`);
    assert.equal(res.status, 404, 'Unknown endpoint should return 404');

    const data = await res.json();
    assert.equal(data.success, false);
    assert.ok(data.error.includes('Cannot GET'), 'Error message should describe missing route');
  });
});
