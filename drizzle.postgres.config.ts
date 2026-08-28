/**
 * HIKMAT TANI - Drizzle Config untuk PostgreSQL
 * 
 * Digunakan oleh Drizzle Kit untuk introspeksi dan migrasi database PostgreSQL.
 */
export default {
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },
};
