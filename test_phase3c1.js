/**
 * Comprehensive Automated Verification Suite for GATEForge Task 3C.1
 * (AI Question Generation Service & Architecture Foundation)
 */

import { QuestionGenerationService } from './backend/src/services/ai/questionGeneration.service.js';
import { AIService } from './backend/src/services/ai/ai.service.js';
import { AIController } from './backend/src/controllers/ai.controller.js';

const API_BASE = 'http://localhost:5000';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

async function runTask3C1Tests() {
  console.log('====================================================');
  console.log('🧪 RUNNING GATEFORGE TASK 3C.1 AUTOMATED VERIFICATION');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // TEST GROUP 1: Service Instantiation & Architecture
  // ----------------------------------------------------
  console.log('📋 GROUP 1: Question Generation Service Architecture');
  
  const mockProvider = {
    providerName: 'mock-provider',
    modelName: 'mock-model-v1',
    isConfigured: () => true,
    generateText: async () => ({ text: 'mock text', model: 'mock-model-v1', latencyMs: 10 }),
    generateStructuredOutput: async (prompt) => {
      if (typeof prompt === 'string' && prompt.includes('TARGET SPECIFICATIONS')) {
        return {
          data: {
            question: 'What is the balance factor of an AVL tree node?',
            questionType: 'MCQ',
            options: [{ id: 'A', text: '-1, 0, or 1' }, { id: 'B', text: 'Any integer' }, { id: 'C', text: '0 only' }, { id: 'D', text: '1 only' }],
            correctAnswer: 'A',
            explanation: 'AVL balance factor must be in {-1, 0, 1}.',
            subject: 'Data Structures',
            topic: 'AVL Trees',
            difficulty: 'Medium',
          },
          rawText: '{}',
          model: 'mock-model-v1',
          latencyMs: 15,
        };
      }
      return {
        data: { status: 'ok', generated: true },
        rawText: '{"status":"ok","generated":true}',
        model: 'mock-model-v1',
        latencyMs: 15,
      };
    },
    checkHealth: async () => ({ configured: true, provider: 'mock-provider', model: 'mock-model-v1', status: 'ready' }),
  };

  const customAIService = new AIService(mockProvider);
  const genServiceWithCustomAI = new QuestionGenerationService(customAIService);
  assert(genServiceWithCustomAI instanceof QuestionGenerationService, 'Generation service can be instantiated with custom AI service');
  assert(typeof genServiceWithCustomAI.generateQuestion === 'function', 'generateQuestion method exists on QuestionGenerationService');
  assert(typeof genServiceWithCustomAI.testGeneration === 'function', 'testGeneration method exists on QuestionGenerationService');

  // Verify that QuestionGenerationService calls AIService
  const mockTestResult = await genServiceWithCustomAI.testGeneration('Test Prompt');
  assert(mockTestResult.status === 'ok', 'Generation service delegates structured output to underlying AI service');
  assert(mockTestResult.provider === 'mock-provider', 'Generation service preserves provider provenance');
  assert(mockTestResult.model === 'mock-model-v1', 'Generation service preserves model provenance');

  // Verify unconfigured error handling in service
  const unconfiguredProvider = {
    ...mockProvider,
    isConfigured: () => false,
  };
  const unconfiguredAIService = new AIService(unconfiguredProvider);
  const unconfiguredGenService = new QuestionGenerationService(unconfiguredAIService);
  let caughtUnconfigured = false;
  try {
    await unconfiguredGenService.testGeneration();
  } catch (err) {
    caughtUnconfigured = true;
    assert(err.code === 'AI_NOT_CONFIGURED', 'Unconfigured service throws AI_NOT_CONFIGURED error safely');
  }
  assert(caughtUnconfigured, 'Service safeguards against unconfigured AI provider');

  // Verify generateQuestion baseline interface
  const baselineResult = await genServiceWithCustomAI.generateQuestion({
    subject: 'Data Structures',
    topic: 'AVL Trees',
    concepts: ['tree rotation', 'balance factor'],
    difficulty: 'Medium',
  });
  assert(baselineResult.success === true, 'generateQuestion interface accepts context and returns cleanly');
  assert(baselineResult.data?.subject === 'Data Structures', 'generateQuestion preserves input context subject');
  assert(baselineResult.data?.question.includes('AVL tree'), 'generateQuestion returns generated question content');

  // ----------------------------------------------------
  // TEST GROUP 2: Controller & Route Integration
  // ----------------------------------------------------
  console.log('\n🎮 GROUP 2: Controller Method Exists & Connected');
  assert(typeof AIController.testGeneration === 'function', 'AIController.testGeneration handler is defined and accessible');

  // ----------------------------------------------------
  // TEST GROUP 3: Live Test Endpoint Execution
  // ----------------------------------------------------
  console.log('\n⚡ GROUP 3: Live Endpoint POST /api/ai/generation/test');
  
  const testRes = await fetch(`${API_BASE}/api/ai/generation/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'Return a JSON object containing {"status":"ok"}.',
    }),
  });

  assert(testRes.status === 200, `POST /api/ai/generation/test returns HTTP 200 (Status: ${testRes.status})`);
  const testJson = await testRes.json();
  assert(testJson.success === true, 'Response body has success: true');
  assert(testJson.message.includes('successful'), 'Response message indicates pipeline success');
  assert(testJson.data?.status === 'ok' || testJson.data?.data?.status === 'ok', 'Pipeline parsed {"status":"ok"} JSON response cleanly');
  assert(typeof testJson.data?.latencyMs === 'number', `Latency measurement returned (${testJson.data?.latencyMs}ms)`);
  assert(testJson.data?.provider === 'gemini', 'Provider confirmed as gemini');
  assert(testJson.data?.model === 'gemini-flash-lite-latest', 'Model confirmed as gemini-flash-lite-latest');

  // ----------------------------------------------------
  // TEST GROUP 4: Security & Secret Protection
  // ----------------------------------------------------
  console.log('\n🔒 GROUP 4: Security & Secret Protection');
  const serializedResponse = JSON.stringify(testJson);
  assert(!serializedResponse.includes('AIzaSy'), 'Response does NOT leak Google/Gemini API key prefix');
  assert(!serializedResponse.toLowerCase().includes('apikey'), 'Response does NOT contain apiKey property');
  assert(!serializedResponse.includes('process.env'), 'Response does NOT contain environment variable references');

  // ----------------------------------------------------
  // TEST GROUP 5: Root API Endpoints Listing
  // ----------------------------------------------------
  console.log('\n📡 GROUP 5: API Endpoints Listing Check');
  const rootRes = await (await fetch(`${API_BASE}/`)).json();
  assert(rootRes.endpoints?.aiGenerationTest === 'POST /api/ai/generation/test', 'Root endpoint lists aiGenerationTest endpoint');

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log(`🏁 TASK 3C.1 TESTS COMPLETE: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTask3C1Tests().catch(err => {
  console.error('Task 3C.1 Test execution failed:', err);
  process.exit(1);
});
