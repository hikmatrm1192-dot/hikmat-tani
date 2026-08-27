import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  jwtSecret: process.env.JWT_SECRET || 'hikmat-tani-local-secure-dev-secret-key-2026',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  databaseUrl: process.env.DATABASE_URL || '',
  apiVersion: 'v1',
};
