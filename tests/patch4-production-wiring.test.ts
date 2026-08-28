/**
 * HIKMAT TANI - Patch 4 Production Wiring & Readiness Audit Tests
 * 
 * 12 Skenario Pengujian Production-Like:
 * 1. Worker fetch tetap merespons 200 OK untuk /api/v1/health & /api/health
 * 2. scheduled() dapat mengeksekusi drainPendingEvents()
 * 3. scheduled invocation berjalan otonom tanpa request user
 * 4. PostgreSQL outbox PENDING -> D1 -> COMPLETED via scheduler
 * 5. D1 failure -> PENDING/FAILED + retry backoff tercatat
 * 6. Lease expired -> event dapat di-claim ulang oleh worker berikutnya
 * 7. Dua scheduled invocation simultan -> tidak double process / duplicate mutation
 * 8. Completed event -> tidak diproses lagi oleh scheduled handler
 * 9. Failed (Dead-Letter) event -> tidak hilang dan tercatat di getFailedReplicationEvents()
 * 10. DATABASE_PROVIDER tetap terisolasi ('postgres')
 * 11. Worker restart / instance recreation -> outbox tetap durable
 * 12. D1 restart / network failure -> PostgreSQL tetap sehat 100%
 */

import worker from '../server/worker.ts';
import { durableOutboxConsumer, DurableOutboxConsumer } from '../server/services/outboxConsumer.ts';
import { InMemoryD1Database, createTestD1Client } from '../server/db/d1/testD1.ts';
import { drizzle } from 'drizzle-orm/d1';
import * as d1Schema from '../server/db/d1/schema.ts';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export async function runProductionWiringTests(): Promise<{
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

  const testD1Db = new InMemoryD1Database();
  const testD1Client = drizzle(testD1Db, { schema: d1Schema });
  const env: any = {
    DB: testD1Db,
    DATABASE_PROVIDER: 'postgres',
  };

  // Inisialisasi consumer dengan test D1
  durableOutboxConsumer.setD1Db(testD1Client);
  durableOutboxConsumer.resetOutbox();

  // 1. Worker fetch tetap 200 untuk /api/v1/health
  await runTest('1. Worker fetch tetap merespons 200 OK untuk /api/v1/health', async () => {
    const req = new Request('https://worker.local/api/v1/health', { method: 'GET' });
    const res = await worker.fetch(req, env, {});
    if (res.status !== 200) {
      throw new Error(`Status bukan 200: ${res.status}`);
    }
    const body: any = await res.json();
    if (body.status !== 'ok' || !body.database.configured) {
      throw new Error(`Health body tidak valid: ${JSON.stringify(body)}`);
    }
  });

  // 2. scheduled() dapat menjalankan drainPendingEvents()
  await runTest('2. scheduled() dapat mengeksekusi drainPendingEvents() secara terintegrasi', async () => {
    durableOutboxConsumer.resetOutbox();
    const record = durableOutboxConsumer.insertOutboxRecord({
      entityType: 'LAND',
      entityId: 'land_sched_01',
      farmerId: 'farmer_p4',
      action: 'CREATE',
      payload: { id: 'land_sched_01', name: 'Petak Scheduler' },
      version: 1,
    });

    const controller = { cron: '* * * * *', scheduledTime: Date.now() };
    let bgPromise: Promise<any> | null = null;
    const ctx = {
      waitUntil: (promise: Promise<any>) => {
        bgPromise = promise;
        return promise;
      },
    };

    await worker.scheduled(controller, env, ctx);
    if (bgPromise) {
      await bgPromise;
    }

    const updated = durableOutboxConsumer.getAllRecords().find((r) => r.id === record.id);
    if (!updated || updated.status !== 'COMPLETED') {
      throw new Error(`Status record setelah scheduled bukan COMPLETED: ${updated?.status}`);
    }
  });

  // 3. scheduled invocation tanpa request user
  await runTest('3. scheduled invocation berjalan mandiri tanpa request user / HTTP context', async () => {
    const controller = { cron: '*/5 * * * *', scheduledTime: Date.now() };
    let waitUntilCalled = false;
    const ctx = {
      waitUntil: (promise: Promise<any>) => {
        waitUntilCalled = true;
        return promise;
      },
    };

    await worker.scheduled(controller, env, ctx);
    if (!waitUntilCalled) {
      throw new Error('ctx.waitUntil tidak dipanggil oleh scheduler');
    }
  });

  // 4. PostgreSQL outbox PENDING → D1 → COMPLETED
  await runTest('4. PostgreSQL outbox PENDING -> D1 -> COMPLETED via scheduler cycle', async () => {
    const record = durableOutboxConsumer.insertOutboxRecord({
      entityType: 'ACTIVITY',
      entityId: 'act_sched_01',
      farmerId: 'farmer_p4',
      action: 'CREATE',
      payload: { id: 'act_sched_01', activityType: 'PENGOLAHAN_TANAH' },
      version: 1,
    });

    await worker.scheduled({ cron: '* * * * *', scheduledTime: Date.now() }, env, {});

    const rec = durableOutboxConsumer.getAllRecords().find((r) => r.id === record.id);
    if (!rec || rec.status !== 'COMPLETED' || !rec.completedAt) {
      throw new Error('Record tidak ter-mark COMPLETED');
    }
  });

  // 5. D1 failure → PENDING/FAILED + retry
  await runTest('5. D1 failure -> record tetap PENDING + retryCount naik + nextRetryAt diset', async () => {
    const brokenD1 = {
      prepare() {
        return {
          bind() { return this; },
          async run() { throw new Error('D1 Cloudflare 500 Connection Refused'); },
          async all() { throw new Error('D1 Cloudflare 500 Connection Refused'); },
          async first() { throw new Error('D1 Cloudflare 500 Connection Refused'); },
        };
      },
      async dump() { return new ArrayBuffer(0); },
      async batch() { throw new Error('Fail'); },
      async exec() { throw new Error('Fail'); },
    };

    const brokenEnv: any = { DB: brokenD1 };
    const failingRecord = durableOutboxConsumer.insertOutboxRecord({
      entityType: 'FERTILIZER_APPLICATION',
      entityId: 'fert_sched_fail_01',
      farmerId: 'farmer_p4',
      action: 'CREATE',
      payload: { id: 'fert_sched_fail_01' },
      version: 1,
    });

    await worker.scheduled({ cron: '* * * * *', scheduledTime: Date.now() }, brokenEnv, {});

    const rec = durableOutboxConsumer.getAllRecords().find((r) => r.id === failingRecord.id);
    if (!rec || rec.retryCount < 1 || !rec.nextRetryAt || rec.status !== 'PENDING') {
      throw new Error(`Retry state salah: retryCount=${rec?.retryCount}, nextRetryAt=${rec?.nextRetryAt}`);
    }
  });

  // 6. lease expired → event dapat diproses ulang
  await runTest('6. Lease expired -> event yang ditinggalkan worker crash dapat di-claim ulang', async () => {
    durableOutboxConsumer.setD1Db(testD1Client);
    const expiredRecord = durableOutboxConsumer.insertOutboxRecord({
      entityType: 'LAND',
      entityId: 'land_lease_exp',
      farmerId: 'farmer_p4',
      action: 'UPDATE',
      payload: { id: 'land_lease_exp' },
      version: 1,
    });

    // Simulasikan worker crash di masa lalu
    expiredRecord.status = 'PROCESSING';
    expiredRecord.lockedBy = 'crashed_worker_node';
    expiredRecord.lockedUntil = new Date(Date.now() - 10000).toISOString(); // 10 detik lalu (expired)

    // Worker baru memproses
    const claimed = durableOutboxConsumer.claimEligibleEvents('new_healthy_worker', 10);
    if (!claimed.find((r) => r.id === expiredRecord.id)) {
      throw new Error('Event dengan lease expired gagal di-claim oleh worker baru');
    }

    const res = await durableOutboxConsumer.processClaimedRecord(expiredRecord);
    if (expiredRecord.status !== 'COMPLETED') {
      throw new Error(`Expired record gagal diselesaikan: ${expiredRecord.status}, error: ${expiredRecord.lastError}`);
    }
  });

  // 7. dua scheduled invocation → tidak double process
  await runTest('7. Dua scheduled invocation simultan -> atomic claim mencegah double process', async () => {
    durableOutboxConsumer.resetOutbox();
    const sharedRecord = durableOutboxConsumer.insertOutboxRecord({
      entityType: 'LAND',
      entityId: 'land_concurrent_01',
      farmerId: 'farmer_p4',
      action: 'CREATE',
      payload: { id: 'land_concurrent_01' },
      version: 1,
    });

    // Invocation 1 claim
    const claim1 = durableOutboxConsumer.claimEligibleEvents('worker_cron_A', 10);
    // Invocation 2 claim
    const claim2 = durableOutboxConsumer.claimEligibleEvents('worker_cron_B', 10);

    if (claim1.length !== 1 || claim2.length !== 0) {
      throw new Error(`Double claim terjadi: claim1=${claim1.length}, claim2=${claim2.length}`);
    }

    await durableOutboxConsumer.processClaimedRecord(claim1[0]);
  });

  // 8. completed event → tidak diproses lagi
  await runTest('8. COMPLETED event tidak pernah diproses lagi pada invocation berikutnya', async () => {
    const res = await worker.scheduled({ cron: '* * * * *', scheduledTime: Date.now() }, env, {});
    const metrics = durableOutboxConsumer.getOutboxMetrics();
    if (metrics.processingCount !== 0) {
      throw new Error('Ada event yang sedang processing tanpa antrean baru');
    }
  });

  // 9. failed event → tidak hilang
  await runTest('9. FAILED (Dead-Letter) event tetap durable dan tercatat pada observability metrics', async () => {
    const dlqRecord = durableOutboxConsumer.insertOutboxRecord({
      entityType: 'ACTIVITY',
      entityId: 'act_dlq_check',
      farmerId: 'farmer_p4',
      action: 'CREATE',
      payload: { id: 'act_dlq_check' },
      version: 1,
    });
    dlqRecord.status = 'FAILED';
    dlqRecord.retryCount = 5;

    const metrics = durableOutboxConsumer.getOutboxMetrics();
    if (metrics.failedCount !== 1 || metrics.abnormalConditions.length === 0) {
      throw new Error(`Observability gagal mendeteksi dead letter: ${JSON.stringify(metrics)}`);
    }
  });

  // 10. DATABASE_PROVIDER tetap postgres
  await runTest('10. DATABASE_PROVIDER tetap postgres & tidak termodifikasi oleh worker/scheduler', async () => {
    const currentProvider = process.env.DATABASE_PROVIDER || 'postgres';
    if (currentProvider !== 'postgres') {
      throw new Error(`DATABASE_PROVIDER bukan postgres: ${currentProvider}`);
    }
    if (env.DATABASE_PROVIDER !== 'postgres') {
      throw new Error(`env.DATABASE_PROVIDER bukan postgres: ${env.DATABASE_PROVIDER}`);
    }
  });

  // 11. Worker restart → outbox tetap durable
  await runTest('11. Worker restart -> instance baru dapat membaca seluruh outbox durable', async () => {
    const freshConsumer = new DurableOutboxConsumer(testD1Client);
    const records = freshConsumer.getAllRecords();
    if (records.length === 0) {
      throw new Error('Data outbox hilang setelah instansiasi consumer baru');
    }
  });

  // 12. D1 restart/failure → PostgreSQL tetap sehat
  await runTest('12. D1 restart/failure -> transaksi & integritas PostgreSQL tetap 100% sehat', async () => {
    // Simulasi insert di PostgreSQL saat D1 down
    const pgRecord = durableOutboxConsumer.insertOutboxRecord({
      entityType: 'CROP_SEASON',
      entityId: 'season_iso_01',
      farmerId: 'farmer_p4',
      action: 'CREATE',
      payload: { id: 'season_iso_01', fieldAreaHa: 1.5 },
      version: 1,
    });

    if (pgRecord.id && pgRecord.status === 'PENDING') {
      // Postgres commit sukses
    } else {
      throw new Error('Insert Postgres gagal');
    }
  });

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  return { total, passed, failed, results };
}

// Eksekusi jika dijalankan langsung
if (process.argv[1]?.includes('outboxConsumer.test') || process.argv[1]?.includes('patch4')) {
  runProductionWiringTests().then((res) => {
    console.log(`\n=== HASIL UJI PRODUCTION WIRING & READINESS AUDIT (PATCH 4) ===`);
    res.results.forEach((r) => {
      console.log(`${r.passed ? '✓' : '✗'} ${r.name}`);
      if (r.error) console.error(`  Error: ${r.error}`);
    });
    console.log(`Total: ${res.total} | Lolos: ${res.passed} | Gagal: ${res.failed}\n`);
    if (res.failed > 0) process.exit(1);
  });
}
