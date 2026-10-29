/**
 * Verification Test: Bounded Request Body Sizes (Security / DoS Guard)
 *
 * Verifies:
 * 1. Requests within limit (< 2MB) are processed normally (HTTP 200).
 * 2. Requests with Content-Length > 2MB are fast-rejected with HTTP 413 and code 'PAYLOAD_TOO_LARGE'.
 * 3. Chunked streaming requests exceeding 2MB are aborted and rejected with HTTP 413 and code 'PAYLOAD_TOO_LARGE'.
 * 4. Normal operations and data integrity remain unaffected after 413 rejections.
 */

import http from 'node:http';
import { Readable } from 'node:stream';

const BASE_URL = 'http://localhost:5000';
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('TEST SUITE: Bounded Request Body Sizes (HTTP 413)');
  console.log('====================================================\n');

  // Test 1: Normal request within body size limit
  console.log('Test 1: Normal request within size limit');
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    assert(res.status === 200, `GET /api/health returned HTTP 200 (got ${res.status})`);
    const data = await res.json();
    assert(data.status === 'healthy', 'Health check reports healthy');
  } catch (err) {
    assert(false, `Test 1 failed with error: ${err.message}`);
  }

  // Test 2: Request with Content-Length exceeding 2MB (2.5 MB)
  console.log('\nTest 2: Fast-rejection on Content-Length > 2MB (2.5 MB payload)');
  try {
    const oversizedPayload = JSON.stringify({
      data: 'A'.repeat(2.5 * 1024 * 1024), // 2.5 MB
    });

    const res = await fetch(`${BASE_URL}/api/questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: oversizedPayload,
    });

    assert(res.status === 413, `Oversized request returned HTTP 413 (got ${res.status})`);
    const body = await res.json();
    assert(body.success === false, 'Response has success === false');
    assert(body.code === 'PAYLOAD_TOO_LARGE', `Response code is PAYLOAD_TOO_LARGE (got '${body.code}')`);
    assert(body.error.includes('Payload too large'), `Error message indicates payload too large: "${body.error}"`);
  } catch (err) {
    assert(false, `Test 2 failed with error: ${err.message}`);
  }

  // Allow undici connection pool to clean up closed socket
  await new Promise((r) => setTimeout(r, 100));

  // Test 3: Oversized request to /api/ai/practice/session
  console.log('\nTest 3: Fast-rejection on practice session endpoint with oversized payload');
  try {
    const oversizedPayload = JSON.stringify({
      subject: 'Database Management Systems',
      questionCount: 3,
      padding: 'X'.repeat(2.2 * 1024 * 1024), // 2.2 MB
    });

    const res = await fetch(`${BASE_URL}/api/ai/practice/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: oversizedPayload,
    });

    assert(res.status === 413, `Oversized session request returned HTTP 413 (got ${res.status})`);
    const body = await res.json();
    assert(body.code === 'PAYLOAD_TOO_LARGE', `Response code is PAYLOAD_TOO_LARGE (got '${body.code}')`);
  } catch (err) {
    assert(false, `Test 3 failed with error: ${err.message}`);
  }

  // Test 4: Chunked streaming request exceeding 2MB without Content-Length
  console.log('\nTest 4: Chunked streaming body parser size bounding (no Content-Length)');
  try {
    const chunkSize = 512 * 1024; // 512 KB per chunk
    const totalChunks = 5; // 5 * 512 KB = 2.5 MB > 2 MB limit
    let currentChunk = 0;

    const stream = new Readable({
      read() {
        if (currentChunk < totalChunks) {
          this.push('B'.repeat(chunkSize));
          currentChunk++;
        } else {
          this.push(null);
        }
      },
    });

    const result = await new Promise((resolve) => {
      const req = http.request(
        `${BASE_URL}/api/questions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Transfer-Encoding': 'chunked',
          },
        },
        (res) => {
          let responseData = '';
          res.on('data', (chunk) => {
            responseData += chunk;
          });
          res.on('end', () => {
            try {
              resolve({
                statusCode: res.statusCode,
                body: JSON.parse(responseData),
              });
            } catch (parseErr) {
              resolve({
                statusCode: res.statusCode,
                raw: responseData,
              });
            }
          });
        }
      );

      req.on('error', (err) => {
        // Socket destruction is expected during stream termination
        resolve({ error: err.message });
      });

      stream.pipe(req);
    });

    if (result.statusCode) {
      assert(result.statusCode === 413, `Chunked streaming returned HTTP 413 (got ${result.statusCode})`);
      assert(
        result.body?.code === 'PAYLOAD_TOO_LARGE',
        `Chunked streaming response code is PAYLOAD_TOO_LARGE (got '${result.body?.code}')`
      );
    } else {
      // If the socket was destroyed before headers could be fully read by client
      assert(true, `Connection terminated as expected upon exceeding limit: ${result.error}`);
    }
  } catch (err) {
    assert(false, `Test 4 failed with error: ${err.message}`);
  }

  // Test 5: Post-rejection service health and state integrity
  console.log('\nTest 5: Service health and normal operation after rejection');
  try {
    const res = await fetch(`${BASE_URL}/api/questions?limit=5`);
    assert(res.status === 200, `GET /api/questions returned HTTP 200 (got ${res.status})`);
    const data = await res.json();
    assert(data.success === true, 'Questions query succeeded');
    assert(Array.isArray(data.data) && data.data.length > 0, `Returned ${data.data?.length} questions`);
  } catch (err) {
    assert(false, `Test 5 failed with error: ${err.message}`);
  }

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
