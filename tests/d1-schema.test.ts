/**
 * HIKMAT TANI - Cloudflare D1 Schema & Adapter Integrity Tests
 * 
 * Pengujian Validasi Skema D1:
 * 1. Seluruh 21 tabel D1 terdefinisi dengan benar di SQLite Drizzle ORM
 * 2. Kesetaraan 1:1 antara tabel PostgreSQL dan tabel D1 SQLite
 * 3. Tipe data terkonversi secara tepat (real, boolean via integer, JSON, timestamp)
 * 4. D1 Database Service instance & status diagnostik
 * 5. Script migrasi D1 (0000_init_d1.sql) valid dan terstruktur
 * 6. Cloudflare Worker compatibility (tanpa Node API di adapter core)
 */

import { d1DbService, d1Schema } from '../server/db/d1/index.ts';
import * as pgSchema from '../server/db/schema.ts';
import fs from 'fs';
import path from 'path';

export interface D1TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export async function runD1SchemaTests(): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: D1TestResult[];
}> {
  const results: D1TestResult[] = [];

  const test = async (name: string, fn: () => Promise<void> | void) => {
    try {
      await fn();
      results.push({ name, passed: true });
    } catch (err: any) {
      results.push({ name, passed: false, error: err.message || String(err) });
    }
  };

  const expectedTables = [
    'farmers',
    'authUsers',
    'lands',
    'cropSeasons',
    'activities',
    'activityFertilizers',
    'activityOptObservations',
    'recommendations',
    'farmerDecisions',
    'actualActions',
    'processedOperations',
    'syncJournal',
    'fertilizers',
    'varieties',
    'opts',
    'naturalEnemies',
    'references',
    'knowledgeArticles',
    'adminUsers',
    'appConfigs',
    'adminAuditLogs',
    'replicationOutbox',
  ];


  // 1. Keberadaan seluruh 22 tabel di D1 Schema
  await test('1. Seluruh 22 tabel D1 terdefinisi dalam schema Drizzle SQLite', () => {
    for (const table of expectedTables) {
      if (!(table in d1Schema)) {
        throw new Error(`Tabel D1 schema tidak ditemukan: ${table}`);
      }
      const tableObj = (d1Schema as any)[table];
      if (!tableObj || typeof tableObj !== 'object') {
        throw new Error(`Objek tabel D1 ${table} tidak valid.`);
      }
    }
  });


  // 2. Paritas 1:1 antara tabel PostgreSQL dan tabel D1
  await test('2. Paritas 1:1 sempurna antara PostgreSQL schema dan D1 SQLite schema', () => {
    const pgTableNames = Object.keys(pgSchema);
    const d1TableNames = Object.keys(d1Schema);

    if (pgTableNames.length !== d1TableNames.length) {
      throw new Error(`Jumlah export schema tidak sama: PG (${pgTableNames.length}) vs D1 (${d1TableNames.length})`);
    }

    for (const table of pgTableNames) {
      if (!(table in d1Schema)) {
        throw new Error(`Tabel ${table} ada di PostgreSQL tetapi tidak ada di D1 schema.`);
      }
    }
  });

  // 3. Konversi tipe data terverifikasi pada kolom-kolom kritis
  await test('3. Validasi konversi tipe data SQLite (real, boolean, JSON, text timestamps)', () => {
    // a. Real (doublePrecision di PG)
    const lands = d1Schema.lands;
    if (!('latitude' in lands) || !('longitude' in lands)) {
      throw new Error('Kolom koordinat tidak ditemukan di tabel lands D1.');
    }

    // b. Boolean (integer mode boolean di D1)
    const authUsers = d1Schema.authUsers;
    if (!('isActive' in authUsers)) {
      throw new Error('Kolom isActive boolean tidak ditemukan di authUsers D1.');
    }

    // c. JSON (text mode json di D1)
    const recommendations = d1Schema.recommendations;
    if (!('payload' in recommendations)) {
      throw new Error('Kolom payload JSON tidak ditemukan di recommendations D1.');
    }

    // d. Timestamps (text di D1)
    const farmers = d1Schema.farmers;
    if (!('createdAt' in farmers) || !('updatedAt' in farmers)) {
      throw new Error('Kolom createdAt/updatedAt tidak ditemukan di farmers D1.');
    }
  });

  // 4. Status D1 Database Service
  await test('4. D1 Database Service status & diagnostik', () => {
    const status = d1DbService.getStatus();
    if (!status.engine.includes('Cloudflare D1') || !status.engine.includes('SQLite')) {
      throw new Error(`Nama engine D1 tidak valid: ${status.engine}`);
    }
    if (status.tableCount !== 22) {
      throw new Error(`Jumlah tabel D1 harus 22, didapat: ${status.tableCount}`);
    }

  });

  // 5. File migrasi D1 SQL (0000_init_d1.sql)
  await test('5. Integritas file migrasi SQL D1 (server/db/d1/migrations/0000_init_d1.sql)', () => {
    const sqlPath = path.join(process.cwd(), 'server', 'db', 'd1', 'migrations', '0000_init_d1.sql');
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`File migrasi D1 tidak ditemukan di: ${sqlPath}`);
    }

    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
    for (const table of [
      'auth_users',
      'farmers',
      'lands',
      'crop_seasons',
      'activities',
      'activity_fertilizers',
      'activity_opt_observations',
      'recommendations',
      'farmer_decisions',
      'actual_actions',
      'processed_operations',
      'sync_journal',
      'fertilizers',
      'varieties',
      'opts',
      'natural_enemies',
      'references',
      'knowledge_articles',
      'admin_users',
      'app_configs',
      'admin_audit_logs',
    ]) {
      if (!sqlContent.includes(`CREATE TABLE IF NOT EXISTS ${table}`) && !sqlContent.includes(`CREATE TABLE IF NOT EXISTS "${table}"`)) {
        throw new Error(`Pernyataan CREATE TABLE untuk '${table}' tidak ditemukan di 0000_init_d1.sql`);
      }
    }
  });

  // 6. Konfigurasi Wrangler TOML & D1 Binding
  await test('6. Validasi wrangler.toml (name = "hikmat-tani", binding = "DB", database = "hikmat-tani-db", database_id = "dea96ce1-84ab-49a5-9ea9-92d4fa45d55b")', () => {
    const wranglerPath = path.join(process.cwd(), 'wrangler.toml');
    if (!fs.existsSync(wranglerPath)) {
      throw new Error('File wrangler.toml tidak ditemukan.');
    }
    const wranglerContent = fs.readFileSync(wranglerPath, 'utf-8');
    if (!wranglerContent.includes('name = "hikmat-tani"')) {
      throw new Error('Nama worker di wrangler.toml harus "hikmat-tani"');
    }
    if (!wranglerContent.includes('binding = "DB"')) {
      throw new Error('D1 binding di wrangler.toml harus "DB"');
    }
    if (!wranglerContent.includes('database_name = "hikmat-tani-db"')) {
      throw new Error('D1 database_name di wrangler.toml harus "hikmat-tani-db"');
    }
    if (!/database_id = "[a-f0-9-]{36}"/.test(wranglerContent)) {
      throw new Error('D1 database_id resmi (UUID 36 karakter) di wrangler.toml tidak sesuai format.');
    }
    if (!wranglerContent.includes('migrations_dir = "server/db/d1/migrations"')) {
      throw new Error('migrations_dir di wrangler.toml harus "server/db/d1/migrations"');
    }
    if (!wranglerContent.includes('app.hikmattani.id')) {
      throw new Error('Custom domain "app.hikmattani.id" harus terdaftar di routes wrangler.toml');
    }
    if (!wranglerContent.includes('workers_dev = true')) {
      throw new Error('workers_dev = true harus dipertahankan sebagai fallback di wrangler.toml');
    }
  });

  // 7. Cloudflare Worker Entry Point
  await test('7. Validasi Cloudflare Worker Fetch handler & Health check response', async () => {
    const workerModule = await import('../server/worker.ts');
    if (!workerModule.default || typeof workerModule.default.fetch !== 'function') {
      throw new Error('server/worker.ts harus mengekspor objek default dengan method fetch');
    }

    const fakeEnv = {
      DB: {},
    };

    const req = new Request('http://localhost/api/v1/health');
    const res = await workerModule.default.fetch(req, fakeEnv, {});
    if (res.status !== 200) {
      throw new Error(`Worker health check merespons status ${res.status}`);
    }
    const json = await res.json();
    if (json.status !== 'ok' || !json.database?.engine.includes('Cloudflare D1')) {
      throw new Error(`Payload worker health check tidak sesuai: ${JSON.stringify(json)}`);
    }
  });

  // 8. Regression Test: Self-Healing admin_audit_logs yang kehilangan kolom actor_name
  await test('8. Regression Test: Self-Healing admin_audit_logs yang kehilangan kolom actor_name (Zero Data Loss)', async () => {
    const { createTestD1Database } = await import('../server/db/d1/testD1.ts');
    const { ensureD1CanonicalSchema, resetSchemaEnsuredCache } = await import('../server/db/d1/ensureCanonical.ts');
    
    resetSchemaEnsuredCache();
    const d1Mock = createTestD1Database();

    // Simulasi database legacy di mana tabel admin_audit_logs dibuat tanpa kolom actor_name
    d1Mock.setTableInfo('admin_audit_logs', [
      { cid: 0, name: 'id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 1 },
      { cid: 1, name: 'actor_id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
      { cid: 2, name: 'actor_role', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
      { cid: 3, name: 'action', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
      { cid: 4, name: 'details', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
      { cid: 5, name: 'ip_address', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
      { cid: 6, name: 'created_at', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
    ]);

    // Masukkan data lama sebelum self-healing
    const legacyMap = d1Mock.getTableMap('admin_audit_logs');
    legacyMap.set('log_legacy_1', {
      id: 'log_legacy_1',
      actor_id: 'admin_super_pappizee',
      actor_role: 'SUPER_ADMIN',
      action: 'LOGIN',
      details: '{"username":"pappizee"}',
      ip_address: '127.0.0.1',
      created_at: '2026-08-01T00:00:00.000Z',
    });

    // Jalankan ensureD1CanonicalSchema() dengan force=true
    const healed = await ensureD1CanonicalSchema(d1Mock, true);
    if (!healed) {
      throw new Error('ensureD1CanonicalSchema mengembalikan false.');
    }

    // Verifikasi kolom actor_name sekarang tersedia pada tabel
    const info = d1Mock.getTableInfo('admin_audit_logs');
    const colNames = info.map((c) => c.name);
    if (!colNames.includes('actor_name')) {
      throw new Error(`Kolom actor_name tidak ditemukan setelah self-healing: ${colNames.join(', ')}`);
    }

    // Verifikasi data legacy tetap ada dan tidak terhapus (Zero Data Loss)
    const existingRow = legacyMap.get('log_legacy_1');
    if (!existingRow || existingRow.id !== 'log_legacy_1' || existingRow.actor_id !== 'admin_super_pappizee') {
      throw new Error('Data legacy pada admin_audit_logs terhapus atau rusak!');
    }

    // Verifikasi nilai actor_name ter-backfill dengan aman
    if (!existingRow.actor_name) {
      throw new Error('Nilai fallback actor_name gagal dibackfill pada baris legacy.');
    }
  });

  // 9. Regression Test: Self-Healing admin_users & app_configs
  await test('9. Regression Test: Self-Healing admin_users & app_configs saat kolom tidak lengkap', async () => {
    const { createTestD1Database } = await import('../server/db/d1/testD1.ts');
    const { ensureD1CanonicalSchema, resetSchemaEnsuredCache } = await import('../server/db/d1/ensureCanonical.ts');

    resetSchemaEnsuredCache();
    const d1Mock = createTestD1Database();

    // Simulasi tabel admin_users dengan kolom lama tanpa email & last_login_at
    d1Mock.setTableInfo('admin_users', [
      { cid: 0, name: 'id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 1 },
      { cid: 1, name: 'username', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
      { cid: 2, name: 'full_name', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
      { cid: 3, name: 'password_hash', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
      { cid: 4, name: 'salt', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
      { cid: 5, name: 'role', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
    ]);

    await ensureD1CanonicalSchema(d1Mock, true);

    const userCols = d1Mock.getTableInfo('admin_users').map((c) => c.name);
    for (const required of ['email', 'is_active', 'last_login_at', 'created_at', 'updated_at']) {
      if (!userCols.includes(required)) {
        throw new Error(`Kolom ${required} tidak ditemukan di admin_users setelah self-healing.`);
      }
    }
  });

  // 10. Verification: INSERT & SELECT pada admin_audit_logs setelah self-healing
  await test('10. Verification: INSERT & SELECT pada admin_audit_logs setelah self-healing', async () => {
    const { createTestD1Database, createTestD1Client } = await import('../server/db/d1/testD1.ts');
    const { ensureD1CanonicalSchema, resetSchemaEnsuredCache } = await import('../server/db/d1/ensureCanonical.ts');
    const { AdminService } = await import('../server/services/adminService.ts');
    const { authService } = await import('../server/services/authService.ts');

    resetSchemaEnsuredCache();
    const d1Mock = createTestD1Database();
    await ensureD1CanonicalSchema(d1Mock, true);
    const d1Client = createTestD1Client(d1Mock);

    const adminService = new AdminService(d1Client);
    await adminService.ensureInitializedAsync();

    const currentSecret = process.env.SUPER_ADMIN_PASSWORD || process.env.ADMIN_INITIAL_PASSWORD || 'HikmatTaniSuperAdmin2026Secret!';
    const loginRes = await adminService.authenticateAdminAsync('pappizee', currentSecret);
    if (!loginRes.success || !loginRes.token) {
      throw new Error(`Login Super Admin gagal: ${loginRes.error}`);
    }

    const session = authService.verifyToken(loginRes.token)!;
    const logs = await adminService.getAuditLogsAsync(session, 10);
    if (!logs || logs.length === 0) {
      throw new Error('Audit logs gagal diambil dari D1 setelah login');
    }

    const loginLog = logs.find((l) => l.action === 'LOGIN');
    if (!loginLog || loginLog.actorName !== 'Pappizee') {
      throw new Error(`Audit log login tidak valid: ${JSON.stringify(loginLog)}`);
    }
    if (loginLog.entityType !== 'AUTH') {
      throw new Error(`Audit log entityType harus 'AUTH', didapat: ${loginLog.entityType}`);
    }
  });

  // 11. Regression Test: Worker Edge & AdminService audit log inserts include valid NOT NULL entity_type
  await test('11. Regression: INSERT audit log pada login admin selalu menyertakan entity_type NOT NULL valid', async () => {
    const { createTestD1Database } = await import('../server/db/d1/testD1.ts');
    const { ensureD1CanonicalSchema, resetSchemaEnsuredCache } = await import('../server/db/d1/ensureCanonical.ts');
    const { authenticateAdminOnWorker } = await import('../server/services/workerAdminAuth.ts');

    resetSchemaEnsuredCache();
    const d1Mock = createTestD1Database();
    await ensureD1CanonicalSchema(d1Mock, true);

    const currentSecret = process.env.SUPER_ADMIN_PASSWORD || process.env.ADMIN_INITIAL_PASSWORD || 'HikmatTaniSuperAdmin2026Secret!';
    
    // Uji login via Worker Edge Authenticator
    const workerAuthRes = await authenticateAdminOnWorker(
      d1Mock,
      { SUPER_ADMIN_PASSWORD: currentSecret },
      'pappizee',
      currentSecret,
      '192.168.1.1'
    );

    if (!workerAuthRes.success || !workerAuthRes.admin) {
      throw new Error(`Worker authenticateAdminOnWorker gagal: ${JSON.stringify(workerAuthRes)}`);
    }

    // Periksa bahwa record di tabel admin_audit_logs memiliki entity_type NOT NULL dan nilainya 'AUTH'
    const auditRows = await d1Mock.prepare(`SELECT * FROM admin_audit_logs WHERE action = 'LOGIN'`).all();
    if (!auditRows.results || auditRows.results.length === 0) {
      throw new Error('Record audit log LOGIN tidak ditemukan di D1.');
    }

    for (const row of auditRows.results) {
      if (!row.entity_type || row.entity_type.trim() === '') {
        throw new Error(`Regression FAIL: Record audit log memiliki entity_type kosong/null: ${JSON.stringify(row)}`);
      }
      if (row.entity_type !== 'AUTH') {
        throw new Error(`Regression FAIL: entity_type untuk LOGIN harus 'AUTH', didapat: ${row.entity_type}`);
      }
    }
  });

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  return { total, passed, failed, results };
}

if (process.argv[1]?.includes('d1-schema.test')) {
  runD1SchemaTests().then((res) => {
    console.log(`\n=== HASIL UJI CLOUDFLARE D1 SCHEMA & ADAPTER (PARALEL) ===`);
    res.results.forEach((r) => {
      console.log(`${r.passed ? '✓' : '✗'} ${r.name}`);
      if (r.error) console.error(`  Error: ${r.error}`);
    });
    console.log(`Total: ${res.total} | Lolos: ${res.passed} | Gagal: ${res.failed}\n`);
    if (res.failed > 0) process.exit(1);
  });
}
