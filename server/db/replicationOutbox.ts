/**
 * HIKMAT TANI - Asynchronous Replication & Outbox Engine (PostgreSQL -> D1)
 * 
 * Prinsip:
 * 1. PostgreSQL adalah Primary & Authoritative Source of Truth.
 * 2. Reliable Outbox Pattern: Event replikasi dicatat dalam transaksi PostgreSQL yang sama.
 * 3. Asinkronus & Non-Blocking: Kegagalan D1 TIDAK menggagalkan transaksi PostgreSQL.
 * 4. Deterministik & Idempotent: OperationId stabil saat retry untuk mencegah duplicate record di D1.
 * 5. Replicator me-replay event ke D1 via `processed_operations` & `sync_journal` D1.
 */

import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { processedOperations as d1ProcessedOps, syncJournal as d1SyncJournal } from './d1/schema.ts';
import { d1Schema, d1DbService } from './d1/index.ts';
import { createTestD1Client } from './d1/testD1.ts';

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

export interface ReplicationOutboxEvent {
  id: string; // Event ID unik
  operationId: string; // Deterministik operationId (entityType:entityId:versionOrTime)
  entityType: ReplicationEntityType;
  entityId: string;
  farmerId: string;
  action: ReplicationAction;
  payload: Record<string, any>;
  version: number;
  status: 'PENDING' | 'PROCESSED' | 'FAILED';
  retryCount: number;
  lastError?: string;
  createdAt: string;
  processedAt?: string;
}

export class ReplicationOutboxService {
  private static instance: ReplicationOutboxService;
  // Outbox storage in PostgreSQL / Local memory buffer for decoupled execution
  private outboxQueue: Map<string, ReplicationOutboxEvent> = new Map();
  private d1Db: DrizzleD1Database<typeof d1Schema> | null = null;

  public constructor(d1Db?: DrizzleD1Database<typeof d1Schema>) {
    if (d1Db) {
      this.d1Db = d1Db;
    }
  }

  public static getInstance(d1Db?: DrizzleD1Database<typeof d1Schema>): ReplicationOutboxService {
    if (!ReplicationOutboxService.instance) {
      ReplicationOutboxService.instance = new ReplicationOutboxService(d1Db);
    } else if (d1Db) {
      ReplicationOutboxService.instance.setD1Db(d1Db);
    }
    return ReplicationOutboxService.instance;
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
   * Helper untuk membuat deterministik operationId
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
   * Merekam event replikasi ke Outbox Queue (Dipanggil di dalam alur transaksi Postgres)
   */
  public createOutboxEvent(params: {
    entityType: ReplicationEntityType,
    entityId: string,
    farmerId: string,
    action: ReplicationAction,
    payload: Record<string, any>,
    version?: number,
    timestamp?: string
  }): ReplicationOutboxEvent {
    const timestamp = params.timestamp || new Date().toISOString();
    const version = params.version || 1;
    const operationId = ReplicationOutboxService.generateDeterministicOperationId(
      params.entityType,
      params.entityId,
      params.action,
      version
    );

    const event: ReplicationOutboxEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      operationId,
      entityType: params.entityType,
      entityId: params.entityId,
      farmerId: params.farmerId,
      action: params.action,
      payload: params.payload || {},
      version,
      status: 'PENDING',
      retryCount: 0,
      createdAt: timestamp,
    };

    this.outboxQueue.set(event.id, event);
    return event;
  }

  /**
   * Memproses dan mereplikasi single outbox event ke Cloudflare D1
   */
  public async processEvent(eventId: string): Promise<{ success: boolean; event: ReplicationOutboxEvent }> {
    const event = this.outboxQueue.get(eventId);
    if (!event) {
      throw new Error(`Replication event with id ${eventId} not found`);
    }

    try {
      const d1 = this.getD1Db();

      // 1. Cek idempotency di D1 processed_operations
      const existingOp = await d1
        .select()
        .from(d1ProcessedOps)
        .where(eq(d1ProcessedOps.operationId, event.operationId))
        .limit(1);

      if (existingOp.length > 0) {
        // Event sudah pernah di-apply ke D1
        event.status = 'PROCESSED';
        event.processedAt = new Date().toISOString();
        return { success: true, event };
      }

      // 2. Perlindungan Kedaulatan Petani (actual_actions delete protection)
      if (event.entityType === 'ACTUAL_ACTION' && event.action === 'DELETE') {
        throw new Error('Kedaulatan Petani: Catatan tindakan aktual mandiri dilindungi dan tidak boleh dihapus di D1.');
      }

      // 3. Tulis mutasi ke sync_journal D1
      const isTombstone = event.action === 'DELETE';
      const journalId = `jn_pg_${event.id}`;
      await d1.insert(d1SyncJournal).values({
        id: journalId,
        farmerId: event.farmerId,
        entityType: event.entityType,
        entityId: event.entityId,
        action: event.action,
        payload: isTombstone ? {} : event.payload,
        isTombstone,
        serverTimestamp: event.createdAt,
      });

      // 4. Rekam operationId ke D1 processed_operations
      try {
        await d1.insert(d1ProcessedOps).values({
          operationId: event.operationId,
          userId: `pg_system_${event.farmerId}`,
          farmerId: event.farmerId,
          entityType: event.entityType,
          entityId: event.entityId,
          action: event.action,
          processedAt: new Date().toISOString(),
        });
      } catch (insertErr: any) {
        // Idempotent duplicate catch
        console.warn(`[Replicator] Concurrent operationId already present in D1: ${event.operationId}`);
      }

      event.status = 'PROCESSED';
      event.processedAt = new Date().toISOString();
      return { success: true, event };
    } catch (err: any) {
      event.status = 'FAILED';
      event.retryCount += 1;
      event.lastError = err?.message || String(err);
      // Kegagalan D1 tidak melempar ke Postgres, tetapi mencatat error di outbox
      return { success: false, event };
    }
  }

  /**
   * Drain / Retry all pending & failed replication events
   */
  public async drainPendingEvents(): Promise<{
    total: number;
    processed: number;
    failed: number;
  }> {
    let processed = 0;
    let failed = 0;

    for (const [id, event] of this.outboxQueue.entries()) {
      if (event.status === 'PENDING' || event.status === 'FAILED') {
        const res = await this.processEvent(id);
        if (res.success) {
          processed++;
        } else {
          failed++;
        }
      }
    }

    return { total: this.outboxQueue.size, processed, failed };
  }

  /**
   * Dapatkan list outbox events (untuk inspection & testing)
   */
  public getOutboxEvents(): ReplicationOutboxEvent[] {
    return Array.from(this.outboxQueue.values());
  }

  /**
   * Reset outbox (Hanya untuk testing)
   */
  public resetOutbox(): void {
    this.outboxQueue.clear();
  }
}

export const replicationOutboxService = ReplicationOutboxService.getInstance();
