/**
 * Automated Verification Suite for GATEForge Checkpoint 2A
 * (Official GATE PYQ Extraction Pipeline)
 */

import fs from 'node:fs';
import path from 'node:path';
import { pyqExtractionService } from './backend/src/services/pyqExtraction/pyqExtraction.service.js';
import { extractPdfText } from './backend/src/services/pyqExtraction/pdfExtractor.js';
import { segmentQuestions, extractOptionsFromBlock } from './backend/src/services/pyqExtraction/questionSegmenter.js';
import { geminiExtractionFallback } from './backend/src/services/pyqExtraction/geminiExtractionFallback.js';
import { sourceRegistry } from './backend/src/services/gateSources/sourceRegistry.js';

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

async function runCheckpoint2ATests() {
  console.log('====================================================');
  console.log('🧪 RUNNING GATEFORGE CHECKPOINT 2A VERIFICATION');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // TEST GROUP 1: PDF Source Validation & Access
  // ----------------------------------------------------
  console.log('📄 GROUP 1: Trusted PDF Source Validation & Ingestion');

  // Test 1: Trusted PDF source can be opened
  const officialSourceId = 'gate-2024-cs-paper';
  const sourceRecord = sourceRegistry.getSourceById(officialSourceId);
  assert(sourceRecord !== undefined, 'Trusted source gate-2024-cs-paper exists in registry');

  // Test 2: Unregistered source is rejected
  let unregisteredRejected = false;
  try {
    await pyqExtractionService.extractFromSource('unregistered-source-xyz');
  } catch (err) {
    unregisteredRejected = true;
    assert(err.message.includes('not registered'), 'Unregistered source throws descriptive error');
  }
  assert(unregisteredRejected === true, 'Unregistered source is safely rejected');

  // ----------------------------------------------------
  // TEST GROUP 2: Raw PDF Text Extraction
  // ----------------------------------------------------
  console.log('\n🔍 GROUP 2: Raw PDF Text Extraction & Page Chunking');

  const pdfPath = path.resolve('backend/data/gate_downloads/gate-2024-cs-paper.pdf');
  assert(fs.existsSync(pdfPath), 'Official downloaded PDF file exists in cache');
  const buffer = fs.readFileSync(pdfPath);

  // Test 3: Raw PDF text extraction succeeds
  const pdfResult = await extractPdfText(buffer);
  assert(pdfResult.status === 'EXTRACTED', 'Raw PDF text extraction status is EXTRACTED');

  // Test 4: Page count and rawTextLength metadata is returned
  assert(pdfResult.pages === 36, `Extracted expected page count (36 pages, found: ${pdfResult.pages})`);
  assert(pdfResult.rawTextLength > 20000, `Raw text length returned (${pdfResult.rawTextLength} characters)`);
  assert(pdfResult.pageTexts.length === 36, 'Page-by-page chunks match total page count');

  // ----------------------------------------------------
  // TEST GROUP 3: Question Segmentation & Option Parsing
  // ----------------------------------------------------
  console.log('\n✂️ GROUP 3: Question Segmentation & Options Parsing');

  const candidates = segmentQuestions(pdfResult.pageTexts);

  // Test 5: Multiple question candidates detected
  assert(candidates.length === 65, `All 65 GATE CS questions detected (found: ${candidates.length})`);

  // Test 6: Question numbers are parsed correctly
  assert(candidates[0].questionNumber === 1, 'First candidate is Q.1');
  assert(candidates[9].questionNumber === 10, 'Candidate 10 is Q.10');
  assert(candidates[64].questionNumber === 65, 'Last candidate is Q.65');

  // Test 7: MCQ-style options can be extracted
  const q1 = candidates[0];
  assert(q1.rawOptions.length === 4, 'Q.1 has exactly 4 options extracted');
  assert(q1.rawOptions[0].includes('starve'), 'Q.1 Option A contains "starve"');
  assert(q1.rawOptions[2].includes('feast'), 'Q.1 Option C contains "feast"');

  // Test 8: Mathematical text is not completely corrupted
  const q5 = candidates[4];
  assert(q5.rawQuestionText.includes('log'), 'Q.5 preserves logarithm formula keyword');
  assert(q5.rawOptions.length === 4, 'Q.5 has 4 options');

  // Test 9: A formal / TOC-style question remains readable
  const q23 = candidates.find((q) => q.questionNumber === 23);
  assert(q23 !== undefined, 'Found TOC question Q.23');
  assert(q23?.rawQuestionText.includes('regular language'), 'Q.23 preserves "regular language" formal terminology');
  assert(q23?.rawOptions.length === 4, 'Q.23 has 4 options');

  // Test 10: Figure-dependent question marked requiresFigure and requiresReview
  const q10 = candidates.find((q) => q.questionNumber === 10);
  assert(q10 !== undefined, 'Found Q.10 in candidates');
  assert(q10?.requiresFigure === true, 'Q.10 is flagged requiresFigure: true');
  assert(q10?.requiresReview === true, 'Q.10 is flagged requiresReview: true');
  assert(q10?.extractionConfidence <= 0.50, `Q.10 confidence reflects figure dependency (${q10?.extractionConfidence})`);

  const q28 = candidates.find((q) => q.questionNumber === 28);
  assert(q28?.requiresFigure === true, 'Q.28 (circuit) flagged requiresFigure: true');

  // ----------------------------------------------------
  // TEST GROUP 4: Safeguards, Fallback & No DB Writes
  // ----------------------------------------------------
  console.log('\n🛡️ GROUP 4: Review Flagging, Gemini Fallback & DB Isolation');

  // Test 11: Malformed candidate becomes requiresReview instead of fabricated data
  const malformedBlock = [
    {
      pageNumber: 5,
      text: 'Q.40 Some corrupted question snippet without options\n(A) Only one option found',
    },
  ];
  const malformedCandidates = segmentQuestions(malformedBlock);
  assert(malformedCandidates.length === 1, 'Malformed snippet parsed as candidate');
  assert(malformedCandidates[0].requiresReview === true, 'Malformed candidate becomes requiresReview: true');
  assert(malformedCandidates[0].extractionConfidence < 0.60, 'Malformed candidate has lower confidence');

  // Test 12: Gemini fallback output is schema validated
  const dummyInput = {
    questionNumber: 42,
    rawText: 'Q.42 Consider a hash table with 10 slots. (A) Slot 1 (B) Slot 2 (C) Slot 3 (D) Slot 4',
    pageNumber: 15,
  };
  // Test schema rejection when AI returns invalid question number
  const fakeAiService = {
    isConfigured: () => true,
    generateStructured: async () => ({
      data: {
        questionNumber: 999, // Mismatched question number
        rawQuestionText: 'Fabricated question',
        rawOptions: ['A', 'B', 'C', 'D'],
      },
    }),
  };
  const { GeminiExtractionFallback } = await import('./backend/src/services/pyqExtraction/geminiExtractionFallback.js');
  const fallbackWithFake = new GeminiExtractionFallback(fakeAiService);
  const rejectedFallback = await fallbackWithFake.refineQuestionCandidate(dummyInput);
  assert(rejectedFallback === null, 'Fallback rejects mismatched questionNumber from AI');

  // Test 13: Gemini fallback rejects fabricated text with no overlap
  const hallucinatingAiService = {
    isConfigured: () => true,
    generateStructured: async () => ({
      data: {
        questionNumber: 42,
        rawQuestionText: 'Completely made up question about quantum physics that was not in source text',
        rawOptions: ['A', 'B', 'C', 'D'],
      },
    }),
  };
  const fallbackWithHallucination = new GeminiExtractionFallback(hallucinatingAiService);
  const rejectedHallucination = await fallbackWithHallucination.refineQuestionCandidate(dummyInput);
  assert(rejectedHallucination === null, 'Fallback rejects hallucinated text with insufficient source overlap');

  // Test 14: No questions written to MongoDB
  // Verify via service response that questions are candidate structures, not saved models
  const serviceResponse = await pyqExtractionService.extractFromSource(officialSourceId);
  assert(serviceResponse.totalCandidates === 65, 'Service returns 65 total candidates');
  assert(serviceResponse.questions.every((q) => q._id === undefined), 'Candidates do not have MongoDB _id (not persisted)');

  // ----------------------------------------------------
  // TEST GROUP 5: Live Development Endpoint Check
  // ----------------------------------------------------
  console.log('\n⚡ GROUP 5: Development Endpoint (POST /api/pyq/extract/:sourceId)');

  const endpointRes = await fetch(`http://localhost:5000/api/pyq/extract/${officialSourceId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  assert(endpointRes.status === 200, `POST /api/pyq/extract/:sourceId returns HTTP 200 (Status: ${endpointRes.status})`);
  const endpointBody = await endpointRes.json();
  assert(endpointBody.success === true, 'Endpoint response body has success: true');
  assert(endpointBody.data?.totalCandidates === 65, 'Endpoint returns 65 question candidates');
  assert(endpointBody.data?.requiresReview === 4, `Endpoint reports 4 review items (Found: ${endpointBody.data?.requiresReview})`);

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log(`🏁 CHECKPOINT 2A TESTS COMPLETE: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runCheckpoint2ATests().catch((err) => {
  console.error('Checkpoint 2A test suite execution failed:', err);
  process.exit(1);
});
