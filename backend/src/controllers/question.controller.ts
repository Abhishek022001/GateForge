import { Request, Response } from 'express';
import { questionService } from '../services/question.service.js';
import { IQuestionInput } from '../types/question.types.js';

export class QuestionController {
  async getAllQuestions(req: Request, res: Response): Promise<void> {
    try {
      const { subject, topic, difficulty, questionType, year } = req.query;
      const questions = await questionService.getAllQuestions({
        subject: subject as string | undefined,
        topic: topic as string | undefined,
        difficulty: difficulty as string | undefined,
        questionType: questionType as string | undefined,
        year: year as string | undefined,
      });

      res.status(200).json({
        success: true,
        count: questions.length,
        data: questions,
      });
    } catch (error) {
      console.error('Error fetching questions:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message || 'Internal Server Error',
      });
    }
  }

  async getQuestionById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const question = await questionService.getQuestionById(id);

      if (!question) {
        res.status(404).json({
          success: false,
          error: `Question with ID '${id}' not found.`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: question,
      });
    } catch (error) {
      console.error(`Error fetching question ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: (error as Error).message || 'Internal Server Error',
      });
    }
  }

  async createQuestion(req: Request, res: Response): Promise<void> {
    try {
      const input: IQuestionInput = req.body;
      const created = await questionService.createQuestion(input);

      res.status(201).json({
        success: true,
        message: 'Question created successfully.',
        data: created,
      });
    } catch (error) {
      console.error('Error creating question:', error);
      res.status(400).json({
        success: false,
        error: (error as Error).message || 'Bad Request',
      });
    }
  }

  async evaluateAnswer(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { answer } = req.body;

      if (!answer && answer !== 0) {
        res.status(400).json({
          success: false,
          error: 'An "answer" field is required in the request body.',
        });
        return;
      }

      const evaluation = await questionService.evaluateAnswer(id, String(answer));

      res.status(200).json({
        success: true,
        data: evaluation,
      });
    } catch (error) {
      console.error(`Error evaluating answer for question ${req.params.id}:`, error);
      const statusCode = (error as Error).message.includes('not found') ? 404 : 400;
      res.status(statusCode).json({
        success: false,
        error: (error as Error).message || 'Error evaluating answer',
      });
    }
  }

  async seedQuestions(_req: Request, res: Response): Promise<void> {
    try {
      const count = await questionService.seedDatabase();
      res.status(200).json({
        success: true,
        message: `Database seeded successfully. Total new records inserted: ${count}`,
      });
    } catch (error) {
      console.error('Error seeding questions:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message || 'Error seeding database',
      });
    }
  }
}

export const questionController = new QuestionController();
