import { DIFFICULTY_LEVELS, QUESTION_TYPES, SOURCE_TYPES } from '../constants/taxonomy.js';

export function validateAndNormalizeQuestion(raw, index) {
  const errors = [];

  if (!raw || typeof raw !== 'object') {
    return { isValid: false, errors: ['Record must be a valid JSON object.'] };
  }

  // 1. Question text
  const questionText = typeof raw.question === 'string' ? raw.question.trim() : '';
  if (!questionText) {
    errors.push('Field "question" is required and cannot be empty.');
  }

  // 2. Subject
  const subject = typeof raw.subject === 'string' ? raw.subject.trim() : '';
  if (!subject) {
    errors.push('Field "subject" is required and cannot be empty.');
  }

  // 3. Topic
  const topic = typeof raw.topic === 'string' ? raw.topic.trim() : '';
  if (!topic) {
    errors.push('Field "topic" is required and cannot be empty.');
  }

  const subtopic = typeof raw.subtopic === 'string' ? raw.subtopic.trim() : undefined;

  // 4. Question Type
  let questionType = raw.questionType;
  if (!questionType || !QUESTION_TYPES.includes(questionType)) {
    errors.push(`Field "questionType" must be one of: ${QUESTION_TYPES.join(', ')}.`);
  }

  // 5. Difficulty
  let difficulty = typeof raw.difficulty === 'string' ? raw.difficulty.trim() : 'Medium';
  if (!DIFFICULTY_LEVELS.includes(difficulty)) {
    difficulty = 'Medium';
  }

  // 6. Concepts array
  let concepts = [];
  if (Array.isArray(raw.concepts)) {
    concepts = raw.concepts
      .map((c) => (typeof c === 'string' ? c.trim() : String(c)))
      .filter(Boolean);
  } else if (typeof raw.concepts === 'string' && raw.concepts.trim()) {
    concepts = raw.concepts
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
  }

  // 7. Reasoning Type
  let reasoningType = [];
  if (Array.isArray(raw.reasoningType)) {
    reasoningType = raw.reasoningType
      .map((r) => (typeof r === 'string' ? r.trim().toLowerCase() : String(r)))
      .filter(Boolean);
  } else if (typeof raw.reasoningType === 'string' && raw.reasoningType.trim()) {
    reasoningType = raw.reasoningType
      .split(',')
      .map((r) => r.trim().toLowerCase())
      .filter(Boolean);
  }

  // 8. Options handling
  let options = [];
  if (Array.isArray(raw.options)) {
    options = raw.options.map((opt, optIdx) => {
      if (typeof opt === 'string') {
        const id = String.fromCharCode(65 + optIdx); // A, B, C, D...
        return { id, text: opt.trim() };
      } else if (opt && typeof opt === 'object') {
        const id = typeof opt.id === 'string' ? opt.id.trim().toUpperCase() : String.fromCharCode(65 + optIdx);
        const text = typeof opt.text === 'string' ? opt.text.trim() : String(opt);
        return { id, text };
      }
      return { id: String.fromCharCode(65 + optIdx), text: String(opt) };
    });
  }

  // 9. Explanation
  const explanation = typeof raw.explanation === 'string' ? raw.explanation.trim() : '';
  if (!explanation) {
    errors.push('Field "explanation" is required for step-by-step solution derivation.');
  }

  // 10. Type-Specific Validation
  let correctAnswer = raw.correctAnswer;
  let numericalAnswer = typeof raw.numericalAnswer === 'number' ? raw.numericalAnswer : undefined;
  let numericalTolerance = typeof raw.numericalTolerance === 'number' ? raw.numericalTolerance : 0.01;

  if (questionType === 'MCQ') {
    if (!options || options.length < 2) {
      errors.push('MCQ questions must have at least 2 options.');
    }
    if (correctAnswer === undefined || correctAnswer === null || correctAnswer === '') {
      errors.push('MCQ questions must have a defined "correctAnswer" (e.g. "A", "B", "C", "D").');
    } else {
      correctAnswer = String(correctAnswer).trim().toUpperCase();
      const validOptionIds = options.map((o) => o.id.toUpperCase());
      if (validOptionIds.length > 0 && !validOptionIds.includes(correctAnswer)) {
        const matchedOpt = options.find((o) => o.text.trim().toLowerCase() === String(raw.correctAnswer).trim().toLowerCase());
        if (matchedOpt) {
          correctAnswer = matchedOpt.id;
        } else {
          errors.push(`MCQ correctAnswer "${correctAnswer}" does not match any valid option ID (${validOptionIds.join(', ')}).`);
        }
      }
    }
  } else if (questionType === 'MSQ') {
    if (!options || options.length < 2) {
      errors.push('MSQ questions must have at least 2 options.');
    }
    let msqAnswers = [];
    if (Array.isArray(correctAnswer)) {
      msqAnswers = correctAnswer.map((a) => String(a).trim().toUpperCase());
    } else if (typeof correctAnswer === 'string' && correctAnswer.trim()) {
      msqAnswers = correctAnswer.split(',').map((a) => a.trim().toUpperCase());
    }

    if (msqAnswers.length === 0) {
      errors.push('MSQ questions must have at least one correct answer option in "correctAnswer" array.');
    } else {
      const validOptionIds = options.map((o) => o.id.toUpperCase());
      const invalidKeys = msqAnswers.filter((a) => !validOptionIds.includes(a));
      if (invalidKeys.length > 0) {
        errors.push(`MSQ correctAnswer contains invalid option ID(s): ${invalidKeys.join(', ')}.`);
      }
      correctAnswer = Array.from(new Set(msqAnswers)).sort();
    }
  } else if (questionType === 'NAT') {
    options = [];
    const candidateVal = raw.numericalAnswer !== undefined ? raw.numericalAnswer : raw.correctAnswer;
    const parsedNum = parseFloat(String(candidateVal));

    if (isNaN(parsedNum)) {
      errors.push('NAT questions must contain a valid numerical answer in "correctAnswer" or "numericalAnswer".');
    } else {
      numericalAnswer = parsedNum;
      correctAnswer = parsedNum;
    }
    if (typeof raw.tolerance === 'number') {
      numericalTolerance = raw.tolerance;
    }
  }

  // 11. Source & Provenance
  const sourceRaw = raw.source && typeof raw.source === 'object' ? raw.source : {};
  let sourceType = typeof sourceRaw.type === 'string' ? sourceRaw.type.toUpperCase() : 'MANUAL';
  if (!SOURCE_TYPES.includes(sourceType)) {
    sourceType = 'MANUAL';
  }

  const source = {
    type: sourceType,
    exam: sourceRaw.exam || raw.exam || 'GATE',
    year: sourceRaw.year || raw.year || 2024,
    paper: sourceRaw.paper || raw.paper || 'CS',
    questionNumber: typeof sourceRaw.questionNumber === 'number' ? sourceRaw.questionNumber : raw.questionNumber,
    notes: sourceRaw.notes,
  };

  const id = raw.id && typeof raw.id === 'string'
    ? raw.id.trim()
    : `gate-${subject.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const year = raw.year || source.year || 2024;
  const exam = raw.exam || source.exam || 'GATE CS';
  const paper = raw.paper || source.paper || 'CS';
  const questionNumber = typeof raw.questionNumber === 'number' ? raw.questionNumber : source.questionNumber;

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  const normalized = {
    id,
    question: questionText,
    subject,
    topic,
    subtopic,
    concepts,
    year,
    exam,
    paper,
    questionNumber,
    questionType,
    difficulty,
    options,
    correctAnswer,
    explanation,
    numericalAnswer,
    numericalTolerance,
    source,
    reasoningType,
  };

  return { isValid: true, errors: [], normalized };
}
