import { Request, Response, NextFunction } from 'express';
import { config } from '../config.ts';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Terjadi kesalahan pada server internal';

  // Log error di server console
  console.error(`[Server Error] [${statusCode}] ${message}`, {
    code: err.code,
    stack: config.isProduction ? undefined : err.stack,
  });

  // Kirim respon aman ke client tanpa expose credential atau stack trace
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code: err.code || 'INTERNAL_SERVER_ERROR',
      statusCode,
      ...(config.isProduction ? {} : { details: err.details }),
    },
  });
}
