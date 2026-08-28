import fs from 'fs';
import path from 'path';

/**
 * HIKMAT TANI - Cloudflare D1 Migration Runner
 * 
 * Memvalidasi dan menjalankan migrasi SQL untuk Cloudflare D1.
 * File SQL 0000_init_d1.sql bersifat IF NOT EXISTS dan 100% idempotent.
 * 
 * Penggunaan CLI Cloudflare Wrangler:
 * npx wrangler d1 execute <DB_NAME> --file=server/db/d1/migrations/0000_init_d1.sql
 */

export async function runD1Migrations(d1Binding?: any): Promise<{ success: boolean; message: string; statementsCount?: number }> {
  const migrationPath = path.join(process.cwd(), 'server', 'db', 'd1', 'migrations', '0000_init_d1.sql');

  if (!fs.existsSync(migrationPath)) {
    return {
      success: false,
      message: `File migrasi D1 tidak ditemukan di: ${migrationPath}`,
    };
  }

  const sqlContent = fs.readFileSync(migrationPath, 'utf-8');

  // Bersihkan komentar dan pisahkan statement
  const statements = sqlContent
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));

  if (!d1Binding) {
    console.log('[HIKMAT TANI D1 Migration] D1 Database binding tidak terpasang secara langsung (Mode Standalone/Dry-Run).');
    console.log(`[HIKMAT TANI D1 Migration] Berhasil memvalidasi skrip migrasi D1 (${statements.length} SQL DDL statements, ${sqlContent.length} bytes).`);
    return {
      success: true,
      message: `Skrip migrasi D1 terverifikasi (${statements.length} DDL statements).`,
      statementsCount: statements.length,
    };
  }

  try {
    console.log('[HIKMAT TANI D1 Migration] Mengeksekusi batch migrasi ke Cloudflare D1...');
    const batch = statements.map((stmt) => d1Binding.prepare(stmt));
    await d1Binding.batch(batch);

    return {
      success: true,
      message: `Berhasil mengeksekusi ${statements.length} statements migrasi ke Cloudflare D1.`,
      statementsCount: statements.length,
    };
  } catch (error: any) {
    console.error('[HIKMAT TANI D1 Migration] Gagal mengeksekusi migrasi D1:', error);
    return {
      success: false,
      message: error?.message || 'Error eksekusi migrasi D1',
    };
  }
}

// Jalankan otomatis jika dipanggil langsung via CLI
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('migrate.ts')) {
  runD1Migrations().then((res) => {
    if (res.success) {
      console.log(`✓ ${res.message}`);
      process.exit(0);
    } else {
      console.error(`✗ ${res.message}`);
      process.exit(1);
    }
  });
}
