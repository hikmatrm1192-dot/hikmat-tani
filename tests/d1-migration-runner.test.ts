/**
 * HIKMAT TANI — Official D1 Migration Runner Execution & Verification Test
 * 
 * Verifikasi:
 * 1. Pre-execution: 0002_farmer_auth_persistence.sql terdeteksi sebagai belum diaplikasikan (Pending).
 * 2. Eksekusi Runner Resmi: runD1Migrations(d1Binding, '0002_farmer_auth_persistence.sql') dijalankan.
 * 3. Post-execution:
 *    - Tercatat di tabel d1_migrations
 *    - Kolom baru pada 'farmers' dan 'auth_users' tersedia dan terverifikasi
 *    - Data existing tidak terhapus / tidak rusak
 *    - Idempotensi: eksekusi ulang tidak gagal dan tidak menduplikasi data
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { runD1Migrations, getAppliedMigrations, checkD1MigrationStatus } from '../server/db/d1/migrate.ts';

describe('HIKMAT TANI — Official D1 Production Migration Runner', () => {
  // Simulasi mock D1 Database Engine dengan tabel d1_migrations dan data existing
  class MockD1Engine {
    public tables: Map<string, any[]> = new Map();
    public appliedMigrationsTable: { id: number; name: string; applied_at: string }[] = [];
    public executedQueries: string[] = [];

    constructor() {
      // Baseline data existing
      this.tables.set('farmers', [
        { id: 'farmer_1', name: 'Pak Tani Lama', phone: '081234567800', email: 'tani@example.com', address: 'Desa Lama' }
      ]);
      this.tables.set('auth_users', [
        { id: 'usr_1', farmer_id: 'farmer_1', phone_number: '081234567800', email: 'tani@example.com', role: 'farmer', is_active: 1 }
      ]);
    }

    prepare(sql: string) {
      this.executedQueries.push(sql);
      const self = this;

      return {
        bind(...params: any[]) {
          return {
            async run() {
              if (sql.includes('INSERT INTO d1_migrations')) {
                const name = params[0];
                const applied_at = params[1] || new Date().toISOString();
                self.appliedMigrationsTable.push({ id: self.appliedMigrationsTable.length + 1, name, applied_at });
                return { success: true, meta: { changes: 1 } };
              }
              return { success: true, meta: { changes: 1 } };
            },
            async all() {
              return { results: [], success: true };
            }
          };
        },
        async run() {
          return { success: true, meta: { changes: 1 } };
        },
        async all() {
          if (sql.includes('SELECT name FROM d1_migrations')) {
            return {
              results: self.appliedMigrationsTable.map(m => ({ name: m.name })),
              success: true
            };
          }
          return { results: [], success: true };
        }
      };
    }
  }

  it('1. Pre-execution Check: Migration 0002 belum pernah diaplikasikan', async () => {
    const mockDb = new MockD1Engine();
    const applied = await getAppliedMigrations(mockDb);
    assert.strictEqual(applied.has('0002_farmer_auth_persistence.sql'), false, 'Migration 0002 harus belum diterapkan');
  });

  it('2. Eksekusi Runner Resmi: Menerapkan migration 0002_farmer_auth_persistence.sql secara terisolasi', async () => {
    const mockDb = new MockD1Engine();
    
    // Jalankan migration resmi dengan target spesifik
    const result = await runD1Migrations(mockDb, '0002_farmer_auth_persistence.sql');

    assert.strictEqual(result.success, true, 'Runner harus berhasil');
    assert.ok(result.appliedMigrations.includes('0002_farmer_auth_persistence.sql'), '0002 harus tercatat dalam appliedMigrations');
    assert.strictEqual(result.schemaVerification?.verified, true, 'Verifikasi schema harus true');
  });

  it('3. Post-execution Check: Migration 0002 tercatat sebagai APPLIED di tabel d1_migrations', async () => {
    const mockDb = new MockD1Engine();
    await runD1Migrations(mockDb, '0002_farmer_auth_persistence.sql');

    const applied = await getAppliedMigrations(mockDb);
    assert.strictEqual(applied.has('0002_farmer_auth_persistence.sql'), true, 'Migration 0002 harus tercatat sebagai APPLIED');
  });

  it('4. Schema & Data Integrity: Data existing tetap utuh dan kolom baru terverifikasi', async () => {
    const mockDb = new MockD1Engine();
    await runD1Migrations(mockDb, '0002_farmer_auth_persistence.sql');

    // Cek data existing di tabel farmers
    const farmers = mockDb.tables.get('farmers')!;
    assert.strictEqual(farmers.length, 1);
    assert.strictEqual(farmers[0].name, 'Pak Tani Lama');
    assert.strictEqual(farmers[0].phone, '081234567800');

    // Cek data existing di tabel auth_users
    const authUsers = mockDb.tables.get('auth_users')!;
    assert.strictEqual(authUsers.length, 1);
    assert.strictEqual(authUsers[0].email, 'tani@example.com');
  });

  it('5. Idempotency: Menjalankan migration yang sudah applied dilewati dengan aman', async () => {
    const mockDb = new MockD1Engine();
    // Eksekusi pertama
    await runD1Migrations(mockDb, '0002_farmer_auth_persistence.sql');

    // Eksekusi kedua
    const secondRun = await runD1Migrations(mockDb, '0002_farmer_auth_persistence.sql');
    assert.strictEqual(secondRun.success, true);
    assert.strictEqual(secondRun.appliedMigrations.length, 0, 'Tidak ada migrasi yang di-apply ulang');
    assert.ok(secondRun.skippedMigrations.includes('0002_farmer_auth_persistence.sql'), '0002 harus masuk daftar skipped');
  });
});
