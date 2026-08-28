/**
 * HIKMAT TANI - Two-Way Sync Test Suite (Persistent D1 Backend)
 * 
 * Pengujian komprehensif:
 * 1. Push satu operasi (tersimpan persistent di D1)
 * 2. Push batch
 * 3. Duplicate operationId (Idempotency di D1)
 * 4. Push unauthorized ownership (IDOR protection)
 * 5. Pull incremental membaca dari D1 sync_journal
 * 6. Sync cursor progression
 * 7. Retry on network failure / invalid payload
 * 8. Offline -> Online sync cycle
 * 9. Simulasi Dua Perangkat (Device A & Device B)
 * 10. Conflict Handling (Last-Write-Wins)
 * 11. Delete / Tombstone synchronization
 * 12. Protection: actualActions DELETE ditolak tegas (Kedaulatan Petani)
 * 13. Persistence: Service instance dibuat ulang -> operationId lama tetap dikenali di D1
 * 14. Persistence: Service instance dibuat ulang -> journal tetap tersedia di D1
 * 15. D1 Failure Protection: Error D1 tidak menghasilkan ack sukses palsu
 */

import { SyncService, SyncPushItem } from '../server/services/syncService.ts';
import { AuthSessionPayload } from '../server/services/authService.ts';
import { createTestD1Client, InMemoryD1Database } from '../server/db/d1/testD1.ts';
import { drizzle } from 'drizzle-orm/d1';
import * as d1Schema from '../server/db/d1/schema.ts';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export async function runSyncTests(): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}> {
  const results: TestResult[] = [];

  const runTest = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      results.push({ name, passed: true });
    } catch (err: any) {
      results.push({ name, passed: false, error: err?.message || String(err) });
    }
  };

  // Gunakan persistent shared D1 in-memory engine untuk pengujian
  const sharedD1Engine = new InMemoryD1Database();
  const sharedD1Client = drizzle(sharedD1Engine, { schema: d1Schema });

  const syncService = new SyncService(sharedD1Client);
  await syncService.resetStore();

  // Siapkan identitas user & petani uji
  const farmerUserA: AuthSessionPayload = {
    userId: 'usr_petani_a',
    farmerId: 'farmer_a',
    role: 'farmer',
    isAnonymous: false,
    issuedAt: Date.now(),
  };

  const farmerUserB: AuthSessionPayload = {
    userId: 'usr_petani_b',
    farmerId: 'farmer_b',
    role: 'farmer',
    isAnonymous: false,
    issuedAt: Date.now(),
  };

  // ==========================================
  // 1. Push Satu Operasi
  // ==========================================
  await runTest('1. Push satu operasi mutasi lokal ke D1 (Persistent)', async () => {
    const item: SyncPushItem = {
      operationId: 'op_single_001',
      entityType: 'LAND',
      entityId: 'land_a_1',
      action: 'CREATE',
      payload: {
        id: 'land_a_1',
        farmerId: 'farmer_a',
        name: 'Petak Sawah Barat',
        areaM2: 5000,
        soilType: 'Lempung Liat',
        irrigationType: 'Irigasi Teknis',
      },
    };

    const res = await syncService.processPush(farmerUserA, [item]);
    if (!res.success || res.processedCount !== 1) {
      throw new Error(`Push gagal: processedCount ${res.processedCount}`);
    }
    if (!res.acknowledgedOperationIds.includes('op_single_001')) {
      throw new Error('OperationId tidak di-acknowledge');
    }

    // Verifikasi bahwa data benar-benar tersimpan di tabel D1
    const stats = await syncService.getStats('farmer_a');
    if (stats.totalProcessedOps < 1 || stats.totalJournalEntries < 1) {
      throw new Error('Data tidak tersimpan di tabel D1');
    }
  });

  // ==========================================
  // 2. Push Batch
  // ==========================================
  await runTest('2. Push batch banyak operasi sekaligus ke D1', async () => {
    const batch: SyncPushItem[] = [
      {
        operationId: 'op_batch_001',
        entityType: 'CROP_SEASON',
        entityId: 'season_a_1',
        action: 'CREATE',
        payload: {
          id: 'season_a_1',
          landId: 'land_a_1',
          seasonNumber: 1,
          varietyId: 'ciherang',
          plantingDate: '2026-05-10',
          status: 'ACTIVE',
        },
      },
      {
        operationId: 'op_batch_002',
        entityType: 'ACTIVITY',
        entityId: 'act_a_1',
        action: 'CREATE',
        payload: {
          id: 'act_a_1',
          cropSeasonId: 'season_a_1',
          date: '2026-05-10',
          hst: 0,
          category: 'TANAM',
          activityType: 'Tanam Bibit',
        },
      },
    ];

    const res = await syncService.processPush(farmerUserA, batch);
    if (res.processedCount !== 2 || res.acknowledgedOperationIds.length !== 2) {
      throw new Error(`Batch push tidak lengkap: processed ${res.processedCount}`);
    }
  });

  // ==========================================
  // 3. Duplicate operationId (Idempotency)
  // ==========================================
  await runTest('3. Idempotency: Duplicate operationId tidak menduplikasi data di D1', async () => {
    const duplicateItem: SyncPushItem = {
      operationId: 'op_batch_001', // Sudah pernah di-push di test 2
      entityType: 'CROP_SEASON',
      entityId: 'season_a_1',
      action: 'CREATE',
      payload: {
        id: 'season_a_1',
        landId: 'land_a_1',
      },
    };

    const res = await syncService.processPush(farmerUserA, [duplicateItem]);
    // Harus di-acknowledge tapi tidak memproses mutasi baru (processedCount: 0)
    if (!res.acknowledgedOperationIds.includes('op_batch_001')) {
      throw new Error('Duplicate operationId tidak di-acknowledge');
    }
    if (res.processedCount !== 0) {
      throw new Error(`Mutasi duplikat seharusnya tidak diproses, didapat: ${res.processedCount}`);
    }
  });

  // ==========================================
  // 4. Push Unauthorized Ownership (IDOR)
  // ==========================================
  await runTest('4. Authorization: Menolak push untuk farmerId milik pengguna lain (IDOR Protection)', async () => {
    const maliciousItem: SyncPushItem = {
      operationId: 'op_hack_001',
      entityType: 'LAND',
      entityId: 'land_b_secret',
      action: 'CREATE',
      payload: {
        id: 'land_b_secret',
        farmerId: 'farmer_b', // Farmer A mencoba menulis data atas nama Farmer B
        name: 'Sawah Curian',
      },
    };

    let errorThrown = false;
    try {
      await syncService.processPush(farmerUserA, [maliciousItem]);
    } catch (err: any) {
      errorThrown = true;
      if (err.code !== 'UNAUTHORIZED_OWNERSHIP') {
        throw new Error(`Error code salah: ${err.code}`);
      }
    }

    if (!errorThrown) {
      throw new Error('Server tidak memblokir penulisan data lintas petani');
    }
  });

  // ==========================================
  // 5. Pull Incremental dari D1 sync_journal
  // ==========================================
  await runTest('5. Pull incremental: Menarik hanya perubahan sejak timestamp tertentu dari D1', async () => {
    const checkpointTimestamp = new Date().toISOString();

    // Jeda kecil agar timestamp lebih baru
    await new Promise((r) => setTimeout(r, 15));

    const newItem: SyncPushItem = {
      operationId: 'op_after_checkpoint',
      entityType: 'ACTIVITY',
      entityId: 'act_a_pupuk_1',
      action: 'CREATE',
      payload: {
        id: 'act_a_pupuk_1',
        cropSeasonId: 'season_a_1',
        category: 'PEMUPUKAN',
        hst: 14,
        date: '2026-05-24',
      },
    };
    await syncService.processPush(farmerUserA, [newItem]);

    const pullRes = await syncService.processPull(farmerUserA, checkpointTimestamp);
    if (pullRes.changes.length !== 1) {
      throw new Error(`Seharusnya hanya 1 perubahan ditarik, didapat: ${pullRes.changes.length}`);
    }
    if (pullRes.changes[0].entityId !== 'act_a_pupuk_1') {
      throw new Error('Entitas yang ditarik tidak sesuai');
    }
  });

  // ==========================================
  // 6. Sync Cursor Progression
  // ==========================================
  await runTest('6. Sync cursor: Memperbarui posisi sinkronisasi server timestamp di D1', async () => {
    const pullRes1 = await syncService.processPull(farmerUserA);
    const cursor = pullRes1.serverTimestamp;

    const pullRes2 = await syncService.processPull(farmerUserA, cursor);
    if (pullRes2.changes.length !== 0) {
      throw new Error(`Cursor tidak bekerja, didapat ${pullRes2.changes.length} perubahan duplikat`);
    }
  });

  // ==========================================
  // 7. Retry & Payload Validation
  // ==========================================
  await runTest('7. Retry & Outbox safety: Item gagal divalidasi tidak diproses', async () => {
    let failed = false;
    try {
      await syncService.processPush(farmerUserA, [
        {
          operationId: '',
          entityType: 'LAND',
          entityId: 'x',
          action: 'CREATE',
          payload: {},
        } as any,
      ]);
    } catch {
      failed = true;
    }
    if (!failed) {
      throw new Error('Seharusnya melempar error saat payload invalid');
    }
  });

  // ==========================================
  // 8. Offline -> Online Cycle
  // ==========================================
  await runTest('8. Offline -> Online sync cycle di D1', async () => {
    const offlineItems: SyncPushItem[] = [
      {
        operationId: 'op_offline_001',
        entityType: 'OPT_OBSERVATION',
        entityId: 'opt_obs_1',
        action: 'CREATE',
        payload: {
          id: 'opt_obs_1',
          cropSeasonId: 'season_a_1',
          optId: 'wereng_coklat',
          severity: 'SEDANG',
          affectedAreaPercentage: 15,
        },
      },
    ];

    const pushResult = await syncService.processPush(farmerUserA, offlineItems);
    if (!pushResult.success || pushResult.processedCount !== 1) {
      throw new Error('Gagal push saat kembali online');
    }
  });

  // ==========================================
  // 9. Simulasi Dua Perangkat (Device A & Device B)
  // ==========================================
  await runTest('9. Simulasi Dua Perangkat: Device A push & Device B pull dari D1', async () => {
    const deviceAActivity: SyncPushItem = {
      operationId: 'op_dev_a_spray',
      entityType: 'ACTIVITY',
      entityId: 'act_spray_001',
      action: 'CREATE',
      payload: {
        id: 'act_spray_001',
        cropSeasonId: 'season_a_1',
        category: 'PENGENDALIAN_HAMA',
        activityType: 'Aplikasi Jamur Beauveria bassiana',
        hst: 21,
      },
    };

    const pushDevA = await syncService.processPush(farmerUserA, [deviceAActivity]);
    if (!pushDevA.success) throw new Error('Device A gagal push');

    const pullDevB = await syncService.processPull(farmerUserA);
    const pulledActivity = pullDevB.changes.find((c) => c.entityId === 'act_spray_001');

    if (!pulledActivity) {
      throw new Error('Device B tidak menerima kegiatan yang dicatat oleh Device A');
    }
    if (pulledActivity.action !== 'CREATE' || pulledActivity.payload.category !== 'PENGENDALIAN_HAMA') {
      throw new Error('Data kegiatan di Device B tidak utuh atau korup');
    }
  });

  // ==========================================
  // 10. Conflict Resolution (Last-Write-Wins)
  // ==========================================
  await runTest('10. Conflict Handling: Last-Write-Wins berdasarkan serverTimestamp & updatedAt', async () => {
    const baseMs = Date.now() + 1000;
    const t1 = new Date(baseMs).toISOString();
    const t2 = new Date(baseMs + 5000).toISOString();

    await syncService.processPush(farmerUserA, [
      {
        operationId: 'op_conflict_init',
        entityType: 'LAND',
        entityId: 'land_conflict_test',
        action: 'CREATE',
        payload: {
          id: 'land_conflict_test',
          name: 'Petak Awal',
          updatedAt: new Date(baseMs - 1000).toISOString(),
        },
      },
    ]);

    await syncService.processPush(farmerUserA, [
      {
        operationId: 'op_conflict_1',
        entityType: 'LAND',
        entityId: 'land_conflict_test',
        action: 'UPDATE',
        payload: {
          id: 'land_conflict_test',
          name: 'Petak Sawah Barat (Nama Versi 1)',
          updatedAt: t1,
        },
      },
    ]);

    await syncService.processPush(farmerUserA, [
      {
        operationId: 'op_conflict_2',
        entityType: 'LAND',
        entityId: 'land_conflict_test',
        action: 'UPDATE',
        payload: {
          id: 'land_conflict_test',
          name: 'Petak Sawah Barat (Nama Terkini)',
          updatedAt: t2,
        },
      },
    ]);

    const pullRes = await syncService.processPull(farmerUserA);
    const landUpdates = pullRes.changes.filter((c) => c.entityId === 'land_conflict_test');
    const latestUpdate = landUpdates[landUpdates.length - 1];

    if (latestUpdate.payload.name !== 'Petak Sawah Barat (Nama Terkini)') {
      throw new Error(`Konflik gagal diselesaikan via LWW: didapat '${latestUpdate.payload.name}'`);
    }
  });

  // ==========================================
  // 11. Delete / Tombstone Synchronization
  // ==========================================
  await runTest('11. Delete & Tombstone: Penyebaran penghapusan aman antar perangkat via D1', async () => {
    const deleteOp: SyncPushItem = {
      operationId: 'op_del_land_001',
      entityType: 'LAND',
      entityId: 'land_del_test',
      action: 'DELETE',
      payload: {
        id: 'land_del_test',
      },
    };

    const res = await syncService.processPush(farmerUserA, [deleteOp]);
    if (!res.success) throw new Error('Gagal push penghapusan');

    const pullRes = await syncService.processPull(farmerUserA);
    const tombstone = pullRes.changes.find((c) => c.entityId === 'land_del_test');

    if (!tombstone) {
      throw new Error('Tombstone penghapusan tidak ditemukan pada pull');
    }
    if (!tombstone.isTombstone || tombstone.action !== 'DELETE') {
      throw new Error('Tombstone format tidak sesuai');
    }
  });

  // ==========================================
  // 12. Protection: actualActions DELETE ditolak tegas
  // ==========================================
  await runTest('12. Protection: actualActions DELETE diblokir secara tegas (Kedaulatan Petani)', async () => {
    // 1. Buat actual action
    const createOp: SyncPushItem = {
      operationId: 'op_act_mandiri_01',
      entityType: 'ACTUAL_ACTION',
      entityId: 'actual_action_001',
      action: 'CREATE',
      payload: {
        id: 'actual_action_001',
        decisionId: 'dec_001',
        actionDescription: 'Mengaplikasikan PGPR 5 ml/liter pada rumpun padi',
        executedAt: new Date().toISOString(),
      },
    };
    await syncService.processPush(farmerUserA, [createOp]);

    // 2. Coba kirim DELETE pada actual action
    const deleteAttempt: SyncPushItem = {
      operationId: 'op_act_mandiri_del_01',
      entityType: 'ACTUAL_ACTION',
      entityId: 'actual_action_001',
      action: 'DELETE',
      payload: {
        id: 'actual_action_001',
      },
    };

    let deleteBlocked = false;
    try {
      await syncService.processPush(farmerUserA, [deleteAttempt]);
    } catch (err: any) {
      if (err.code === 'ACTUAL_ACTION_PROTECTED') {
        deleteBlocked = true;
      }
    }

    if (!deleteBlocked) {
      throw new Error('Penghapusan actual_action seharusnya diblokir dan melempar error ACTUAL_ACTION_PROTECTED');
    }
  });

  // ==========================================
  // 13. Persistence: Service instance dibuat ulang -> operationId lama tetap dikenali
  // ==========================================
  await runTest('13. Persistence: Service instance dibuat ulang -> operationId lama tetap dikenali di D1', async () => {
    // Buat instance SyncService baru yang menggunakan database D1 yang sama (simulasi Worker restart)
    const restartedSyncService = new SyncService(sharedD1Client);

    // Coba kirim operationId yang sudah pernah diproses pada instance sebelumnya
    const res = await restartedSyncService.processPush(farmerUserA, [
      {
        operationId: 'op_single_001', // dari test 1
        entityType: 'LAND',
        entityId: 'land_a_1',
        action: 'CREATE',
        payload: { id: 'land_a_1' },
      },
    ]);

    if (!res.acknowledgedOperationIds.includes('op_single_001')) {
      throw new Error('OperationId lama tidak di-acknowledge oleh service instance baru');
    }
    if (res.processedCount !== 0) {
      throw new Error('Service instance baru memproses ulang operasi yang sudah ada di D1');
    }
  });

  // ==========================================
  // 14. Persistence: Service instance dibuat ulang -> journal tetap tersedia
  // ==========================================
  await runTest('14. Persistence: Service instance dibuat ulang -> journal tetap terbaca dari D1', async () => {
    const restartedSyncService = new SyncService(sharedD1Client);

    const pullRes = await restartedSyncService.processPull(farmerUserA);
    if (pullRes.changes.length === 0) {
      throw new Error('Journal kosong setelah service instance dibuat ulang');
    }

    const foundLand = pullRes.changes.find((c) => c.entityId === 'land_a_1');
    if (!foundLand) {
      throw new Error('Data land_a_1 tidak ditemukan di journal D1 setelah restart');
    }
  });

  // ==========================================
  // 15. D1 Failure Protection: Error D1 tidak menghasilkan ack sukses palsu
  // ==========================================
  await runTest('15. D1 Failure Protection: Kegagalan D1 melempar error dan tidak meng-ack sukses palsu', async () => {
    // Mock D1 binding yang melempar error saat query
    const brokenD1Engine = {
      prepare() {
        return {
          bind() { return this; },
          async run() { throw new Error('D1 Disk Full / Network Broken'); },
          async all() { throw new Error('D1 Disk Full / Network Broken'); },
          async first() { throw new Error('D1 Disk Full / Network Broken'); },
        };
      },
      async dump() { return new ArrayBuffer(0); },
      async batch() { throw new Error('D1 Error'); },
      async exec() { throw new Error('D1 Error'); },
    };

    const brokenD1Client = drizzle(brokenD1Engine as any, { schema: d1Schema });
    const brokenSyncService = new SyncService(brokenD1Client);

    let errorThrown = false;
    try {
      await brokenSyncService.processPush(farmerUserA, [
        {
          operationId: 'op_broken_test_001',
          entityType: 'LAND',
          entityId: 'land_broken_1',
          action: 'CREATE',
          payload: { id: 'land_broken_1' },
        },
      ]);
    } catch {
      errorThrown = true;
    }

    if (!errorThrown) {
      throw new Error('SyncService seharusnya melempar exception saat D1 gagal dan tidak memberikan ack palsu');
    }
  });

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  return { total, passed, failed, results };
}

// Eksekusi jika dijalankan secara mandiri via CLI (tsx tests/sync.test.ts)
if (process.argv[1]?.includes('sync.test')) {
  runSyncTests().then((res) => {
    console.log(`\n=== HASIL UJI TWO-WAY SYNC (PERSISTENT D1 BACKEND) ===`);
    res.results.forEach((r) => {
      console.log(`${r.passed ? '✓' : '✗'} ${r.name}`);
      if (r.error) console.error(`  Error: ${r.error}`);
    });
    console.log(`Total: ${res.total} | Lolos: ${res.passed} | Gagal: ${res.failed}\n`);
    if (res.failed > 0) process.exit(1);
  });
}
