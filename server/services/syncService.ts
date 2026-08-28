/**
 * HIKMAT TANI - Two-Way Sync Service (Persistent D1 Backend)
 * 
 * Prinsip:
 * 1. Idempotency mutlak via D1 table `processed_operations`.
 * 2. Validasi kepemilikan data (Ownership Authorization) per farmerId.
 * 3. Pemisahan data operasional vs data master knowledge.
 * 4. Incremental pull berbasis D1 table `sync_journal` dengan ordering server_timestamp ASC.
 * 5. Perlindungan kedaulatan petani: ACTUAL_ACTION DELETE diblokir secara tegas.
 * 6. Tombstone synchronization untuk penyebaran penghapusan aman antar perangkat.
 * 7. Bebas dari in-memory state ephemeral di level production.
 */

import { eq, and, gt, asc, desc } from 'drizzle-orm';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import { AuthSessionPayload } from './authService.ts';
import { d1DbService, d1Schema } from '../db/d1/index.ts';
import { processedOperations, syncJournal } from '../db/d1/schema.ts';
import { createTestD1Client, InMemoryD1Database } from '../db/d1/testD1.ts';

export type SyncEntityType =
  | 'FARMER'
  | 'LAND'
  | 'CROP_SEASON'
  | 'ACTIVITY'
  | 'FERTILIZER_APPLICATION'
  | 'OPT_OBSERVATION'
  | 'SEEDBED'
  | 'EXPENSE'
  | 'RECOMMENDATION'
  | 'FARMER_DECISION'
  | 'ACTUAL_ACTION';

export type SyncAction = 'CREATE' | 'UPDATE' | 'DELETE';

export interface SyncPushItem {
  id?: string;
  operationId: string;
  entityType: SyncEntityType;
  entityId: string;
  action: SyncAction;
  payload: Record<string, any>;
  createdAt?: string;
}

export interface SyncJournalEntry {
  id: string;
  farmerId: string;
  operationId: string;
  entityType: SyncEntityType;
  entityId: string;
  action: SyncAction;
  payload: Record<string, any>;
  isTombstone: boolean;
  serverTimestamp: string;
}

export const ALLOWED_SYNC_ENTITIES = new Set<string>([
  'FARMER',
  'LAND',
  'CROP_SEASON',
  'ACTIVITY',
  'FERTILIZER_APPLICATION',
  'OPT_OBSERVATION',
  'SEEDBED',
  'EXPENSE',
  'RECOMMENDATION',
  'FARMER_DECISION',
  'ACTUAL_ACTION',
]);

export class SyncService {
  private static instance: SyncService;
  private db: DrizzleD1Database<typeof d1Schema> | null = null;
  private testEngine: InMemoryD1Database | null = null;

  public constructor(db?: DrizzleD1Database<typeof d1Schema>) {
    if (db) {
      this.db = db;
    }
  }

  public static getInstance(db?: DrizzleD1Database<typeof d1Schema>): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService(db);
    } else if (db) {
      SyncService.instance.setDb(db);
    }
    return SyncService.instance;
  }

  /**
   * Set D1 Database Client secara eksplisit (misal dari Cloudflare Worker env.DB)
   */
  public setDb(db: DrizzleD1Database<typeof d1Schema>): void {
    this.db = db;
  }

  /**
   * Mengambil instance D1 client aktif
   */
  public getDb(): DrizzleD1Database<typeof d1Schema> {
    if (this.db) {
      return this.db;
    }
    const globalClient = d1DbService.getClient();
    if (globalClient) {
      this.db = globalClient;
      return this.db;
    }
    // Fallback in-memory D1 engine untuk test runner / local environment
    if (!this.testEngine) {
      this.testEngine = new InMemoryD1Database();
    }
    this.db = createTestD1Client();
    return this.db;
  }

  /**
   * Reset store (hanya digunakan untuk keperluan unit testing)
   */
  public async resetStore(): Promise<void> {
    const db = this.getDb();
    try {
      await db.delete(processedOperations);
      await db.delete(syncJournal);
    } catch {
      // Abaikan jika database baru belum memiliki baris
    }
    if (this.testEngine) {
      this.testEngine.reset();
    }
  }

  /**
   * Memproses batch push dari client dengan persistensi D1
   */
  public async processPush(
    user: AuthSessionPayload,
    items: SyncPushItem[]
  ): Promise<{
    success: boolean;
    processedCount: number;
    acknowledgedOperationIds: string[];
    serverTimestamp: string;
  }> {
    const userFarmerId = user.farmerId || `farmer_${user.userId}`;
    const serverTimestamp = new Date().toISOString();
    const acknowledgedOperationIds: string[] = [];
    let processedCount = 0;
    const db = this.getDb();

    for (const item of items) {
      // 1. Validasi struktur wajib item
      if (!item.operationId || !item.entityType || !item.entityId || !item.action) {
        throw {
          statusCode: 400,
          code: 'INVALID_SYNC_ITEM',
          message: 'Item sinkronisasi harus memiliki operationId, entityType, entityId, dan action yang valid',
        };
      }

      // 2. Validasi supported operational entity
      if (!ALLOWED_SYNC_ENTITIES.has(item.entityType)) {
        throw {
          statusCode: 400,
          code: 'UNSUPPORTED_SYNC_ENTITY',
          message: `Entitas ${item.entityType} bukan data operasional yang dapat disinkronkan oleh client`,
        };
      }

      // 3. Validasi Hak Milik (Ownership Authorization)
      if (item.payload && item.payload.farmerId && item.payload.farmerId !== userFarmerId) {
        throw {
          statusCode: 403,
          code: 'UNAUTHORIZED_OWNERSHIP',
          message: `Akses ditolak: Operasi untuk farmerId '${item.payload.farmerId}' tidak sesuai dengan hak akses user '${userFarmerId}'`,
        };
      }

      // 4. Perlindungan Mutlak ACTUAL_ACTION: Penghapusan dilarang keras
      if (item.entityType === 'ACTUAL_ACTION' && item.action === 'DELETE') {
        throw {
          statusCode: 400,
          code: 'ACTUAL_ACTION_PROTECTED',
          message: 'Kedaulatan Petani: Catatan tindakan aktual mandiri petani dilindungi dan tidak boleh dihapus.',
        };
      }

      // 5. Pemeriksaan Idempotency persisten di tabel processed_operations
      const existingOp = await db
        .select()
        .from(processedOperations)
        .where(eq(processedOperations.operationId, item.operationId))
        .limit(1);

      if (existingOp.length > 0) {
        // Operasi sudah pernah diproses secara persisten -> acknowledge tanpa duplikasi mutasi
        acknowledgedOperationIds.push(item.operationId);
        continue;
      }

      // 6. Conflict Resolution (LWW) & Ownership verifikasi terhadap entitas sebelumnya di journal
      const existingEntries = await db
        .select()
        .from(syncJournal)
        .where(
          and(
            eq(syncJournal.entityType, item.entityType),
            eq(syncJournal.entityId, item.entityId)
          )
        )
        .orderBy(desc(syncJournal.serverTimestamp), desc(syncJournal.id))
        .limit(1);

      const latestEntry = existingEntries[0];

      if (latestEntry && latestEntry.farmerId !== userFarmerId) {
        throw {
          statusCode: 403,
          code: 'UNAUTHORIZED_ENTITY_ACCESS',
          message: `Akses ditolak: Entitas ${item.entityId} dimiliki oleh akun lain`,
        };
      }

      let shouldApply = true;
      if (latestEntry && item.action === 'UPDATE') {
        const incomingUpdatedAt = item.payload?.updatedAt || item.createdAt || serverTimestamp;
        const latestTime = new Date(latestEntry.serverTimestamp).getTime();
        const incomingTime = new Date(incomingUpdatedAt).getTime();

        if (!isNaN(latestTime) && !isNaN(incomingTime) && latestTime > incomingTime) {
          // Versi di database lebih baru -> Last-Write-Wins mencegah overwrite data usang
          shouldApply = false;
        }
      }

      // 7. Simpan mutasi ke sync_journal persisten
      if (shouldApply) {
        const isDelete = item.action === 'DELETE';
        const journalId = `jn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const mergedPayload = isDelete ? {} : (item.payload || {});

        await db.insert(syncJournal).values({
          id: journalId,
          farmerId: userFarmerId,
          entityType: item.entityType,
          entityId: item.entityId,
          action: item.action,
          payload: mergedPayload,
          isTombstone: isDelete,
          serverTimestamp: serverTimestamp,
        });

        processedCount++;
      }

      // 8. Simpan operationId ke processed_operations secara persisten (Idempotency Lock)
      try {
        await db.insert(processedOperations).values({
          operationId: item.operationId,
          userId: user.userId,
          farmerId: userFarmerId,
          entityType: item.entityType,
          entityId: item.entityId,
          action: item.action,
          processedAt: serverTimestamp,
        });
      } catch (insertErr: any) {
        // Tangani race condition jika concurrent push sudah memasukkan operationId yang sama
        console.warn(`[SyncService] Concurrent duplicate operationId detected for ${item.operationId}:`, insertErr?.message || insertErr);
      }

      acknowledgedOperationIds.push(item.operationId);
    }

    return {
      success: true,
      processedCount,
      acknowledgedOperationIds,
      serverTimestamp,
    };
  }

  /**
   * Memproses incremental pull untuk client langsung dari tabel sync_journal D1
   */
  public async processPull(
    user: AuthSessionPayload,
    since?: string
  ): Promise<{
    success: boolean;
    changes: SyncJournalEntry[];
    serverTimestamp: string;
    hasMore: boolean;
  }> {
    const userFarmerId = user.farmerId || `farmer_${user.userId}`;
    const currentServerTimestamp = new Date().toISOString();
    const db = this.getDb();

    let entries: any[] = [];
    if (since) {
      entries = await db
        .select()
        .from(syncJournal)
        .where(
          and(
            eq(syncJournal.farmerId, userFarmerId),
            gt(syncJournal.serverTimestamp, since)
          )
        )
        .orderBy(asc(syncJournal.serverTimestamp), asc(syncJournal.id));
    } else {
      entries = await db
        .select()
        .from(syncJournal)
        .where(eq(syncJournal.farmerId, userFarmerId))
        .orderBy(asc(syncJournal.serverTimestamp), asc(syncJournal.id));
    }

    const changes: SyncJournalEntry[] = entries.map((entry) => {
      let parsedPayload: Record<string, any> = {};
      if (typeof entry.payload === 'string') {
        try {
          parsedPayload = JSON.parse(entry.payload);
        } catch {
          parsedPayload = {};
        }
      } else if (entry.payload && typeof entry.payload === 'object') {
        parsedPayload = entry.payload;
      }

      return {
        id: entry.id,
        farmerId: entry.farmerId,
        operationId: '',
        entityType: entry.entityType as SyncEntityType,
        entityId: entry.entityId,
        action: entry.action as SyncAction,
        payload: parsedPayload,
        isTombstone: Boolean(entry.isTombstone),
        serverTimestamp: entry.serverTimestamp,
      };
    });

    return {
      success: true,
      changes,
      serverTimestamp: currentServerTimestamp,
      hasMore: false,
    };
  }

  /**
   * Mendapatkan status statistik sinkronisasi langsung dari database
   */
  public async getStats(farmerId?: string): Promise<{
    totalProcessedOps: number;
    totalJournalEntries: number;
  }> {
    const db = this.getDb();
    const ops = await db.select().from(processedOperations);
    const journalEntries = farmerId
      ? await db.select().from(syncJournal).where(eq(syncJournal.farmerId, farmerId))
      : await db.select().from(syncJournal);

    return {
      totalProcessedOps: ops.length,
      totalJournalEntries: journalEntries.length,
    };
  }
}

export const syncService = SyncService.getInstance();
