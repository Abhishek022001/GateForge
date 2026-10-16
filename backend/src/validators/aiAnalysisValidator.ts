import { IAIAnalysis, CognitiveSkill, DifficultyLevel } from '../types/question.types.js';

export interface IAIAnalysisValidationResult {
  isValid: boolean;
  errors: string[];
  sanitized?: Omit<IAIAnalysis, 'analyzed' | 'analysisVersion' | 'analyzedAt'>;
}

const VALID_COGNITIVE_SKILLS = new Set<string>(['recall', 'understand', 'apply', 'analyze', 'evaluate']);
const VALID_DIFFICULTIES = new Set<string>(['Easy', 'Medium', 'Hard']);
const GENERIC_CONCEPTS = new Set<string>(['computer science', 'cs', 'gate', 'engineering', 'mcq', 'nat', 'msq']);

export function validateAnalysisQuality(data: any): { isSpecific: boolean; isValid: boolean; issues: string[] } {
  const issues: string[] = [];

  // 1. Concepts Specificity
  const concepts = Array.isArray(data.concepts)
    ? data.concepts.map((c: any) => String(c).trim().toLowerCase()).filter(Boolean)
    : [];

  if (concepts.length < 2) {
    issues.push('At least 2 specific concepts required.');
  } else if (concepts.some((c: string) => GENERIC_CONCEPTS.has(c))) {
    issues.push('Concepts are too generic (e.g. ["Computer Science"]). Specific granular concepts required.');
  }

  // 2. Topic Specificity
  if (data.topic && typeof data.topic === 'string') {
    const t = data.topic.trim().toLowerCase();
    if (GENERIC_CONCEPTS.has(t) || t.length < 3) {
      issues.push(`Topic "${data.topic}" is too generic or short. Specific curriculum topic required.`);
    }
  }

  // 3. Question Pattern Specificity
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

export function validateAIAnalysis(data: any): IAIAnalysisValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: ['AI output is not a valid JSON object.'] };
  }

  // 1. Concepts
  if (!Array.isArray(data.concepts) || data.concepts.length === 0) {
    errors.push('Field "concepts" must be a non-empty array of strings.');
  }

  // 2. Sub-concepts
  if (data.subConcepts !== undefined && !Array.isArray(data.subConcepts)) {
    errors.push('Field "subConcepts" must be an array of strings.');
  }

  // 3. Reasoning Type
  if (!Array.isArray(data.reasoningType) || data.reasoningType.length === 0) {
    errors.push('Field "reasoningType" must be a non-empty array of strings.');
  }

  // 4. Cognitive Skill
  const rawSkill = String(data.cognitiveSkill || '').toLowerCase().trim();
  if (!VALID_COGNITIVE_SKILLS.has(rawSkill)) {
    errors.push(`Field "cognitiveSkill" must be one of: recall, understand, apply, analyze, evaluate.`);
  }

  // 5. Question Pattern
  if (!data.questionPattern || typeof data.questionPattern !== 'string' || !data.questionPattern.trim()) {
    errors.push('Field "questionPattern" must be a non-empty string describing the problem archetype.');
  }

  // 6. Solution Approach
  if (!data.solutionApproach || typeof data.solutionApproach !== 'string' || !data.solutionApproach.trim()) {
    errors.push('Field "solutionApproach" must be a non-empty string describing the strategy.');
  }

  // 7. Difficulty Assessment
  const rawDiff = String(data.difficultyAssessment || '').trim();
  const normalizedDiff = rawDiff.charAt(0).toUpperCase() + rawDiff.slice(1).toLowerCase();
  if (!VALID_DIFFICULTIES.has(normalizedDiff)) {
    errors.push('Field "difficultyAssessment" must be "Easy", "Medium", or "Hard".');
  }

  // 8. Distractor Patterns
  if (data.distractorPatterns !== undefined && !Array.isArray(data.distractorPatterns)) {
    errors.push('Field "distractorPatterns" must be an array of strings.');
  }

  // 9. Common Traps
  if (data.commonTraps !== undefined && !Array.isArray(data.commonTraps)) {
    errors.push('Field "commonTraps" must be an array of strings.');
  }

  // 10. Required Knowledge
  if (data.requiredKnowledge !== undefined && !Array.isArray(data.requiredKnowledge)) {
    errors.push('Field "requiredKnowledge" must be an array of strings.');
  }

  // 11. GATE Characteristics
  if (data.gateCharacteristics !== undefined && !Array.isArray(data.gateCharacteristics)) {
    errors.push('Field "gateCharacteristics" must be an array of strings.');
  }

  // Quality Guard Check
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
      concepts: (data.concepts || []).map((c: any) => String(c).trim()).filter(Boolean),
      subConcepts: (data.subConcepts || []).map((s: any) => String(s).trim()).filter(Boolean),
      reasoningType: (data.reasoningType || []).map((r: any) => String(r).toLowerCase().trim()).filter(Boolean),
      cognitiveSkill: rawSkill as CognitiveSkill,
      questionPattern: String(data.questionPattern).trim(),
      solutionApproach: String(data.solutionApproach).trim(),
      difficultyAssessment: normalizedDiff as DifficultyLevel,
      distractorPatterns: (data.distractorPatterns || []).map((d: any) => String(d).trim()).filter(Boolean),
      commonTraps: (data.commonTraps || []).map((t: any) => String(t).trim()).filter(Boolean),
      requiredKnowledge: (data.requiredKnowledge || []).map((k: any) => String(k).trim()).filter(Boolean),
      gateCharacteristics: (data.gateCharacteristics || []).map((g: any) => String(g).trim()).filter(Boolean),
    },
  };
}
