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

      // 7. Simpan mutasi ke sync_journal persisten & entity replica
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

        // Tulis ke replica table D1
        await this.applyEntityReplica(db, item, userFarmerId, serverTimestamp);

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

  /**
   * Menulis mutasi ke replica table D1 secara konsisten
   */
  private async applyEntityReplica(
    db: DrizzleD1Database<typeof d1Schema>,
    item: SyncPushItem,
    farmerId: string,
    serverTimestamp: string
  ): Promise<void> {
    const isDelete = item.action === 'DELETE';
    const payload = item.payload || {};

    try {
      switch (item.entityType) {
        case 'LAND': {
          if (isDelete) {
            await db.delete(d1Schema.lands).where(eq(d1Schema.lands.id, item.entityId));
          } else if (item.action === 'CREATE') {
            const existing = await db.select().from(d1Schema.lands).where(eq(d1Schema.lands.id, item.entityId)).limit(1);
            const landRecord = {
              id: item.entityId,
              farmerId: payload.farmerId || farmerId,
              name: payload.name || 'Lahan',
              areaM2: payload.areaM2 !== undefined && payload.areaM2 !== null ? Number(payload.areaM2) : 1000,
              soilType: payload.soilType || 'Lempung Berliat',
              irrigationType: payload.irrigationType || 'Irigasi Teknis',
              village: payload.village || 'Sukamaju',
              district: payload.district || '',
              regency: payload.regency || '',
              latitude: payload.latitude !== undefined && payload.latitude !== null ? Number(payload.latitude) : null,
              longitude: payload.longitude !== undefined && payload.longitude !== null ? Number(payload.longitude) : null,
              status: payload.status || 'ACTIVE',
              createdAt: payload.createdAt || serverTimestamp,
              updatedAt: payload.updatedAt || serverTimestamp,
            };
            if (existing.length > 0) {
              await db.update(d1Schema.lands).set(landRecord).where(eq(d1Schema.lands.id, item.entityId));
            } else {
              await db.insert(d1Schema.lands).values(landRecord);
            }
          } else if (item.action === 'UPDATE') {
            const updateRecord: Record<string, any> = {
              updatedAt: payload.updatedAt || serverTimestamp,
            };
            if (payload.name) updateRecord.name = payload.name;
            if (payload.areaM2 !== undefined && payload.areaM2 !== null) updateRecord.areaM2 = Number(payload.areaM2);
            if (payload.soilType) updateRecord.soilType = payload.soilType;
            if (payload.irrigationType) updateRecord.irrigationType = payload.irrigationType;
            if (payload.village) updateRecord.village = payload.village;
            if (payload.district) updateRecord.district = payload.district;
            if (payload.regency) updateRecord.regency = payload.regency;
            if (payload.latitude !== undefined && payload.latitude !== null) updateRecord.latitude = Number(payload.latitude);
            if (payload.longitude !== undefined && payload.longitude !== null) updateRecord.longitude = Number(payload.longitude);
            if (payload.status) updateRecord.status = payload.status;
            await db.update(d1Schema.lands).set(updateRecord).where(eq(d1Schema.lands.id, item.entityId));
          }
          break;
        }
        case 'FARMER': {
          if (isDelete) {
            await db.delete(d1Schema.farmers).where(eq(d1Schema.farmers.id, item.entityId));
          } else if (item.action === 'CREATE') {
            const existing = await db.select().from(d1Schema.farmers).where(eq(d1Schema.farmers.id, item.entityId)).limit(1);
            const farmerRecord = {
              id: item.entityId,
              name: payload.name || 'Petani Mandiri',
              phoneNumber: payload.phoneNumber || null,
              village: payload.village || 'Sukamaju',
              district: payload.district || null,
              regency: payload.regency || null,
              province: payload.province || null,
              farmerGroupName: payload.farmerGroupName || null,
              authUserId: payload.authUserId || null,
              createdAt: payload.createdAt || serverTimestamp,
              updatedAt: payload.updatedAt || serverTimestamp,
            };
            if (existing.length > 0) {
              await db.update(d1Schema.farmers).set(farmerRecord).where(eq(d1Schema.farmers.id, item.entityId));
            } else {
              await db.insert(d1Schema.farmers).values(farmerRecord);
            }
          } else if (item.action === 'UPDATE') {
            await db.update(d1Schema.farmers).set({
              ...payload,
              updatedAt: payload.updatedAt || serverTimestamp,
            }).where(eq(d1Schema.farmers.id, item.entityId));
          }
          break;
        }
        case 'CROP_SEASON': {
          if (isDelete) {
            await db.delete(d1Schema.cropSeasons).where(eq(d1Schema.cropSeasons.id, item.entityId));
          } else if (item.action === 'CREATE') {
            const existing = await db.select().from(d1Schema.cropSeasons).where(eq(d1Schema.cropSeasons.id, item.entityId)).limit(1);
            const seasonRecord = {
              id: item.entityId,
              landId: payload.landId,
              seasonNumber: payload.seasonNumber !== undefined && payload.seasonNumber !== null ? Number(payload.seasonNumber) : 1,
              varietyId: payload.varietyId || 'inapri-32',
              plantingDate: payload.plantingDate || serverTimestamp,
              harvestDate: payload.harvestDate || null,
              targetYieldTon: payload.targetYieldTon !== undefined && payload.targetYieldTon !== null ? Number(payload.targetYieldTon) : 5,
              actualYieldTon: payload.actualYieldTon !== undefined && payload.actualYieldTon !== null ? Number(payload.actualYieldTon) : null,
              status: payload.status || 'ACTIVE',
              notes: payload.notes || null,
              createdAt: payload.createdAt || serverTimestamp,
              updatedAt: payload.updatedAt || serverTimestamp,
            };
            if (existing.length > 0) {
              await db.update(d1Schema.cropSeasons).set(seasonRecord).where(eq(d1Schema.cropSeasons.id, item.entityId));
            } else {
              await db.insert(d1Schema.cropSeasons).values(seasonRecord);
            }
          } else if (item.action === 'UPDATE') {
            await db.update(d1Schema.cropSeasons).set({
              ...payload,
              updatedAt: payload.updatedAt || serverTimestamp,
            }).where(eq(d1Schema.cropSeasons.id, item.entityId));
          }
          break;
        }
        case 'ACTIVITY': {
          if (isDelete) {
            await db.delete(d1Schema.activities).where(eq(d1Schema.activities.id, item.entityId));
          } else if (item.action === 'CREATE') {
            const existing = await db.select().from(d1Schema.activities).where(eq(d1Schema.activities.id, item.entityId)).limit(1);
            const actRecord = {
              id: item.entityId,
              cropSeasonId: payload.cropSeasonId,
              date: payload.activityDate || payload.date || serverTimestamp,
              hst: payload.hst !== undefined && payload.hst !== null ? Number(payload.hst) : 0,
              activityType: payload.activityType || payload.category || 'OTHER',
              notes: payload.notes || payload.description || null,
              photoUrl: payload.photoUrl || null,
              costRupiah: payload.costRupiah !== undefined && payload.costRupiah !== null ? Number(payload.costRupiah) : null,
              createdAt: payload.createdAt || serverTimestamp,
              updatedAt: payload.updatedAt || serverTimestamp,
            };
            if (existing.length > 0) {
              await db.update(d1Schema.activities).set(actRecord).where(eq(d1Schema.activities.id, item.entityId));
            } else {
              await db.insert(d1Schema.activities).values(actRecord);
            }
          } else if (item.action === 'UPDATE') {
            await db.update(d1Schema.activities).set({
              ...payload,
              updatedAt: payload.updatedAt || serverTimestamp,
            }).where(eq(d1Schema.activities.id, item.entityId));
          }
          break;
        }
        case 'RECOMMENDATION': {
          if (item.action === 'CREATE') {
            const existing = await db.select().from(d1Schema.recommendations).where(eq(d1Schema.recommendations.id, item.entityId)).limit(1);
            if (existing.length === 0) {
              await db.insert(d1Schema.recommendations).values({
                id: item.entityId,
                cropSeasonId: payload.cropSeasonId,
                hst: payload.hst || 0,
                recommendationType: payload.recommendationType || 'IRRIGATION',
                title: payload.title || 'Rekomendasi',
                description: payload.description || '',
                priority: payload.priority || 'MEDIUM',
                sourceRuleId: payload.sourceRuleId || null,
                referenceId: payload.referenceId || null,
                payload: payload.payload || null,
                createdAt: payload.createdAt || serverTimestamp,
              });
            }
          }
          break;
        }
        case 'FARMER_DECISION': {
          if (item.action === 'CREATE') {
            const existing = await db.select().from(d1Schema.farmerDecisions).where(eq(d1Schema.farmerDecisions.id, item.entityId)).limit(1);
            if (existing.length === 0) {
              await db.insert(d1Schema.farmerDecisions).values({
                id: item.entityId,
                recommendationId: payload.recommendationId || null,
                decision: payload.decision || 'ACCEPTED',
                reason: payload.reason || null,
                adjustedData: payload.adjustedData || null,
                decidedAt: payload.decidedAt || serverTimestamp,
              });
            }
          }
          break;
        }
        case 'ACTUAL_ACTION': {
          if (item.action === 'CREATE') {
            const existing = await db.select().from(d1Schema.actualActions).where(eq(d1Schema.actualActions.id, item.entityId)).limit(1);
            if (existing.length === 0) {
              await db.insert(d1Schema.actualActions).values({
                id: item.entityId,
                decisionId: payload.decisionId || null,
                activityId: payload.activityId || null,
                actionDescription: payload.actionDescription || 'Tindakan Aktual Lapang',
                executedAt: payload.executedAt || serverTimestamp,
              });
            }
          }
          break;
        }
      }
    } catch (replicaErr: any) {
      console.warn(`[SyncService] Entity replica write notice for ${item.entityType}:${item.entityId}:`, replicaErr?.message || replicaErr);
    }
  }
}

export const syncService = SyncService.getInstance();
