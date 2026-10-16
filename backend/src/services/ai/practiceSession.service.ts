import crypto from 'node:crypto';
import { IGeneratedQuestion } from './questionGeneration.service.js';
import { AIError } from './ai.interface.js';

export interface IPracticeSessionEntry {
  id: string;
  question: IGeneratedQuestion;
  createdAt: number;
  expiresAt: number;
}

export interface ISanitizedPracticeQuestion {
  id: string;
  question: string;
  questionType: 'MCQ' | 'MSQ' | 'NAT';
  options: Array<{ id: string; text: string }>;
  subject: string;
  topic: string;
  subtopic?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  concepts: string[];
  reasoningType: string[];
  source: { type: 'AI_GENERATED' };
}

export interface IPracticeAnswerEvaluation {
  questionId: string;
  questionType: 'MCQ' | 'MSQ' | 'NAT';
  isCorrect: boolean;
  userAnswer: any;
  correctAnswer: string | string[] | number;
  explanation: string;
  tolerance?: number;
}

export interface IMultiQuestionSessionConfig {
  subject: string;
  topic?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  questionType: 'MCQ' | 'MSQ' | 'NAT' | 'Mixed';
  questionCount: number;
}

export interface IMultiQuestionSessionQuestion {
  id: string;
  fullQuestion: IGeneratedQuestion;
  sanitizedQuestion: ISanitizedPracticeQuestion;
}

export interface IMultiQuestionSessionResultItem {
  questionId: string;
  question: string;
  questionType: 'MCQ' | 'MSQ' | 'NAT';
  options?: Array<{ id: string; text: string }>;
  userAnswer: any;
  isAttempted: boolean;
  isCorrect: boolean;
  correctAnswer: string | string[] | number;
  explanation: string;
  subject: string;
  topic: string;
  concepts?: string[];
}

export interface IMultiQuestionSessionSubmissionResult {
  total: number;
  attempted: number;
  unanswered: number;
  correct: number;
  incorrect: number;
  percentage: number;
  results: IMultiQuestionSessionResultItem[];
}

export interface IMultiQuestionPracticeSession {
  sessionId: string;
  config: IMultiQuestionSessionConfig;
  questions: IMultiQuestionSessionQuestion[];
  createdAt: number;
  expiresAt: number;
  submitted: boolean;
  submissionResult?: IMultiQuestionSessionSubmissionResult;
}

export class PracticeSessionService {
  private sessions: Map<string, IPracticeSessionEntry> = new Map();
  private multiSessions: Map<string, IMultiQuestionPracticeSession> = new Map();
  private ttlMs: number;

  constructor(ttlMs: number = 60 * 60 * 1000) {
    // Default TTL: 1 hour (3600000 ms)
    this.ttlMs = ttlMs;
  }

  /**
   * Generates an unpredictable session ID, stores the verified candidate server-side,
   * and returns the session ID.
   */
  public createSession(question: IGeneratedQuestion): string {
    this.cleanupExpired();

    const id = crypto.randomUUID();
    const now = Date.now();

    this.sessions.set(id, {
      id,
      question: { ...question },
      createdAt: now,
      expiresAt: now + this.ttlMs,
    });

    return id;
  }

  /**
   * Retrieves a session by ID if it exists and has not expired.
   */
  public getSession(id: string): IPracticeSessionEntry | null {
    const entry = this.sessions.get(id);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.sessions.delete(id);
      return null;
    }

    return entry;
  }

  /**
   * Creates a multi-question practice session (Checkpoint 4B).
   * Generates a session ID and unpredictable IDs for each question.
   * Stores the full candidates server-side and returns sanitized questions.
   */
  public createMultiQuestionSession(
    config: IMultiQuestionSessionConfig,
    questions: IGeneratedQuestion[]
  ): { sessionId: string; questions: ISanitizedPracticeQuestion[] } {
    this.cleanupExpired();

    const sessionId = crypto.randomUUID();
    const now = Date.now();

    const sessionQuestions: IMultiQuestionSessionQuestion[] = questions.map((q) => {
      const qId = crypto.randomUUID();
      const sanitized = this.getSanitizedQuestion(q, qId);
      return {
        id: qId,
        fullQuestion: { ...q },
        sanitizedQuestion: sanitized,
      };
    });

    this.multiSessions.set(sessionId, {
      sessionId,
      config: { ...config },
      questions: sessionQuestions,
      createdAt: now,
      expiresAt: now + this.ttlMs,
      submitted: false,
    });

    return {
      sessionId,
      questions: sessionQuestions.map((sq) => sq.sanitizedQuestion),
    };
  }

  /**
   * Retrieves a multi-question session by ID if not expired.
   */
  public getMultiQuestionSession(sessionId: string): IMultiQuestionPracticeSession | null {
    const entry = this.multiSessions.get(sessionId);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.multiSessions.delete(sessionId);
      return null;
    }

    return entry;
  }

  /**
   * Submits and evaluates a multi-question practice session (Checkpoint 4B).
   * Enforces server-side evaluation, session locking, and accurate counts for attempted/unanswered/correct/incorrect.
   */
  public submitMultiQuestionSession(
    sessionId: string,
    userAnswers: Record<string, any> = {}
  ): IMultiQuestionSessionSubmissionResult {
    const session = this.getMultiQuestionSession(sessionId);
    if (!session) {
      throw new AIError(
        'Practice session not found or has expired. Please generate a new practice set.',
        'SESSION_NOT_FOUND',
        404
      );
    }

    // Session Locking: If already submitted, return the idempotent saved result
    if (session.submitted && session.submissionResult) {
      return session.submissionResult;
    }

    const total = session.questions.length;
    let attempted = 0;
    let unanswered = 0;
    let correct = 0;
    let incorrect = 0;

    const results: IMultiQuestionSessionResultItem[] = [];

    for (const qEntry of session.questions) {
      const { id, fullQuestion } = qEntry;
      const ans = userAnswers ? userAnswers[id] : undefined;

      // Check whether answered
      const isAnswered =
        ans !== undefined &&
        ans !== null &&
        (typeof ans === 'string'
          ? ans.trim() !== ''
          : Array.isArray(ans)
          ? ans.length > 0
          : true);

      const qType = fullQuestion.questionType || 'MCQ';
      const formattedCorrectAnswer =
        fullQuestion.correctAnswer ??
        (fullQuestion.numericalAnswer
          ? `${fullQuestion.numericalAnswer.min} to ${fullQuestion.numericalAnswer.max}`
          : 'N/A');

      if (!isAnswered) {
        unanswered++;
        results.push({
          questionId: id,
          question: fullQuestion.question,
          questionType: qType,
          options: fullQuestion.options,
          userAnswer: null,
          isAttempted: false,
          isCorrect: false,
          correctAnswer: formattedCorrectAnswer,
          explanation: fullQuestion.explanation || 'Detailed step-by-step solution verified.',
          subject: fullQuestion.subject,
          topic: fullQuestion.topic,
          concepts: fullQuestion.concepts || [],
        });
      } else {
        attempted++;
        const evalResult = this.evaluateQuestionAnswer(fullQuestion, ans);
        if (evalResult.isCorrect) {
          correct++;
        } else {
          incorrect++;
        }

        results.push({
          questionId: id,
          question: fullQuestion.question,
          questionType: qType,
          options: fullQuestion.options,
          userAnswer: ans,
          isAttempted: true,
          isCorrect: evalResult.isCorrect,
          correctAnswer: evalResult.correctAnswer,
          explanation: evalResult.explanation,
          subject: fullQuestion.subject,
          topic: fullQuestion.topic,
          concepts: fullQuestion.concepts || [],
        });
      }
    }

    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

    const submissionResult: IMultiQuestionSessionSubmissionResult = {
      total,
      attempted,
      unanswered,
      correct,
      incorrect,
      percentage,
      results,
    };

    session.submitted = true;
    session.submissionResult = submissionResult;

    return submissionResult;
  }

  /**
   * Returns a sanitized question object with correctAnswer, numericalAnswer,
   * and explanation completely stripped to prevent answer leakage in the browser.
   */
  public getSanitizedQuestion(
    question: IGeneratedQuestion,
    sessionQuestionId: string
  ): ISanitizedPracticeQuestion {
    return {
      id: sessionQuestionId,
      question: question.question,
      questionType: question.questionType,
      options: question.options || [],
      subject: question.subject,
      topic: question.topic,
      subtopic: question.subtopic,
      difficulty: question.difficulty,
      concepts: question.concepts || [],
      reasoningType: question.reasoningType || [],
      source: { type: 'AI_GENERATED' },
    };
  }

  /**
   * Shared evaluation logic for MCQ, MSQ, and NAT questions.
   */
  public evaluateQuestionAnswer(
    question: IGeneratedQuestion,
    userAnswer: any
  ): {
    isCorrect: boolean;
    correctAnswer: string | string[] | number;
    explanation: string;
    tolerance?: number;
  } {
    const qType = question.questionType || 'MCQ';
    let isCorrect = false;

    if (qType === 'MCQ') {
      const normalizedUser = String(userAnswer).trim().toUpperCase();
      const normalizedCorrect = String(question.correctAnswer).trim().toUpperCase();

      isCorrect =
        normalizedUser === normalizedCorrect ||
        (question.options || []).some(
          (opt) =>
            opt.id.toUpperCase() === normalizedCorrect &&
            opt.text.trim().toLowerCase() === String(userAnswer).trim().toLowerCase()
        );
    } else if (qType === 'MSQ') {
      let userList: string[] = [];
      if (Array.isArray(userAnswer)) {
        userList = userAnswer.map((a) => String(a).trim().toUpperCase());
      } else if (typeof userAnswer === 'string') {
        userList = userAnswer.split(',').map((a) => a.trim().toUpperCase());
      }

      let correctList: string[] = [];
      if (Array.isArray(question.correctAnswer)) {
        correctList = question.correctAnswer.map((a) => String(a).trim().toUpperCase());
      } else if (typeof question.correctAnswer === 'string') {
        correctList = question.correctAnswer.split(',').map((a) => a.trim().toUpperCase());
      }

      const uniqueUser = Array.from(new Set(userList)).filter(Boolean).sort();
      const uniqueCorrect = Array.from(new Set(correctList)).filter(Boolean).sort();

      // Exact complete set match required (no partial correctness)
      isCorrect =
        uniqueUser.length === uniqueCorrect.length &&
        uniqueUser.every((val, idx) => val === uniqueCorrect[idx]);
    } else if (qType === 'NAT') {
      const userNum = parseFloat(String(userAnswer).trim());
      const range =
        question.numericalAnswer && typeof question.numericalAnswer.min === 'number'
          ? question.numericalAnswer
          : null;

      if (!isNaN(userNum) && range) {
        isCorrect = userNum >= range.min - 1e-9 && userNum <= range.max + 1e-9;
      } else {
        const correctNum = parseFloat(String(question.correctAnswer).trim());
        const tol = 0.01;

        if (!isNaN(userNum) && !isNaN(correctNum)) {
          isCorrect = Math.abs(userNum - correctNum) <= tol + 1e-9;
        } else {
          isCorrect = false;
        }
      }
    }

    return {
      isCorrect,
      correctAnswer:
        question.correctAnswer ??
        (question.numericalAnswer
          ? `${question.numericalAnswer.min} to ${question.numericalAnswer.max}`
          : 'N/A'),
      explanation: question.explanation || 'Detailed step-by-step solution verified.',
      tolerance: 0.01,
    };
  }

  /**
   * Evaluates user answer against the stored single-question session.
   */
  public evaluateAnswer(
    sessionQuestionId: string,
    userAnswer: any
  ): IPracticeAnswerEvaluation {
    const entry = this.getSession(sessionQuestionId);
    if (!entry) {
      throw new AIError(
        'Practice session question not found or has expired. Please generate a new question.',
        'SESSION_NOT_FOUND',
        404
      );
    }

    if (
      userAnswer === undefined ||
      userAnswer === null ||
      (typeof userAnswer === 'string' && userAnswer.trim() === '')
    ) {
      throw new AIError('Missing required "answer" field.', 'MISSING_ANSWER', 400);
    }

    const evalResult = this.evaluateQuestionAnswer(entry.question, userAnswer);

    return {
      questionId: sessionQuestionId,
      questionType: entry.question.questionType || 'MCQ',
      isCorrect: evalResult.isCorrect,
      userAnswer,
      correctAnswer: evalResult.correctAnswer,
      explanation: evalResult.explanation,
      tolerance: evalResult.tolerance,
    };
  }

  /**
   * Removes expired sessions from the map.
   */
  public cleanupExpired(): void {
    const now = Date.now();
    for (const [id, entry] of this.sessions.entries()) {
      if (now > entry.expiresAt) {
        this.sessions.delete(id);
      }
    }
    for (const [id, entry] of this.multiSessions.entries()) {
      if (now > entry.expiresAt) {
        this.multiSessions.delete(id);
      }
    }
  }

  /**
   * Returns current active session count (for diagnostics / testing).
   */
  public getActiveSessionCount(): number {
    this.cleanupExpired();
    return this.sessions.size + this.multiSessions.size;
  }
}

export const practiceSessionService = new PracticeSessionService();
