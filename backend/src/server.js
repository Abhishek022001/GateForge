import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEED_QUESTIONS } from './data/seedQuestions.js';
import { OFFICIAL_PYQS } from './data/officialQuestions.js';
import {
  GATE_CS_SUBJECTS,
  QUESTION_TYPES,
  DIFFICULTY_LEVELS,
  SOURCE_TYPES,
  REASONING_TYPES,
} from './constants/taxonomy.js';
import { validateAndNormalizeQuestion } from './validators/questionValidator.js';
import { importService } from './services/import.service.js';
import { aiService } from './services/ai/ai.service.js';
import { questionAnalysisService } from './services/ai/questionAnalysis.service.js';
import { patternAggregationService } from './services/ai/patternAggregation.service.js';
import { questionGenerationService } from './services/ai/questionGeneration.service.js';
import { questionSimilarityService } from './services/ai/questionSimilarity.service.js';
import { sourceRegistry } from './services/gateSources/sourceRegistry.js';
import { pyqExtractionService } from './services/pyqExtraction/pyqExtraction.service.js';
import { pyqValidationService } from './services/pyqExtraction/pyqValidation.service.js';
import { officialPyqImportService } from './services/pyqExtraction/officialPyqImport.service.js';
import { pyqEnrichmentService } from './services/pyqExtraction/pyqEnrichment.service.js';
import { practiceSessionService } from './services/ai/practiceSession.service.js';
import { analyticsService } from './services/analytics.service.js';
import { connectToDatabase } from './config/db.js';
import { AIError } from './services/ai/ai.interface.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Clean In-Memory Database Store with full MCQ, MSQ, NAT, Provenance, Concepts, Pagination & AI Analysis
class QuestionDatabase {
  constructor() {
    this.questions = new Map();
    this.seedIfEmpty();
  }

  seedIfEmpty() {
    this.questions.clear();
    for (const q of SEED_QUESTIONS) {
      this.questions.set(q.id, {
        ...q,
        _id: `mem-${q.id}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    for (const q of OFFICIAL_PYQS) {
      this.questions.set(q.id, {
        ...q,
        _id: `mem-${q.id}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  findAll(filter = {}) {
    let list = Array.from(this.questions.values());

    if (filter.subject) {
      list = list.filter((q) => (q.subject || '').toLowerCase() === filter.subject.toLowerCase());
    }
    if (filter.topic) {
      list = list.filter((q) => (q.topic || '').toLowerCase().includes(filter.topic.toLowerCase()));
    }
    if (filter.subtopic) {
      list = list.filter((q) => (q.subtopic || '').toLowerCase().includes(filter.subtopic.toLowerCase()));
    }
    if (filter.year) {
      list = list.filter((q) => String(q.year) === String(filter.year) || String(q.source?.year) === String(filter.year));
    }
    if (filter.questionType) {
      list = list.filter((q) => (q.questionType || '').toLowerCase() === filter.questionType.toLowerCase());
    }
    if (filter.difficulty) {
      list = list.filter((q) => (q.difficulty || '').toLowerCase() === filter.difficulty.toLowerCase());
    }
    if (filter.sourceType) {
      list = list.filter((q) => (q.source?.type || 'MANUAL').toLowerCase() === filter.sourceType.toLowerCase());
    }
    if (filter.concept) {
      const term = filter.concept.toLowerCase();
      list = list.filter((q) => (q.concepts || []).some((c) => c.toLowerCase().includes(term)));
    }
    if (filter.reasoningType) {
      const rTerm = filter.reasoningType.toLowerCase();
      list = list.filter((q) => (q.reasoningType || []).some((r) => r.toLowerCase().includes(rTerm)));
    }
    if (filter.search) {
      const s = filter.search.toLowerCase();
      list = list.filter(
        (q) =>
          (q.question || '').toLowerCase().includes(s) ||
          (q.topic || '').toLowerCase().includes(s) ||
          (q.subject || '').toLowerCase().includes(s) ||
          (q.concepts || []).some((c) => c.toLowerCase().includes(s))
      );
    }
    if (filter.analyzed !== undefined) {
      const isAnalyzed = filter.analyzed === 'true' || filter.analyzed === true;
      list = list.filter((q) => Boolean(q.aiAnalysis?.analyzed) === isAnalyzed);
    }

    return list;
  }

  findPaginated(filter = {}, page = 1, limit = 20) {
    const allMatches = this.findAll(filter);
    const total = allMatches.length;
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(String(limit), 10) || 20));
    const totalPages = Math.ceil(total / limitNum) || 1;

    const startIndex = (pageNum - 1) * limitNum;
    const paginatedItems = allMatches.slice(startIndex, startIndex + limitNum);

    return {
      data: paginatedItems,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    };
  }

  findById(id) {
    const q = this.questions.get(id);
    return q ? { ...q } : null;
  }

  create(questionInput) {
    const id = questionInput.id || `gate-q-${Date.now()}`;
    const question = {
      ...questionInput,
      id,
      _id: `mem-${id}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.questions.set(id, question);
    return question;
  }

  update(id, partial) {
    const existing = this.questions.get(id);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...partial,
      updatedAt: new Date().toISOString(),
    };
    this.questions.set(id, updated);
    return updated;
  }

  count() {
    return this.questions.size;
  }
}

const db = new QuestionDatabase();

// CORS Headers Helper
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Security: Strict upper bound on request body size (default 2MB)
const MAX_BODY_SIZE_BYTES = parseInt(process.env.MAX_BODY_SIZE_BYTES || '2097152', 10) || 2097152;

// Security: In-Memory Sliding Window Rate Limiter for Expensive AI Endpoints
class SimpleRateLimiter {
  constructor(windowMs = 60000, maxRequests = 20) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.clients = new Map();
  }

  isRateLimited(clientId) {
    const now = Date.now();
    const clientRecord = this.clients.get(clientId) || [];
    const recent = clientRecord.filter((t) => now - t < this.windowMs);

    if (recent.length >= this.maxRequests) {
      this.clients.set(clientId, recent);
      return true;
    }

    recent.push(now);
    this.clients.set(clientId, recent);
    return false;
  }
}

const aiRateLimiter = new SimpleRateLimiter(60000, 20);

// JSON Body Parser Helper with strict size bounds
function parseJsonBody(req, res = null, maxSizeBytes = MAX_BODY_SIZE_BYTES) {
  return new Promise((resolve, reject) => {
    const contentLengthHeader = req.headers['content-length'];
    if (contentLengthHeader) {
      const contentLength = parseInt(contentLengthHeader, 10);
      if (!isNaN(contentLength) && contentLength > maxSizeBytes) {
        const err = new Error(`Payload too large. Maximum allowed request body size is ${maxSizeBytes} bytes.`);
        err.statusCode = 413;
        err.status = 413;
        err.code = 'PAYLOAD_TOO_LARGE';
        if (res && !res.headersSent) {
          res.writeHead(413, { 'Content-Type': 'application/json', 'Connection': 'close' });
          res.end(
            JSON.stringify({
              success: false,
              error: err.message,
              code: 'PAYLOAD_TOO_LARGE',
            })
          );
        }
        reject(err);
        return;
      }
    }

    let body = '';
    let receivedBytes = 0;
    let aborted = false;

    req.on('data', (chunk) => {
      if (aborted) return;
      receivedBytes += chunk.length;
      if (receivedBytes > maxSizeBytes) {
        aborted = true;
        const err = new Error(`Payload too large. Maximum allowed request body size is ${maxSizeBytes} bytes.`);
        err.statusCode = 413;
        err.status = 413;
        err.code = 'PAYLOAD_TOO_LARGE';
        if (res && !res.headersSent) {
          res.writeHead(413, { 'Content-Type': 'application/json', 'Connection': 'close' });
          res.end(
            JSON.stringify({
              success: false,
              error: err.message,
              code: 'PAYLOAD_TOO_LARGE',
            })
          );
        }
        req.destroy();
        reject(err);
        return;
      }
      body += chunk.toString();
    });

    req.on('end', () => {
      if (aborted) return;
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        const parseErr = new Error('Invalid JSON format.');
        parseErr.statusCode = 400;
        parseErr.status = 400;
        parseErr.code = 'INVALID_JSON';
        reject(parseErr);
      }
    });

    req.on('error', (err) => {
      if (!aborted) reject(err);
    });
  });
}

// HTTP Server Handler
const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Request Body Size Guard: Fast-reject oversized Content-Length before routing
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (!isNaN(contentLength) && contentLength > MAX_BODY_SIZE_BYTES) {
    res.writeHead(413, { 'Content-Type': 'application/json', 'Connection': 'close' });
    res.end(
      JSON.stringify({
        success: false,
        error: `Payload too large. Maximum allowed request body size is ${MAX_BODY_SIZE_BYTES} bytes.`,
        code: 'PAYLOAD_TOO_LARGE',
      })
    );
    return;
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;
  console.log(`[API] ${req.method} ${pathname}`);

  // Health Endpoint
  if (req.method === 'GET' && pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'healthy',
        application: 'GATEForge Backend API',
        phase: '3B - AI Question Intelligence & Pattern Analysis',
        database: 'Clean Database Abstraction Layer (Active)',
        questionCount: db.count(),
        aiConfigured: aiService.isConfigured(),
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  // GET /api/ai/health - AI Provider Health & Capability Status
  if (req.method === 'GET' && pathname === '/api/ai/health') {
    try {
      const health = await aiService.getHealth();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          data: health,
        })
      );
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: 'Failed to retrieve AI health status.',
          code: 'AI_HEALTH_ERROR',
        })
      );
    }
    return;
  }

  // POST /api/ai/test - Development-Only AI Connection Test
  if (req.method === 'POST' && pathname === '/api/ai/test') {
    // Security Guard: Restrict test endpoint in production environments
    if (process.env.NODE_ENV === 'production') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: 'The /api/ai/test endpoint is disabled in production mode.',
          code: 'ENDPOINT_DISABLED_IN_PRODUCTION',
        })
      );
      return;
    }

    if (!aiService.isConfigured()) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: 'AI provider is not configured. Please set GEMINI_API_KEY in backend/.env',
          code: 'AI_NOT_CONFIGURED',
        })
      );
      return;
    }

    try {
      const body = await parseJsonBody(req, res);
      let prompt = typeof body?.prompt === 'string' && body.prompt.trim()
        ? body.prompt.trim()
        : 'Respond with the word OK.';

      // Limit prompt length to prevent unbounded misuse
      if (prompt.length > 500) {
        prompt = prompt.slice(0, 500);
      }

      const result = await aiService.testConnection(prompt);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          message: 'AI Provider communication test successful.',
          data: result,
        })
      );
    } catch (err) {
      if (res.headersSent) return;
      const status = err.statusCode || err.status || (err instanceof AIError ? err.status : 500);
      const code = err.code || (err instanceof AIError ? err.code : 'AI_TEST_FAILED');

      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: err.message || 'AI test request failed.',
          code,
        })
      );
    }
    return;
  }

  // POST /api/ai/generation/test - Task 3C.1 Question Generation Pipeline Test
  if (req.method === 'POST' && pathname === '/api/ai/generation/test') {
    if (process.env.NODE_ENV === 'production') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: 'The /api/ai/generation/test endpoint is disabled in production mode.',
          code: 'ENDPOINT_DISABLED_IN_PRODUCTION',
        })
      );
      return;
    }

    if (!aiService.isConfigured()) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: 'AI provider is not configured. Please set GEMINI_API_KEY in backend/.env',
          code: 'AI_NOT_CONFIGURED',
        })
      );
      return;
    }

    try {
      const body = await parseJsonBody(req, res);
      let input;

      if (body.subject || body.topic || body.questionType || body.concepts) {
        input = body;
      } else if (typeof body?.prompt === 'string' && body.prompt.trim()) {
        input = body.prompt.trim().slice(0, 500);
      } else {
        input = 'Return a JSON object containing {"status":"ok"}.';
      }

      const result = await questionGenerationService.testGeneration(input);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          message: 'AI Question Generation test pipeline successful.',
          data: result,
        })
      );
    } catch (err) {
      if (res.headersSent) return;
      const status = err.statusCode || err.status || (err instanceof AIError ? err.status : 500);
      const code = err.code || (err instanceof AIError ? err.code : 'GENERATION_TEST_FAILED');

      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: err.message || 'Generation test request failed.',
          code,
        })
      );
    }
    return;
  }

  // POST /api/ai/generate-question - Checkpoint 3C.3 Question Generation with Official PYQ Context
  if (req.method === 'POST' && pathname === '/api/ai/generate-question') {
    if (!aiService.isConfigured()) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: 'AI provider is not configured. Please set GEMINI_API_KEY in backend/.env',
          code: 'AI_NOT_CONFIGURED',
        })
      );
      return;
    }

    const clientIp = (req.headers['x-test-client-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').toString();
    if (aiRateLimiter.isRateLimited(clientIp)) {
      res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '60' });
      res.end(
        JSON.stringify({
          success: false,
          error: 'Rate limit exceeded: Maximum 20 AI question generations per minute. Please try again shortly.',
          code: 'RATE_LIMIT_EXCEEDED',
        })
      );
      return;
    }

    try {
      const body = await parseJsonBody(req, res);
      const result = await questionGenerationService.generateQuestionWithContext(body, db);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: result.success,
          status: result.status,
          attemptCount: result.attemptCount,
          attemptStatuses: result.attemptStatuses,
          lastFailureReason: result.lastFailureReason,
          question: result.question,
          generationContext: result.generationContext,
          validation: result.validation,
        })
      );
    } catch (err) {
      if (res.headersSent) return;
      const status = err.statusCode || err.status || (err instanceof AIError ? err.status : 500);
      const code = err.code || (err instanceof AIError ? err.code : 'GENERATION_FAILED');

      const respHeaders = { 'Content-Type': 'application/json' };
      if (status === 429) {
        const retryVal = err.retryAfter ?? (code === 'AI_RATE_LIMITED' ? 60 : undefined);
        if (retryVal !== undefined) {
          respHeaders['Retry-After'] = String(retryVal);
        }
      }
      res.writeHead(status, respHeaders);
      res.end(
        JSON.stringify({
          success: false,
          error: (code === 'AI_QUOTA_EXCEEDED')
            ? 'The AI provider quota has been exhausted. Generation will become available again when the provider quota resets.'
            : (err.message || 'Question generation failed.'),
          code,
          validation: err.validation || undefined,
        })
      );
    }
    return;
  }

  // POST /api/ai/practice/session/:sessionId/submit - Checkpoint 4B Multi-Question Session Submission
  const practiceSessionSubmitMatch = pathname.match(/^\/api\/ai\/practice\/session\/([^/]+)\/submit$/);
  if (req.method === 'POST' && practiceSessionSubmitMatch) {
    const sessionId = decodeURIComponent(practiceSessionSubmitMatch[1]);

    try {
      const body = await parseJsonBody(req, res);
      const submissionResult = practiceSessionService.submitMultiQuestionSession(
        sessionId,
        body.answers || {}
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          sessionId,
          data: submissionResult,
        })
      );
    } catch (err) {
      if (res.headersSent) return;
      const status = err.statusCode || err.status || (err instanceof AIError ? err.status : 400);
      const code = err.code || (err instanceof AIError ? err.code : 'SUBMISSION_FAILED');

      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: err.message || 'Session submission failed.',
          code,
        })
      );
    }
    return;
  }

  // POST /api/ai/practice/session - Checkpoint 4B Multi-Question Session Generation (Controlled Concurrency & Anti-Leak)
  if (req.method === 'POST' && pathname === '/api/ai/practice/session') {
    if (!aiService.isConfigured()) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: 'AI provider is not configured. Please set GEMINI_API_KEY in backend/.env',
          code: 'AI_NOT_CONFIGURED',
        })
      );
      return;
    }

    const clientIp = (req.headers['x-test-client-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').toString();
    if (aiRateLimiter.isRateLimited(clientIp)) {
      res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '60' });
      res.end(
        JSON.stringify({
          success: false,
          error: 'Rate limit exceeded: Maximum 20 AI practice sessions per minute. Please try again shortly.',
          code: 'RATE_LIMIT_EXCEEDED',
        })
      );
      return;
    }

    try {
      const body = await parseJsonBody(req, res);

      // 1. Validate questionCount (API Cost Protection: only 3 or 5 allowed)
      let questionCount = body.questionCount;
      if (questionCount === undefined || questionCount === null) {
        questionCount = 3;
      }
      if (
        typeof questionCount !== 'number' ||
        !Number.isInteger(questionCount) ||
        (questionCount !== 3 && questionCount !== 5)
      ) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: false,
            error: 'Field "questionCount" must be 3 or 5.',
            code: 'INVALID_QUESTION_COUNT',
          })
        );
        return;
      }

      // 2. Validate Subject
      if (!body.subject || typeof body.subject !== 'string' || !body.subject.trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: false,
            error: 'Field "subject" is required and must be a non-empty string.',
            code: 'MISSING_REQUIRED_FIELD',
          })
        );
        return;
      }

      const subject = body.subject.trim();
      const topic = body.topic && typeof body.topic === 'string' && body.topic.trim() ? body.topic.trim() : undefined;
      const difficulty = body.difficulty && ['Easy', 'Medium', 'Hard'].includes(body.difficulty)
        ? body.difficulty
        : 'Medium';

      const rawType = (body.questionType || 'Mixed').trim().toUpperCase();
      const validTypes = new Set(['MCQ', 'MSQ', 'NAT', 'MIXED']);
      if (!validTypes.has(rawType)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: false,
            error: 'Field "questionType" must be one of: "MCQ", "MSQ", "NAT", "Mixed".',
            code: 'INVALID_QUESTION_TYPE',
          })
        );
        return;
      }

      // 3. Determine target question types for this session
      let targetTypes = [];
      if (rawType === 'MCQ') {
        targetTypes = Array(questionCount).fill('MCQ');
      } else if (rawType === 'MSQ') {
        targetTypes = Array(questionCount).fill('MSQ');
      } else if (rawType === 'NAT') {
        targetTypes = Array(questionCount).fill('NAT');
      } else {
        // Mixed distribution:
        // 3 questions: 1 MCQ, 1 MSQ, 1 NAT
        // 5 questions: 2 MCQ, 2 MSQ, 1 NAT
        if (questionCount === 3) {
          targetTypes = ['MCQ', 'MSQ', 'NAT'];
        } else {
          targetTypes = ['MCQ', 'MSQ', 'NAT', 'MCQ', 'MSQ'];
        }
      }

      // 4. Controlled Concurrency Generation (Max 2 concurrent requests) with Same-Session Duplicate Prevention
      const acceptedQuestions = [];
      let generationError = null;
      const concurrency = 2;
      let nextIndex = 0;

      async function worker(workerId) {
        console.log(`[Worker ${workerId}] Started`);
        while (nextIndex < targetTypes.length && !generationError) {
          const idx = nextIndex++;
          const targetType = targetTypes[idx];
          console.log(`[Worker ${workerId}] Picking up idx=${idx}, targetType=${targetType}`);

          try {
            const genPayload = {
              subject,
              topic: topic && topic !== 'Any' && topic !== 'Any Topic' ? topic : undefined,
              difficulty,
              questionType: targetType,
              additionalReferenceQuestions: [...acceptedQuestions],
            };

            const result = await questionGenerationService.generateQuestionWithContext(genPayload, db);
            console.log(`[Worker ${workerId}] generateQuestionWithContext returned status=${result?.status}`);

            if (result.status === 'VERIFIED' && result.question) {
              // Double check similarity against any questions accepted by concurrent worker
              const sim = questionSimilarityService.checkSimilarity(result.question, acceptedQuestions);
              if (!sim.passed) {
                console.log(`[Practice Session] In-session duplicate detected (${sim.maxSimilarity} >= ${sim.threshold}). Triggering regeneration.`);
                const retryPayload = {
                  ...genPayload,
                  additionalReferenceQuestions: [...acceptedQuestions],
                };
                const retryResult = await questionGenerationService.generateQuestionWithContext(retryPayload, db);
                if (retryResult.status === 'VERIFIED' && retryResult.question) {
                  acceptedQuestions.push(retryResult.question);
                  console.log(`[Worker ${workerId}] Retry accepted. Total accepted=${acceptedQuestions.length}`);
                } else {
                  generationError = new AIError(
                    `Failed to generate unique verified question for type ${targetType}.`,
                    'SESSION_GENERATION_FAILED',
                    422
                  );
                  return;
                }
              } else {
                acceptedQuestions.push(result.question);
                console.log(`[Worker ${workerId}] Question accepted. Total accepted=${acceptedQuestions.length}`);
              }
            } else {
              const code = result.status === 'GENERATION_ATTEMPTS_EXHAUSTED'
                ? 'GENERATION_ATTEMPTS_EXHAUSTED'
                : 'SESSION_GENERATION_FAILED';
              const message = result.status === 'GENERATION_ATTEMPTS_EXHAUSTED'
                ? "We couldn't generate a question that passed all quality checks. Try again."
                : `Failed to generate verified question for type ${targetType}. Status: ${result.status}`;
              generationError = new AIError(message, code, 422);
              return;
            }
          } catch (err) {
            console.error(`[Worker ${workerId}] Threw error:`, err);
            generationError = err;
            return;
          }
        }
        console.log(`[Worker ${workerId}] Exiting loop. nextIndex=${nextIndex}, generationError=${Boolean(generationError)}`);
      }

      const workers = [];
      const numWorkers = Math.min(concurrency, targetTypes.length);
      for (let w = 0; w < numWorkers; w++) {
        workers.push(worker(w));
      }
      await Promise.all(workers);

      if (generationError || acceptedQuestions.length !== targetTypes.length) {
        let errCode = 'SESSION_GENERATION_FAILED';
        let errMsg = "We couldn't generate a complete reliable set. Try again.";
        let errStatus = 422;

        if (generationError) {
          if (generationError.code === 'AI_QUOTA_EXCEEDED') {
            errCode = 'AI_QUOTA_EXCEEDED';
            errMsg = 'The AI provider quota has been exhausted. Generation will become available again when the provider quota resets.';
            errStatus = 429;
          } else if (generationError.code === 'AI_RATE_LIMIT' || generationError.code === 'AI_RATE_LIMITED') {
            errCode = 'AI_RATE_LIMITED';
            errMsg = 'AI generation is temporarily rate-limited. Please wait a moment and try again.';
            errStatus = 429;
          } else if (generationError.code === 'AI_NOT_CONFIGURED' || generationError.code === 'AI_SERVICE_UNAVAILABLE') {
            errCode = generationError.code;
            errMsg = 'The AI service is temporarily unavailable. Your Question Bank and normal Practice are still available.';
            errStatus = 503;
          } else if (generationError.code === 'NO_GENERATION_CONTEXT') {
            errCode = 'NO_GENERATION_CONTEXT';
            errMsg = 'Not enough analyzed GATE questions are available for this selection yet.';
            errStatus = 422;
          } else if (generationError.code === 'GENERATION_ATTEMPTS_EXHAUSTED') {
            errCode = 'GENERATION_ATTEMPTS_EXHAUSTED';
            errMsg = "We couldn't generate a question that passed all quality checks. Try again.";
            errStatus = 422;
          }
        }

        console.log(`[AI Practice Session] Session generation notice: code=${errCode}, status=${errStatus}`);
        const sessionHeaders = { 'Content-Type': 'application/json' };
        if (errStatus === 429) {
          const retryVal = generationError?.retryAfter ?? (errCode === 'AI_RATE_LIMITED' ? 60 : undefined);
          if (retryVal !== undefined) {
            sessionHeaders['Retry-After'] = String(retryVal);
          }
        }
        res.writeHead(errStatus, sessionHeaders);
        res.end(
          JSON.stringify({
            success: false,
            error: errMsg,
            code: errCode,
          })
        );
        return;
      }

      // 5. Create Ephemeral Multi-Question Session
      const sessionResult = practiceSessionService.createMultiQuestionSession(
        {
          subject,
          topic,
          difficulty,
          questionType: rawType,
          questionCount: targetTypes.length,
        },
        acceptedQuestions
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          sessionId: sessionResult.sessionId,
          questions: sessionResult.questions,
        })
      );
    } catch (err) {
      if (res.headersSent) return;
      const status = err.statusCode || err.status || (err instanceof AIError ? err.status : 500);
      const safeStatus = (status === 502) ? 422 : status;
      const code = err.code || (err instanceof AIError ? err.code : 'SESSION_GENERATION_FAILED');

      const catchHeaders = { 'Content-Type': 'application/json' };
      if (safeStatus === 429) {
        const retryVal = err.retryAfter ?? (code === 'AI_RATE_LIMITED' ? 60 : undefined);
        if (retryVal !== undefined) {
          catchHeaders['Retry-After'] = String(retryVal);
        }
      }
      res.writeHead(safeStatus, catchHeaders);
      res.end(
        JSON.stringify({
          success: false,
          error: (code === 'AI_QUOTA_EXCEEDED')
            ? 'The AI provider quota has been exhausted. Generation will become available again when the provider quota resets.'
            : (err.message || 'Practice session generation failed.'),
          code,
        })
      );
    }
    return;
  }

  // POST /api/ai/practice/generate - Checkpoint 4A Safe Practice Question Generation (No Answer Leakage)
  if (req.method === 'POST' && pathname === '/api/ai/practice/generate') {
    if (!aiService.isConfigured()) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: 'AI provider is not configured. Please set GEMINI_API_KEY in backend/.env',
          code: 'AI_NOT_CONFIGURED',
        })
      );
      return;
    }

    try {
      const body = await parseJsonBody(req, res);
      const result = await questionGenerationService.generateQuestionWithContext(body, db);

      if (result.status === 'VERIFIED' && result.question) {
        const sessionQuestionId = practiceSessionService.createSession(result.question);
        const sanitizedQuestion = practiceSessionService.getSanitizedQuestion(result.question, sessionQuestionId);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: true,
            status: 'VERIFIED',
            sessionQuestionId,
            question: sanitizedQuestion,
            generationContext: result.generationContext,
            attemptCount: result.attemptCount,
            attemptStatuses: result.attemptStatuses,
          })
        );
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: false,
            status: result.status,
            attemptCount: result.attemptCount,
            attemptStatuses: result.attemptStatuses,
            lastFailureReason: result.lastFailureReason,
            generationContext: result.generationContext,
          })
        );
      }
    } catch (err) {
      if (res.headersSent) return;
      const status = err.statusCode || err.status || (err instanceof AIError ? err.status : 500);
      const code = err.code || (err instanceof AIError ? err.code : 'PRACTICE_GENERATION_FAILED');

      const genHeaders = { 'Content-Type': 'application/json' };
      if (status === 429) {
        const retryVal = err.retryAfter ?? (code === 'AI_RATE_LIMITED' ? 60 : undefined);
        if (retryVal !== undefined) {
          genHeaders['Retry-After'] = String(retryVal);
        }
      }
      res.writeHead(status, genHeaders);
      res.end(
        JSON.stringify({
          success: false,
          error: (code === 'AI_QUOTA_EXCEEDED')
            ? 'The AI provider quota has been exhausted. Generation will become available again when the provider quota resets.'
            : (err.message || 'Practice question generation failed.'),
          code,
        })
      );
    }
    return;
  }

  // POST /api/ai/practice/:sessionQuestionId/answer - Checkpoint 4A Safe Answer Submission & Evaluation
  const practiceAnswerMatch = pathname.match(/^\/api\/ai\/practice\/([^/]+)\/answer$/);
  if (req.method === 'POST' && practiceAnswerMatch) {
    const sessionQuestionId = decodeURIComponent(practiceAnswerMatch[1]);

    try {
      const body = await parseJsonBody(req, res);
      const evaluation = practiceSessionService.evaluateAnswer(sessionQuestionId, body.answer);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          sessionQuestionId,
          data: evaluation,
        })
      );
    } catch (err) {
      if (res.headersSent) return;
      const status = err.statusCode || err.status || (err instanceof AIError ? err.status : 400);
      const code = err.code || (err instanceof AIError ? err.code : 'ANSWER_EVALUATION_FAILED');

      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: err.message || 'Answer evaluation failed.',
          code,
        })
      );
    }
    return;
  }

  // POST /api/pyq/extract/:sourceId - Temporary Development Endpoint for Official GATE PYQ Extraction
  const pyqExtractMatch = pathname.match(/^\/api\/pyq\/extract\/([^/]+)$/);
  if (req.method === 'POST' && pyqExtractMatch) {
    if (process.env.NODE_ENV === 'production') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: 'The /api/pyq/extract/:sourceId endpoint is disabled in production mode.',
          code: 'ENDPOINT_DISABLED_IN_PRODUCTION',
        })
      );
      return;
    }

    const sourceId = decodeURIComponent(pyqExtractMatch[1]);
    const sourceRecord = sourceRegistry.getSourceById(sourceId);

    if (!sourceRecord) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: `Source '${sourceId}' is not registered in the official GATE source registry.`,
          code: 'SOURCE_NOT_FOUND',
        })
      );
      return;
    }

    try {
      const body = await parseJsonBody(req, res);
      const forceDownload = body?.forceDownload === true;
      const useFallback = body?.useFallback === true;

      const result = await pyqExtractionService.extractFromSource(sourceId, {
        forceDownload,
        useFallback,
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          message: `Successfully extracted ${result.totalCandidates} question candidates from official GATE source '${sourceId}'.`,
          data: result,
        })
      );
    } catch (err) {
      if (res.headersSent) return;
      const status = err.statusCode || err.status || 500;
      const code = err.code || 'EXTRACTION_FAILED';
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: err.message || 'PYQ extraction failed.',
          code,
        })
      );
    }
    return;
  }

  // POST /api/pyq/validate/:sourceId - Development Endpoint for Official GATE PYQ Validation & Key Mapping
  const pyqValidateMatch = pathname.match(/^\/api\/pyq\/validate\/([^/]+)$/);
  if (req.method === 'POST' && pyqValidateMatch) {
    if (process.env.NODE_ENV === 'production') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: 'The /api/pyq/validate/:sourceId endpoint is disabled in production mode.',
          code: 'ENDPOINT_DISABLED_IN_PRODUCTION',
        })
      );
      return;
    }

    const sourceId = decodeURIComponent(pyqValidateMatch[1]);
    const sourceRecord = sourceRegistry.getSourceById(sourceId);

    if (!sourceRecord) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: `Source '${sourceId}' is not registered in the official GATE source registry.`,
          code: 'SOURCE_NOT_FOUND',
        })
      );
      return;
    }

    try {
      const body = await parseJsonBody(req, res);
      const customKeySourceId = body?.answerKeySourceId || urlObj.searchParams.get('answerKeySourceId') || undefined;
      const forceDownload = body?.forceDownload === true;

      const result = await pyqValidationService.validatePaper(sourceId, customKeySourceId, {
        forceDownload,
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          message: `Successfully validated ${result.total} candidate questions against official answer key.`,
          data: result,
        })
      );
    } catch (err) {
      if (res.headersSent) return;
      const status = err.statusCode || err.status || (err.message && err.message.includes('not registered') ? 404 : 400);
      const code = err.code || 'VALIDATION_FAILED';
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: err.message || 'PYQ validation failed.',
          code,
        })
      );
    }
    return;
  }

  // POST /api/pyq/import/:sourceId - Development/Admin Endpoint to Import Valid Official GATE PYQs
  const pyqImportMatch = pathname.match(/^\/api\/pyq\/import\/([^/]+)$/);
  if (req.method === 'POST' && pyqImportMatch) {
    if (process.env.NODE_ENV === 'production') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: 'The /api/pyq/import/:sourceId endpoint is disabled in production mode.',
          code: 'ENDPOINT_DISABLED_IN_PRODUCTION',
        })
      );
      return;
    }

    const sourceId = decodeURIComponent(pyqImportMatch[1]);
    const sourceRecord = sourceRegistry.getSourceById(sourceId);

    if (!sourceRecord) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: `Source '${sourceId}' is not registered in the official GATE source registry.`,
          code: 'SOURCE_NOT_FOUND',
        })
      );
      return;
    }

    try {
      const body = await parseJsonBody(req, res);
      const customKeySourceId = body?.answerKeySourceId || urlObj.searchParams.get('answerKeySourceId') || undefined;
      const forceDownload = body?.forceDownload === true;

      const report = await officialPyqImportService.importOfficialPyqs(sourceId, db, {
        customKeySourceId,
        forceDownload,
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          message: `PYQ import complete. Total: ${report.totalCandidates}, Valid: ${report.validCandidates}, Imported: ${report.imported}, Duplicates: ${report.duplicates}, Needs Review: ${report.needsReview}.`,
          data: report,
        })
      );
    } catch (err) {
      if (res.headersSent) return;
      const status = err.statusCode || err.status || (err.message && err.message.includes('not registered') ? 404 : 400);
      const code = err.code || 'IMPORT_FAILED';
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: err.message || 'PYQ import failed.',
          code,
        })
      );
    }
    return;
  }

  // POST /api/pyq/analyze/:sourceId - Development/Admin Endpoint to Enrich Imported Official PYQs via Phase 3B AI
  const pyqAnalyzeMatch = pathname.match(/^\/api\/pyq\/analyze\/([^/]+)$/);
  if (req.method === 'POST' && pyqAnalyzeMatch) {
    if (process.env.NODE_ENV === 'production') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: 'The /api/pyq/analyze/:sourceId endpoint is disabled in production mode.',
          code: 'ENDPOINT_DISABLED_IN_PRODUCTION',
        })
      );
      return;
    }

    if (!aiService.isConfigured()) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: 'AI provider is not configured. Please configure GEMINI_API_KEY in backend/.env.',
          code: 'AI_NOT_CONFIGURED',
        })
      );
      return;
    }

    const sourceId = decodeURIComponent(pyqAnalyzeMatch[1]);
    const sourceRecord = sourceRegistry.getSourceById(sourceId);

    if (!sourceRecord) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: `Source '${sourceId}' is not registered in the official GATE source registry.`,
          code: 'SOURCE_NOT_FOUND',
        })
      );
      return;
    }

    try {
      const body = await parseJsonBody(req, res);
      const force = body?.force === true || urlObj.searchParams.get('force') === 'true';
      const concurrency = typeof body?.concurrency === 'number'
        ? body.concurrency
        : parseInt(urlObj.searchParams.get('concurrency') || '2', 10);
      const limit = typeof body?.limit === 'number'
        ? body.limit
        : urlObj.searchParams.has('limit') ? parseInt(urlObj.searchParams.get('limit') || '0', 10) : undefined;

      const report = await pyqEnrichmentService.enrichOfficialPyqs(sourceId, db, {
        force,
        concurrency,
        limit,
      });
      pyqEnrichmentService.invalidateContextCache();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          message: `PYQ enrichment complete. Total: ${report.total}, Analyzed: ${report.analyzed}, Skipped: ${report.skipped}, Failed: ${report.failed}.`,
          data: report,
        })
      );
    } catch (err) {
      if (res.headersSent) return;
      const status = err.statusCode || err.status || (err.message && err.message.includes('not registered') ? 404 : 500);
      const code = err.code || 'ENRICHMENT_FAILED';
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: err.message || 'PYQ enrichment failed.',
          code,
        })
      );
    }
    return;
  }

  // POST /api/ai/analyze-question/:id - Analyze Single Question
  const analyzeSingleMatch = pathname.match(/^\/api\/ai\/analyze-question\/([^/]+)$/);
  if (req.method === 'POST' && analyzeSingleMatch) {
    const questionId = decodeURIComponent(analyzeSingleMatch[1]);
    const force = urlObj.searchParams.get('force') === 'true';

    if (!aiService.isConfigured()) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: 'AI provider is not configured. Please configure GEMINI_API_KEY in backend/.env.',
          code: 'AI_NOT_CONFIGURED',
        })
      );
      return;
    }

    const question = db.findById(questionId);
    if (!question) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: `Question with ID '${questionId}' not found.`,
          code: 'QUESTION_NOT_FOUND',
        })
      );
      return;
    }

    try {
      const body = await parseJsonBody(req, res);
      const isForced = force || Boolean(body?.force);
      const result = await questionAnalysisService.analyzeQuestion(question, db, { force: isForced });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          message: result.cached ? 'Retrieved cached AI analysis.' : 'AI question analysis completed successfully.',
          data: result,
        })
      );
    } catch (err) {
      if (res.headersSent) return;
      const status = err.statusCode || err.status || (err instanceof AIError ? err.status : 500);
      const code = err.code || (err instanceof AIError ? err.code : 'ANALYSIS_FAILED');

      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: err.message || 'Question analysis failed.',
          code,
        })
      );
    }
    return;
  }

  // POST /api/ai/analyze-questions - Bulk Question Analysis
  if (req.method === 'POST' && pathname === '/api/ai/analyze-questions') {
    if (!aiService.isConfigured()) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: 'AI provider is not configured. Please configure GEMINI_API_KEY in backend/.env.',
          code: 'AI_NOT_CONFIGURED',
        })
      );
      return;
    }

    try {
      const body = await parseJsonBody(req, res);
      const questionIds = Array.isArray(body?.questionIds) ? body.questionIds : null;

      if (!questionIds || questionIds.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: false,
            error: 'Request body must contain a non-empty "questionIds" array.',
            code: 'INVALID_REQUEST_BODY',
          })
        );
        return;
      }

      const force = Boolean(body?.force);
      const concurrency = typeof body?.concurrency === 'number' ? body.concurrency : 2;

      const result = await questionAnalysisService.analyzeBulk(questionIds, db, { force, concurrency });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          message: `Bulk analysis completed. Analyzed: ${result.analyzed}, Skipped (cached): ${result.skipped}, Failed: ${result.failed}.`,
          data: result,
        })
      );
    } catch (err) {
      if (res.headersSent) return;
      const status = err.statusCode || err.status || (err instanceof AIError ? err.status : 500);
      const code = err.code || (err instanceof AIError ? err.code : 'BULK_ANALYSIS_FAILED');

      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: err.message || 'Bulk question analysis failed.',
          code,
        })
      );
    }
    return;
  }

  // GET /api/ai/patterns - Aggregate Question Pattern Analytics
  if (req.method === 'GET' && pathname === '/api/ai/patterns') {
    try {
      const allQuestions = db.findAll();
      const excludeGA = urlObj.searchParams.get('excludeGA') === 'true';
      const summary = patternAggregationService.aggregatePatterns(allQuestions, { excludeGA });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          data: summary,
        })
      );
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: 'Failed to aggregate question patterns.',
          code: 'PATTERN_AGGREGATION_ERROR',
        })
      );
    }
    return;
  }

  // GET /api/stats (Real-Time Dynamic System Statistics & Privacy-Preserving Analytics)
  if (req.method === 'GET' && pathname === '/api/stats') {
    const analytics = await analyticsService.recordVisit(req);
    const all = db.findAll();
    const officialCount = all.filter(
      (q) =>
        q.source?.type === 'OFFICIAL_PYQ' ||
        q.source?.type === 'PYQ' ||
        q.source?.provider === 'OFFICIAL_GATE' ||
        q.sourceType === 'OFFICIAL_PYQ' ||
        Boolean(q.provenance)
    ).length;
    const analyzedCount = all.filter((q) => q.aiAnalysis?.analyzed === true).length;
    const subjects = new Set(all.map((q) => q.subject).filter(Boolean));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: true,
        data: {
          totalQuestions: all.length,
          officialPyqs: officialCount,
          analyzedQuestions: analyzedCount,
          subjectsCovered: subjects.size || GATE_CS_SUBJECTS.length,
          practiceModes: 4, // Mixed, MCQ, MSQ, NAT
          uniqueVisitors: analytics.uniqueVisitors,
          peopleVisitedSoFar: analytics.peopleVisitedSoFar ?? analytics.uniqueVisitors,
          totalVisits: analytics.totalVisits,
        },
      })
    );
    return;
  }

  // GET /api/taxonomy (Centralized GATE CS Subjects & Metadata)
  if (req.method === 'GET' && pathname === '/api/taxonomy') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: true,
        data: {
          subjects: GATE_CS_SUBJECTS,
          questionTypes: QUESTION_TYPES,
          difficultyLevels: DIFFICULTY_LEVELS,
          sourceTypes: SOURCE_TYPES,
          reasoningTypes: REASONING_TYPES,
        },
      })
    );
    return;
  }

  // GET /api/taxonomy/topics (Subject-Specific Topics from Question Corpus)
  if (req.method === 'GET' && pathname === '/api/taxonomy/topics') {
    const rawSubject = (urlObj.searchParams.get('subject') || '').toLowerCase().trim();
    let questions;
    if (!rawSubject || rawSubject === 'any' || rawSubject === 'all') {
      questions = db.findAll();
    } else {
      questions = db.findAll().filter((q) => {
        const qSub = (q.subject || '').toLowerCase();
        return (
          qSub === rawSubject ||
          qSub.includes(rawSubject) ||
          rawSubject.includes(qSub) ||
          (rawSubject.includes('dbms') && qSub.includes('database')) ||
          (rawSubject.includes('database') && qSub.includes('dbms'))
        );
      });
    }
    const topics = Array.from(new Set(questions.map((q) => q.topic).filter(Boolean))).sort();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: true,
        data: topics,
      })
    );
    return;
  }

  // POST /api/questions/import (Bulk Question Import)
  if (req.method === 'POST' && pathname === '/api/questions/import') {
    try {
      const body = await parseJsonBody(req, res);
      const rawRecords = Array.isArray(body) ? body : Array.isArray(body.questions) ? body.questions : null;

      if (!rawRecords) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: false,
            error: 'Request body must be a JSON array of questions or an object with a "questions" array.',
            code: 'INVALID_REQUEST_BODY',
          })
        );
        return;
      }

      const summary = await importService.importQuestions(rawRecords, db);
      pyqEnrichmentService.invalidateContextCache();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          message: `Bulk import completed. Imported: ${summary.imported}, Duplicates: ${summary.duplicates}, Failed: ${summary.failed}.`,
          summary,
        })
      );
    } catch (err) {
      if (res.headersSent) return;
      const status = err.statusCode || err.status || 400;
      const code = err.code || 'IMPORT_FAILED';
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message, code }));
    }
    return;
  }

  // GET /api/questions (Filtered & Paginated)
  if (req.method === 'GET' && pathname === '/api/questions') {
    const filter = {
      subject: urlObj.searchParams.get('subject') || undefined,
      topic: urlObj.searchParams.get('topic') || undefined,
      subtopic: urlObj.searchParams.get('subtopic') || undefined,
      year: urlObj.searchParams.get('year') || undefined,
      questionType: urlObj.searchParams.get('questionType') || undefined,
      difficulty: urlObj.searchParams.get('difficulty') || undefined,
      sourceType: urlObj.searchParams.get('sourceType') || undefined,
      concept: urlObj.searchParams.get('concept') || undefined,
      reasoningType: urlObj.searchParams.get('reasoningType') || undefined,
      search: urlObj.searchParams.get('search') || undefined,
      analyzed: urlObj.searchParams.has('analyzed') ? urlObj.searchParams.get('analyzed') : undefined,
    };

    const isPaginated = urlObj.searchParams.has('page') || urlObj.searchParams.has('limit');
    const page = urlObj.searchParams.get('page') || 1;
    const limit = urlObj.searchParams.get('limit') || 20;

    if (isPaginated) {
      const result = db.findPaginated(filter, page, limit);
      const safeData = result.data.map(({ correctAnswer, explanation, ...safeQ }) => ({
        ...safeQ,
        ...(urlObj.searchParams.get('includeAnswer') === 'true' ? { correctAnswer, explanation } : {}),
      }));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          data: safeData,
          pagination: result.pagination,
        })
      );
    } else {
      const allFiltered = db.findAll(filter);
      const safeData = allFiltered.map(({ correctAnswer, explanation, ...safeQ }) => ({
        ...safeQ,
        ...(urlObj.searchParams.get('includeAnswer') === 'true' ? { correctAnswer, explanation } : {}),
      }));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          count: safeData.length,
          data: safeData,
        })
      );
    }
    return;
  }

  // POST /api/questions/seed
  if (req.method === 'POST' && (pathname === '/api/questions/seed' || pathname === '/api/seed')) {
    db.seedIfEmpty();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: true,
        message: 'Questions seeded successfully',
        count: db.count(),
      })
    );
    return;
  }

  // POST /api/questions/:id/answer (Interactive Evaluation)
  const answerMatch = pathname.match(/^\/api\/questions\/([^/]+)\/answer$/);
  if (req.method === 'POST' && answerMatch) {
    const questionId = decodeURIComponent(answerMatch[1]);
    try {
      const body = await parseJsonBody(req, res);
      const userAnswer = body.answer;

      if (userAnswer === undefined || userAnswer === null || (typeof userAnswer === 'string' && userAnswer.trim() === '')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: false,
            error: 'Missing required "answer" field.',
          })
        );
        return;
      }

      const question = db.findById(questionId);
      if (!question) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: false,
            error: `Question with ID '${questionId}' not found.`,
          })
        );
        return;
      }

      const qType = question.questionType || 'MCQ';
      let isCorrect = false;

      if (qType === 'MCQ') {
        const normalizedUser = String(userAnswer).trim().toUpperCase();
        const normalizedCorrect = String(question.correctAnswer).trim().toUpperCase();

        isCorrect =
          normalizedUser === normalizedCorrect ||
          (question.options || []).some(
            (opt) =>
              opt.id.toUpperCase() === normalizedCorrect &&
              opt.text.trim().toLowerCase() === String(userAnswer).trim().toLowerCase()
          );
      } else if (qType === 'MSQ') {
        let userList = [];
        if (Array.isArray(userAnswer)) {
          userList = userAnswer.map((a) => String(a).trim().toUpperCase());
        } else if (typeof userAnswer === 'string') {
          userList = userAnswer.split(',').map((a) => a.trim().toUpperCase());
        }

        let correctList = [];
        if (Array.isArray(question.correctAnswer)) {
          correctList = question.correctAnswer.map((a) => String(a).trim().toUpperCase());
        } else if (typeof question.correctAnswer === 'string') {
          correctList = question.correctAnswer.split(',').map((a) => a.trim().toUpperCase());
        }

        const uniqueUser = Array.from(new Set(userList)).filter(Boolean).sort();
        const uniqueCorrect = Array.from(new Set(correctList)).filter(Boolean).sort();

        isCorrect =
          uniqueUser.length === uniqueCorrect.length &&
          uniqueUser.every((val, idx) => val === uniqueCorrect[idx]);
      } else if (qType === 'NAT') {
        const userNum = parseFloat(String(userAnswer).trim());
        const range = question.numericalAnswer && typeof question.numericalAnswer.min === 'number'
          ? question.numericalAnswer
          : question.numericalRange && typeof question.numericalRange.min === 'number'
          ? question.numericalRange
          : null;

        if (!isNaN(userNum) && range) {
          isCorrect = userNum >= (range.min - 1e-9) && userNum <= (range.max + 1e-9);
        } else {
          const correctNum = parseFloat(String(question.correctAnswer).trim());
          const tol = typeof question.numericalTolerance === 'number'
            ? question.numericalTolerance
            : typeof question.tolerance === 'number'
            ? question.tolerance
            : 0.01;

          if (!isNaN(userNum) && !isNaN(correctNum)) {
            isCorrect = Math.abs(userNum - correctNum) <= tol + 1e-9;
          } else {
            isCorrect = false;
          }
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          data: {
            questionId: question.id,
            questionType: qType,
            isCorrect,
            userAnswer,
            correctAnswer: question.correctAnswer ?? (question.numericalAnswer ? `${question.numericalAnswer.min} to ${question.numericalAnswer.max}` : null),
            explanation: question.explanation || 'Explanation not available yet.',
            tolerance: question.numericalTolerance || question.tolerance,
          },
        })
      );
    } catch (err) {
      if (res.headersSent) return;
      const status = err.statusCode || err.status || 400;
      const code = err.code || 'ANSWER_FAILED';
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message, code }));
    }
    return;
  }

  // GET /api/questions/:id
  const singleMatch = pathname.match(/^\/api\/questions\/([^/]+)$/);
  if (req.method === 'GET' && singleMatch) {
    const questionId = decodeURIComponent(singleMatch[1]);
    const question = db.findById(questionId);

    if (!question) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: `Question with ID '${questionId}' not found.`,
        })
      );
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: true,
        data: question,
      })
    );
    return;
  }

  // POST /api/questions (Create Single Question)
  if (req.method === 'POST' && pathname === '/api/questions') {
    try {
      const body = await parseJsonBody(req, res);
      const validation = validateAndNormalizeQuestion(body);

      if (!validation.isValid || !validation.normalized) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: false,
            errors: validation.errors,
          })
        );
        return;
      }

      const created = db.create(validation.normalized);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          message: 'Question created successfully',
          data: created,
        })
      );
    } catch (err) {
      if (res.headersSent) return;
      const status = err.statusCode || err.status || 400;
      const code = err.code || 'CREATE_FAILED';
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message, code }));
    }
    return;
  }

  // Static Frontend Serving (Unified Deployment & SPA Client Routing Fallback)
  const distCandidates = [
    path.resolve(__dirname, '../../frontend/dist'),
    path.resolve(__dirname, '../frontend/dist'),
    path.resolve(process.cwd(), 'frontend/dist'),
    path.resolve(process.cwd(), '../frontend/dist'),
    path.resolve(process.cwd(), 'dist'),
  ];
  const frontendDistDir = distCandidates.find((dir) => fs.existsSync(dir));

  if (req.method === 'GET' && !pathname.startsWith('/api')) {
    if (frontendDistDir) {
      const sanitized = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
      let filePath = path.join(frontendDistDir, sanitized);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'application/javascript; charset=utf-8',
          '.mjs': 'application/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.json': 'application/json; charset=utf-8',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.svg': 'image/svg+xml',
          '.ico': 'image/x-icon',
          '.woff': 'font/woff',
          '.woff2': 'font/woff2',
          '.ttf': 'font/ttf',
          '.txt': 'text/plain; charset=utf-8',
        };
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
        return;
      }

      // SPA Fallback for client routes like /practice, /ai-practice
      const indexFile = path.join(frontendDistDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(indexFile).pipe(res);
        return;
      }
    }
  }

  // Root Info (Standalone API Fallback)
  if (req.method === 'GET' && pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        name: 'GATEForge API',
        version: '3.1.0',
        phase: 'Phase 3B - AI Question Intelligence & Pattern Analysis',
        supportedTypes: ['MCQ', 'MSQ', 'NAT'],
        ai: {
          provider: aiService.getProviderName(),
          model: aiService.getModelName(),
          configured: aiService.isConfigured(),
        },
        endpoints: {
          health: 'GET /api/health',
          aiHealth: 'GET /api/ai/health',
          aiTest: 'POST /api/ai/test',
          aiGenerationTest: 'POST /api/ai/generation/test',
          aiGenerateQuestion: 'POST /api/ai/generate-question',
          pyqExtract: 'POST /api/pyq/extract/:sourceId',
          pyqValidate: 'POST /api/pyq/validate/:sourceId',
          pyqImport: 'POST /api/pyq/import/:sourceId',
          pyqAnalyze: 'POST /api/pyq/analyze/:sourceId',
          aiAnalyzeQuestion: 'POST /api/ai/analyze-question/:id?force=true',
          aiAnalyzeBulk: 'POST /api/ai/analyze-questions',
          aiPatterns: 'GET /api/ai/patterns',
          taxonomy: 'GET /api/taxonomy',
          questions: 'GET /api/questions?subject=...&topic=...&page=1&limit=20',
          questionById: 'GET /api/questions/:id',
          createQuestion: 'POST /api/questions',
          importBulk: 'POST /api/questions/import',
          evaluateAnswer: 'POST /api/questions/:id/answer',
        },
      })
    );
    return;
  }

  // 404 Handler
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      success: false,
      error: `Cannot ${req.method} ${pathname}`,
    })
  );
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  console.log(`🚀 GATEForge Server listening on http://localhost:${PORT}`);
  console.log(`🤖 AI Provider: ${aiService.getProviderName()} (model: ${aiService.getModelName()}, configured: ${aiService.isConfigured()})`);
  console.log(`📡 API Endpoints active at http://localhost:${PORT}/api/questions`);
  console.log(`🧠 AI Question Analysis at http://localhost:${PORT}/api/ai/analyze-question/:id`);
  console.log(`📊 AI Patterns Analytics at http://localhost:${PORT}/api/ai/patterns`);
  console.log(`⚡ AI Generation Test at http://localhost:${PORT}/api/ai/generation/test`);
  try {
    await connectToDatabase();
  } catch (_) {}
});
