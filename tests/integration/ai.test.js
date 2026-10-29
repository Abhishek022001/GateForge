import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, stopTestServer } from '../setup/testServer.js';

describe('AI Infrastructure & Pattern Analytics', () => {
  let baseUrl;

  before(async () => {
    baseUrl = await startTestServer();
  });

  after(async () => {
    await stopTestServer();
  });

  it('GET /api/ai/health should return provider readiness without exposing secrets', async () => {
    const res = await fetch(`${baseUrl}/api/ai/health`);
    assert.equal(res.status, 200, 'HTTP status should be 200');

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data, 'AI health data should exist');
    assert.ok(['ready', 'not_configured', 'error'].includes(body.data.status));
    assert.ok(body.data.provider, 'Provider should be specified');
    assert.ok(body.data.model, 'Model should be specified');

    // Security check: Verify no API keys or sensitive authorization headers are leaked
    const jsonStr = JSON.stringify(body);
    assert.equal(jsonStr.includes('gsk_'), false, 'Groq API keys must not be exposed');
    assert.equal(jsonStr.includes('AIza'), false, 'Google API keys must not be exposed');
    assert.equal(body.data.apiKey, undefined, 'apiKey property must not be returned');
    assert.equal(body.data.secret, undefined, 'secret property must not be returned');
  });

  it('GET /api/ai/patterns should return pattern metrics and taxonomy coverage', async () => {
    const res = await fetch(`${baseUrl}/api/ai/patterns`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data);
    assert.equal(typeof body.data.totalQuestions, 'number');
    assert.equal(typeof body.data.analyzedQuestions, 'number');
    assert.equal(typeof body.data.coveragePercentage, 'number');
  });
});
