export type QuestionType = 'MCQ' | 'MSQ' | 'NAT';
export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';

export interface IOption {
  id: string; // e.g. "A", "B", "C", "D"
  text: string;
}

export interface IQuestion {
  _id?: string;
  id: string;
  question: string;
  subject: string;
  topic: string;
  subtopic?: string;
  concepts?: string[];
  year: number | string;
  exam: string;
  paper?: string;
  questionNumber?: number;
  questionType: QuestionType;
  difficulty: DifficultyLevel;
  options?: IOption[];
  correctAnswer?: string | string[] | number;
  numericalAnswer?: number;
  numericalTolerance?: number;
  tolerance?: number;
  explanation?: string;
  imageUrl?: string;
  source?: {
    type: 'PYQ' | 'AI_GENERATED' | 'MANUAL' | 'PRACTICE';
    provider?: string;
    exam?: string;
    year?: number | string;
    paper?: string;
    questionNumber?: number;
    sourceUrl?: string;
    fetchedAt?: string;
    checksum?: string;
    notes?: string;
  };
  reasoningType?: string[];
  aiAnalysis?: {
    analyzed: boolean;
    concepts: string[];
    subConcepts: string[];
    reasoningType: string[];
    cognitiveSkill: string;
    questionPattern: string;
    solutionApproach: string;
    difficultyAssessment: DifficultyLevel;
    distractorPatterns: string[];
    commonTraps: string[];
    requiredKnowledge: string[];
    gateCharacteristics: string[];
    analysisVersion: string;
    analyzedAt: string;
  };
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

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  count?: number;
  message?: string;
  error?: string;
}

export interface IAIPracticeConfig {
  subject: string;
  topic: string;
  difficulty: DifficultyLevel;
  questionType: QuestionType;
}

export interface IAIPracticeGenerateResponse {
  success: boolean;
  status: 'VERIFIED' | 'GENERATION_ATTEMPTS_EXHAUSTED' | string;
  sessionQuestionId?: string;
  question?: IQuestion;
  attemptCount?: number;
  attemptStatuses?: string[];
  lastFailureReason?: string;
  generationContext?: {
    sourceQuestionIds: string[];
    contextCount: number;
  };
}

export interface IAIPracticeSessionConfig {
  subject: string;
  topic?: string;
  difficulty: DifficultyLevel;
  questionType: QuestionType | 'Mixed';
  questionCount: 3 | 5;
}

export interface IAIPracticeSessionResultItem {
  questionId: string;
  question: string;
  questionType: QuestionType;
  options?: IOption[];
  userAnswer: any;
  isAttempted: boolean;
  isCorrect: boolean;
  correctAnswer: string | string[] | number;
  explanation: string;
  subject: string;
  topic: string;
  concepts?: string[];
}

export interface IAIPracticeSessionSubmitData {
  total: number;
  attempted: number;
  unanswered: number;
  correct: number;
  incorrect: number;
  percentage: number;
  results: IAIPracticeSessionResultItem[];
}

export interface IAIPracticeSessionCreateResponse {
  success: boolean;
  sessionId: string;
  questions: IQuestion[];
  error?: string;
  code?: string;
}

export interface IAIPracticeSessionSubmitResponse {
  success: boolean;
  sessionId: string;
  data: IAIPracticeSessionSubmitData;
  error?: string;
  code?: string;
}
