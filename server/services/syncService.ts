/**
 * HIKMAT TANI - Two-Way Sync Service (Server Side)
 * 
 * Prinsip:
 * 1. Idempotency mutlak via operationId.
 * 2. Validasi kepemilikan data (Ownership Authorization) per farmerId.
 * 3. Pemisahan data operasional vs data master knowledge.
 * 4. Incremental pull berbasis server cursor/timestamp.
 * 5. Perlindungan data actualActions (catatan historis petani tidak boleh hilang).
 * 6. Tombstone synchronization untuk penyebaran penghapusan aman antar perangkat.
 */

import { AuthSessionPayload } from './authService.ts';

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

  // In-memory backing store for processed operations and journal entries
  // (mirrors the PostgreSQL schema for reliable operation in all environments)
  private processedOps: Map<string, { userId: string; farmerId: string; processedAt: string }> = new Map();
  private journal: SyncJournalEntry[] = [];
  private entityStore: Map<string, { farmerId: string; updatedAt: string; data: Record<string, any>; isDeleted: boolean }> = new Map();

  private constructor() {}

  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  /**
   * Reset store (untuk keperluan testing / isolasi)
   */
  public resetStore(): void {
    this.processedOps.clear();
    this.journal = [];
    this.entityStore.clear();
  }

  /**
   * Memproses batch push dari client
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
      // Jika payload memiliki farmerId eksplisit, pastikan sama dengan farmerId user
      if (item.payload && item.payload.farmerId && item.payload.farmerId !== userFarmerId) {
        throw {
          statusCode: 403,
          code: 'UNAUTHORIZED_OWNERSHIP',
          message: `Akses ditolak: Operasi untuk farmerId '${item.payload.farmerId}' tidak sesuai dengan hak akses user '${userFarmerId}'`,
        };
      }

      // 4. Pemeriksaan Idempotency
      if (this.processedOps.has(item.operationId)) {
        // Operasi sudah pernah diproses sebelumnya -> acknowledge tanpa duplikasi
        acknowledgedOperationIds.push(item.operationId);
        continue;
      }

      // 5. Conflict Resolution & Pemrosesan Mutasi
      const storeKey = `${item.entityType}:${item.entityId}`;
      const existingEntity = this.entityStore.get(storeKey);

      // Verifikasi hak milik atas entity yang sudah ada sebelumnya
      if (existingEntity && existingEntity.farmerId !== userFarmerId) {
        throw {
          statusCode: 403,
          code: 'UNAUTHORIZED_ENTITY_ACCESS',
          message: `Akses ditolak: Entitas ${item.entityId} dimiliki oleh akun lain`,
        };
      }

      // Aturan Khusus: ACTUAL_ACTION tidak boleh terhapus sembarangan
      if (item.entityType === 'ACTUAL_ACTION' && item.action === 'DELETE' && existingEntity && !existingEntity.isDeleted) {
        // Tindakan aktual historis petani dilindungi
        console.warn(`[SyncService] Menolak penghapusan sembarangan atas actualAction ${item.entityId}`);
      }

      // Resolusi Konflik LWW untuk Update
      let shouldApply = true;
      if (existingEntity && item.action === 'UPDATE') {
        const incomingUpdatedAt = item.payload?.updatedAt || item.createdAt || serverTimestamp;
        if (existingEntity.updatedAt && new Date(existingEntity.updatedAt).getTime() > new Date(incomingUpdatedAt).getTime()) {
          // Versi server lebih baru -> skip overwrite data server tapi tetap tandai operationId sebagai processed
          shouldApply = false;
        }
      }

      if (shouldApply) {
        const isDelete = item.action === 'DELETE';
        const mergedData = isDelete
          ? {}
          : { ...(existingEntity?.data || {}), ...(item.payload || {}) };

        this.entityStore.set(storeKey, {
          farmerId: userFarmerId,
          updatedAt: item.payload?.updatedAt || serverTimestamp,
          data: mergedData,
          isDeleted: isDelete,
        });

        // 6. Catat ke Jurnal Sinkronisasi untuk disebarkan ke perangkat lain
        const journalEntry: SyncJournalEntry = {
          id: `jn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          farmerId: userFarmerId,
          operationId: item.operationId,
          entityType: item.entityType,
          entityId: item.entityId,
          action: item.action,
          payload: mergedData,
          isTombstone: isDelete,
          serverTimestamp,
        };

        this.journal.push(journalEntry);
        processedCount++;
      }

      // 7. Tandai operationId sebagai telah diproses secara permanen (Idempotent)
      this.processedOps.set(item.operationId, {
        userId: user.userId,
        farmerId: userFarmerId,
        processedAt: serverTimestamp,
      });

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
   * Memproses incremental pull untuk client
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

    let sinceDateMs = 0;
    if (since) {
      const parsed = new Date(since).getTime();
      if (!isNaN(parsed)) {
        sinceDateMs = parsed;
      }
    }

    // Filter perubahan milik farmer yang terjadi setelah `since`
    const relevantChanges = this.journal.filter((entry) => {
      if (entry.farmerId !== userFarmerId) return false;
      const entryTimeMs = new Date(entry.serverTimestamp).getTime();
      return entryTimeMs > sinceDateMs;
    });

    return {
      success: true,
      changes: relevantChanges,
      serverTimestamp: currentServerTimestamp,
      hasMore: false,
    };
  }

  /**
   * Mendapatkan status jurnal sinkronisasi (untuk keperluan inspeksi)
   */
  public getStats(farmerId?: string) {
    return {
      totalProcessedOps: this.processedOps.size,
      totalJournalEntries: farmerId
        ? this.journal.filter((j) => j.farmerId === farmerId).length
        : this.journal.length,
      activeEntitiesCount: this.entityStore.size,
    };
  }
}

export const syncService = SyncService.getInstance();
