import { Router, Request, Response } from 'express';
import { AIController } from '../controllers/ai.controller.js';

export function createAIRouter(db: any): Router {
  const router = Router();

  // GET /api/ai/health - Safe health and provider status
  router.get('/health', AIController.getHealth);

  // POST /api/ai/test - Development-only connection test
  router.post('/test', AIController.testConnection);

  // POST /api/ai/generation/test - Task 3C.1 Development Question Generation test
  router.post('/generation/test', AIController.testGeneration);

  // POST /api/ai/analyze-question/:id - Analyze single question
  router.post('/analyze-question/:id', (req: Request, res: Response) => AIController.analyzeQuestion(req, res, db));

  // POST /api/ai/analyze-questions - Analyze multiple questions with controlled concurrency
  router.post('/analyze-questions', (req: Request, res: Response) => AIController.analyzeQuestionsBulk(req, res, db));

  // POST /api/ai/generate-question - Checkpoint 3C.3 Question Generation with PYQ Context
  router.post('/generate-question', (req: Request, res: Response) => AIController.generateQuestion(req, res, db));

  // GET /api/ai/patterns - In-memory aggregate question pattern analytics
  router.get('/patterns', (req: Request, res: Response) => AIController.getPatterns(req, res, db));

  // POST /api/ai/practice/session - Checkpoint 4B Multi-Question Session Generation
  router.post('/practice/session', (req: Request, res: Response) => AIController.createPracticeSession(req, res, db));

  // POST /api/ai/practice/session/:sessionId/submit - Checkpoint 4B Multi-Question Session Submission
  router.post('/practice/session/:sessionId/submit', AIController.submitPracticeSession);

  return router;
}

export default createAIRouter;
