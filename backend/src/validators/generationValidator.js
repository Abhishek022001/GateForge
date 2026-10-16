/**
 * Deterministic Structural Validator for AI-Generated GATE Questions (JS Implementation)
 * Validates MCQ, MSQ, and NAT questions against GATE schema requirements.
 */

export function validateGeneratedQuestionStructure(question, expectedType) {
  const errors = [];

  if (!question || typeof question !== 'object') {
    return { isValid: false, errors: ['Generated question must be a valid JSON object.'] };
  }

  // 1. Universal Question Fields
  if (!question.question || typeof question.question !== 'string' || question.question.trim().length < 10) {
    errors.push('Field "question" must be a non-empty string with at least 10 characters.');
  }

  if (!question.subject || typeof question.subject !== 'string' || !question.subject.trim()) {
    errors.push('Field "subject" must be a non-empty string.');
  }

  if (!question.topic || typeof question.topic !== 'string' || !question.topic.trim()) {
    errors.push('Field "topic" must be a non-empty string.');
  }

  if (!question.explanation || typeof question.explanation !== 'string' || question.explanation.trim().length < 10) {
    errors.push('Field "explanation" must be a non-empty string with at least 10 characters.');
  }

  const validDifficulties = new Set(['Easy', 'Medium', 'Hard']);
  if (!question.difficulty || !validDifficulties.has(question.difficulty)) {
    errors.push('Field "difficulty" must be one of: "Easy", "Medium", "Hard".');
  }

  if (!Array.isArray(question.concepts) || question.concepts.length === 0) {
    errors.push('Field "concepts" must be a non-empty array of strings.');
  }

  const validTypes = new Set(['MCQ', 'MSQ', 'NAT']);
  const targetType = (question.questionType || expectedType || '').toUpperCase();
  if (!validTypes.has(targetType)) {
    errors.push('Field "questionType" must be one of: "MCQ", "MSQ", "NAT".');
  }

  if (expectedType && targetType !== expectedType.toUpperCase()) {
    errors.push(`Generated questionType "${targetType}" does not match requested type "${expectedType}".`);
  }

  // 2. Type-Specific Validation Rules
  if (targetType === 'MCQ') {
    // Exactly 4 options
    if (!Array.isArray(question.options) || question.options.length !== 4) {
      errors.push(`MCQ must have exactly 4 options. Found: ${Array.isArray(question.options) ? question.options.length : 0}.`);
    } else {
      const optionIds = new Set();
      for (const opt of question.options) {
        if (!opt || typeof opt !== 'object' || !opt.id || !opt.text || !String(opt.text).trim()) {
          errors.push('Each MCQ option must be an object with non-empty "id" and "text".');
        } else {
          optionIds.add(String(opt.id).toUpperCase());
        }
      }

      // Exactly one correct answer mapping to an option
      if (!question.correctAnswer || typeof question.correctAnswer !== 'string') {
        errors.push('MCQ "correctAnswer" must be a single string option ID (e.g. "A", "B", "C", "D").');
      } else {
        const ansId = question.correctAnswer.trim().toUpperCase();
        if (!optionIds.has(ansId)) {
          errors.push(`MCQ correctAnswer "${ansId}" does not match any existing option ID (${Array.from(optionIds).join(', ')}).`);
        }
      }
    }
  } else if (targetType === 'MSQ') {
    // Exactly 4 options
    if (!Array.isArray(question.options) || question.options.length !== 4) {
      errors.push(`MSQ must have exactly 4 options. Found: ${Array.isArray(question.options) ? question.options.length : 0}.`);
    } else {
      const optionIds = new Set();
      for (const opt of question.options) {
        if (!opt || typeof opt !== 'object' || !opt.id || !opt.text || !String(opt.text).trim()) {
          errors.push('Each MSQ option must be an object with non-empty "id" and "text".');
        } else {
          optionIds.add(String(opt.id).toUpperCase());
        }
      }

      // One or more correct answers, all mapping to existing options
      let answers = [];
      if (Array.isArray(question.correctAnswer)) {
        answers = question.correctAnswer.map((a) => String(a).trim().toUpperCase()).filter(Boolean);
      } else if (typeof question.correctAnswer === 'string') {
        answers = question.correctAnswer.split(/[,;\s]+/).map((a) => a.trim().toUpperCase()).filter(Boolean);
      }

      if (answers.length === 0) {
        errors.push('MSQ "correctAnswer" must contain at least one valid option ID.');
      } else {
        for (const ansId of answers) {
          if (!optionIds.has(ansId)) {
            errors.push(`MSQ correctAnswer "${ansId}" does not match any existing option ID (${Array.from(optionIds).join(', ')}).`);
          }
        }
      }
    }
  } else if (targetType === 'NAT') {
    // No selectable options
    if (Array.isArray(question.options) && question.options.length > 0) {
      errors.push('NAT question must NOT have selectable options. Expected empty array or undefined.');
    }

    // Valid numerical answer or range
    const ans = question.correctAnswer;
    const numAns = question.numericalAnswer;

    let hasValidNumber = false;

    if (typeof ans === 'number' && !isNaN(ans)) {
      hasValidNumber = true;
    } else if (typeof ans === 'string' && ans.trim() && !isNaN(Number(ans.trim()))) {
      hasValidNumber = true;
    } else if (numAns && typeof numAns === 'object') {
      if (typeof numAns.min === 'number' && typeof numAns.max === 'number' && numAns.min <= numAns.max) {
        hasValidNumber = true;
      }
    }

    if (!hasValidNumber) {
      errors.push('NAT question must have a valid numerical "correctAnswer" or valid "numericalAnswer" range ({min, max}).');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
