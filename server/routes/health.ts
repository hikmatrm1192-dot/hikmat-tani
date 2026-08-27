import { Router, Request, Response } from 'express';
import { dbService } from '../db/index.ts';
import { config } from '../config.ts';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  const dbStatus = dbService.getStatus();
  res.json({
    success: true,
    status: 'ok',
    app: 'HIKMAT TANI',
    version: '1.0.0',
    apiVersion: config.apiVersion,
    environment: config.nodeEnv,
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

export const healthRoutes = router;
