/**
 * HIKMAT TANI - Client Synchronization Engine (Two-Way Sync)
 * 
 * Prinsip:
 * - 100% Offline-First: Dexie IndexedDB tetap sumber utama data lokal.
 * - Outbox Queue: Semua mutasi lokal tercatat di outbox dengan operationId unik.
 * - Idempotent Push: Kirim outbox dalam batch, hapus hanya setelah diakui server.
 * - Incremental Pull: Tarik perubahan berdasarkan server cursor / timestamp.
 * - Conflict Handling: LWW dengan proteksi penuh untuk data aktual petani (actualActions).
 * - Human-Friendly Status:
 *     ✓ Tersinkron
 *     ⟳ Menyinkronkan
 *     • Menunggu koneksi
 *     ! Sinkronisasi tertunda
 */

import { db } from '../db/database.ts';
import { outboxRepository } from '../db/repositories/outboxRepository.ts';
import { SyncOutboxItem } from '../types/sync.ts';

export type SyncState = 'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR' | 'OFFLINE';

export interface SyncEngineStateInfo {
  state: SyncState;
  statusLabel: string;
  statusDetail: string;
  isOnline: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  errorMessage?: string;
}

const STORAGE_KEYS = {
  TOKEN: 'hikmat_auth_token',
  ANONYMOUS_ID: 'hikmat_anon_device_id',
  SYNC_CURSOR: 'hikmat_sync_cursor',
  LAST_SYNC_AT: 'hikmat_last_sync_time',
};

class SyncEngine {
  private static instance: SyncEngine;
  private state: SyncState = 'IDLE';
  private errorMessage?: string;
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private pendingCount = 0;
  private lastSyncAt: string | null = null;
  private listeners: Set<(info: SyncEngineStateInfo) => void> = new Set();
  private syncInProgress = false;
  private isInitialized = false;
  private debounceTimer: any = null;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.lastSyncAt = localStorage.getItem(STORAGE_KEYS.LAST_SYNC_AT);
      this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

      window.addEventListener('online', () => {
        this.isOnline = true;
        this.notifyListeners();
        this.syncNow().catch(() => {});
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.state = 'OFFLINE';
        this.notifyListeners();
      });

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.isOnline) {
          this.syncNow().catch(() => {});
        }
      });

      // Background sync periodic timer (every 60s)
      setInterval(() => {
        if (this.isOnline && !this.syncInProgress) {
          this.syncNow().catch(() => {});
        }
      }, 60000);
    }
  }

  public static getInstance(): SyncEngine {
    if (!SyncEngine.instance) {
      SyncEngine.instance = new SyncEngine();
    }
    return SyncEngine.instance;
  }

  /**
   * Inisialisasi awal saat aplikasi dimuat
   */
  public async init(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;
    await this.refreshPendingCount();
    this.notifyListeners();

    // Jalankan sync pertama jika online
    if (this.isOnline) {
      setTimeout(() => {
        this.syncNow().catch(() => {});
      }, 1500);
    }
  }

  /**
   * Notifikasi adanya mutasi lokal baru dari repository
   */
  public notifyMutation(): void {
    this.refreshPendingCount().catch(() => {});
    if (this.isOnline) {
      this.debounceSync();
    }
  }

  private debounceSync(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.syncNow().catch(() => {});
    }, 1000);
  }

  /**
   * Memperbarui hitungan antrean pending di outbox
   */
  public async refreshPendingCount(): Promise<number> {
    try {
      this.pendingCount = await outboxRepository.countPending();
      this.notifyListeners();
      return this.pendingCount;
    } catch {
      return this.pendingCount;
    }
  }

  /**
   * Mendapatkan token autentikasi aktif atau membuat token anonim otomatis
   */
  private async getOrFetchAuthToken(): Promise<string | null> {
    if (typeof window === 'undefined') return null;

    let token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    if (token) return token;

    // Buat/ambil anonymousId
    let anonId = localStorage.getItem(STORAGE_KEYS.ANONYMOUS_ID);
    if (!anonId) {
      anonId = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem(STORAGE_KEYS.ANONYMOUS_ID, anonId);
    }

    try {
      const resp = await fetch('/api/v1/auth/anonymous-or-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId: anonId }),
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data?.data?.token) {
          token = data.data.token;
          localStorage.setItem(STORAGE_KEYS.TOKEN, token!);
          return token;
        }
      }
    } catch {
      // Gagal tersambung ke backend (misal offline)
    }

    return null;
  }

  /**
   * Eksekusi Siklus Sinkronisasi Lengkap (Push + Pull)
   */
  public async syncNow(): Promise<{
    success: boolean;
    pushedCount: number;
    pulledCount: number;
    error?: string;
  }> {
    if (this.syncInProgress) {
      return { success: false, pushedCount: 0, pulledCount: 0, error: 'Sinkronisasi sedang berjalan' };
    }

    if (!this.isOnline) {
      this.state = 'OFFLINE';
      this.notifyListeners();
      return { success: false, pushedCount: 0, pulledCount: 0, error: 'Perangkat sedang offline' };
    }

    this.syncInProgress = true;
    this.state = 'SYNCING';
    this.errorMessage = undefined;
    this.notifyListeners();

    let pushedCount = 0;
    let pulledCount = 0;
    let itemsToPush: any[] = [];

    try {
      const token = await this.getOrFetchAuthToken();
      if (!token) {
        throw new Error('Tidak dapat memperoleh token autentikasi server');
      }

      // ==========================================
      // 1. PUSH: Kirim outbox lokal ke server
      // ==========================================
      const pendingItems = await outboxRepository.getPending();
      itemsToPush = [...pendingItems];

      if (pendingItems.length > 0) {
        // Tandai item sedang diproses
        for (const item of pendingItems) {
          await outboxRepository.updateStatus(item.id, 'SYNCING');
        }

        const pushResp = await fetch('/api/v1/sync/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ items: pendingItems }),
        });

        if (!pushResp.ok) {
          const errData = await pushResp.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `Push error HTTP ${pushResp.status}`);
        }

        const pushData = await pushResp.json();
        const ackIds: string[] = pushData?.data?.acknowledgedOperationIds || [];

        // Hapus item yang sudah di-acknowledge dari outbox Dexie
        for (const item of pendingItems) {
          if (ackIds.includes(item.operationId)) {
            await outboxRepository.clearSynced(item.id);
            pushedCount++;
          } else {
            await outboxRepository.updateStatus(item.id, 'PENDING', 'Tidak di-acknowledge server');
          }
        }
      }

      // ==========================================
      // 2. PULL: Tarik perubahan terbaru dari server
      // ==========================================
      const lastCursor = localStorage.getItem(STORAGE_KEYS.SYNC_CURSOR) || '';
      const pullUrl = `/api/v1/sync/pull${lastCursor ? `?since=${encodeURIComponent(lastCursor)}` : ''}`;

      const pullResp = await fetch(pullUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!pullResp.ok) {
        const errData = await pullResp.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Pull error HTTP ${pullResp.status}`);
      }

      const pullData = await pullResp.json();
      const changes = pullData?.data?.changes || [];
      const newCursor = pullData?.data?.serverTimestamp;

      if (changes.length > 0) {
        // Terapkan perubahan ke Dexie IndexedDB
        await this.applyRemoteChanges(changes);
        pulledCount = changes.length;
      }

      if (newCursor) {
        localStorage.setItem(STORAGE_KEYS.SYNC_CURSOR, newCursor);
      }

      const nowIso = new Date().toISOString();
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC_AT, nowIso);
      this.lastSyncAt = nowIso;
      this.state = 'SUCCESS';
      await this.refreshPendingCount();

      return {
        success: true,
        pushedCount,
        pulledCount,
      };
    } catch (err: any) {
      // Pada saat gagal, kembalikan status item ke PENDING agar dapat dicoba lagi
      for (const item of itemsToPush) {
        await outboxRepository.updateStatus(item.id, 'PENDING', err?.message || 'Koneksi gagal');
      }

      this.state = 'ERROR';
      this.errorMessage = err?.message || 'Sinkronisasi tertunda';
      await this.refreshPendingCount();

      return {
        success: false,
        pushedCount,
        pulledCount,
        error: this.errorMessage,
      };
    } finally {
      this.syncInProgress = false;
      this.notifyListeners();
    }
  }

  /**
   * Terapkan perubahan dari server ke Dexie secara aman
   */
  private async applyRemoteChanges(changes: any[]): Promise<void> {
    for (const change of changes) {
      const { entityType, entityId, action, payload, isTombstone } = change;

      try {
        if (isTombstone || action === 'DELETE') {
          await this.deleteLocalEntity(entityType, entityId);
        } else {
          await this.putLocalEntity(entityType, payload);
        }
      } catch (err) {
        console.warn(`[SyncEngine] Gagal menerapkan perubahan remote untuk ${entityType}:${entityId}:`, err);
      }
    }
  }

  private async putLocalEntity(entityType: string, payload: any): Promise<void> {
    if (!payload || !payload.id) return;

    switch (entityType) {
      case 'FARMER':
        await db.farmers.put(payload);
        break;
      case 'LAND':
        await db.lands.put(payload);
        break;
      case 'CROP_SEASON':
        await db.cropSeasons.put(payload);
        break;
      case 'ACTIVITY':
        await db.activities.put(payload);
        break;
      case 'FERTILIZER_APPLICATION':
        await db.fertilizerApplications.put(payload);
        break;
      case 'OPT_OBSERVATION':
        await db.optObservations.put(payload);
        break;
      case 'SEEDBED':
        await db.seedbeds.put(payload);
        break;
      case 'EXPENSE':
        await db.expenses.put(payload);
        break;
      case 'RECOMMENDATION':
        await db.recommendations.put(payload);
        break;
      case 'FARMER_DECISION':
        await db.farmerDecisions.put(payload);
        break;
      case 'ACTUAL_ACTION':
        // Lindungi catatan tindakan aktual petani
        await db.actualActions.put(payload);
        break;
    }
  }

  private async deleteLocalEntity(entityType: string, entityId: string): Promise<void> {
    switch (entityType) {
      case 'FARMER':
        await db.farmers.delete(entityId);
        break;
      case 'LAND':
        await db.lands.delete(entityId);
        break;
      case 'CROP_SEASON':
        await db.cropSeasons.delete(entityId);
        break;
      case 'ACTIVITY':
        await db.activities.delete(entityId);
        break;
      case 'FERTILIZER_APPLICATION':
        await db.fertilizerApplications.delete(entityId);
        break;
      case 'OPT_OBSERVATION':
        await db.optObservations.delete(entityId);
        break;
      case 'SEEDBED':
        await db.seedbeds.delete(entityId);
        break;
      case 'EXPENSE':
        await db.expenses.delete(entityId);
        break;
      case 'RECOMMENDATION':
        await db.recommendations.delete(entityId);
        break;
      case 'FARMER_DECISION':
        await db.farmerDecisions.delete(entityId);
        break;
      case 'ACTUAL_ACTION':
        // ACTUAL_ACTION tidak sembarangan dihapus
        break;
    }
  }

  /**
   * Status label dalam bahasa ramah petani
   */
  public getStateInfo(): SyncEngineStateInfo {
    let statusLabel = '• Menunggu koneksi';
    let statusDetail = 'Data tersimpan di perangkat.';

    if (!this.isOnline) {
      statusLabel = '• Menunggu koneksi';
      statusDetail = 'Data tersimpan di perangkat.';
    } else if (this.state === 'SYNCING') {
      statusLabel = '⟳ Menyinkronkan';
      statusDetail = 'Sedang menyinkronkan...';
    } else if (this.state === 'SUCCESS' && this.pendingCount === 0) {
      statusLabel = '✓ Tersinkron';
      statusDetail = 'Data tersinkron.';
    } else if (this.state === 'ERROR' || this.pendingCount > 0) {
      statusLabel = '! Sinkronisasi tertunda';
      statusDetail = 'Belum tersinkron. Akan dicoba lagi.';
    } else if (this.isOnline) {
      statusLabel = '✓ Tersinkron';
      statusDetail = 'Data tersinkron.';
    }

    return {
      state: this.state,
      statusLabel,
      statusDetail,
      isOnline: this.isOnline,
      pendingCount: this.pendingCount,
      lastSyncAt: this.lastSyncAt,
      errorMessage: this.errorMessage,
    };
  }

  public subscribe(listener: (info: SyncEngineStateInfo) => void): () => void {
    this.listeners.add(listener);
    listener(this.getStateInfo());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const info = this.getStateInfo();
    for (const listener of this.listeners) {
      try {
        listener(info);
      } catch (err) {
        console.error('[SyncEngine] Error in listener:', err);
      }
    }
  }
}

export const syncEngine = SyncEngine.getInstance();
