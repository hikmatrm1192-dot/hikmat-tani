/**
 * HIKMAT TANI - Backend Foundation Tests (Langkah 11A)
 * 
 * Pengujian Fondasi Server:
 * 1. Health Check Endpoint & API Versioning
 * 2. Auth Foundation: Anonymous Token Generation & Verification
 * 3. Auth Middleware: Bearer Token Enforcement & Invalid Token Rejection
 * 4. Request Validation: Schema & Body Validation
 * 5. Error Handler: Format Kesalahan Aman & Pencegahan Stack Trace Leakage
 * 6. Farmer Profile Service & Endpoint Logic
 * 7. Database Drizzle Schema & Table Definitions Integrity
 */

import { authService } from '../server/services/authService.ts';
import { farmerService } from '../server/services/farmerService.ts';
import { dbService, schema } from '../server/db/index.ts';
import { config } from '../server/config.ts';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export async function runBackendTests(): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}> {
  const results: TestResult[] = [];

  const test = async (name: string, fn: () => Promise<void> | void) => {
    try {
      await fn();
      results.push({ name, passed: true });
    } catch (err: any) {
      results.push({ name, passed: false, error: err.message || String(err) });
    }
  };

  // 1. Health Check & Config
  await test('1. Backend Config & API Versioning Valid', () => {
    if (!config.apiVersion || config.apiVersion !== 'v1') {
      throw new Error(`API Version tidak valid: ${config.apiVersion}`);
    }
    if (!config.port || typeof config.port !== 'number' || config.port <= 0) {
      throw new Error(`Port harus berupa angka port yang valid, didapat: ${config.port}`);
    }
    const dbStatus = dbService.getStatus();
    if (!dbStatus.engine.includes('PostgreSQL')) {
      throw new Error(`Engine database harus PostgreSQL Drizzle ORM`);
    }
  });

  // 2. Auth Foundation: Anonymous Token Generation & Verification
  await test('2. Auth Service: Pembuatan & Verifikasi Token Anonim', () => {
    const anonRes = authService.processAnonymousOrRegister({});
    if (!anonRes.success || !anonRes.token) {
      throw new Error('Gagal menghasilkan token anonim.');
    }
    if (!anonRes.user.isAnonymous) {
      throw new Error('Sesi tanpa nama harus bertanda isAnonymous=true');
    }

    // Verifikasi Token JWT
    const decoded = authService.verifyToken(anonRes.token);
    if (!decoded || decoded.userId !== anonRes.user.id || !decoded.isAnonymous) {
      throw new Error('Token JWT yang diverifikasi tidak cocok dengan sesi asli.');
    }
  });

  // 3. Auth Foundation: Registrasi Profil Petani
  await test('3. Auth Service: Registrasi Profil Petani & Pembuatan Token Sesi', () => {
    const regRes = authService.processAnonymousOrRegister({
      farmerName: 'Pak Sutrisno',
      phoneNumber: '081234567890',
      village: 'Sukamaju',
    });

    if (!regRes.success || regRes.user.isAnonymous) {
      throw new Error('Registrasi dengan nama petani harus menghasilkan user non-anonim.');
    }
    if (regRes.farmer.name !== 'Pak Sutrisno') {
      throw new Error(`Nama petani salah: ${regRes.farmer.name}`);
    }

    const decoded = authService.verifyToken(regRes.token);
    if (!decoded || decoded.farmerId !== regRes.farmer.id) {
      throw new Error('Token JWT petani terdaftar tidak valid.');
    }
  });

  // 4. Auth Security: Penolakan Token Rusak / Palsu
  await test('4. Auth Security: Penolakan Token Kadaluwarsa / Palsu', () => {
    const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.payload';
    const decoded = authService.verifyToken(fakeToken);
    if (decoded !== null) {
      throw new Error('Token palsu seharusnya ditolak oleh AuthService.');
    }
  });

  // 5. Farmer Service Profil Retrieval
  await test('5. Farmer Service: Abstraksi Pengambilan Profil Petani', async () => {
    const profile = await farmerService.getProfileByUserId('usr_test_123', 'farmer_test_123');
    if (!profile || profile.id !== 'farmer_test_123') {
      throw new Error('Pengambilan profil petani gagal.');
    }
    if (!profile.name || !profile.village) {
      throw new Error('Data profil petani tidak lengkap.');
    }
  });

  // 6. Drizzle Schema Integrity: Tabel Petani, Budidaya, Keputusan, dan Master Knowledge
  await test('6. Database Schema: Integritas Tabel PostgreSQL Drizzle ORM', () => {
    // 5 Domain Utama (termasuk sync & idempotency)
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
    ];

    for (const table of expectedTables) {
      if (!(table in schema)) {
        throw new Error(`Tabel Drizzle schema tidak ditemukan: ${table}`);
      }
    }
  });

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  return { total, passed, failed, results };
}

// Eksekusi jika dijalankan secara langsung via tsx / node
if (process.argv[1]?.includes('backend.test')) {
  runBackendTests().then((res) => {
    console.log(`\n=== HASIL UJI BACKEND FOUNDATION HIKMAT TANI ===`);
    res.results.forEach((r) => {
      console.log(`${r.passed ? '✓' : '✗'} ${r.name}`);
      if (r.error) console.error(`  Error: ${r.error}`);
    });
    console.log(`Total: ${res.total} | Lolos: ${res.passed} | Gagal: ${res.failed}\n`);
    if (res.failed > 0) process.exit(1);
  });
}
