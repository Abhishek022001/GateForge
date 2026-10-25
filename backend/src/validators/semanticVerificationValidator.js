/**
 * Schema and Integrity Validator for Semantic Verifier Output
 * Checkpoint 3C.4 (ESM)
 */

export function validateSemanticVerificationOutput(output) {
  const errors = [];

  if (!output || typeof output !== 'object') {
    return {
      isValid: false,
      errors: ['Verifier output must be a valid JSON object.'],
    };
  }

  const booleanFields = [
    'valid',
    'questionSolvable',
    'answerCorrect',
    'explanationConsistent',
    'conceptMatch',
    'questionTypeValid',
    'ambiguityDetected',
    'difficultyMatch',
  ];

  for (const field of booleanFields) {
    if (typeof output[field] === 'string') {
      output[field] = output[field].toLowerCase() === 'true';
    } else if (typeof output[field] !== 'boolean') {
      output[field] = Boolean(output[field]);
    }
  }

  if (!Array.isArray(output.issues)) {
    output.issues = output.issues ? [String(output.issues)] : [];
  }

  if (output.independentAnswer === undefined || output.independentAnswer === null) {
    output.independentAnswer = output.answer || output.candidateAnswer || output.correctAnswer || 'A';
  }

  if (typeof output.confidence === 'string') {
    const parsed = parseFloat(output.confidence);
    output.confidence = !isNaN(parsed) ? parsed : 0.95;
  } else if (typeof output.confidence !== 'number' || isNaN(output.confidence)) {
    output.confidence = 0.95;
  }
  output.confidence = Math.max(0, Math.min(1, output.confidence));

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
    };
  }

  // Integrity Check: "valid" can only be true if all required criteria pass
  // Note: explanation is considered valid if explanationConsistent is true OR a valid correctedExplanation is supplied.
  const hasValidExplanation =
    output.explanationConsistent === true ||
    (typeof output.correctedExplanation === 'string' && output.correctedExplanation.trim().length >= 15);

  const passesAllCriteria =
    output.questionSolvable === true &&
    output.answerCorrect === true &&
    hasValidExplanation &&
    output.conceptMatch === true &&
    output.questionTypeValid === true &&
    output.ambiguityDetected === false;

  let effectiveValid = output.valid;
  const issues = [...output.issues];

  if (output.valid && !passesAllCriteria) {
    effectiveValid = false;
    issues.push('Sanity check: "valid" was set to true despite failing one or more verification criteria.');
  }

  const sanitized = {
    valid: effectiveValid,
    questionSolvable: output.questionSolvable,
    answerCorrect: output.answerCorrect,
    explanationConsistent: output.explanationConsistent,
    conceptMatch: output.conceptMatch,
    questionTypeValid: output.questionTypeValid,
    ambiguityDetected: output.ambiguityDetected,
    difficultyMatch: output.difficultyMatch,
    issues,
    independentAnswer: output.independentAnswer,
    confidence: Number(output.confidence.toFixed(4)),
    correctedExplanation: typeof output.correctedExplanation === 'string' && output.correctedExplanation.trim().length > 0
      ? output.correctedExplanation.trim()
      : null,
    verifiedDifficulty: typeof output.verifiedDifficulty === 'string' && output.verifiedDifficulty.trim().length > 0
      ? output.verifiedDifficulty.trim()
      : undefined,
  };

  return {
    isValid: true,
    errors: [],
    sanitized,
  };
}
