/**
 * Central Configuration and Categories for AI Question Generation & Retries
 * Checkpoint 3C.6: Controlled Automatic Regeneration (ESM)
 */

export const MAX_GENERATION_ATTEMPTS = 3;

export const RETRY_CATEGORIES = {
  STRUCTURE_INVALID: 'STRUCTURE_INVALID',
  ANSWER_INCORRECT: 'ANSWER_INCORRECT',
  EXPLANATION_INCONSISTENT: 'EXPLANATION_INCONSISTENT',
  AMBIGUOUS: 'AMBIGUOUS',
  UNSOLVABLE: 'UNSOLVABLE',
  QUESTION_TYPE_INVALID: 'QUESTION_TYPE_INVALID',
  CONCEPT_MISMATCH: 'CONCEPT_MISMATCH',
  DIFFICULTY_MISMATCH: 'DIFFICULTY_MISMATCH',
  TOO_SIMILAR: 'TOO_SIMILAR',
};

/**
 * Formats concise, sanitized failure feedback for injection into the regeneration prompt.
 * Strictly prevents leaking chain-of-thought, internal stack traces, or raw error objects.
 */
export function formatRetryFeedback(details) {
  // Sanitize detail string: strip potential stack traces, limit length to 250 chars
  const sanitizedDetail = details.detail
    ? details.detail.replace(/\bat\s+[^\n]+/g, '').replace(/(\r\n|\n|\r)/gm, ' ').slice(0, 250).trim()
    : undefined;

  switch (details.category) {
    case RETRY_CATEGORIES.STRUCTURE_INVALID:
      return sanitizedDetail
        ? `[STRUCTURAL INTEGRITY] The previous candidate was rejected due to structural issues: ${sanitizedDetail}. Ensure schema rules are strictly followed.`
        : '[STRUCTURAL INTEGRITY] The previous candidate was rejected because question structure was malformed. Ensure exact schema rules are strictly followed.';

    case RETRY_CATEGORIES.ANSWER_INCORRECT:
      return '[CORRECTNESS] The previous candidate failed independent verification because the proposed answer did not match the independently derived solution. Independently construct a correct problem and verified solution.';

    case RETRY_CATEGORIES.EXPLANATION_INCONSISTENT:
      return '[EXPLANATION CONSISTENCY] The previous explanation was inconsistent with the proposed answer. Ensure the explanation rigorously and logically derives the exact proposed answer without contradictions.';

    case RETRY_CATEGORIES.AMBIGUOUS:
      return sanitizedDetail
        ? `[CLARITY & PRECISION] The previous question was rejected because multiple interpretations or correct answers were possible (${sanitizedDetail}). Make all assumptions explicit, define all symbols unambiguously, and ensure the correct answer is unique.`
        : '[CLARITY & PRECISION] The previous question was rejected because multiple interpretations or correct answers were possible. Make all assumptions explicit, define all symbols unambiguously, and ensure the correct answer is unique.';

    case RETRY_CATEGORIES.UNSOLVABLE:
      return '[SOLVABILITY] The previous candidate was determined to be mathematically unsolvable or missing essential boundary conditions. Formulate a fully solvable problem with complete parameters.';

    case RETRY_CATEGORIES.QUESTION_TYPE_INVALID:
      return '[QUESTION TYPE INTEGRITY] The previous candidate violated the format or constraints for the specified question type. Strictly follow the structural and answer rules for the requested question type.';

    case RETRY_CATEGORIES.CONCEPT_MISMATCH:
      return details.concept
        ? `[CONCEPT ALIGNMENT] The previous question did not adequately test the requested concept: "${details.concept}". Keep the next candidate specifically focused on this concept.`
        : '[CONCEPT ALIGNMENT] The previous question drifted from the requested concept. Keep the next candidate specifically focused on the requested concept and topic.';

    case RETRY_CATEGORIES.DIFFICULTY_MISMATCH:
      return details.difficulty
        ? `[DIFFICULTY CALIBRATION] The previous question did not match the requested difficulty: "${details.difficulty}". Adjust the depth of reasoning to match ${details.difficulty}.`
        : '[DIFFICULTY CALIBRATION] The previous question did not match the requested difficulty level. Adjust the depth of analytical reasoning accordingly.';

    case RETRY_CATEGORIES.TOO_SIMILAR:
      return details.sourceId
        ? `[ORIGINALITY WARNING] The previous candidate was too similar to official question ${details.sourceId}. Create a substantially different problem structure while testing the same underlying concept.`
        : '[ORIGINALITY WARNING] The previous candidate was too similar to an existing official GATE question. Create a substantially different problem structure while testing the same underlying concept.';

    default:
      return '[QUALITY VERIFICATION] The previous candidate failed quality verification. Create an original, unambiguous GATE CS question with a verified correct answer.';
  }
}
