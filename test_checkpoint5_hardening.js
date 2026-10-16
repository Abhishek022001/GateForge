/**
 * Checkpoint 5 Hardening Verification Suite
 * Verifies:
 * 1. Official-PYQ Grounding (source.type === 'PYQ' & provider === 'OFFICIAL_GATE')
 * 2. Seed Question Exclusion from official grounding (allowDevelopmentFallback: false by default)
 * 3. Missing official context returns NO_GENERATION_CONTEXT (HTTP 422)
 * 4. Provider "retry in 48s" safely parsed to Retry-After: 48
 * 5. Provider temporary rate-limit missing duration falls back conservatively to 60s
 * 6. Daily quota exhaustion (AI_QUOTA_EXCEEDED) does NOT set 60s Retry-After
 * 7. AI_RATE_LIMITED vs AI_QUOTA_EXCEEDED separation in code, status, headers, and messages
 * 8. Fast-fail behavior: neither rate limit nor quota triggers generation retry loops
 */

import { pyqEnrichmentService, isOfficialPyq } from './backend/src/services/pyqExtraction/pyqEnrichment.service.js';
import { GeminiProvider } from './backend/src/services/ai/gemini.provider.js';
import { AIRateLimitError, AIQuotaExceededError, AIError } from './backend/src/services/ai/ai.interface.js';
import { QuestionGenerationService } from './backend/src/services/ai/questionGeneration.service.js';
import { OFFICIAL_PYQS } from './backend/src/data/officialQuestions.js';
import { SEED_QUESTIONS } from './backend/src/data/seedQuestions.js';

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

// In-Memory DB Mock matching QuestionDatabase
class MockDB {
  constructor() {
    this.questions = [...SEED_QUESTIONS, ...OFFICIAL_PYQS];
  }
  findAll() {
    return this.questions;
  }
}

async function runHardeningTests() {
  console.log('====================================================');
  console.log('🛡️  CHECKPOINT 5: RUNTIME HARDENING VERIFICATION');
  console.log('====================================================\n');

  const mockDb = new MockDB();

  // ----------------------------------------------------
  // Test 1: Official PYQ Grounding Validation
  // ----------------------------------------------------
  console.log('--- Test 1: Official PYQ Grounding References ---');
  {
    const context = pyqEnrichmentService.getGenerationContext(
      { subject: 'Algorithms', limit: 3 },
      mockDb
    );

    assert(context.length > 0, 'Context returns matching questions for Algorithms', `count=${context.length}`);
    const allOfficial = context.every(isOfficialPyq);
    assert(allOfficial, 'All returned context questions are genuine official GATE PYQs');
    for (const q of context) {
      assert(q.source?.type === 'PYQ', `Question ${q.id} has source.type === 'PYQ'`);
      assert(q.source?.provider === 'OFFICIAL_GATE', `Question ${q.id} has source.provider === 'OFFICIAL_GATE'`);
      assert(q.year !== undefined || q.source?.year !== undefined, `Question ${q.id} has official exam year`);
    }
  }

  // ----------------------------------------------------
  // Test 2: Seed Questions Excluded by Default
  // ----------------------------------------------------
  console.log('\n--- Test 2: Seed Questions Excluded from Official Grounding ---');
  {
    // Normal call without allowDevelopmentFallback
    const normalContext = pyqEnrichmentService.getGenerationContext(
      { subject: 'Algorithms' },
      mockDb
    );
    const hasSeed = normalContext.some((q) => q.source?.type === 'MANUAL');
    assert(!hasSeed, 'Normal AI Practice strictly excludes seed/manual questions from context');

    // Explicit fallback call
    const fallbackContext = pyqEnrichmentService.getGenerationContext(
      { subject: 'Algorithms', allowDevelopmentFallback: true },
      mockDb
    );
    assert(Array.isArray(fallbackContext), 'allowDevelopmentFallback is explicitly supported for dev mode');
  }

  // ----------------------------------------------------
  // Test 3: Missing Official Context Returns NO_GENERATION_CONTEXT (422)
  // ----------------------------------------------------
  console.log('\n--- Test 3: Missing Official Context Throws NO_GENERATION_CONTEXT (422) ---');
  {
    const emptyContext = pyqEnrichmentService.getGenerationContext(
      { subject: 'Nonexistent Subject 99' },
      mockDb
    );
    assert(emptyContext.length === 0, 'getGenerationContext returns empty array for absent subject');

    const fakeAi = { isConfigured: () => true, getProviderName: () => 'gemini' };
    const genService = new QuestionGenerationService(fakeAi, null, null);
    try {
      await genService.generateQuestionWithContext(
        { subject: 'Nonexistent Subject 99', difficulty: 'Medium', questionType: 'MCQ' },
        mockDb
      );
      assert(false, 'Should have thrown NO_GENERATION_CONTEXT');
    } catch (err) {
      assert(err.code === 'NO_GENERATION_CONTEXT', 'Throws code NO_GENERATION_CONTEXT', `code=${err.code}`);
      assert(err.status === 422, 'Throws HTTP status 422', `status=${err.status}`);
      assert(err.message.includes('Not enough analyzed GATE questions'), 'Safe user-facing error message');
    }
  }

  // ----------------------------------------------------
  // Test 4: Provider "retry in 48s" produces Retry-After: 48
  // ----------------------------------------------------
  console.log('\n--- Test 4: Provider "retry in 48s" Produces Retry-After: 48 ---');
  {
    const provider = new GeminiProvider({ apiKey: 'mock-key' });
    const delayFromDetails = provider.parseRetryDelay({
      details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '48.128s' }],
    });
    assert(delayFromDetails === 48, 'Parses retryDelay from details object', `delay=${delayFromDetails}`);

    const delayFromMessage = provider.parseRetryDelay({
      message: 'Resource has been exhausted. Please retry in 35s.',
    });
    assert(delayFromMessage === 35, 'Parses retry in XXs from error message', `delay=${delayFromMessage}`);

    // Map error test
    const mapped = provider.mapError({
      status: 429,
      message: 'Quota exceeded for metric: 15 requests per minute. Please retry in 48s.',
    });
    assert(mapped instanceof AIRateLimitError, 'Maps burst rate limit to AIRateLimitError');
    assert(mapped.code === 'AI_RATE_LIMITED', 'Error code is AI_RATE_LIMITED');
    assert(mapped.retryAfter === 48, 'AIRateLimitError carries parsed retryAfter: 48', `retryAfter=${mapped.retryAfter}`);
  }

  // ----------------------------------------------------
  // Test 5: Missing Temporary Retry Duration Falls Back Conservatively to 60s
  // ----------------------------------------------------
  console.log('\n--- Test 5: Missing Temporary Rate-Limit Retry Duration Uses 60s Fallback ---');
  {
    const provider = new GeminiProvider({ apiKey: 'mock-key' });
    const mapped = provider.mapError({
      status: 429,
      message: 'Too many requests. Rate limit reached.',
    });
    assert(mapped instanceof AIRateLimitError, 'Maps to AIRateLimitError');
    assert(mapped.retryAfter === 60, 'Conservative fallback is 60s', `retryAfter=${mapped.retryAfter}`);
  }

  // ----------------------------------------------------
  // Test 6: Daily Quota Exhaustion (AI_QUOTA_EXCEEDED) Does NOT Promise 60s
  // ----------------------------------------------------
  console.log('\n--- Test 6: Daily Quota Exhaustion Omits 60s Retry-After ---');
  {
    const provider = new GeminiProvider({ apiKey: 'mock-key' });
    const mapped = provider.mapError({
      status: 429,
      message: 'Quota exceeded for metric: GenerateRequestsPerDay, limit: 500 per day',
    });
    assert(mapped instanceof AIQuotaExceededError, 'Maps daily limit to AIQuotaExceededError');
    assert(mapped.code === 'AI_QUOTA_EXCEEDED', 'Error code is AI_QUOTA_EXCEEDED');
    assert(mapped.retryAfter === undefined, 'AIQuotaExceededError does NOT set retryAfter: 60', `retryAfter=${mapped.retryAfter}`);
    assert(
      mapped.message.includes('quota has been exhausted'),
      'Message states quota exhaustion without raw provider URL leakage',
      mapped.message
    );
  }

  // ----------------------------------------------------
  // Test 7: AI_RATE_LIMITED vs AI_QUOTA_EXCEEDED Separation
  // ----------------------------------------------------
  console.log('\n--- Test 7: AI_RATE_LIMITED vs AI_QUOTA_EXCEEDED Code & Message Separation ---');
  {
    const rateLimitErr = new AIRateLimitError('AI generation is temporarily rate-limited. Please wait a moment and try again.', 48);
    const quotaErr = new AIQuotaExceededError('The AI provider quota has been exhausted. Generation will become available again when the provider quota resets.');

    assert(rateLimitErr.code === 'AI_RATE_LIMITED', 'Rate limit code is AI_RATE_LIMITED');
    assert(quotaErr.code === 'AI_QUOTA_EXCEEDED', 'Quota code is AI_QUOTA_EXCEEDED');
    assert(rateLimitErr.code !== quotaErr.code, 'Error codes are strictly distinct');
    assert(rateLimitErr.status === 429 && quotaErr.status === 429, 'Both return HTTP 429');
    assert(rateLimitErr.retryAfter === 48, 'Rate limit carries retryAfter');
    assert(quotaErr.retryAfter === undefined, 'Quota does not carry short retryAfter');
    assert(rateLimitErr.message !== quotaErr.message, 'User-facing messages are distinct');
  }

  // ----------------------------------------------------
  // Test 8: Fast-Fail Behavior (No Retries on 429 Rate-Limit / Quota)
  // ----------------------------------------------------
  console.log('\n--- Test 8: Fast-Fail on 429 Rate-Limit & Quota (No Regeneration Loops) ---');
  {
    let callCount = 0;
    const failingAi = {
      isConfigured: () => true,
      getProviderName: () => 'gemini',
      generateStructured: async () => {
        callCount++;
        throw new AIRateLimitError('Rate limit exceeded', 30);
      },
    };

    const genService = new QuestionGenerationService(failingAi, null, null, 3);
    let caught = null;
    try {
      await genService.generateQuestionWithContext(
        { subject: 'Algorithms', difficulty: 'Medium', questionType: 'MCQ' },
        mockDb
      );
    } catch (err) {
      caught = err;
    }

    assert(caught instanceof AIRateLimitError, 'Throws AIRateLimitError on first failure');
    assert(callCount === 1, 'Fast-failed immediately without retrying (callCount === 1)', `calls=${callCount}`);
    assert(caught.code === 'AI_RATE_LIMITED', 'Preserves error code AI_RATE_LIMITED');
  }

  // ----------------------------------------------------
  // Test 9: Live Server HTTP API Integration
  // ----------------------------------------------------
  console.log('\n--- Test 9: Live Server API 422 & 429 Response Headers ---');
  try {
    // 9a. Test missing official context returns HTTP 422
    const res422 = await fetch('http://localhost:5000/api/ai/practice/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: 'Artificial Superintelligence Unknown Subject',
        questionCount: 3,
        questionType: 'MCQ',
        difficulty: 'Medium',
      }),
    });
    const body422 = await res422.json();
    assert(res422.status === 422, 'Returns HTTP 422 for ungrounded subject', `status=${res422.status}`);
    assert(body422.code === 'NO_GENERATION_CONTEXT', 'Returns code NO_GENERATION_CONTEXT', `code=${body422.code}`);

    // 9b. Verify Retry-After header on 429 rate limiter endpoint
    const promises = [];
    for (let i = 0; i < 25; i++) {
      promises.push(
        fetch('http://localhost:5000/api/ai/practice/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Test-Client-IP': 'spam-client-hardening-9b',
          },
          body: JSON.stringify({ subject: 'Algorithms', questionCount: 3 }),
        })
      );
    }
    const responses = await Promise.all(promises);
    let hitRateLimit = false;
    for (const r of responses) {
      if (r.status === 429) {
        hitRateLimit = true;
        const retryHeader = r.headers.get('retry-after');
        const retryVal = parseInt(retryHeader, 10);
        assert(!isNaN(retryVal) && retryVal > 0, 'Server rate limiter sets valid positive Retry-After header', `retry=${retryHeader}`);
        break;
      }
    }
    assert(hitRateLimit, 'Local rate limiter successfully triggers 429');
  } catch (err) {
    assert(false, 'Live API test encountered error', err.message);
  }

  // ----------------------------------------------------
  // Summary
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log(`HARDENING TEST SUMMARY:`);
  console.log(`Total Assertions: ${totalAssertions}`);
  console.log(`Passed: ${passedAssertions}`);
  console.log(`Failed: ${failedAssertions}`);
  console.log('====================================================');

  if (failedAssertions > 0) {
    process.exit(1);
  }
}

runHardeningTests().catch((err) => {
  console.error('Fatal error running hardening tests:', err);
  process.exit(1);
});
