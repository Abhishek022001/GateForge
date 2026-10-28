import { Router, Request, Response } from 'express';

const router = Router();

// GET /api/health - Health check and keep-alive ping endpoint
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    message: 'Your API is running',
    timestamp: new Date().toISOString(),
  });
});

export default router;
