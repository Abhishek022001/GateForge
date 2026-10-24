export type QuestionType = 'MCQ' | 'MSQ' | 'NAT';
export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';
export type SourceType = 'PYQ' | 'AI_GENERATED' | 'MANUAL' | 'PRACTICE';
export type ReasoningType =
  | 'conceptual'
  | 'numerical'
  | 'logical'
  | 'analytical'
  | 'code-tracing'
  | 'proof-based'
  | 'calculation';

export interface IOption {
  id: string; // e.g. "A", "B", "C", "D"
  text: string;
}

export interface IQuestionSource {
  type: SourceType;
  provider?: string; // e.g. "OFFICIAL_GATE"
  exam?: string; // e.g. "GATE"
  year?: number | string; // e.g. 2024
  paper?: string; // e.g. "CS", "DA"
  questionNumber?: number;
  section?: string;
  sourceUrl?: string;
  fetchedAt?: string;
  checksum?: string;
  notes?: string;
  questionPaperSourceId?: string;
  answerKeySourceId?: string;
  questionPaperChecksum?: string;
  answerKeyChecksum?: string;
}

export type CognitiveSkill = 'recall' | 'understand' | 'apply' | 'analyze' | 'evaluate';

export interface IAIAnalysis {
  analyzed: boolean;
  subject?: string;
  topic?: string;
  subtopic?: string;
  concepts: string[];
  subConcepts: string[];
  reasoningType: string[];
  cognitiveSkill: CognitiveSkill | string;
  questionPattern: string;
  solutionApproach: string;
  difficultyAssessment: DifficultyLevel;
  distractorPatterns: string[];
  commonTraps: string[];
  requiredKnowledge: string[];
  gateCharacteristics: string[];
  analysisVersion: string;
  analyzedAt: string;
}

export interface IQuestion {
  _id?: string;
  id: string;
  question: string;
  subject?: string;
  topic?: string;
  subtopic?: string;
  concepts?: string[]; // Array of granular concepts for future AI / concept retrieval
  year: number | string;
  exam: string;
  paper?: string;
  section?: string;
  questionNumber?: number;
  questionType: QuestionType;
  difficulty?: DifficultyLevel;
  options?: IOption[];
  correctAnswer: string | string[] | number | null;
  explanation?: string;
  numericalAnswer?: number | { min: number; max: number } | null;
  numericalTolerance?: number;
  tolerance?: number;
  marks?: number;
  requiresFigure?: boolean;
  imageUrl?: string;
  extractionConfidence?: number;
  source: IQuestionSource;
  reasoningType?: ReasoningType[] | string[];
  aiAnalysis?: IAIAnalysis;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export type IQuestionInput = Omit<IQuestion, '_id' | 'createdAt' | 'updatedAt'>;

export interface IAnswerSubmission {
  answer: string | string[] | number;
}

export interface IAnswerEvaluation {
  questionId: string;
  questionType: QuestionType;
  isCorrect: boolean;
  userAnswer: string | string[] | number;
  correctAnswer: string | string[] | number;
  explanation: string;
  tolerance?: number;
}

export interface IQuestionFilter {
  subject?: string;
  topic?: string;
  subtopic?: string;
  year?: number | string;
  exam?: string;
  paper?: string;
  questionType?: QuestionType | string;
  difficulty?: DifficultyLevel | string;
  concept?: string;
  sourceType?: SourceType | string;
  reasoningType?: string;
  search?: string;
}

export interface IPaginationOptions {
  page?: number;
  limit?: number;
}

export interface IPaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface IImportValidationFailure {
  index: number;
  id?: string;
  errors: string[];
  snippet?: string;
}

export interface IImportDuplicateDetail {
  index: number;
  id?: string;
  reason: string;
  snippet?: string;
}

export interface IImportSummary {
  total: number;
  valid: number;
  imported: number;
  duplicates: number;
  failed: number;
  errors: IImportValidationFailure[];
  duplicateDetails: IImportDuplicateDetail[];
}
