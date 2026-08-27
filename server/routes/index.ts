import { Router } from 'express';
import { healthRoutes } from './health.ts';
import { authRoutes } from './auth.ts';
import { farmerRoutes } from './farmers.ts';
import { syncRoutes } from './sync.ts';
import { knowledgeRoutes } from './knowledge.ts';
import { infoRoutes } from './info.ts';
import { adminRoutes } from './admin.ts';
import { configRoutes } from './config.ts';

const apiRouter = Router();

// Mount sub-routes v1
apiRouter.use('/', healthRoutes); // /api/v1/health
apiRouter.use('/auth', authRoutes); // /api/v1/auth/*
apiRouter.use('/farmers', farmerRoutes); // /api/v1/farmers/*
apiRouter.use('/sync', syncRoutes); // /api/v1/sync/*
apiRouter.use('/knowledge', knowledgeRoutes); // /api/v1/knowledge/*
apiRouter.use('/info', infoRoutes); // /api/v1/info/*
apiRouter.use('/config', configRoutes); // /api/v1/config/public
apiRouter.use('/admin', adminRoutes); // /api/v1/admin/*

export { apiRouter };

