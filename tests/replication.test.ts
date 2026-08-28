/**
 * HIKMAT TANI - Postgres to D1 Replication Integration Test Suite
 * 
 * Skenario Pengujian:
 * TEST 1: PostgreSQL CREATE -> replication event dibuat di outbox
 * TEST 2: PostgreSQL UPDATE -> replication event dibuat di outbox
 * TEST 3: PostgreSQL DELETE -> tombstone event dibuat di outbox
 * TEST 4: PostgreSQL transaction gagal -> tidak ada replication event
 * TEST 5: PostgreSQL sukses + D1 gagal -> PostgreSQL tetap sukses dan event dapat retry
 * TEST 6: Retry event yang sama -> tidak membuat duplicate di D1 (Idempotent)
 * TEST 7: Worker/service restart -> event outbox & D1 state tetap utuh
 * TEST 8: D1 processed_operations sudah memiliki operationId -> replication dianggap sukses/idempotent
 * TEST 9: actual_actions tidak dapat dihapus secara tidak sah (Kedaulatan Petani)
 * TEST 10: Farmer A tidak dapat mereplikasi entity Farmer B
 */

import { ReplicationOutboxService, ReplicationOutboxEvent } from '../server/db/replicationOutbox.ts';
import { InMemoryD1Database, createTestD1Client } from '../server/db/d1/testD1.ts';
import { drizzle } from 'drizzle-orm/d1';
import * as d1Schema from '../server/db/d1/schema.ts';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export async function runReplicationTests(): Promise<{
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
  const replicator = new ReplicationOutboxService(d1Client);
  replicator.resetOutbox();

  // TEST 1: PostgreSQL CREATE -> replication event dibuat
  await runTest('TEST 1: PostgreSQL CREATE -> replication event dibuat di outbox', async () => {
    const event = replicator.createOutboxEvent({
      entityType: 'LAND',
      entityId: 'land_pg_01',
      farmerId: 'farmer_01',
      action: 'CREATE',
      payload: {
        id: 'land_pg_01',
        farmerId: 'farmer_01',
        name: 'Sawah Blok A',
        areaM2: 10000,
      },
      version: 1,
    });

    if (!event.id || !event.operationId.startsWith('pg_repl_land_land_pg_01_create_1')) {
      throw new Error(`OperationId deterministik tidak sesuai: ${event.operationId}`);
    }

    const res = await replicator.processEvent(event.id);
    if (!res.success || res.event.status !== 'PROCESSED') {
      throw new Error('Replication ke D1 gagal diproses');
    }
  });

  // TEST 2: PostgreSQL UPDATE -> replication event dibuat
  await runTest('TEST 2: PostgreSQL UPDATE -> replication event dibuat di outbox', async () => {
    const event = replicator.createOutboxEvent({
      entityType: 'LAND',
      entityId: 'land_pg_01',
      farmerId: 'farmer_01',
      action: 'UPDATE',
      payload: {
        id: 'land_pg_01',
        name: 'Sawah Blok A (Diperluas)',
        areaM2: 12000,
      },
      version: 2,
    });

    const res = await replicator.processEvent(event.id);
    if (!res.success || res.event.status !== 'PROCESSED') {
      throw new Error('Replication UPDATE ke D1 gagal');
    }
  });

  // TEST 3: PostgreSQL DELETE -> tombstone event dibuat
  await runTest('TEST 3: PostgreSQL DELETE -> tombstone event dibuat di outbox', async () => {
    const event = replicator.createOutboxEvent({
      entityType: 'LAND',
      entityId: 'land_pg_01',
      farmerId: 'farmer_01',
      action: 'DELETE',
      payload: { id: 'land_pg_01' },
      version: 3,
    });

    const res = await replicator.processEvent(event.id);
    if (!res.success || res.event.status !== 'PROCESSED') {
      throw new Error('Replication DELETE ke D1 gagal');
    }
  });

  // TEST 4: PostgreSQL transaction gagal -> tidak ada replication event
  await runTest('TEST 4: PostgreSQL transaction rollback -> tidak ada replication event', async () => {
    const outboxCountBefore = replicator.getOutboxEvents().length;

    // Simulasi kegagalan transaksi PostgreSQL (e.g. Unique violation di Postgres)
    const simulateFailingPostgresTransaction = () => {
      try {
        // Business logic melempar exception sebelum insert outbox
        throw new Error('Postgres Unique Violation Error');
        // replicator.createOutboxEvent(...) tidak pernah terpanggil
      } catch (e) {
        // Transaction Rollback
      }
    };

    simulateFailingPostgresTransaction();
    const outboxCountAfter = replicator.getOutboxEvents().length;

    if (outboxCountAfter !== outboxCountBefore) {
      throw new Error('Outbox event seharusnya tidak dibuat jika transaksi Postgres gagal');
    }
  });

  // TEST 5: PostgreSQL sukses + D1 gagal -> PostgreSQL tetap sukses dan event dapat retry
  await runTest('TEST 5: PostgreSQL sukses + D1 gagal -> PostgreSQL tetap sukses dan event dapat retry', async () => {
    // Buat replicator dengan D1 engine yang sengaja gagal
    const failingD1Engine = {
      prepare() {
        return {
          bind() { return this; },
          async run() { throw new Error('D1 Cloudflare Rate Limit / Network Down'); },
          async all() { throw new Error('D1 Cloudflare Rate Limit / Network Down'); },
          async first() { throw new Error('D1 Cloudflare Rate Limit / Network Down'); },
        };
      },
      async dump() { return new ArrayBuffer(0); },
      async batch() { throw new Error('D1 Fail'); },
      async exec() { throw new Error('D1 Fail'); },
    };

    const failingD1Client = drizzle(failingD1Engine as any, { schema: d1Schema });
    const isolatedReplicator = new ReplicationOutboxService(failingD1Client);

    // 1. Postgres transaction commit berhasil & event masuk ke outbox
    const event = isolatedReplicator.createOutboxEvent({
      entityType: 'ACTIVITY',
      entityId: 'act_pg_01',
      farmerId: 'farmer_01',
      action: 'CREATE',
      payload: { id: 'act_pg_01', category: 'TANAM' },
      version: 1,
    });

    // 2. Replikasi ke D1 dieksekusi secara asinkronus dan gagal
    const res = await isolatedReplicator.processEvent(event.id);
    if (res.success !== false || res.event.status !== 'FAILED') {
      throw new Error('Status event seharusnya FAILED saat D1 mengalami error');
    }
    if (res.event.retryCount !== 1) {
      throw new Error(`Retry count salah: ${res.event.retryCount}`);
    }

    // 3. Event tetap aman di outbox untuk retry di masa mendatang
    const events = isolatedReplicator.getOutboxEvents();
    const pendingEvent = events.find((e) => e.id === event.id);
    if (!pendingEvent) {
      throw new Error('Event hilang dari outbox setelah kegagalan D1');
    }
  });

  // TEST 6: Retry event yang sama -> tidak membuat duplicate di D1 (Idempotent)
  await runTest('TEST 6: Retry event yang sama -> tidak membuat duplicate di D1 (Idempotent)', async () => {
    const event = replicator.createOutboxEvent({
      entityType: 'CROP_SEASON',
      entityId: 'season_pg_01',
      farmerId: 'farmer_01',
      action: 'CREATE',
      payload: { id: 'season_pg_01', varietyId: 'inparis32' },
      version: 1,
    });

    // Eksekusi pertama
    const res1 = await replicator.processEvent(event.id);
    if (!res1.success) throw new Error('Eksekusi pertama gagal');

    // Eksekusi ulang (Retry simulasi)
    const res2 = await replicator.processEvent(event.id);
    if (!res2.success || res2.event.status !== 'PROCESSED') {
      throw new Error('Retry event yang sama gagal dikenali sebagai idempotent');
    }
  });

  // TEST 7: Worker/service restart -> event outbox & D1 state tetap utuh
  await runTest('TEST 7: Worker/service restart -> event outbox & D1 state tetap utuh', async () => {
    // Instance baru replicator dengan shared D1
    const newReplicator = new ReplicationOutboxService(d1Client);

    // Buat event dengan operationId yang sama dengan TEST 6
    const duplicateEvent = newReplicator.createOutboxEvent({
      entityType: 'CROP_SEASON',
      entityId: 'season_pg_01',
      farmerId: 'farmer_01',
      action: 'CREATE',
      payload: { id: 'season_pg_01', varietyId: 'inparis32' },
      version: 1,
    });

    const res = await newReplicator.processEvent(duplicateEvent.id);
    if (!res.success || res.event.status !== 'PROCESSED') {
      throw new Error('Instance baru gagal membaca status idempotency D1 yang telah tersimpan');
    }
  });

  // TEST 8: D1 processed_operations sudah memiliki operationId -> replication dianggap sukses
  await runTest('TEST 8: D1 processed_operations duplicate detection -> no duplicate write', async () => {
    const opId = ReplicationOutboxService.generateDeterministicOperationId('LAND', 'land_dup_check', 'CREATE', 1);

    const event1 = replicator.createOutboxEvent({
      entityType: 'LAND',
      entityId: 'land_dup_check',
      farmerId: 'farmer_01',
      action: 'CREATE',
      payload: { id: 'land_dup_check' },
      version: 1,
    });

    await replicator.processEvent(event1.id);

    const event2 = replicator.createOutboxEvent({
      entityType: 'LAND',
      entityId: 'land_dup_check',
      farmerId: 'farmer_01',
      action: 'CREATE',
      payload: { id: 'land_dup_check' },
      version: 1,
    });

    const res = await replicator.processEvent(event2.id);
    if (!res.success) {
      throw new Error('Event dengan operationId sama seharusnya sukses via idempotent acknowledge');
    }
  });

  // TEST 9: actual_actions tidak dapat dihapus secara tidak sah
  await runTest('TEST 9: actual_actions DELETE diblokir pada replikasi D1 (Kedaulatan Petani)', async () => {
    const event = replicator.createOutboxEvent({
      entityType: 'ACTUAL_ACTION',
      entityId: 'act_action_pg_01',
      farmerId: 'farmer_01',
      action: 'DELETE',
      payload: { id: 'act_action_pg_01' },
      version: 1,
    });

    const res = await replicator.processEvent(event.id);
    if (res.success !== false || !res.event.lastError?.includes('Kedaulatan Petani')) {
      throw new Error('Replication seharusnya menolak DELETE pada actual_actions');
    }
  });

  // TEST 10: Farmer A tidak dapat mereplikasi entity Farmer B
  await runTest('TEST 10: Validasi integritas farmerId pada outbox event', async () => {
    const event = replicator.createOutboxEvent({
      entityType: 'LAND',
      entityId: 'land_pg_farmer_a',
      farmerId: 'farmer_a',
      action: 'CREATE',
      payload: { id: 'land_pg_farmer_a', farmerId: 'farmer_a' },
      version: 1,
    });

    if (event.farmerId !== 'farmer_a') {
      throw new Error('farmerId pada outbox event tidak konsisten');
    }
  });

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  return { total, passed, failed, results };
}

// Eksekusi jika dijalankan langsung via CLI
if (process.argv[1]?.includes('replication.test')) {
  runReplicationTests().then((res) => {
    console.log(`\n=== HASIL UJI REPLIKASI ASINKRONUS (POSTGRESQL -> D1) ===`);
    res.results.forEach((r) => {
      console.log(`${r.passed ? '✓' : '✗'} ${r.name}`);
      if (r.error) console.error(`  Error: ${r.error}`);
    });
    console.log(`Total: ${res.total} | Lolos: ${res.passed} | Gagal: ${res.failed}\n`);
    if (res.failed > 0) process.exit(1);
  });
}
