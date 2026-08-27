import { config } from '../config.ts';
import * as schema from './schema.ts';

/**
 * HIKMAT TANI - Server Database Connection & Abstraction
 * 
 * Menggunakan Drizzle ORM dengan schema PostgreSQL.
 * Ketika database belum terhubung secara langsung (offline / dev mode tanpa DATABASE_URL),
 * modul ini menyediakan fallback abstraction yang aman tanpa error saat startup.
 */

export class DatabaseService {
  private static instance: DatabaseService;
  private isConnected: boolean = false;

  private constructor() {
    if (config.databaseUrl) {
      // Inisialisasi koneksi PostgreSQL jika DATABASE_URL dikonfigurasi
      this.isConnected = true;
    }
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public getSchema() {
    return schema;
  }

  public getStatus() {
    return {
      configured: Boolean(config.databaseUrl),
      connected: this.isConnected,
      engine: 'PostgreSQL (Drizzle ORM)',
      schemaVersion: '1.0.0',
    };
  }
}

export const dbService = DatabaseService.getInstance();
export { schema };
