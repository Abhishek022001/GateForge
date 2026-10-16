import cors from 'cors';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import { connectToDatabase, isDatabaseConnected } from './config/db.js';
import questionRoutes from './routes/question.routes.js';
import { questionService } from './services/question.service.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
// Security: Bound request body size to prevent DoS/memory exhaustion (default 2MB)
const MAX_BODY_SIZE_BYTES = parseInt(process.env.MAX_BODY_SIZE_BYTES || '2097152', 10) || 2097152;
app.use(express.json({ limit: MAX_BODY_SIZE_BYTES }));

// Request logging middleware
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/api/health', async (_req: Request, res: Response) => {
  const isDbUp = isDatabaseConnected();
  const count = await questionService.count();
  res.status(200).json({
    status: 'healthy',
    application: 'GATEForge Backend API',
    phase: 1,
    database: isDbUp ? 'MongoDB (Connected)' : 'In-Memory Repository (Active Fallback)',
    questionCount: count,
    timestamp: new Date().toISOString(),
  });
});

// Dynamic Real-Time Stats endpoint
app.get('/api/stats', async (_req: Request, res: Response) => {
  const all = await questionService.getAll();
  const officialCount = all.filter(
    (q: any) =>
      q.source?.type === 'OFFICIAL_PYQ' ||
      q.source?.type === 'PYQ' ||
      q.source?.provider === 'OFFICIAL_GATE' ||
      q.sourceType === 'OFFICIAL_PYQ' ||
      Boolean(q.provenance)
  ).length;
  const analyzedCount = all.filter((q: any) => q.aiAnalysis?.analyzed === true).length;
  const subjects = new Set(all.map((q: any) => q.subject).filter(Boolean));

  res.status(200).json({
    success: true,
    data: {
      totalQuestions: all.length,
      officialPyqs: officialCount,
      analyzedQuestions: analyzedCount,
      subjectsCovered: subjects.size,
      practiceModes: 4,
    },
  });
});

// Questions API
app.use('/api/questions', questionRoutes);

// Root info route
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    name: 'GATEForge API',
    version: '1.0.0',
    phase: 'Phase 1 - Core Practice Engine',
    endpoints: {
      health: 'GET /api/health',
      questions: 'GET /api/questions',
      questionById: 'GET /api/questions/:id',
      createQuestion: 'POST /api/questions',
      evaluateAnswer: 'POST /api/questions/:id/answer',
      seedQuestions: 'POST /api/questions/seed',
    },
  });
});

// Error handling middleware for oversized request bodies
app.use((err: any, _req: Request, res: Response, next: any) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413 || err.statusCode === 413)) {
    return res.status(413).json({
      success: false,
      error: `Payload too large. Maximum allowed request body size is ${MAX_BODY_SIZE_BYTES} bytes.`,
      code: 'PAYLOAD_TOO_LARGE',
    });
  }
  next(err);
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Bootstrap server
async function startServer() {
  const mongoUri = process.env.MONGODB_URI;
  await connectToDatabase(mongoUri);

  // Auto-seed initial questions if empty
  try {
    const seededCount = await questionService.seedDatabase();
    if (seededCount > 0) {
      console.log(`[Seed] Initialized ${seededCount} GATE CS practice questions.`);
    }
  } catch (err) {
    console.warn(`[Seed] Notice during initial question check:`, (err as Error).message);
  }

  app.listen(PORT, () => {
    console.log(`🚀 GATEForge Backend Server listening on http://localhost:${PORT}`);
    console.log(`📡 Questions API: http://localhost:${PORT}/api/questions`);
    console.log(`🩺 Health API: http://localhost:${PORT}/api/health`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
