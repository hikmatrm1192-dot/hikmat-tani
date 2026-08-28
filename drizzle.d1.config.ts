/**
 * HIKMAT TANI - Drizzle Config untuk Cloudflare D1 (SQLite)
 * 
 * Digunakan oleh Drizzle Kit untuk introspeksi dan migrasi database Cloudflare D1.
 */
export default {
  schema: './server/db/d1/schema.ts',
  out: './server/db/d1/migrations',
  dialect: 'sqlite',
};
