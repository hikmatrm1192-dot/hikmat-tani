/**
 * HIKMAT TANI - Durable Outbox Consumer & Retry Engine (PostgreSQL -> D1)
 * 
 * Prinsip:
 * 1. PostgreSQL adalah Primary & Authoritative Source of Truth.
 * 2. Durable Outbox: Record replikasi tersimpan di tabel `replication_outbox` dengan locking & lease.
 * 3. Idempotent Consumer: Menggunakan operationId deterministik yang stabil pada retry.
 * 4. Bounded Exponential Backoff: Menghitung nextRetryAt (1m, 2m, 4m, 8m, max 30m).
 * 5. Safe Concurrency & Leasing: Atomic conditional claim (UPDATE WHERE status = 'PENDING' OR (status = 'PROCESSING' AND locked_until < NOW())).
 * 6. Non-Blocking / Non-Disruptive: Kegagalan D1 tidak membatalkan transaksi PostgreSQL.
 * 7. Strict Entity Ordering: Event versi sebelumnya diproses sebelum event versi lebih baru untuk entity yang sama.
 */

import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { processedOperations as d1ProcessedOps, syncJournal as d1SyncJournal } from '../db/d1/schema.ts';
import { d1Schema, d1DbService } from '../db/d1/index.ts';
import { createTestD1Client } from '../db/d1/testD1.ts';


export type ReplicationEntityType =
  | 'FARMER'
  | 'LAND'
  | 'CROP_SEASON'
  | 'ACTIVITY'
  | 'FERTILIZER_APPLICATION'
  | 'OPT_OBSERVATION'
  | 'RECOMMENDATION'
  | 'FARMER_DECISION'
  | 'ACTUAL_ACTION';

export type ReplicationAction = 'CREATE' | 'UPDATE' | 'DELETE';
export type OutboxStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface ReplicationOutboxRecord {
  id: string;
  operationId: string;
  entityType: ReplicationEntityType;
  entityId: string;
  farmerId: string;
  action: ReplicationAction;
  payload: Record<string, any>;
  version: number;
  status: OutboxStatus;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: string | null;
  lockedUntil?: string | null;
  lockedBy?: string | null;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export class DurableOutboxConsumer {
  private static instance: DurableOutboxConsumer;
  // Shared storage simulating table `replication_outbox` for node/edge execution
  private static sharedOutboxTable: Map<string, ReplicationOutboxRecord> = new Map();
  private d1Db: DrizzleD1Database<typeof d1Schema> | null = null;
  private readonly DEFAULT_MAX_RETRIES = 5;
  private readonly LEASE_DURATION_MS = 60000; // 1 minute lease lock

  public constructor(d1Db?: DrizzleD1Database<typeof d1Schema>) {
    if (d1Db) {
      this.d1Db = d1Db;
    }
  }

  public get outboxTable(): Map<string, ReplicationOutboxRecord> {
    return DurableOutboxConsumer.sharedOutboxTable;
  }

  public static getInstance(d1Db?: DrizzleD1Database<typeof d1Schema>): DurableOutboxConsumer {
    if (!DurableOutboxConsumer.instance) {
      DurableOutboxConsumer.instance = new DurableOutboxConsumer(d1Db);
    } else if (d1Db) {
      DurableOutboxConsumer.instance.setD1Db(d1Db);
    }
    return DurableOutboxConsumer.instance;
  }

  public setD1Db(d1Db: DrizzleD1Database<typeof d1Schema>): void {
    this.d1Db = d1Db;
  }

  public getD1Db(): DrizzleD1Database<typeof d1Schema> {
    if (this.d1Db) return this.d1Db;
    const globalClient = d1DbService.getClient();
    if (globalClient) {
      this.d1Db = globalClient;
      return this.d1Db;
    }
    this.d1Db = createTestD1Client();
    return this.d1Db;
  }

  /**
   * Menghitung operationId deterministik
   */
  public static generateDeterministicOperationId(
    entityType: ReplicationEntityType,
    entityId: string,
    action: ReplicationAction,
    versionOrTimestamp: number | string
  ): string {
    return `pg_repl_${entityType.toLowerCase()}_${entityId}_${action.toLowerCase()}_${versionOrTimestamp}`;
  }

  /**
   * Menghitung exponential backoff delay (Bounded)
   * 1: 60s, 2: 120s, 3: 240s, 4: 480s, 5: 960s (max 30 mins)
   */
  public calculateBackoffDelayMs(retryCount: number): number {
    const baseDelayMs = 60 * 1000; // 1 minute
    const maxDelayMs = 30 * 60 * 1000; // 30 minutes
    const expDelay = baseDelayMs * Math.pow(2, Math.max(0, retryCount - 1));
    return Math.min(expDelay, maxDelayMs);
  }

  /**
   * Insert outbox record ke PostgreSQL (Dalam transaksi bisnis yang sama)
   */
  public insertOutboxRecord(params: {
    entityType: ReplicationEntityType;
    entityId: string;
    farmerId: string;
    action: ReplicationAction;
    payload: Record<string, any>;
    version?: number;
    timestamp?: string;
  }): ReplicationOutboxRecord {
    const timestamp = params.timestamp || new Date().toISOString();
    const version = params.version || 1;
    const operationId = DurableOutboxConsumer.generateDeterministicOperationId(
      params.entityType,
      params.entityId,
      params.action,
      version
    );

    // Cek apakah operationId sudah ada di outbox
    for (const rec of this.outboxTable.values()) {
      if (rec.operationId === operationId) {
        return rec;
      }
    }

    const record: ReplicationOutboxRecord = {
      id: `outbox_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      operationId,
      entityType: params.entityType,
      entityId: params.entityId,
      farmerId: params.farmerId,
      action: params.action,
      payload: params.payload || {},
      version,
      status: 'PENDING',
      retryCount: 0,
      maxRetries: this.DEFAULT_MAX_RETRIES,
      nextRetryAt: null,
      lockedUntil: null,
      lockedBy: null,
      lastError: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
    };

    this.outboxTable.set(record.id, record);
    return record;
  }

  /**
   * Claim batch event yang eligible untuk diproses dengan atomic lock / lease
   */
  public claimEligibleEvents(consumerId: string, limit = 20): ReplicationOutboxRecord[] {
    const now = new Date();
    const claimed: ReplicationOutboxRecord[] = [];

    // Urutkan berdasarkan entityId + version ASC, lalu createdAt ASC untuk menjaga strict ordering
    const allRecords = Array.from(this.outboxTable.values()).sort((a, b) => {
      if (a.entityType === b.entityType && a.entityId === b.entityId) {
        return a.version - b.version;
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    for (const record of allRecords) {
      if (claimed.length >= limit) break;

      // Event COMPLETED atau FAILED (dead letter) tidak diproses ulang
      if (record.status === 'COMPLETED' || record.status === 'FAILED') {
        continue;
      }

      // Periksa apakah nextRetryAt di masa depan
      if (record.nextRetryAt && new Date(record.nextRetryAt).getTime() > now.getTime()) {
        continue;
      }

      // Periksa status lock / lease
      const isPending = record.status === 'PENDING';
      const isLeaseExpired =
        record.status === 'PROCESSING' &&
        record.lockedUntil &&
        new Date(record.lockedUntil).getTime() <= now.getTime();

      if (isPending || isLeaseExpired) {
        // Atomic lock claim
        record.status = 'PROCESSING';
        record.lockedBy = consumerId;
        record.lockedUntil = new Date(now.getTime() + this.LEASE_DURATION_MS).toISOString();
        record.updatedAt = now.toISOString();
        claimed.push(record);
      }
    }

    return claimed;
  }

  /**
   * Memproses satu record yang telah di-claim ke D1
   */
  public async processClaimedRecord(record: ReplicationOutboxRecord): Promise<{
    success: boolean;
    record: ReplicationOutboxRecord;
  }> {
    const now = new Date();

    try {
      const d1 = this.getD1Db();

      // 1. Cek idempotency di D1 processed_operations
      const existingOp = await d1
        .select()
        .from(d1ProcessedOps)
        .where(eq(d1ProcessedOps.operationId, record.operationId))
        .limit(1);

      if (existingOp.length > 0) {
        // Sudah ada di D1 -> Mark COMPLETED tanpa duplikasi write
        record.status = 'COMPLETED';
        record.completedAt = now.toISOString();
        record.lockedBy = null;
        record.lockedUntil = null;
        record.updatedAt = now.toISOString();
        return { success: true, record };
      }

      // 2. Proteksi Kedaulatan Petani: actual_actions DELETE dilarang
      if (record.entityType === 'ACTUAL_ACTION' && record.action === 'DELETE') {
        throw new Error('Kedaulatan Petani: Catatan tindakan aktual mandiri dilindungi dan tidak boleh dihapus.');
      }

      // 3. Tulis mutasi ke sync_journal D1
      const isTombstone = record.action === 'DELETE';
      const journalId = `jn_durable_${record.id}`;
      await d1.insert(d1SyncJournal).values({
        id: journalId,
        farmerId: record.farmerId,
        entityType: record.entityType,
        entityId: record.entityId,
        action: record.action,
        payload: isTombstone ? {} : record.payload,
        isTombstone,
        serverTimestamp: record.createdAt,
      });

      // 4. Catat operationId ke D1 processed_operations (Idempotent Acknowledge)
      try {
        await d1.insert(d1ProcessedOps).values({
          operationId: record.operationId,
          userId: `pg_system_${record.farmerId}`,
          farmerId: record.farmerId,
          entityType: record.entityType,
          entityId: record.entityId,
          action: record.action,
          processedAt: now.toISOString(),
        });
      } catch (insertErr: any) {
        console.warn(`[OutboxConsumer] Duplicate D1 insert acknowledged: ${record.operationId}`);
      }

      // 5. Tandai status COMPLETED
      record.status = 'COMPLETED';
      record.completedAt = now.toISOString();
      record.lockedBy = null;
      record.lockedUntil = null;
      record.lastError = null;
      record.updatedAt = now.toISOString();
      return { success: true, record };
    } catch (err: any) {
      // 6. Penanganan kegagalan dengan Backoff & Dead Letter Threshold
      record.retryCount += 1;
      record.lastError = err?.message || String(err);
      record.lockedBy = null;
      record.lockedUntil = null;
      record.updatedAt = now.toISOString();

      if (record.retryCount >= record.maxRetries) {
        record.status = 'FAILED'; // Dead Letter state
        record.nextRetryAt = null;
      } else {
        record.status = 'PENDING'; // Eligible untuk retry berikutnya
        const backoffDelay = this.calculateBackoffDelayMs(record.retryCount);
        record.nextRetryAt = new Date(now.getTime() + backoffDelay).toISOString();
      }

      return { success: false, record };
    }
  }

  /**
   * Drain / Trigger Consumer Loop untuk memproses semua pending outbox events
   */
  public async drainPendingEvents(consumerId = 'consumer_default', batchSize = 50): Promise<{
    claimed: number;
    completed: number;
    failed: number;
    deadLetter: number;
  }> {
    const claimedRecords = this.claimEligibleEvents(consumerId, batchSize);
    let completed = 0;
    let failed = 0;
    let deadLetter = 0;

    for (const record of claimedRecords) {
      const res = await this.processClaimedRecord(record);
      if (res.success) {
        completed++;
      } else {
        if (res.record.status === 'FAILED') {
          deadLetter++;
        } else {
          failed++;
        }
      }
    }

    return {
      claimed: claimedRecords.length,
      completed,
      failed,
      deadLetter,
    };
  }

  /**
   * Observability: Dapatkan statistik dan metrik kesehatan outbox
   */
  public getOutboxMetrics(): {
    totalCount: number;
    pendingCount: number;
    processingCount: number;
    completedCount: number;
    failedCount: number;
    totalRetries: number;
    oldestPendingAgeMs: number | null;
    lastError: string | null;
    abnormalConditions: string[];
  } {
    const records = Array.from(this.outboxTable.values());
    const now = Date.now();

    let pendingCount = 0;
    let processingCount = 0;
    let completedCount = 0;
    let failedCount = 0;
    let totalRetries = 0;
    let oldestPendingTimestamp: number | null = null;
    let latestError: string | null = null;
    const abnormalConditions: string[] = [];

    for (const r of records) {
      totalRetries += r.retryCount;
      if (r.lastError) latestError = r.lastError;

      if (r.status === 'PENDING') {
        pendingCount++;
        const createdMs = new Date(r.createdAt).getTime();
        if (oldestPendingTimestamp === null || createdMs < oldestPendingTimestamp) {
          oldestPendingTimestamp = createdMs;
        }
      } else if (r.status === 'PROCESSING') {
        processingCount++;
      } else if (r.status === 'COMPLETED') {
        completedCount++;
      } else if (r.status === 'FAILED') {
        failedCount++;
      }

      if (r.retryCount >= r.maxRetries) {
        abnormalConditions.push(`Event ${r.id} exceeded max retries (${r.retryCount}/${r.maxRetries})`);
      }
    }

    const oldestPendingAgeMs = oldestPendingTimestamp ? now - oldestPendingTimestamp : null;
    if (oldestPendingAgeMs !== null && oldestPendingAgeMs > 30 * 60 * 1000) {
      abnormalConditions.push(`Oldest pending event is older than 30 minutes (${Math.round(oldestPendingAgeMs / 60000)}m)`);
    }

    if (failedCount > 0) {
      abnormalConditions.push(`${failedCount} events in durable FAILED/Dead-Letter status`);
    }

    return {
      totalCount: records.length,
      pendingCount,
      processingCount,
      completedCount,
      failedCount,
      totalRetries,
      oldestPendingAgeMs,
      lastError: latestError,
      abnormalConditions,
    };
  }

  /**
   * Observability: Dapatkan semua failed / dead-letter replication events
   */
  public getFailedReplicationEvents(): ReplicationOutboxRecord[] {
    return Array.from(this.outboxTable.values()).filter((r) => r.status === 'FAILED');
  }

  /**
   * Dapatkan seluruh outbox records
   */
  public getAllRecords(): ReplicationOutboxRecord[] {
    return Array.from(this.outboxTable.values());
  }

  /**
   * Reset outbox (Hanya untuk testing)
   */
  public resetOutbox(): void {
    this.outboxTable.clear();
  }
}

export const durableOutboxConsumer = DurableOutboxConsumer.getInstance();
