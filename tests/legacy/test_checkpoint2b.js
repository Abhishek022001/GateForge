/**
 * Comprehensive Automated Verification Suite for GATEForge Checkpoint 2B
 * (Official Answer-Key Mapping, Type Verification, Normalization & Provenance)
 */

import { pyqValidationService } from './backend/src/services/pyqExtraction/pyqValidation.service.js';
import { extractAnswerKeyFromPdf, parseAnswerKeyText } from './backend/src/services/pyqExtraction/answerKeyExtractor.js';
import { validateAndMapCandidates } from './backend/src/services/pyqExtraction/candidateValidator.js';
import { sourceRegistry } from './backend/src/services/gateSources/sourceRegistry.js';
import { officialGateSourceService } from './backend/src/services/gateSources/officialGateSource.js';

const API_BASE = 'http://localhost:5000';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message, detail = '') {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${message} ${detail ? `(${detail})` : ''}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message} ${detail ? `(${detail})` : ''}`);
    failedTests++;
  }
}

async function runCheckpoint2BTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING GATEFORGE CHECKPOINT 2B VERIFICATION');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // TEST GROUP 1: Matching Official Answer Key Resolution
  // ----------------------------------------------------
  console.log('🔑 GROUP 1: Matching Official Answer-Key Source Resolution');

  const paperSource = sourceRegistry.getSourceById('gate-2024-cs-paper');
  assert(paperSource !== undefined, 'Found gate-2024-cs-paper in registry');

  // Test 1: Matching answer-key source resolved correctly
  const resolvedKey = pyqValidationService.resolveMatchingAnswerKey(paperSource);
  assert(resolvedKey.id === 'gate-2024-cs-key', 'Matching answer-key source resolved correctly', resolvedKey.id);
  assert(resolvedKey.year === 2024, 'Answer key year matches paper year (2024)');
  assert(resolvedKey.paper === 'CS', 'Answer key paper matches paper (CS)');

  // Test 2: Wrong paper/set answer key is rejected
  let mismatchRejected = false;
  try {
    const wrongKeySource = {
      id: 'gate-2023-cs-key',
      year: 2023,
      paper: 'CS',
      title: 'GATE 2023 CS Key',
      documentType: 'ANSWER_KEY',
      url: 'https://gate2026.iitg.ac.in/doc/download/Answer_keys2023/CS_ANS_GATE2023.pdf',
      provider: 'OFFICIAL_GATE',
      status: 'DISCOVERED',
    };
    pyqValidationService.verifyPaperKeyCompatibility(paperSource, wrongKeySource);
  } catch (err) {
    mismatchRejected = true;
    assert(err.message.includes('Year mismatch'), 'Year mismatch throws descriptive error', err.message);
  }
  assert(mismatchRejected === true, 'Wrong year/set answer key is strictly rejected');

  // ----------------------------------------------------
  // TEST GROUP 2: Answer-Key Text Parsing Unit Tests
  // ----------------------------------------------------
  console.log('\n📄 GROUP 2: Answer-Key Text Parsing');

  const sampleKeyText = `
Q. No. Session Question Type Section Key/Range Mark
1 5 MCQ GA A 1
2 5 MCQ GA D 1
22 5 MSQ CS-1 A;C 1
30 5 MSQ CS-1 A;B;C 1
32 5 NAT CS-1 2 to 2 1
63 5 NAT CS-1 0.370 to 0.380 2
64 5 NAT CS-1 4.5 2
65 5 MCQ CS-1 MTA 2
  `;

  const parsedSample = parseAnswerKeyText(sampleKeyText);
  assert(parsedSample.totalRecords === 8, 'Parsed all 8 sample records', `Count: ${parsedSample.totalRecords}`);

  // Test 3: MCQ official answer mapped correctly
  const sampleQ1 = parsedSample.records.find((r) => r.questionNumber === 1);
  assert(sampleQ1.questionType === 'MCQ', 'Q1 is MCQ');
  assert(sampleQ1.answers[0] === 'A', 'Q1 MCQ answer is A');
  assert(sampleQ1.marks === 1, 'Q1 marks is 1');

  // Test 4: MSQ multiple answers mapped correctly
  const sampleQ22 = parsedSample.records.find((r) => r.questionNumber === 22);
  assert(sampleQ22.questionType === 'MSQ', 'Q22 is MSQ');
  assert(
    sampleQ22.answers.length === 2 && sampleQ22.answers.includes('A') && sampleQ22.answers.includes('C'),
    'Q22 MSQ multiple answers parsed correctly',
    JSON.stringify(sampleQ22.answers)
  );

  const sampleQ30 = parsedSample.records.find((r) => r.questionNumber === 30);
  assert(
    sampleQ30.answers.length === 3 && sampleQ30.answers.join(';') === 'A;B;C',
    'Q30 MSQ 3 answers parsed correctly',
    JSON.stringify(sampleQ30.answers)
  );

  // Test 5: NAT exact answer mapped correctly
  const sampleQ64 = parsedSample.records.find((r) => r.questionNumber === 64);
  assert(sampleQ64.questionType === 'NAT', 'Q64 is NAT');
  assert(
    sampleQ64.acceptedRange?.min === 4.5 && sampleQ64.acceptedRange?.max === 4.5,
    'NAT single exact value parsed as {min: 4.5, max: 4.5}',
    JSON.stringify(sampleQ64.acceptedRange)
  );

  // Test 6: NAT accepted range mapped correctly
  const sampleQ63 = parsedSample.records.find((r) => r.questionNumber === 63);
  assert(sampleQ63.questionType === 'NAT', 'Q63 is NAT');
  assert(
    sampleQ63.acceptedRange?.min === 0.37 && sampleQ63.acceptedRange?.max === 0.38,
    'NAT range 0.370 to 0.380 parsed accurately',
    JSON.stringify(sampleQ63.acceptedRange)
  );

  // Marks to All (MTA) test
  const sampleQ65 = parsedSample.records.find((r) => r.questionNumber === 65);
  assert(sampleQ65.isMTA === true, 'Q65 MTA flag detected correctly');

  // ----------------------------------------------------
  // TEST GROUP 3: Candidate Mapping & Validation Edge Cases
  // ----------------------------------------------------
  console.log('\n🔍 GROUP 3: Candidate Mapping & Validation Rules');

  const mockPaperSource = {
    id: 'mock-2024-cs-paper',
    year: 2024,
    paper: 'CS',
    title: 'Mock Paper',
    documentType: 'QUESTION_PAPER',
    url: 'https://gate2026.iitg.ac.in/doc/download/2024/mock.pdf',
    provider: 'OFFICIAL_GATE',
    status: 'DOWNLOADED',
    checksum: 'mock-paper-hash',
  };

  const mockKeySource = {
    id: 'mock-2024-cs-key',
    year: 2024,
    paper: 'CS',
    title: 'Mock Key',
    documentType: 'ANSWER_KEY',
    url: 'https://gate2026.iitg.ac.in/doc/download/2024/mock-key.pdf',
    provider: 'OFFICIAL_GATE',
    status: 'DOWNLOADED',
    checksum: 'mock-key-hash',
  };

  const mockCandidates = [
    // 1. Normal valid MCQ
    {
      questionNumber: 1,
      rawQuestionText: 'What is 2 + 2?',
      rawOptions: ['1', '4', '3', '5'],
      pageNumber: 1,
      extractionConfidence: 0.95,
      requiresReview: false,
      requiresFigure: false,
      marks: 1,
    },
    // 2. Extracted guessed MCQ, but official is MSQ (Test 7)
    {
      questionNumber: 2,
      rawQuestionText: 'Which are prime numbers?',
      rawOptions: ['2', '3', '4', '6'],
      pageNumber: 1,
      extractionConfidence: 0.95,
      requiresReview: false,
      requiresFigure: false,
      marks: 2,
    },
    // 3. MCQ with missing correct option (Test 8)
    {
      questionNumber: 3,
      rawQuestionText: 'Select option C:',
      rawOptions: ['Option A text', 'Option B text'], // Missing C and D
      pageNumber: 1,
      extractionConfidence: 0.95,
      requiresReview: false,
      requiresFigure: false,
      marks: 1,
    },
    // 4. MSQ with nonexistent option in answer (Test 9)
    {
      questionNumber: 4,
      rawQuestionText: 'Select A and D:',
      rawOptions: ['Option A', 'Option B', 'Option C'], // Missing D
      pageNumber: 2,
      extractionConfidence: 0.95,
      requiresReview: false,
      requiresFigure: false,
      marks: 2,
    },
    // 5. Candidate with missing answer-key record (Test 10)
    {
      questionNumber: 5,
      rawQuestionText: 'Candidate without key record?',
      rawOptions: ['A', 'B'],
      pageNumber: 2,
      extractionConfidence: 0.95,
      requiresReview: false,
      requiresFigure: false,
      marks: 1,
    },
    // 6. Figure-dependent question (Test 14)
    {
      questionNumber: 6,
      rawQuestionText: 'Refer to the diagram shown below:',
      rawOptions: ['10', '20', '30', '40'],
      pageNumber: 2,
      extractionConfidence: 0.5,
      requiresReview: true,
      requiresFigure: true,
      marks: 2,
    },
  ];

  const mockKeyRecords = [
    { questionNumber: 1, questionType: 'MCQ', answers: ['B'], rawKey: 'B', marks: 1, isMTA: false },
    { questionNumber: 2, questionType: 'MSQ', answers: ['A', 'B'], rawKey: 'A;B', marks: 2, isMTA: false },
    { questionNumber: 3, questionType: 'MCQ', answers: ['C'], rawKey: 'C', marks: 1, isMTA: false }, // Option C missing in candidate
    { questionNumber: 4, questionType: 'MSQ', answers: ['A', 'D'], rawKey: 'A;D', marks: 2, isMTA: false }, // Option D missing in candidate
    // Q5 has no key record
    { questionNumber: 6, questionType: 'MCQ', answers: ['A'], rawKey: 'A', marks: 2, isMTA: false },
  ];

  const validationRun = validateAndMapCandidates(mockCandidates, mockKeyRecords, {
    paperSource: mockPaperSource,
    keySource: mockKeySource,
    paperChecksum: 'mock-paper-hash',
    keyChecksum: 'mock-key-hash',
  });

  // Test 7: Official question type overrides extraction guess
  const validatedQ2 = validationRun.questions.find((q) => q.questionNumber === 2);
  assert(validatedQ2.questionType === 'MSQ', 'Official question type MSQ overrides extraction guess MCQ');
  assert(validatedQ2.typeOverridden === true, 'typeOverridden flag is set to true');
  assert(Array.isArray(validatedQ2.correctAnswer), 'MSQ correctAnswer is an array', JSON.stringify(validatedQ2.correctAnswer));

  // Test 8: MCQ with missing correct option becomes NEEDS_REVIEW
  const validatedQ3 = validationRun.questions.find((q) => q.questionNumber === 3);
  assert(validatedQ3.validationStatus === 'NEEDS_REVIEW', 'MCQ with missing correct option becomes NEEDS_REVIEW');
  assert(
    validatedQ3.validationIssues.some((i) => i.includes('does not exist in extracted options')),
    'Identified specific missing option issue',
    validatedQ3.validationIssues.join('; ')
  );

  // Test 9: MSQ answer containing nonexistent option becomes NEEDS_REVIEW
  const validatedQ4 = validationRun.questions.find((q) => q.questionNumber === 4);
  assert(validatedQ4.validationStatus === 'NEEDS_REVIEW', 'MSQ answer with missing option becomes NEEDS_REVIEW');
  assert(
    validatedQ4.validationIssues.some((i) => i.includes("MSQ official answer 'D' does not exist")),
    'Identified specific missing MSQ option issue',
    validatedQ4.validationIssues.join('; ')
  );

  // Test 10: Missing answer-key record becomes NEEDS_REVIEW
  const validatedQ5 = validationRun.questions.find((q) => q.questionNumber === 5);
  assert(validatedQ5.validationStatus === 'NEEDS_REVIEW', 'Candidate with no answer key record becomes NEEDS_REVIEW');
  assert(
    validatedQ5.validationIssues.some((i) => i.includes('No matching official answer key record')),
    'Identified missing key record issue',
    validatedQ5.validationIssues.join('; ')
  );

  // Test 11: Duplicate answer-key entries are detected
  const duplicateKeyText = `
1 5 MCQ GA A 1
1 5 MCQ GA B 1
2 5 MCQ GA C 1
  `;
  const parsedDuplicateKey = parseAnswerKeyText(duplicateKeyText);
  assert(
    parsedDuplicateKey.unparsedLines.some((l) => l.includes('Duplicate entry for Q.1')),
    'Duplicate answer-key entry detected in parser'
  );

  // Test 12: Question-paper provenance remains intact
  const validatedQ1 = validationRun.questions.find((q) => q.questionNumber === 1);
  assert(validatedQ1.provenance.questionPaperSourceId === 'mock-2024-cs-paper', 'Question-paper source ID preserved');
  assert(validatedQ1.provenance.questionPaperChecksum === 'mock-paper-hash', 'Question-paper checksum preserved');
  assert(validatedQ1.provenance.year === 2024, 'Provenance year is 2024');

  // Test 13: Answer-key provenance is added
  assert(validatedQ1.provenance.answerKeySourceId === 'mock-2024-cs-key', 'Answer-key source ID added to provenance');
  assert(validatedQ1.provenance.answerKeyChecksum === 'mock-key-hash', 'Answer-key checksum added to provenance');

  // Test 14: Figure-dependent question remains flagged
  const validatedQ6 = validationRun.questions.find((q) => q.questionNumber === 6);
  assert(validatedQ6.requiresFigure === true, 'Figure-dependent question has requiresFigure: true');
  assert(validatedQ6.validationStatus === 'NEEDS_REVIEW', 'Figure-dependent question is assigned NEEDS_REVIEW');

  // Test 15: No Gemini-generated answer replaces an official answer
  assert(validatedQ1.correctAnswer === 'B', 'MCQ answer is strictly from official key (B)');
  assert(JSON.stringify(validatedQ2.correctAnswer) === JSON.stringify(['A', 'B']), 'MSQ answer is strictly from official key (A, B)');

  // Test 16: No candidate is written to MongoDB
  const questionsRes = await fetch(`${API_BASE}/api/questions`);
  const questionsData = await questionsRes.json();
  const foundMock = (questionsData.data || []).some(
    (q) => q.id?.includes('mock-2024') || q.question?.includes('What is 2 + 2?')
  );
  assert(foundMock === false, 'No candidate question was written to MongoDB or question store');

  // ----------------------------------------------------
  // TEST GROUP 4: Real End-to-End Run on Official GATE 2024 CS Paper
  // ----------------------------------------------------
  console.log('\n🚀 GROUP 4: Real End-to-End Extraction & Answer-Key Validation');

  const realValidation = await pyqValidationService.validatePaper('gate-2024-cs-paper');
  assert(realValidation.paperSourceId === 'gate-2024-cs-paper', 'Paper source ID is gate-2024-cs-paper');
  assert(realValidation.answerKeySourceId === 'gate-2024-cs-key', 'Resolved answer key is gate-2024-cs-key');
  assert(realValidation.total === 65, 'Total questions validated is 65 (100% of official paper)', `Total: ${realValidation.total}`);
  assert(realValidation.valid >= 58, `High VALID count achieved (${realValidation.valid}/65)`);
  assert(realValidation.failed === 0, 'No questions failed catastrophically (Failed: 0)');
  assert(realValidation.needsReview <= 7, `Low NEEDS_REVIEW count (${realValidation.needsReview}/65)`);
  assert(realValidation.questionTypes.MCQ > 0, `MCQ count: ${realValidation.questionTypes.MCQ}`);
  assert(realValidation.questionTypes.MSQ > 0, `MSQ count: ${realValidation.questionTypes.MSQ}`);
  assert(realValidation.questionTypes.NAT > 0, `NAT count: ${realValidation.questionTypes.NAT}`);
  assert(realValidation.consistencyReport.isConsistent === true, 'Dataset consistency verified (no missing/duplicate numbers)');

  // ----------------------------------------------------
  // TEST GROUP 5: Development Endpoint Verification
  // ----------------------------------------------------
  console.log('\n🌐 GROUP 5: Development Endpoint POST /api/pyq/validate/:sourceId');

  const endpointRes = await fetch(`${API_BASE}/api/pyq/validate/gate-2024-cs-paper`, {
    method: 'POST',
  });
  const endpointData = await endpointRes.json();
  assert(endpointRes.status === 200, 'POST /api/pyq/validate/gate-2024-cs-paper returns 200');
  assert(endpointData.success === true, 'Endpoint returns success: true');
  assert(endpointData.data?.total === 65, 'Endpoint returns total: 65 questions');
  assert(endpointData.data?.valid === realValidation.valid, 'Endpoint valid count matches service output');

  // Test 404 on unregistered source
  const notFoundRes = await fetch(`${API_BASE}/api/pyq/validate/unknown-source-123`, {
    method: 'POST',
  });
  assert(notFoundRes.status === 404, 'Unregistered source returns 404');

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log(`📊 CHECKPOINT 2B TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
  if (failedTests > 0) {
    console.log(`❌ ${failedTests} TESTS FAILED`);
  } else {
    console.log('🎉 ALL CHECKPOINT 2B VERIFICATION TESTS PASSED!');
  }
  console.log('====================================================\n');
}

runCheckpoint2BTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
