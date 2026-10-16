const VALID_COGNITIVE_SKILLS = new Set(['recall', 'understand', 'apply', 'analyze', 'evaluate']);
const VALID_DIFFICULTIES = new Set(['Easy', 'Medium', 'Hard']);
const GENERIC_CONCEPTS = new Set(['computer science', 'cs', 'gate', 'engineering', 'mcq', 'nat', 'msq']);

export function validateAnalysisQuality(data) {
  const issues = [];

  const concepts = Array.isArray(data.concepts)
    ? data.concepts.map((c) => String(c).trim().toLowerCase()).filter(Boolean)
    : [];

  if (concepts.length < 2) {
    issues.push('At least 2 specific concepts required.');
  } else if (concepts.some((c) => GENERIC_CONCEPTS.has(c))) {
    issues.push('Concepts are too generic (e.g. ["Computer Science"]). Specific granular concepts required.');
  }

  if (data.topic && typeof data.topic === 'string') {
    const t = data.topic.trim().toLowerCase();
    if (GENERIC_CONCEPTS.has(t) || t.length < 3) {
      issues.push(`Topic "${data.topic}" is too generic or short. Specific curriculum topic required.`);
    }
  }

  if (data.questionPattern && typeof data.questionPattern === 'string') {
    const qp = data.questionPattern.trim();
    if (qp.length < 15 || /^(answer|solve|calculate|find)\s+(the\s+)?(question|problem|answer)$/i.test(qp)) {
      issues.push(`Question pattern "${qp}" is too brief or generic. Must describe problem archetype.`);
    }
  }

  return {
    isSpecific: issues.length === 0,
    isValid: issues.length === 0,
    issues,
  };
}

export function validateAIAnalysis(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: ['AI output is not a valid JSON object.'] };
  }

  if (!Array.isArray(data.concepts) || data.concepts.length === 0) {
    errors.push('Field "concepts" must be a non-empty array of strings.');
  }

  if (data.subConcepts !== undefined && !Array.isArray(data.subConcepts)) {
    errors.push('Field "subConcepts" must be an array of strings.');
  }

  if (!Array.isArray(data.reasoningType) || data.reasoningType.length === 0) {
    errors.push('Field "reasoningType" must be a non-empty array of strings.');
  }

  const rawSkill = String(data.cognitiveSkill || '').toLowerCase().trim();
  if (!VALID_COGNITIVE_SKILLS.has(rawSkill)) {
    errors.push(`Field "cognitiveSkill" must be one of: recall, understand, apply, analyze, evaluate.`);
  }

  if (!data.questionPattern || typeof data.questionPattern !== 'string' || !data.questionPattern.trim()) {
    errors.push('Field "questionPattern" must be a non-empty string describing the problem archetype.');
  }

  if (!data.solutionApproach || typeof data.solutionApproach !== 'string' || !data.solutionApproach.trim()) {
    errors.push('Field "solutionApproach" must be a non-empty string describing the strategy.');
  }

  const rawDiff = String(data.difficultyAssessment || '').trim();
  const normalizedDiff = rawDiff.charAt(0).toUpperCase() + rawDiff.slice(1).toLowerCase();
  if (!VALID_DIFFICULTIES.has(normalizedDiff)) {
    errors.push('Field "difficultyAssessment" must be "Easy", "Medium", or "Hard".');
  }

  if (data.distractorPatterns !== undefined && !Array.isArray(data.distractorPatterns)) {
    errors.push('Field "distractorPatterns" must be an array of strings.');
  }

  if (data.commonTraps !== undefined && !Array.isArray(data.commonTraps)) {
    errors.push('Field "commonTraps" must be an array of strings.');
  }

  if (data.requiredKnowledge !== undefined && !Array.isArray(data.requiredKnowledge)) {
    errors.push('Field "requiredKnowledge" must be an array of strings.');
  }

  if (data.gateCharacteristics !== undefined && !Array.isArray(data.gateCharacteristics)) {
    errors.push('Field "gateCharacteristics" must be an array of strings.');
  }

  const quality = validateAnalysisQuality(data);
  if (!quality.isSpecific) {
    errors.push(...quality.issues);
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    sanitized: {
      subject: typeof data.subject === 'string' && data.subject.trim() ? data.subject.trim() : undefined,
      topic: typeof data.topic === 'string' && data.topic.trim() ? data.topic.trim() : undefined,
      subtopic: typeof data.subtopic === 'string' && data.subtopic.trim() ? data.subtopic.trim() : undefined,
      concepts: (data.concepts || []).map((c) => String(c).trim()).filter(Boolean),
      subConcepts: (data.subConcepts || []).map((s) => String(s).trim()).filter(Boolean),
      reasoningType: (data.reasoningType || []).map((r) => String(r).toLowerCase().trim()).filter(Boolean),
      cognitiveSkill: rawSkill,
      questionPattern: String(data.questionPattern).trim(),
      solutionApproach: String(data.solutionApproach).trim(),
      difficultyAssessment: normalizedDiff,
      distractorPatterns: (data.distractorPatterns || []).map((d) => String(d).trim()).filter(Boolean),
      commonTraps: (data.commonTraps || []).map((t) => String(t).trim()).filter(Boolean),
      requiredKnowledge: (data.requiredKnowledge || []).map((k) => String(k).trim()).filter(Boolean),
      gateCharacteristics: (data.gateCharacteristics || []).map((g) => String(g).trim()).filter(Boolean),
    },
  };
}
