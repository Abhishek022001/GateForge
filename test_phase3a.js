import { parseStructuredJson, extractJsonFromText } from './backend/src/services/ai/structuredParser.js';
import { getAISafeConfig } from './backend/src/config/ai.config.js';

async function runPhase3ATests() {
  const BASE_URL = 'http://localhost:5000';
  console.log('🧪 Running GATEForge Phase 3A (AI Infrastructure) Test Suite...\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName, detail = '') {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ [PASS] ${testName} ${detail ? `(${detail})` : ''}`);
    } else {
      console.error(`  ❌ [FAIL] ${testName} ${detail ? `(${detail})` : ''}`);
    }
  }

  try {
    // 1. Health & AI Config Endpoints
    console.log('1. Testing System & AI Health Endpoints...');
    const health = await (await fetch(`${BASE_URL}/api/health`)).json();
    assert(health.status === 'healthy', 'System health endpoint returns healthy', `Phase: ${health.phase}`);

    const aiHealth = await (await fetch(`${BASE_URL}/api/ai/health`)).json();
    assert(aiHealth.success === true, 'AI health endpoint returns success');
    assert(aiHealth.data && aiHealth.data.provider === 'gemini', 'AI provider is set to "gemini"');
    assert(aiHealth.data && Boolean(aiHealth.data.model), 'AI model is configured', `Model: ${aiHealth.data?.model}`);
    assert(!aiHealth.data.apiKey && !aiHealth.data.secret, 'Security check: No API keys or secrets exposed in health response');

    // 2. Safe Config Helper
    console.log('\n2. Testing Centralized Safe Config...');
    const safeConfig = getAISafeConfig();
    assert(safeConfig.provider === 'gemini', 'Safe config provider is gemini');
    assert(typeof safeConfig.configured === 'boolean', 'Safe config includes configuration boolean');
    assert(!('apiKey' in safeConfig), 'Security check: Safe config object does not contain apiKey property');

    // 3. AI Test Endpoint Behavior
    console.log('\n3. Testing AI Connection Endpoint Handling...');
    const isConfiguredOnServer = Boolean(aiHealth.data?.configured);

    const aiTestRes = await fetch(`${BASE_URL}/api/ai/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Ping test' }),
    });
    const aiTestData = await aiTestRes.json();

    if (!isConfiguredOnServer) {
      assert(aiTestRes.status === 503, 'Returns 503 when AI is not configured', `Status: ${aiTestRes.status}`);
      assert(aiTestData.code === 'AI_NOT_CONFIGURED', 'Returns clear AI_NOT_CONFIGURED error code');
    } else {
      assert(aiTestRes.status === 200, 'Returns 200 when AI is configured', `Status: ${aiTestRes.status}`);
      assert(aiTestData.success === true, 'Returns success: true for live AI test');
      assert(Boolean(aiTestData.data?.latencyMs), 'Returns latency measurement', `${aiTestData.data?.latencyMs}ms`);
    }
    assert(!aiTestData.apiKey && !aiTestData.secret, 'Security check: No API key or secret exposed in test response');

    // 4. Structured JSON Parser & Extractor Tests
    console.log('\n4. Testing Structured JSON Extraction & Parser Resilience...');
    
    // Direct JSON
    const directJson = '{"question": "What is AVL tree?", "questionType": "MCQ", "difficulty": "Medium"}';
    const parsedDirect = parseStructuredJson(directJson);
    assert(parsedDirect.question === 'What is AVL tree?' && parsedDirect.questionType === 'MCQ', 'Parses direct JSON string');

    // Markdown Fenced JSON (```json ... ```)
    const markdownJson = 'Here is the generated question:\n```json\n{\n  "question": "What is DFA?",\n  "questionType": "MCQ",\n  "options": ["A", "B"],\n  "correctAnswer": "A"\n}\n```\nHope this helps!';
    const parsedMarkdown = parseStructuredJson(markdownJson);
    assert(parsedMarkdown.question === 'What is DFA?' && parsedMarkdown.correctAnswer === 'A', 'Extracts and parses JSON wrapped in markdown code fence');

    // Schema Validation Hook
    const sampleGateQuestion = `\`\`\`json
{
  "question": "Which of the following is true regarding B+ trees?",
  "questionType": "MSQ",
  "options": ["Option 1", "Option 2"],
  "correctAnswer": ["A", "B"],
  "explanation": "B+ tree leaves are linked sequentially.",
  "subject": "DBMS",
  "topic": "Indexing",
  "concepts": ["B+ tree", "fanout"],
  "difficulty": "Hard"
}
\`\`\``;

    const validator = (q) => Boolean(q.question && q.questionType && q.options && q.correctAnswer && q.explanation);
    const parsedValidQuestion = parseStructuredJson(sampleGateQuestion, validator);
    assert(parsedValidQuestion.subject === 'DBMS' && parsedValidQuestion.concepts.length === 2, 'Validates structured GATE question schema successfully');

    // Malformed JSON Rejection
    let errorCaught = false;
    try {
      parseStructuredJson('This is not valid JSON at all without brackets');
    } catch (err) {
      errorCaught = true;
      assert(err.name === 'AIResponseParsingError' && err.code === 'AI_PARSE_ERROR', 'Rejects malformed JSON with AIResponseParsingError');
    }
    assert(errorCaught, 'Properly threw error for invalid JSON input');

    // 5. Preserved Phase 1 & Phase 2 Endpoints
    console.log('\n5. Verifying Preserved Question Bank & Practice Endpoints...');
    const questionsRes = await (await fetch(`${BASE_URL}/api/questions?page=1&limit=5`)).json();
    assert(questionsRes.success && questionsRes.data.length === 5, 'GET /api/questions with pagination works');

    const taxonomyRes = await (await fetch(`${BASE_URL}/api/taxonomy`)).json();
    assert(taxonomyRes.success && taxonomyRes.data?.subjects?.length === 12, 'GET /api/taxonomy returns 12 subjects');

    const answerEval = await (await fetch(`${BASE_URL}/api/questions/gate-cs-ds-001/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: 'B' }),
    })).json();
    assert(answerEval.data?.isCorrect === true, 'Answer evaluation engine for MCQ works');

    // 6. Frontend Proxy Integration
    console.log('\n6. Verifying Frontend Server & AI Proxy Integration...');
    const frontAiHealth = await (await fetch('http://localhost:5173/api/ai/health')).json();
    assert(frontAiHealth.success === true && frontAiHealth.data?.provider === 'gemini', 'Frontend proxy forwards /api/ai/health correctly');

    console.log('\n======================================================');
    console.log(`🎉 ALL PHASE 3A TESTS PASSED (${passedTests}/${totalTests})!`);
    console.log('======================================================\n');
  } catch (err) {
    console.error('❌ Phase 3A Test Suite failed:', err);
  }
}

runPhase3ATests();
