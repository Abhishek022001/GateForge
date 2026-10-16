export const GATE_CS_SUBJECTS = [
  'Engineering Mathematics',
  'Discrete Mathematics',
  'Data Structures',
  'Algorithms',
  'Programming',
  'Digital Logic',
  'Computer Organization and Architecture',
  'Operating Systems',
  'DBMS',
  'Computer Networks',
  'Theory of Computation',
  'Compiler Design',
] as const;

export type GateCsSubject = typeof GATE_CS_SUBJECTS[number];

export const QUESTION_TYPES = ['MCQ', 'MSQ', 'NAT'] as const;
export type QuestionType = typeof QUESTION_TYPES[number];

export const DIFFICULTY_LEVELS = ['Easy', 'Medium', 'Hard'] as const;
export type DifficultyLevel = typeof DIFFICULTY_LEVELS[number];

export const SOURCE_TYPES = ['PYQ', 'AI_GENERATED', 'MANUAL', 'PRACTICE'] as const;
export type SourceType = typeof SOURCE_TYPES[number];

export const REASONING_TYPES = [
  'conceptual',
  'numerical',
  'logical',
  'analytical',
  'code-tracing',
  'proof-based',
  'calculation',
] as const;
export type ReasoningType = typeof REASONING_TYPES[number];
