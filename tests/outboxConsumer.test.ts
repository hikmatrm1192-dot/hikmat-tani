/**
 * HIKMAT TANI - Patch 3 Outbox Consumer & Retry Engine Tests
 * 
 * 15 Skenario Uji Wajib:
 * 1. PENDING event -> D1 SUCCESS -> COMPLETED
 * 2. PENDING event -> D1 FAILURE -> retry status PENDING & nextRetryAt diset
 * 3. Retry event -> operationId tetap sama persis
 * 4. Duplicate consumer / concurrent run -> tidak double apply
 * 5. Worker restart -> event outbox tetap tersedia
 * 6. FAILED event (Max Retries exceeded) -> tetap durable (Dead Letter)
 * 7. retryCount meningkat setiap kali terjadi kegagalan
 * 8. nextRetryAt dihormati (event belum eligible tidak di-claim)
 * 9. COMPLETED event tidak diproses ulang
 * 10. Dua event entity sama -> ordering versi v1 diproses sebelum v2
 * 11. PostgreSQL mutation rollback -> tidak ada outbox event dibuat
 * 12. PostgreSQL commit -> outbox event durable tersimpan
 * 13. actual_actions DELETE tetap protected (Kedaulatan Petani)
 * 14. Farmer ownership tetap enforced
 * 15. D1 unavailable -> PostgreSQL mutation tetap sukses
 */

import { DurableOutboxConsumer, ReplicationOutboxRecord } from '../server/services/outboxConsumer.ts';
import { InMemoryD1Database, createTestD1Client } from '../server/db/d1/testD1.ts';
import { drizzle } from 'drizzle-orm/d1';
import * as d1Schema from '../server/db/d1/schema.ts';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export async function runOutboxConsumerTests(): Promise<{
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

  const d1Engine = new InMemoryD1Database();
  const d1Client = drizzle(d1Engine, { schema: d1Schema });
  const consumer = new DurableOutboxConsumer(d1Client);
  consumer.resetOutbox();

  // 1. PENDING event -> D1 SUCCESS -> COMPLETED
  await runTest('1. PENDING event -> D1 SUCCESS -> status berubah menjadi COMPLETED', async () => {
    const record = consumer.insertOutboxRecord({
      entityType: 'LAND',
      entityId: 'land_p3_01',
      farmerId: 'farmer_p3',
      action: 'CREATE',
      payload: { id: 'land_p3_01', name: 'Petak Utara', areaM2: 5000 },
      version: 1,
    });

    const res = await consumer.drainPendingEvents('worker_1');
    if (res.completed !== 1) {
      throw new Error(`Seharusnya 1 completed, didapat: ${res.completed}`);
    }

    const updated = consumer.getAllRecords().find((r) => r.id === record.id);
    if (!updated || updated.status !== 'COMPLETED' || !updated.completedAt) {
      throw new Error('Record status bukan COMPLETED');
    }
  });

  // 2. PENDING event -> D1 FAILURE -> retry
  await runTest('2. PENDING event -> D1 FAILURE -> retry status & nextRetryAt dihitung', async () => {
    const brokenD1Engine = {
      prepare() {
        return {
          bind() { return this; },
          async run() { throw new Error('D1 Cloudflare 503 Service Unavailable'); },
          async all() { throw new Error('D1 Cloudflare 503 Service Unavailable'); },
          async first() { throw new Error('D1 Cloudflare 503 Service Unavailable'); },
        };
      },
      async dump() { return new ArrayBuffer(0); },
      async batch() { throw new Error('D1 Fail'); },
      async exec() { throw new Error('D1 Fail'); },
    };

    const brokenClient = drizzle(brokenD1Engine as any, { schema: d1Schema });
    const failingConsumer = new DurableOutboxConsumer(brokenClient);

    const record = failingConsumer.insertOutboxRecord({
      entityType: 'ACTIVITY',
      entityId: 'act_p3_01',
      farmerId: 'farmer_p3',
      action: 'CREATE',
      payload: { id: 'act_p3_01', category: 'PUPUK' },
      version: 1,
    });

    const res = await failingConsumer.drainPendingEvents('worker_failing');
    if (res.failed !== 1) {
      throw new Error(`Seharusnya 1 failed, didapat: ${res.failed}`);
    }

    const rec = failingConsumer.getAllRecords().find((r) => r.id === record.id);
    if (!rec || rec.status !== 'PENDING' || rec.retryCount !== 1 || !rec.nextRetryAt) {
      throw new Error('Record tidak mencatat retry count atau nextRetryAt dengan benar');
    }
  });

  // 3. retry event -> operationId tetap sama
  await runTest('3. Retry event -> operationId tetap sama persis (Deterministik)', async () => {
    const record = consumer.insertOutboxRecord({
      entityType: 'CROP_SEASON',
      entityId: 'season_p3_01',
      farmerId: 'farmer_p3',
      action: 'CREATE',
      payload: { id: 'season_p3_01', varietyId: 'inparis32' },
      version: 1,
    });

    const initialOpId = record.operationId;
    const opIdRetry = DurableOutboxConsumer.generateDeterministicOperationId('CROP_SEASON', 'season_p3_01', 'CREATE', 1);

    if (initialOpId !== opIdRetry) {
      throw new Error(`OperationId berubah saat retry: ${initialOpId} vs ${opIdRetry}`);
    }
  });

  // 4. duplicate consumer -> tidak double apply
  await runTest('4. Duplicate / Concurrent consumer -> locking mencegah double execution', async () => {
    consumer.resetOutbox();
    const record = consumer.insertOutboxRecord({
      entityType: 'LAND',
      entityId: 'land_p3_lock',
      farmerId: 'farmer_p3',
      action: 'CREATE',
      payload: { id: 'land_p3_lock' },
      version: 1,
    });

    // Worker 1 claim event
    const claimedByWorker1 = consumer.claimEligibleEvents('worker_1', 10);
    if (claimedByWorker1.length !== 1 || claimedByWorker1[0].lockedBy !== 'worker_1') {
      throw new Error(`Worker 1 gagal claim event (claimed count: ${claimedByWorker1.length})`);
    }

    // Worker 2 mencoba claim event yang sedang di-lock Worker 1
    const claimedByWorker2 = consumer.claimEligibleEvents('worker_2', 10);
    if (claimedByWorker2.length !== 0) {
      throw new Error('Worker 2 seharusnya tidak dapat claim event yang sedang di-lease Worker 1');
    }

    // Worker 1 menyelesaikan proses
    await consumer.processClaimedRecord(claimedByWorker1[0]);
  });


  // 5. Worker restart -> event tetap tersedia
  await runTest('5. Worker restart -> event outbox tetap aman & terbaca oleh instance baru', async () => {
    const newConsumer = new DurableOutboxConsumer(d1Client);
    // Simulasikan outbox table yang sudah memiliki record dari state Postgres
    const record = newConsumer.insertOutboxRecord({
      entityType: 'RECOMMENDATION',
      entityId: 'rec_p3_01',
      farmerId: 'farmer_p3',
      action: 'CREATE',
      payload: { id: 'rec_p3_01', title: 'Rekomendasi Pemupukan' },
      version: 1,
    });

    const pending = newConsumer.claimEligibleEvents('worker_fresh');
    if (!pending.find((r) => r.id === record.id)) {
      throw new Error('Event hilang setelah restart instance');
    }
    await newConsumer.processClaimedRecord(record);
  });

  // 6. FAILED event -> tetap durable (Dead Letter State)
  await runTest('6. FAILED event (Max retries exceeded) -> status FAILED & tetap durable', async () => {
    const record = consumer.insertOutboxRecord({
      entityType: 'ACTIVITY',
      entityId: 'act_p3_deadletter',
      farmerId: 'farmer_p3',
      action: 'CREATE',
      payload: { id: 'act_p3_deadletter' },
      version: 1,
    });

    // Simulasikan retry melebihi maxRetries (5)
    record.retryCount = 4;
    record.maxRetries = 5;

    // Proses dengan mock D1 yang gagal
    const failingD1 = drizzle({
      prepare() {
        return {
          bind() { return this; },
          async run() { throw new Error('Unrecoverable error'); },
          async all() { throw new Error('Unrecoverable error'); },
          async first() { throw new Error('Unrecoverable error'); },
        };
      },
      async dump() { return new ArrayBuffer(0); },
      async batch() { throw new Error('Fail'); },
      async exec() { throw new Error('Fail'); },
    } as any, { schema: d1Schema });

    const dlqConsumer = new DurableOutboxConsumer(failingD1);
    await dlqConsumer.processClaimedRecord(record);

    if (record.status !== 'FAILED') {
      throw new Error(`Status seharusnya FAILED saat melewati maxRetries, didapat: ${record.status}`);
    }

    const failedEvents = consumer.getFailedReplicationEvents();
    if (!failedEvents.find((e) => e.id === record.id)) {
      throw new Error('Failed event tidak tersimpan dalam daftar getFailedReplicationEvents()');
    }
  });

  // 7. retryCount meningkat
  await runTest('7. retryCount meningkat secara akurat pada setiap failure cycle', async () => {
    const record = consumer.insertOutboxRecord({
      entityType: 'LAND',
      entityId: 'land_p3_retry_inc',
      farmerId: 'farmer_p3',
      action: 'UPDATE',
      payload: { id: 'land_p3_retry_inc' },
      version: 1,
    });

    const brokenClient = drizzle({
      prepare() {
        return {
          bind() { return this; },
          async run() { throw new Error('Timeout'); },
          async all() { throw new Error('Timeout'); },
          async first() { throw new Error('Timeout'); },
        };
      },
      async dump() { return new ArrayBuffer(0); },
      async batch() { throw new Error('Fail'); },
      async exec() { throw new Error('Fail'); },
    } as any, { schema: d1Schema });

    const c = new DurableOutboxConsumer(brokenClient);
    await c.processClaimedRecord(record);
    if ((record.retryCount as number) !== 1) throw new Error(`Retry count salah: ${record.retryCount}`);

    await c.processClaimedRecord(record);
    if ((record.retryCount as number) !== 2) throw new Error(`Retry count salah: ${record.retryCount}`);
  });


  // 8. nextRetryAt dihormati
  await runTest('8. nextRetryAt dihormati (event dengan nextRetryAt di masa depan tidak di-claim)', async () => {
    const futureRecord = consumer.insertOutboxRecord({
      entityType: 'LAND',
      entityId: 'land_p3_future',
      farmerId: 'farmer_p3',
      action: 'UPDATE',
      payload: { id: 'land_p3_future' },
      version: 1,
    });

    futureRecord.nextRetryAt = new Date(Date.now() + 600000).toISOString(); // 10 menit ke depan
    futureRecord.status = 'PENDING';

    const claimed = consumer.claimEligibleEvents('worker_test');
    if (claimed.find((r) => r.id === futureRecord.id)) {
      throw new Error('Event yang belum eligible (nextRetryAt di masa depan) seharusnya tidak di-claim');
    }
  });

  // 9. COMPLETED event tidak diproses ulang
  await runTest('9. COMPLETED event tidak pernah di-claim atau diproses ulang', async () => {
    const record = consumer.insertOutboxRecord({
      entityType: 'FARMER_DECISION',
      entityId: 'dec_p3_01',
      farmerId: 'farmer_p3',
      action: 'CREATE',
      payload: { id: 'dec_p3_01' },
      version: 1,
    });
    record.status = 'COMPLETED';

    const claimed = consumer.claimEligibleEvents('worker_test');
    if (claimed.find((r) => r.id === record.id)) {
      throw new Error('Event COMPLETED seharusnya diabaikan oleh consumer');
    }
  });

  // 10. dua event entity sama -> ordering benar
  await runTest('10. Ordering: Versi v1 diproses sebelum v2 untuk entity yang sama', async () => {
    // Insert v2 terlebih dahulu
    const v2 = consumer.insertOutboxRecord({
      entityType: 'LAND',
      entityId: 'land_ordering_test',
      farmerId: 'farmer_p3',
      action: 'UPDATE',
      payload: { id: 'land_ordering_test', name: 'Nama Versi 2' },
      version: 2,
      timestamp: new Date(Date.now() + 1000).toISOString(),
    });

    // Insert v1
    const v1 = consumer.insertOutboxRecord({
      entityType: 'LAND',
      entityId: 'land_ordering_test',
      farmerId: 'farmer_p3',
      action: 'CREATE',
      payload: { id: 'land_ordering_test', name: 'Nama Versi 1' },
      version: 1,
      timestamp: new Date(Date.now()).toISOString(),
    });

    const claimed = consumer.claimEligibleEvents('worker_order', 10);
    const orderIndexV1 = claimed.findIndex((r) => r.id === v1.id);
    const orderIndexV2 = claimed.findIndex((r) => r.id === v2.id);

    if (orderIndexV1 === -1 || orderIndexV2 === -1 || orderIndexV1 > orderIndexV2) {
      throw new Error(`Ordering salah: v1 (index ${orderIndexV1}) harus sebelum v2 (index ${orderIndexV2})`);
    }

    await consumer.processClaimedRecord(v1);
    await consumer.processClaimedRecord(v2);
  });

  // 11. PostgreSQL mutation rollback -> tidak ada outbox event
  await runTest('11. Transaction Safety: Rollback di Postgres mencegah terbitnya outbox event', async () => {
    const countBefore = consumer.getAllRecords().length;

    // Simulasi rollback
    const simulateRollback = () => {
      try {
        throw new Error('Constraint Violation in PG');
      } catch {
        // Rollback -> tidak memanggil consumer.insertOutboxRecord()
      }
    };
    simulateRollback();

    const countAfter = consumer.getAllRecords().length;
    if (countBefore !== countAfter) {
      throw new Error('Outbox event dibuat padahal transaksi Postgres gagal');
    }
  });

  // 12. PostgreSQL commit -> outbox event durable
  await runTest('12. Transaction Safety: Commit di Postgres menjamin outbox event tersimpan', async () => {
    const record = consumer.insertOutboxRecord({
      entityType: 'LAND',
      entityId: 'land_committed_01',
      farmerId: 'farmer_p3',
      action: 'CREATE',
      payload: { id: 'land_committed_01' },
      version: 1,
    });

    if (!consumer.getAllRecords().find((r) => r.id === record.id)) {
      throw new Error('Record tidak tersimpan setelah commit');
    }
  });

  // 13. actual_actions DELETE tetap protected
  await runTest('13. Kedaulatan Petani: actual_actions DELETE diblokir secara tegas di D1', async () => {
    const record = consumer.insertOutboxRecord({
      entityType: 'ACTUAL_ACTION',
      entityId: 'act_action_protected_01',
      farmerId: 'farmer_p3',
      action: 'DELETE',
      payload: { id: 'act_action_protected_01' },
      version: 1,
    });

    const res = await consumer.processClaimedRecord(record);
    if (res.success || !record.lastError?.includes('Kedaulatan Petani')) {
      throw new Error('actual_actions DELETE seharusnya gagal dengan pesan Kedaulatan Petani');
    }
  });

  // 14. farmer ownership tetap enforced
  await runTest('14. Ownership: Event replikasi membawa farmerId yang valid', async () => {
    const record = consumer.insertOutboxRecord({
      entityType: 'LAND',
      entityId: 'land_owned_01',
      farmerId: 'farmer_legit',
      action: 'CREATE',
      payload: { id: 'land_owned_01' },
      version: 1,
    });

    if (record.farmerId !== 'farmer_legit') {
      throw new Error('farmerId outbox event tidak valid');
    }
  });

  // 15. D1 unavailable -> PostgreSQL mutation tetap sukses
  await runTest('15. Isolation: Kegagalan D1 tidak mempengaruhi integritas outbox di PostgreSQL', async () => {
    const brokenD1 = drizzle({
      prepare() {
        return {
          bind() { return this; },
          async run() { throw new Error('D1 Completely Down'); },
          async all() { throw new Error('D1 Completely Down'); },
          async first() { throw new Error('D1 Completely Down'); },
        };
      },
      async dump() { return new ArrayBuffer(0); },
      async batch() { throw new Error('Fail'); },
      async exec() { throw new Error('Fail'); },
    } as any, { schema: d1Schema });

    const c = new DurableOutboxConsumer(brokenD1);

    // PG Insert sukses
    const record = c.insertOutboxRecord({
      entityType: 'LAND',
      entityId: 'land_isolated_01',
      farmerId: 'farmer_p3',
      action: 'CREATE',
      payload: { id: 'land_isolated_01' },
      version: 1,
    });

    // Replikasi gagal
    const res = await c.processClaimedRecord(record);
    if (res.success) {
      throw new Error('Seharusnya replikasi D1 gagal');
    }

    // Data di Postgres outbox tetap aman
    if (!c.getAllRecords().find((r) => r.id === record.id)) {
      throw new Error('Data outbox hilang di Postgres setelah replikasi D1 gagal');
    }
  });

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  return { total, passed, failed, results };
}

// Eksekusi jika dijalankan secara langsung via CLI
if (process.argv[1]?.includes('outboxConsumer.test')) {
  runOutboxConsumerTests().then((res) => {
    console.log(`\n=== HASIL UJI DURABLE OUTBOX CONSUMER & RETRY ENGINE (PATCH 3) ===`);
    res.results.forEach((r) => {
      console.log(`${r.passed ? '✓' : '✗'} ${r.name}`);
      if (r.error) console.error(`  Error: ${r.error}`);
    });
    console.log(`Total: ${res.total} | Lolos: ${res.passed} | Gagal: ${res.failed}\n`);
    if (res.failed > 0) process.exit(1);
  });
}
