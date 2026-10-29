import { pyqExtractionService } from './backend/src/services/pyqExtraction/pyqExtraction.service.js';

async function findRepresentativeQuestions() {
  const result = await pyqExtractionService.extractFromSource('gate-2024-cs-paper');
  console.log('Total:', result.totalCandidates);
  
  // Find figure dependent questions
  const figureQuestions = result.questions.filter(q => q.requiresFigure);
  console.log('\nFigure questions count:', figureQuestions.length);
  figureQuestions.forEach(q => {
    console.log(`- Q.${q.questionNumber} (p.${q.pageNumber}): ${q.rawQuestionText.slice(0, 100)}... [opts: ${q.rawOptions.length}]`);
  });

  // Search for TOC questions (language, grammar, regular, automata, Turing)
  const tocQuestions = result.questions.filter(q => 
    /\b(grammar|language|regular|DFA|NFA|Turing|context-free|PDA|automaton)\b/i.test(q.rawQuestionText)
  );
  console.log('\nTOC questions count:', tocQuestions.length);
  tocQuestions.forEach(q => {
    console.log(`- Q.${q.questionNumber} (p.${q.pageNumber}): ${q.rawQuestionText.slice(0, 100)}... [opts: ${q.rawOptions.length}]`);
  });

  // Search for Math / Discrete Math questions
  const mathQuestions = result.questions.filter(q =>
    /\b(matrix|eigenvalue|eigenvector|probability|graph|recurrence|log|permutation)\b/i.test(q.rawQuestionText)
  );
  console.log('\nMath questions count:', mathQuestions.length);
  mathQuestions.slice(0, 5).forEach(q => {
    console.log(`- Q.${q.questionNumber} (p.${q.pageNumber}): ${q.rawQuestionText.slice(0, 100)}... [opts: ${q.rawOptions.length}]`);
  });
}

findRepresentativeQuestions();
