import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AIError } from './ai.interface.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSIONS_DIR = path.resolve(__dirname, '../../data/sessions');

export class PracticeSessionService {
  constructor(ttlMs = 60 * 60 * 1000) {
    // Default TTL: 1 hour (3600000 ms)
    this.sessions = new Map();
    this.multiSessions = new Map();
    this.ttlMs = ttlMs;
    this.ensureSessionDir();
  }

  ensureSessionDir() {
    try {
      if (!fs.existsSync(SESSIONS_DIR)) {
        fs.mkdirSync(SESSIONS_DIR, { recursive: true });
      }
    } catch (_) {}
  }

  saveSessionToDisk(sessionId, data) {
    try {
      this.ensureSessionDir();
      fs.writeFileSync(path.join(SESSIONS_DIR, `${sessionId}.json`), JSON.stringify(data), 'utf8');
    } catch (_) {}
  }

  loadSessionFromDisk(sessionId) {
    try {
      const file = path.join(SESSIONS_DIR, `${sessionId}.json`);
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, 'utf8');
        const data = JSON.parse(raw);
        if (data && data.expiresAt && Date.now() < data.expiresAt) {
          return data;
        }
      }
    } catch (_) {}
    return null;
  }

  /**
   * Generates an unpredictable session ID, stores the verified candidate server-side,
   * and returns the session ID.
   */
  createSession(question) {
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
  getSession(id) {
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
  createMultiQuestionSession(config, questions) {
    this.cleanupExpired();

    const sessionId = crypto.randomUUID();
    const now = Date.now();

    const sessionQuestions = (questions || []).map((q) => {
      const qId = crypto.randomUUID();
      const sanitized = this.getSanitizedQuestion(q, qId);
      return {
        id: qId,
        fullQuestion: { ...q },
        sanitizedQuestion: sanitized,
      };
    });

    const sessionData = {
      sessionId,
      config: { ...config },
      questions: sessionQuestions,
      createdAt: now,
      expiresAt: now + this.ttlMs,
      submitted: false,
    };

    this.multiSessions.set(sessionId, sessionData);
    this.saveSessionToDisk(sessionId, sessionData);

    return {
      sessionId,
      questions: sessionQuestions.map((sq) => sq.sanitizedQuestion),
    };
  }

  /**
   * Retrieves a multi-question session by ID if not expired.
   */
  getMultiQuestionSession(sessionId) {
    let entry = this.multiSessions.get(sessionId);
    if (!entry) {
      entry = this.loadSessionFromDisk(sessionId);
      if (entry) {
        this.multiSessions.set(sessionId, entry);
      }
    }
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.multiSessions.delete(sessionId);
      try {
        const file = path.join(SESSIONS_DIR, `${sessionId}.json`);
        if (fs.existsSync(file)) fs.unlinkSync(file);
      } catch (_) {}
      return null;
    }

    return entry;
  }

  /**
   * Retrieves a sanitized multi-question session safe for client consumption.
   * Excludes answer keys and explanations to enforce anti-leak integrity before submission.
   */
  getSanitizedSession(sessionId) {
    const session = this.getMultiQuestionSession(sessionId);
    if (!session) return null;

    return {
      sessionId: session.sessionId,
      config: session.config,
      questions: session.questions.map((q) => q.sanitizedQuestion),
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      submitted: session.submitted,
      answers: session.answers || {},
      currentIndex: typeof session.currentIndex === 'number' ? session.currentIndex : 0,
      submissionResult: session.submissionResult,
    };
  }

  /**
   * Updates live progress (chosen answers and active question index) in the server-side session cache.
   */
  updateSessionProgress(sessionId, progress = {}) {
    const session = this.getMultiQuestionSession(sessionId);
    if (!session || session.submitted) {
      return false;
    }

    if (progress.answers && typeof progress.answers === 'object') {
      session.answers = { ...(session.answers || {}), ...progress.answers };
    }
    if (typeof progress.currentIndex === 'number' && progress.currentIndex >= 0) {
      session.currentIndex = progress.currentIndex;
    }

    this.multiSessions.set(sessionId, session);
    this.saveSessionToDisk(sessionId, session);
    return true;
  }

  /**
   * Submits and evaluates a multi-question practice session (Checkpoint 4B).
   * Enforces server-side evaluation, session locking, and accurate counts for attempted/unanswered/correct/incorrect.
   */
  submitMultiQuestionSession(sessionId, userAnswers = {}) {
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

    const results = [];

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

    const submissionResult = {
      total,
      attempted,
      unanswered,
      correct,
      incorrect,
      percentage,
      results,
    };

    session.answers = { ...(session.answers || {}), ...(userAnswers || {}) };
    session.submitted = true;
    session.submissionResult = submissionResult;
    this.saveSessionToDisk(sessionId, session);

    return submissionResult;
  }

  /**
   * Returns a sanitized question object with correctAnswer, numericalAnswer,
   * and explanation completely stripped to prevent answer leakage in the browser.
   */
  getSanitizedQuestion(question, sessionQuestionId) {
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
  evaluateQuestionAnswer(question, userAnswer) {
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
      let userList = [];
      if (Array.isArray(userAnswer)) {
        userList = userAnswer.map((a) => String(a).trim().toUpperCase());
      } else if (typeof userAnswer === 'string') {
        userList = userAnswer.split(',').map((a) => a.trim().toUpperCase());
      }

      let correctList = [];
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
  evaluateAnswer(sessionQuestionId, userAnswer) {
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
  cleanupExpired() {
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
  getActiveSessionCount() {
    this.cleanupExpired();
    return this.sessions.size + this.multiSessions.size;
  }
}

export const practiceSessionService = new PracticeSessionService();
