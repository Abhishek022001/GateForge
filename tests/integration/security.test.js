import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, stopTestServer } from '../setup/testServer.js';

describe('Security & Request Hardening', () => {
  let baseUrl;

  before(async () => {
    baseUrl = await startTestServer();
  });

  after(async () => {
    await stopTestServer();
  });

  it('OPTIONS preflight request should respond with HTTP 204 and CORS headers', async () => {
    const res = await fetch(`${baseUrl}/api/questions`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://gateforge.vercel.app',
        'Access-Control-Request-Method': 'POST',
      },
    });

    assert.equal(res.status, 204, 'Preflight status should be 204');
    assert.ok(res.headers.get('access-control-allow-origin'), 'CORS origin header should be present');
    assert.ok(res.headers.get('access-control-allow-methods'), 'CORS methods header should be present');
  });

  it('Oversized request body should be rejected with HTTP 413 Payload Too Large', async () => {
    // Generate a payload exceeding 2MB (2,097,152 bytes)
    const largeString = 'x'.repeat(2.2 * 1024 * 1024);
    const res = await fetch(`${baseUrl}/api/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: largeString }),
    });

    assert.equal(res.status, 413, 'Oversized body should return HTTP 413');
    const body = await res.json();
    assert.equal(body.code, 'PAYLOAD_TOO_LARGE');
  });

  it('Invalid JSON syntax should return HTTP 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}/api/questions/gate-cs-ds-001/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ malformed json syntax here',
    });

    assert.equal(res.status, 400, 'Malformed JSON should return HTTP 400');
    const body = await res.json();
    assert.equal(body.success, false);
  });
});
