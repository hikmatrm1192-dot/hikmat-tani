import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { config } from './config.ts';
import { apiRouter } from './routes/index.ts';
import { errorHandler } from './middleware/errorHandler.ts';
import { dbService } from './db/index.ts';

export async function createApp() {
  const app = express();

  // Basic security and parsing middlewares
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  const getCorsOrigin = () => {
    if (config.corsOrigin === '*' || !config.corsOrigin) return true;
    if (config.corsOrigin.includes(',')) {
      return config.corsOrigin.split(',').map((o) => o.trim()).filter(Boolean);
    }
    return config.corsOrigin;
  };

  app.use(cors({
    origin: getCorsOrigin(),
    credentials: true,
  }));
  app.use(express.json({ limit: '5mb' }));

  // API v1 Routes
  app.use('/api/v1', apiRouter);

  // Backward-compatible health check
  app.get('/api/health', (_req, res) => {
    const dbStatus = dbService.getStatus();
    res.json({
      status: 'ok',
      app: 'HIKMAT TANI',
      mode: config.nodeEnv,
      database: dbStatus,
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}

export async function startServer() {
  const app = await createApp();
  const PORT = config.port;

  // Vite development middleware or static production serve
  if (config.nodeEnv !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Central error handling middleware
  app.use(errorHandler);

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[HIKMAT TANI] Server Express & PostgreSQL (Drizzle) berjalan di port ${PORT}`);
  });

  // Graceful shutdown
  const handleShutdown = (signal: string) => {
    console.log(`[HIKMAT TANI] Menerima sinyal ${signal}. Memulai graceful shutdown...`);
    server.close(() => {
      console.log('[HIKMAT TANI] Koneksi server HTTP ditutup dengan aman.');
      process.exit(0);
    });

    setTimeout(() => {
      console.error('[HIKMAT TANI] Batas waktu shutdown terlampaui (10s), mematikan paksa.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));

  return { app, server };
}

// Jalankan server jika dieksekusi langsung
if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('[HIKMAT TANI] Gagal memulai server:', err);
    process.exit(1);
  });
}
