import { pyqExtractionService } from './backend/src/services/pyqExtraction/pyqExtraction.service.js';

async function testRealExtraction() {
  console.log('Testing extraction from official GATE 2024 CS paper...');
  const result = await pyqExtractionService.extractFromSource('gate-2024-cs-paper');
  console.log('Extraction Summary:');
  console.log('Source:', result.source);
  console.log('Total Candidates Segmented:', result.totalCandidates);
  console.log('Requires Review Count:', result.requiresReview);
  console.log('Sample Questions (First 5):');
  for (let i = 0; i < Math.min(5, result.questions.length); i++) {
    const q = result.questions[i];
    console.log(`\n--- [Q.${q.questionNumber}] (Page ${q.pageNumber}, Marks: ${q.marks}) ---`);
    console.log(`Confidence: ${q.extractionConfidence}, RequiresReview: ${q.requiresReview}, RequiresFigure: ${q.requiresFigure}`);
    console.log(`Question Text: ${q.rawQuestionText.slice(0, 150)}...`);
    console.log(`Options Count: ${q.rawOptions.length}`);
    if (q.rawOptions.length > 0) {
      q.rawOptions.forEach((opt, idx) => console.log(`  (${String.fromCharCode(65 + idx)}) ${opt.slice(0, 80)}`));
    }
    if (q.notes) {
      console.log(`Notes: ${q.notes}`);
    }
  }
}

testRealExtraction().catch(console.error);
