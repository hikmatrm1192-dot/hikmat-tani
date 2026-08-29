import { drizzle, DrizzleD1Database } from 'drizzle-orm/d1';
import * as d1Schema from './schema.ts';

/**
 * HIKMAT TANI - Cloudflare D1 Database Adapter & Client Abstraction
 * 
 * Modul ini menyediakan adapter ORM Drizzle khusus untuk Cloudflare D1.
 * Didesain 100% kompatibel dengan Cloudflare Workers environment (edge runtime)
 * tanpa ketergantungan pada API khusus Node.js.
 * 
 * Jalur Database:
 * 1. Default (Sekarang): PostgreSQL (/server/db/index.ts)
 * 2. Paralel (Migrasi Cloudflare): Cloudflare D1 (/server/db/d1/index.ts)
 */

export interface D1Database {
  prepare(query: string): any;
  dump(): Promise<ArrayBuffer>;
  batch<T = unknown>(statements: any[]): Promise<any[]>;
  exec(query: string): Promise<any>;
}

export interface D1Status {
  configured: boolean;
  connected: boolean;
  engine: string;
  schemaVersion: string;
  tableCount: number;
}

export class D1DatabaseService {
  private static instance: D1DatabaseService;
  private dbInstance: DrizzleD1Database<typeof d1Schema> | null = null;
  private isBindingAvailable: boolean = false;

  private constructor(d1Binding?: any) {
    if (d1Binding) {
      try {
        this.dbInstance = drizzle(d1Binding, { schema: d1Schema });
        this.isBindingAvailable = true;
      } catch (err) {
        console.warn('[HIKMAT TANI D1] Peringatan inisialisasi D1 binding:', err);
      }
    }
  }

  public static getInstance(d1Binding?: any): D1DatabaseService {
    if (!D1DatabaseService.instance || d1Binding) {
      D1DatabaseService.instance = new D1DatabaseService(d1Binding);
    }
    return D1DatabaseService.instance;
  }

  /**
   * Mengembalikan instance Drizzle D1 Client
   */
  public getClient(): DrizzleD1Database<typeof d1Schema> | null {
    return this.dbInstance;
  }

  /**
   * Mengembalikan skema tabel D1
   */
  public getSchema() {
    return d1Schema;
  }

  /**
   * Mengembalikan status diagnostik adapter D1
   */
  public getStatus(): D1Status {
    const tableKeys = Object.keys(d1Schema).filter((key) => {
      const item = (d1Schema as any)[key];
      return item && typeof item === 'object';
    });

    return {
      configured: this.isBindingAvailable,
      connected: this.isBindingAvailable,
      engine: 'Cloudflare D1 (SQLite Drizzle ORM)',
      schemaVersion: '1.0.0',
      tableCount: tableKeys.length,
    };
  }
}

/**
 * Factory helper untuk membuat client D1 dari Cloudflare Worker Env binding
 * 
 * Contoh penggunaan di Cloudflare Worker:
 * ```ts
 * export default {
 *   async fetch(request, env, ctx) {
 *     const db = createD1Client(env.DB);
 *     const allLands = await db.query.lands.findMany();
 *     return Response.json(allLands);
 *   }
 * }
 * ```
 */
export function createD1Client(d1Binding: any): DrizzleD1Database<typeof d1Schema> {
  if (!d1Binding) {
    throw new Error('D1Database binding dari Cloudflare Worker env (misal: env.DB) dibutuhkan.');
  }
  return drizzle(d1Binding, { schema: d1Schema });
}

export const d1DbService = D1DatabaseService.getInstance();
export { d1Schema };
export { ensureD1CanonicalSchema } from './ensureCanonical.ts';
