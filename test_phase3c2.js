/**
 * Comprehensive Automated Verification Suite for GATEForge Task 3C.2
 * (First Real AI Question-Generation Prompt & Service Layer)
 */

import { buildQuestionGenerationPrompt } from './backend/src/services/ai/prompts/generation.prompt.js';
import { QuestionGenerationService } from './backend/src/services/ai/questionGeneration.service.js';
import { AIService } from './backend/src/services/ai/ai.service.js';

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

async function runTask3C2Tests() {
  console.log('====================================================');
  console.log('🧪 RUNNING GATEFORGE TASK 3C.2 AUTOMATED VERIFICATION');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // TEST GROUP 1: Prompt Construction & Template Integrity
  // ----------------------------------------------------
  console.log('📝 GROUP 1: Prompt Construction & Anti-Copy Rules');

  const sampleContext = {
    subject: 'Algorithms',
    topic: 'Graph Algorithms',
    subtopic: 'Shortest Paths',
    concepts: ["Dijkstra's algorithm", 'shortest path', 'weighted graphs'],
    reasoningType: ['analytical', 'numerical'],
    cognitiveSkill: 'apply',
    questionPattern: 'Determine shortest-path distances in a weighted graph',
    difficulty: 'Medium',
    questionType: 'MCQ',
    relevantPYQs: [
      {
        id: 'gate-cs-algo-002',
        question: 'What is the minimum weight spanning tree of graph G?',
        questionType: 'MCQ',
        options: [{ id: 'A', text: '12' }, { id: 'B', text: '14' }],
        correctAnswer: 'B',
        questionPattern: 'Compute MST weight using Kruskal algorithm',
      },
    ],
  };

  const mcqPrompt = buildQuestionGenerationPrompt(sampleContext);
  assert(mcqPrompt.includes('Algorithms'), 'Prompt includes specified subject');
  assert(mcqPrompt.includes('Graph Algorithms'), 'Prompt includes specified topic');
  assert(mcqPrompt.includes("Dijkstra's algorithm"), 'Prompt includes specified concept');
  assert(mcqPrompt.includes('Medium'), 'Prompt includes specified difficulty');
  assert(mcqPrompt.includes('apply'), 'Prompt includes specified cognitive skill');
  assert(mcqPrompt.includes('Determine shortest-path distances'), 'Prompt includes specified question pattern');
  assert(mcqPrompt.includes('REFERENCE GATE PREVIOUS YEAR QUESTIONS (PYQs)'), 'Prompt includes reference PYQs section');
  assert(mcqPrompt.includes('DO NOT copy, clone, or paraphrase'), 'Prompt explicitly contains anti-copy instruction');
  assert(mcqPrompt.includes('DO NOT merely change variable names'), 'Prompt explicitly forbids simple variable/number substitutions');
  assert(mcqPrompt.includes('Multiple Choice Question (MCQ)'), 'Prompt contains MCQ-specific instructions');
  assert(mcqPrompt.includes('exactly 4 options labeled "A", "B", "C", "D"'), 'Prompt requires exactly 4 options');

  // MSQ prompt check
  const msqPrompt = buildQuestionGenerationPrompt({ ...sampleContext, questionType: 'MSQ' });
  assert(msqPrompt.includes('Multiple Select Question (MSQ)'), 'MSQ prompt contains MSQ-specific instructions');
  assert(msqPrompt.includes('ONE OR MORE options can be correct'), 'MSQ prompt specifies multiple correct options capability');

  // NAT prompt check
  const natPrompt = buildQuestionGenerationPrompt({ ...sampleContext, questionType: 'NAT' });
  assert(natPrompt.includes('Numerical Answer Type (NAT)'), 'NAT prompt contains NAT-specific instructions');
  assert(natPrompt.includes('"options" must be an empty array []'), 'NAT prompt forbids options array');

  // ----------------------------------------------------
  // TEST GROUP 2: Mocked Service Generation & Normalization
  // ----------------------------------------------------
  console.log('\n🤖 GROUP 2: Deterministic Mock Generation & Normalization');

  // Mock Provider for MCQ
  const mockMCQProvider = {
    providerName: 'mock-gemini',
    modelName: 'mock-flash',
    isConfigured: () => true,
    generateStructuredOutput: async () => ({
      data: {
        question: 'Let $G = (V, E)$ be a directed weighted graph. What is the distance from $s$ to $t$?',
        questionType: 'MCQ',
        options: [
          { id: 'A', text: '$15$' },
          { id: 'B', text: '$18$' },
          { id: 'C', text: '$21$' },
          { id: 'D', text: '$24$' },
        ],
        correctAnswer: 'B',
        explanation: 'Applying Dijkstra step by step gives distance 18.',
        subject: 'Algorithms',
        topic: 'Graph Algorithms',
        difficulty: 'Medium',
      },
      rawText: '{}',
      model: 'mock-flash',
      latencyMs: 45,
    }),
    generateText: async () => ({ text: '', model: '', latencyMs: 0 }),
    checkHealth: async () => ({ configured: true, provider: 'mock', model: 'mock', status: 'ready' }),
  };

  const mcqService = new QuestionGenerationService(new AIService(mockMCQProvider));
  const mcqResult = await mcqService.generateQuestion(sampleContext);
  assert(mcqResult.success === true, 'MCQ generation returns success: true');
  assert(mcqResult.data?.questionType === 'MCQ', 'MCQ returns questionType: MCQ');
  assert(Array.isArray(mcqResult.data?.options) && mcqResult.data.options.length === 4, 'MCQ contains exactly 4 options');
  assert(mcqResult.data?.options[0].id === 'A', 'Option 0 has id A');
  assert(mcqResult.data?.correctAnswer === 'B', 'MCQ correctAnswer is single option ID B');
  assert(mcqResult.data?.question.includes('$G = (V, E)$'), 'LaTeX notation preserved in question');

  // Mock Provider for MSQ
  const mockMSQProvider = {
    ...mockMCQProvider,
    generateStructuredOutput: async () => ({
      data: {
        question: 'Which of the following statements about functional dependencies are TRUE?',
        questionType: 'MSQ',
        options: [
          { id: 'A', text: 'Armstrong axioms are sound.' },
          { id: 'B', text: 'Armstrong axioms are complete.' },
          { id: 'C', text: 'Lossless join requires all dependencies to be preserved.' },
          { id: 'D', text: 'A candidate key functionally determines all attributes.' },
        ],
        correctAnswer: ['A', 'B', 'D'],
        explanation: 'Options A, B, and D are standard database theorems.',
        subject: 'DBMS',
        topic: 'Normalization',
        difficulty: 'Hard',
      },
      rawText: '{}',
      model: 'mock-flash',
      latencyMs: 50,
    }),
  };

  const msqService = new QuestionGenerationService(new AIService(mockMSQProvider));
  const msqResult = await msqService.generateQuestion({ ...sampleContext, questionType: 'MSQ' });
  assert(msqResult.data?.questionType === 'MSQ', 'MSQ returns questionType: MSQ');
  assert(Array.isArray(msqResult.data?.correctAnswer) && msqResult.data.correctAnswer.length === 3, 'MSQ correctAnswer is an array with 3 correct options');
  assert(msqResult.data.correctAnswer.includes('A') && msqResult.data.correctAnswer.includes('D'), 'MSQ contains expected option IDs');

  // Mock Provider for NAT
  const mockNATProvider = {
    ...mockMCQProvider,
    generateStructuredOutput: async () => ({
      data: {
        question: 'Consider a paging system with page size 4 KB. If logical address is 32 bits, how many pages are there in total?',
        questionType: 'NAT',
        options: [],
        correctAnswer: 1048576,
        explanation: '$2^{32} / 2^{12} = 2^{20} = 1048576$.',
        subject: 'Operating Systems',
        topic: 'Virtual Memory',
        difficulty: 'Easy',
      },
      rawText: '{}',
      model: 'mock-flash',
      latencyMs: 40,
    }),
  };

  const natService = new QuestionGenerationService(new AIService(mockNATProvider));
  const natResult = await natService.generateQuestion({ ...sampleContext, questionType: 'NAT' });
  assert(natResult.data?.questionType === 'NAT', 'NAT returns questionType: NAT');
  assert(Array.isArray(natResult.data?.options) && natResult.data.options.length === 0, 'NAT options array is empty []');
  assert(typeof natResult.data?.correctAnswer === 'number' && natResult.data.correctAnswer === 1048576, 'NAT correctAnswer is numerical value');

  // String Options Array Normalization test
  const mockStringOptionsProvider = {
    ...mockMCQProvider,
    generateStructuredOutput: async () => ({
      data: {
        question: 'Sample question text',
        questionType: 'MCQ',
        options: ['Choice 1', 'Choice 2', 'Choice 3', 'Choice 4'],
        correctAnswer: 'C',
        explanation: 'Exp',
      },
      rawText: '{}',
      model: 'mock-flash',
      latencyMs: 30,
    }),
  };
  const stringOptsService = new QuestionGenerationService(new AIService(mockStringOptionsProvider));
  const stringOptsResult = await stringOptsService.generateQuestion(sampleContext);
  assert(stringOptsResult.data.options[0].id === 'A' && stringOptsResult.data.options[0].text === 'Choice 1', 'String array options normalized to {id, text} objects');

  // Error handling test on malformed AI output
  const mockMalformedProvider = {
    ...mockMCQProvider,
    generateStructuredOutput: async () => ({
      data: null,
      rawText: 'null',
      model: 'mock-flash',
      latencyMs: 20,
    }),
  };
  const malformedService = new QuestionGenerationService(new AIService(mockMalformedProvider));
  let malformedCaught = false;
  try {
    await malformedService.generateQuestion(sampleContext);
  } catch (err) {
    malformedCaught = true;
    assert(err.code === 'INVALID_GENERATED_QUESTION', 'Malformed AI output throws controlled INVALID_GENERATED_QUESTION error');
  }
  assert(malformedCaught, 'Service safely guards against malformed/null AI output');

  // ----------------------------------------------------
  // TEST GROUP 3: Live Endpoint Generation Context Support
  // ----------------------------------------------------
  console.log('\n⚡ GROUP 3: Live Development Endpoint Support (POST /api/ai/generation/test)');

  // Test with full generation context on live endpoint
  const liveRes = await fetch(`${API_BASE}/api/ai/generation/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject: 'Algorithms',
      topic: 'Sorting & Selection',
      concepts: ['QuickSelect', 'order statistics', 'worst-case time complexity'],
      questionPattern: 'Analyze recurrence and worst-case partitioning scenario',
      reasoningType: ['analytical'],
      difficulty: 'Medium',
      questionType: 'MCQ',
    }),
  });

  assert(liveRes.status === 200, `Live endpoint with generation context returns HTTP 200 (Status: ${liveRes.status})`);
  const liveJson = await liveRes.json();
  assert(liveJson.success === true, 'Live response has success: true');
  assert(Boolean(liveJson.data?.data?.question || liveJson.data?.question), 'Live generated question text is present');
  const genQ = liveJson.data?.data || liveJson.data;
  assert(genQ?.questionType === 'MCQ', 'Live generated question type is MCQ');
  assert(Array.isArray(genQ?.options) && genQ.options.length === 4, 'Live generated MCQ has 4 options');
  assert(Boolean(genQ?.correctAnswer), `Live generated question has correctAnswer: ${genQ?.correctAnswer}`);
  assert(Boolean(genQ?.explanation), 'Live generated question has explanation');

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log(`🏁 TASK 3C.2 TESTS COMPLETE: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTask3C2Tests().catch((err) => {
  console.error('Task 3C.2 Test execution failed:', err);
  process.exit(1);
});
