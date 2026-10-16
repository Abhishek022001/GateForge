export function buildQuestionGenerationPrompt(context) {
  const subject = context.subject || 'Computer Science & Information Technology';
  const topic = context.topic || 'General Core Subject';
  const subtopic = context.subtopic || '';
  const questionType = (context.questionType || 'MCQ').toUpperCase();
  const difficulty = context.difficulty || 'Medium';
  const cognitiveSkill = context.cognitiveSkill || 'apply';
  const conceptsList = Array.isArray(context.concepts) && context.concepts.length > 0
    ? context.concepts.join(', ')
    : 'Core syllabus principles';
  const reasoningList = Array.isArray(context.reasoningType) && context.reasoningType.length > 0
    ? context.reasoningType.join(', ')
    : 'analytical, conceptual';
  const questionPattern = context.questionPattern || 'Evaluate conceptual integrity and multi-step analytical problem solving.';

  // Streamlined Reference PYQ Section
  let pyqSection = '';
  if (Array.isArray(context.relevantPYQs) && context.relevantPYQs.length > 0) {
    const formattedPYQs = context.relevantPYQs.map((pyq, idx) => {
      const opts = pyq.options && pyq.options.length > 0
        ? pyq.options.map((o) => `(${o.id}) ${o.text}`).join(' | ')
        : '';
      const ans = Array.isArray(pyq.correctAnswer) ? pyq.correctAnswer.join(', ') : String(pyq.correctAnswer || '');
      return `[PYQ ${idx + 1}] (${pyq.id || 'GATE'}) ${pyq.subject || ''} > ${pyq.topic || ''} [Diff: ${pyq.difficulty || 'Medium'}]
Concepts: ${Array.isArray(pyq.concepts) ? pyq.concepts.join(', ') : 'N/A'} | Pattern: ${pyq.questionPattern || 'Analytical problem solving'}
Question: ${pyq.question || ''}${opts ? `\nOptions: ${opts}` : ''}${ans ? `\nAnswer: ${ans}` : ''}`;
    }).join('\n\n');

    pyqSection = `
REFERENCE GATE PYQs (Use strictly as conceptual & rigor benchmarks, NOT templates):
${formattedPYQs}

ORIGINALITY MANDATE:
- Formulate a completely NEW problem from first principles testing the target concepts.
- Do NOT clone, copy, or minimally rephrase reference PYQs. Use fresh parameters, values, and scenarios.
`;
  }

  // Type-specific formatting instructions
  let typeInstructions = '';
  if (questionType === 'MCQ') {
    typeInstructions = `QUESTION TYPE: MCQ (Multiple Choice)
- Provide exactly 4 options labeled "A", "B", "C", "D".
- Exactly ONE option must be correct. Provide 3 plausible distractors.
- "correctAnswer" must be the single option letter matching the correct option.`;
  } else if (questionType === 'MSQ') {
    typeInstructions = `QUESTION TYPE: MSQ (Multiple Select)
- Provide exactly 4 options labeled "A", "B", "C", "D".
- ONE OR MORE options can be correct (1, 2, 3, or all 4).
- In the explanation, explicitly evaluate each option (A, B, C, D) and state whether it is TRUE or FALSE.
- "correctAnswer" array MUST contain ALL and ONLY the option letters that your explanation marks as TRUE (e.g. ["B", "C"]).`;
  } else if (questionType === 'NAT') {
    typeInstructions = `QUESTION TYPE: NAT (Numerical Answer Type)
- "options" must be an empty array [].
- "correctAnswer" must be the exact numerical value that your derivation calculates (integer or decimal).
- State rounding/precision instructions clearly in the question text if non-integer.`;
  }

  let retrySection = '';
  if (context.retryFeedback && context.retryFeedback.trim()) {
    retrySection = `
PREVIOUS ATTEMPT FEEDBACK (CORRECTIVE ACTION REQUIRED):
${context.retryFeedback.trim()}
Construct a fresh, completely original problem that avoids this specific failure.
`;
  }

  return `You are a Senior Item Writer for the GATE Computer Science Examination. Author an ORIGINAL, HIGH-YIELD GATE CS question.

TARGET SPECIFICATIONS:
- Subject: ${subject}
- Topic: ${topic}${subtopic ? ` (${subtopic})` : ''}
- Target Concepts: ${conceptsList}
- Archetype: ${questionPattern}
- Question Type: ${questionType}
- Target Difficulty: ${difficulty}
- Cognitive Skill: ${cognitiveSkill}
- Reasoning Style: ${reasoningList}
${retrySection}${pyqSection}
AUTHORING GUIDELINES:
1. RIGOR: Test deep theoretical understanding and multi-step derivations. Avoid shallow recall.
2. LATEX MATH: Use $...$ for inline expressions (e.g. $O(n \\log n)$, $\\lambda = 4$) and $$...$$ for display equations. Ensure proper escaping for JSON strings.
3. INDEPENDENT SOLVABILITY: State all parameters, conventions, and boundary conditions unambiguously.
4. EXPLANATION: Provide a step-by-step mathematical proof/derivation.

${typeInstructions}

OUTPUT FORMAT:
Return ONLY a valid JSON object matching this schema:
{
  "question": "Problem statement with LaTeX math notation ($...$ or $$...$$)",
  "questionType": "${questionType}",
  "options": [
    { "id": "A", "text": "Option A" },
    { "id": "B", "text": "Option B" },
    { "id": "C", "text": "Option C" },
    { "id": "D", "text": "Option D" }
  ],
  "correctAnswer": ${questionType === 'MSQ' ? '["A", "C"]' : questionType === 'NAT' ? '12.5' : '"B"'},
  "explanation": "Step-by-step derivation with LaTeX formatting",
  "subject": "${subject}",
  "topic": "${topic}",
  "subtopic": "${subtopic}",
  "concepts": ["${conceptsList.split(', ')[0] || topic}"],
  "reasoningType": ["${reasoningList.split(', ')[0] || 'analytical'}"],
  "difficulty": "${difficulty}"
}`;
}
