import { Router } from 'express';
import { questionController } from '../controllers/question.controller.js';

const router = Router();

// Get all questions
router.get('/', (req, res) => questionController.getAllQuestions(req, res));

// Seed questions endpoint
router.post('/seed', (req, res) => questionController.seedQuestions(req, res));

// Get single question by ID
router.get('/:id', (req, res) => questionController.getQuestionById(req, res));

// Create a new question
router.post('/', (req, res) => questionController.createQuestion(req, res));

// Submit and evaluate answer for a question
router.post('/:id/answer', (req, res) => questionController.evaluateAnswer(req, res));

export default router;
