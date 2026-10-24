import { SEED_QUESTIONS } from '../data/seedQuestions.js';
import { IQuestionRepository } from '../repositories/IQuestionRepository.js';
import { getQuestionRepository } from '../repositories/index.js';
import {
  IAnswerEvaluation,
  IQuestion,
  IQuestionInput,
} from '../types/question.types.js';

export class QuestionService {
  private get repo(): IQuestionRepository {
    return getQuestionRepository();
  }

  async getAllQuestions(filter?: {
    subject?: string;
    topic?: string;
    difficulty?: string;
    questionType?: string;
    year?: number | string;
  }): Promise<Omit<IQuestion, 'correctAnswer' | 'explanation'>[]> {
    // Ensure repository has seed questions if empty
    await this.repo.seedIfEmpty(SEED_QUESTIONS);

    const questions = await this.repo.findAll(filter);

    // Return sanitized question list (options and metadata without revealing the answer upfront)
    return questions.map((q) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { correctAnswer, explanation, ...safeQuestion } = q;
      return safeQuestion;
    });
  }

  async getAll(): Promise<IQuestion[]> {
    await this.repo.seedIfEmpty(SEED_QUESTIONS);
    return await this.repo.findAll();
  }

  async getQuestionById(
    id: string
  ): Promise<Omit<IQuestion, 'correctAnswer' | 'explanation'> | null> {
    const question = await this.repo.findById(id);
    if (!question) return null;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { correctAnswer, explanation, ...safeQuestion } = question;
    return safeQuestion;
  }

  async getFullQuestionById(id: string): Promise<IQuestion | null> {
    return await this.repo.findById(id);
  }

  async createQuestion(data: IQuestionInput): Promise<IQuestion> {
    if (!data.question || !data.subject || !data.topic || data.correctAnswer === undefined || !data.explanation) {
      throw new Error(
        'Missing required fields: question, subject, topic, correctAnswer, and explanation are mandatory.'
      );
    }

    if (!data.id) {
      data.id = `gate-${data.subject.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    }

    if ((data.questionType === 'MCQ' || data.questionType === 'MSQ') && (!data.options || data.options.length === 0)) {
      throw new Error('Options array cannot be empty for MCQ and MSQ questions.');
    }

    return await this.repo.create(data);
  }

  async evaluateAnswer(
    questionId: string,
    userAnswer: string | string[] | number
  ): Promise<IAnswerEvaluation> {
    if (userAnswer === undefined || userAnswer === null) {
      throw new Error('User answer is required.');
    }

    const question = await this.repo.findById(questionId);
    if (!question) {
      throw new Error(`Question with ID '${questionId}' not found.`);
    }

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
      // User answer can be array of strings or comma-separated string
      let userList: string[] = [];
      if (Array.isArray(userAnswer)) {
        userList = userAnswer.map((a) => String(a).trim().toUpperCase());
      } else if (typeof userAnswer === 'string') {
        userList = userAnswer.split(',').map((a) => a.trim().toUpperCase());
      }

      // Correct answer can be array or string
      let correctList: string[] = [];
      if (Array.isArray(question.correctAnswer)) {
        correctList = question.correctAnswer.map((a) => String(a).trim().toUpperCase());
      } else if (typeof question.correctAnswer === 'string') {
        correctList = question.correctAnswer.split(',').map((a) => a.trim().toUpperCase());
      }

      // Remove duplicates & sort
      const uniqueUser = Array.from(new Set(userList)).filter(Boolean).sort();
      const uniqueCorrect = Array.from(new Set(correctList)).filter(Boolean).sort();

      isCorrect =
        uniqueUser.length === uniqueCorrect.length &&
        uniqueUser.every((val, idx) => val === uniqueCorrect[idx]);
    } else if (qType === 'NAT') {
      const userNum = parseFloat(String(userAnswer).trim());
      const correctNum = parseFloat(String(question.correctAnswer).trim());
      const tol = typeof question.numericalTolerance === 'number'
        ? question.numericalTolerance
        : typeof question.tolerance === 'number'
        ? question.tolerance
        : 0.01;

      if (!isNaN(userNum) && !isNaN(correctNum)) {
        isCorrect = Math.abs(userNum - correctNum) <= tol + 1e-9;
      } else {
        isCorrect = false;
      }
    }

    return {
      questionId: question.id,
      questionType: qType,
      isCorrect,
      userAnswer,
      correctAnswer: question.correctAnswer ?? '',
      explanation: question.explanation || '',
      tolerance: question.numericalTolerance || question.tolerance,
    };
  }

  async seedDatabase(): Promise<number> {
    return await this.repo.seedIfEmpty(SEED_QUESTIONS);
  }

  async count(): Promise<number> {
    return await this.repo.count();
  }
}

export const questionService = new QuestionService();
