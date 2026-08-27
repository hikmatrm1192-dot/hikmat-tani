/**
 * HIKMAT TANI - Automated Backup, Restore & Sync-Readiness Subsystem Tests (Langkah 10)
 */

import { backupService } from '../src/backup/index.ts';
import { db } from '../src/db/database.ts';
import { outboxRepository } from '../src/db/repositories/outboxRepository.ts';
import { TestResult } from './index.test.ts';

export async function runBackupTests(): Promise<{
  allPassed: boolean;
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}> {
  const results: TestResult[] = [];

  async function test(name: string, fn: () => Promise<void>) {
    const start = performance.now();
    try {
      await fn();
      results.push({
        name,
        passed: true,
        message: 'Lolos uji verifikasi.',
        durationMs: Math.round(performance.now() - start),
      });
    } catch (err: any) {
      results.push({
        name,
        passed: false,
        message: err?.message || 'Gagal dalam pengujian.',
        durationMs: Math.round(performance.now() - start),
      });
    }
  }

  // Test 1: Generate Backup File Structure & Versioning
  await test('1. Pembuatan Cadangan Terstruktur & Versioned (format: hikmat-tani-backup, version: 1)', async () => {
    const result = await backupService.generateBackup();
    if (!result.fileName.startsWith('cadangan-hikmat-tani-')) {
      throw new Error(`Nama file tidak sesuai standar: ${result.fileName}`);
    }
    if (result.backup.format !== 'hikmat-tani-backup') {
      throw new Error(`Format backup bukan "hikmat-tani-backup": ${result.backup.format}`);
    }
    if (result.backup.version !== 1) {
      throw new Error(`Versi backup bukan 1: ${result.backup.version}`);
    }
    if (!result.backup.createdAt) {
      throw new Error('Waktu pembuatan createdAt tidak ditemukan.');
    }
    if (!result.jsonString || result.jsonString.length < 50) {
      throw new Error('Data JSON backup terlalu pendek atau kosong.');
    }
  });

  // Test 2: Backup Validation Schema & Non-Hikmat File Rejection
  await test('2. Validasi Format & Penolakan File Rusak / Bukan Cadangan', async () => {
    const valid = backupService.validateBackupData({
      format: 'hikmat-tani-backup',
      version: 1,
      createdAt: new Date().toISOString(),
      metadata: {
        backupVersion: '1.0.0',
        appVersion: '1.0.0',
        createdAt: new Date().toISOString(),
        recordCounts: {},
      },
      data: {
        farmers: [],
        lands: [],
      },
    });
    if (!valid) throw new Error('Data valid ditolak oleh validator.');

    const invalidBroken = backupService.validateBackupData({ broken: true });
    if (invalidBroken) throw new Error('Data rusak lolos dari validator.');

    const invalidOtherApp = backupService.validateBackupData({
      format: 'other-app-backup',
      version: 2,
      data: { users: [] },
    });
    if (invalidOtherApp) throw new Error('File aplikasi lain lolos dari validator.');
  });

  // Test 3: Relational Data Integrity Validation
  await test('3. Validasi Integritas Relasional Data (Data Integrity Check)', async () => {
    const validData = {
      lands: [
        {
          id: 'land-valid',
          farmerId: 'farmer-1',
          name: 'Sawah Petak 1',
          areaHa: 0.5,
          waterSource: 'IRRIGATION_TECHNICAL',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      cropSeasons: [
        {
          id: 'season-valid',
          landId: 'land-valid',
          name: 'MT1 2026',
          status: 'ACTIVE' as const,
          plantingDate: '2026-05-01',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };

    const validCheck = backupService.validateDataIntegrity(validData as any);
    if (!validCheck.valid) {
      throw new Error(`Data valid gagal integritas: ${validCheck.reason}`);
    }

    const invalidLandData = {
      lands: [
        {
          id: 'land-broken',
          farmerId: 'farmer-1',
          name: '',
          areaHa: -2, // Luas negatif tidak valid
          waterSource: 'IRRIGATION_TECHNICAL',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };

    const invalidCheck = backupService.validateDataIntegrity(invalidLandData as any);
    if (invalidCheck.valid) {
      throw new Error('Data lahan dengan luas negatif lolos dari pemeriksaan integritas.');
    }
  });

  // Test 4: Atomic Restore Transaction
  await test('4. Pemulihan Data Transaksional Atomik (Atomic Restore & Consistency)', async () => {
    const testId = `land_test_restore_${Date.now()}`;
    const mockBackup = {
      format: 'hikmat-tani-backup' as const,
      version: 1,
      createdAt: new Date().toISOString(),
      metadata: {
        backupVersion: '1.0.0',
        appVersion: '1.0.0',
        createdAt: new Date().toISOString(),
        recordCounts: { lands: 1 },
      },
      data: {
        lands: [
          {
            id: testId,
            farmerId: 'farmer-test',
            name: 'Petak Uji Pemulihan Atomik',
            areaHa: 0.5,
            waterSource: 'IRRIGATION_TECHNICAL',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    };

    const res = await backupService.restoreBackup(mockBackup as any);
    if (!res.success || res.recordCounts.lands < 1) {
      throw new Error('Gagal memulihkan catatan lahan uji.');
    }

    const restoredLand = await db.lands.get(testId);
    if (!restoredLand || restoredLand.name !== 'Petak Uji Pemulihan Atomik') {
      throw new Error('Lahan yang dipulihkan tidak sesuai dengan isi berkas.');
    }

    // Cleanup
    await db.lands.delete(testId);
  });

  // Test 5: Outbox Idempotency with OperationId
  await test('5. Antrean Outbox & Jaminan Idempotency (Unique operationId)', async () => {
    const testOpId = `op-test-idempotent-${Date.now()}`;
    const item1 = {
      id: `outbox-1-${Date.now()}`,
      operationId: testOpId,
      entityType: 'LAND' as const,
      entityId: 'land-test-op',
      action: 'CREATE' as const,
      payload: { name: 'Petak Outbox' },
      createdAt: new Date().toISOString(),
      retryCount: 0,
      status: 'PENDING' as const,
    };

    const id1 = await outboxRepository.add(item1);

    // Kirim ulang dengan operationId yang sama
    const item2 = {
      id: `outbox-2-${Date.now()}`,
      operationId: testOpId,
      entityType: 'LAND' as const,
      entityId: 'land-test-op',
      action: 'CREATE' as const,
      payload: { name: 'Petak Outbox (Duplikat UI Retry)' },
      createdAt: new Date().toISOString(),
      retryCount: 0,
      status: 'PENDING' as const,
    };

    const id2 = await outboxRepository.add(item2);

    if (id1 !== id2) {
      throw new Error(`Idempotency gagal: ID berbeda (${id1} vs ${id2}) untuk operationId yang sama.`);
    }

    // Cleanup
    await db.syncOutbox.where('operationId').equals(testOpId).delete();
  });

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return {
    allPassed: failed === 0,
    total: results.length,
    passed,
    failed,
    results,
  };
}
