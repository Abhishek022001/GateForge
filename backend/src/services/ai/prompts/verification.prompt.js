/**
 * Verification Prompt for Independent AI Question Verification
 * Checkpoint 3C.4: Second-stage semantic verifier (ESM)
 */

export function buildQuestionVerificationPrompt(payload) {
  const optionsText = Array.isArray(payload.options) && payload.options.length > 0
    ? payload.options.map((o) => `  (${o.id}) ${o.text}`).join('\n')
    : '(None - NAT)';

  const proposedAnswerText = Array.isArray(payload.correctAnswer)
    ? `[${payload.correctAnswer.join(', ')}]`
    : typeof payload.correctAnswer === 'object' && payload.correctAnswer !== null
      ? JSON.stringify(payload.correctAnswer)
      : String(payload.correctAnswer ?? 'N/A');

  const conceptsText = Array.isArray(payload.concepts) && payload.concepts.length > 0
    ? payload.concepts.join(', ')
    : 'N/A';

  return `You are a GATE Computer Science professor and technical auditor. Independently verify this candidate question.

INSTRUCTIONS:
1. INDEPENDENT SOLVING: Solve the question from first principles first to compute your independent answer before evaluating the candidate's proposed answer.
2. CRITERIA:
   - MCQ: Exactly one option must be unambiguously correct.
   - MSQ: Complete, exact set of all correct options (no missing, no extra).
   - NAT: Definite numerical answer/range provable from given data.
   - Ambiguity: No unstated conventions, multiple interpretations, or conflicting terms.
   - Concept Match: True if it tests the requested topic or a legitimate prerequisite within the same subject. False ONLY for serious topic drift.
   - Difficulty: Assess actual difficulty in "verifiedDifficulty" ('Easy'|'Medium'|'Hard'). Note: "difficultyMatch" is advisory and does NOT invalidate an otherwise mathematically correct question.
3. SMART EXPLANATION REPAIR:
   - If the candidate is solvable, answer is correct, type is valid, concept matches, and unambiguous, BUT the explanation has minor flaws, typos, or omissions:
     Provide a concise, rigorous step-by-step derivation in "correctedExplanation". The system will repair the explanation in-place without discarding the question.
   - If candidate explanation is already sound, set "correctedExplanation": null.

CANDIDATE QUESTION:
${payload.question}

Type: ${payload.questionType}
Options:
${optionsText}
Proposed Answer: ${proposedAnswerText}${payload.numericalAnswer ? ` (Range: min=${payload.numericalAnswer.min}, max=${payload.numericalAnswer.max})` : ''}
Supplied Explanation: ${payload.explanation}

Requested Context: Subject: ${payload.subject} | Topic: ${payload.topic}${payload.subtopic ? ` (${payload.subtopic})` : ''} | Concepts: ${conceptsText} | Difficulty: ${payload.difficulty || 'Medium'}

Return ONLY valid JSON matching this schema:
{
  "valid": true,
  "questionSolvable": true,
  "answerCorrect": true,
  "explanationConsistent": true,
  "conceptMatch": true,
  "questionTypeValid": true,
  "ambiguityDetected": false,
  "difficultyMatch": true,
  "issues": [],
  "independentAnswer": "A",
  "confidence": 0.95,
  "correctedExplanation": null,
  "verifiedDifficulty": "Medium"
}

NOTE on "valid":
"valid" is true IF AND ONLY IF:
questionSolvable === true AND
answerCorrect === true AND
(explanationConsistent === true OR (typeof correctedExplanation === 'string' && correctedExplanation.length >= 15)) AND
conceptMatch === true AND
questionTypeValid === true AND
ambiguityDetected === false`;
}
