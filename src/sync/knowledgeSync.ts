/**
 * HIKMAT TANI - Client Knowledge Sync Engine (Langkah 11C)
 * 
 * Prinsip:
 * - Offline-First: Dexie IndexedDB adalah sumber data lokal utama untuk UI Informasi.
 * - Non-Blocking: UI membaca langsung dari Dexie, tidak pernah menunggu API jaringan.
 * - Atomic Update: Pembaruan master data dilakukan dalam satu transaksi Dexie menyeluruh.
 * - Bandwidth-Efficient: Memeriksa versi terlebih dahulu sebelum mengunduh data besar.
 * - Friendly Status: Notifikasi yang tenang, tidak mengganggu operasional petani.
 */

import { db } from '../db/database.ts';
import {
  Fertilizer,
  KnowledgeArticle,
  NaturalEnemy,
  Opt,
  Reference,
  RiceVariety,
} from '../types/index.ts';

export type KnowledgeSyncStatus =
  | 'IDLE'
  | 'CHECKING'
  | 'SYNCING'
  | 'SUCCESS'
  | 'OFFLINE_FALLBACK'
  | 'ERROR';

export interface KnowledgeSyncInfo {
  status: KnowledgeSyncStatus;
  message: string;
  localVersion: string;
  lastSyncAt: string | null;
  updatedEntitiesCount?: number;
}

export interface KnowledgeBundleData {
  version: string;
  updatedAt: string;
  references?: Reference[];
  fertilizers?: Fertilizer[];
  riceVarieties?: RiceVariety[];
  opts?: Opt[];
  naturalEnemies?: NaturalEnemy[];
  knowledgeArticles?: KnowledgeArticle[];
}

export interface KnowledgeUpdatesData {
  hasUpdates: boolean;
  version: string;
  since: string | null;
  updatedAt: string;
  isFullSyncRequired?: boolean;
  changes: {
    references?: Reference[];
    fertilizers?: Fertilizer[];
    riceVarieties?: RiceVariety[];
    opts?: Opt[];
    naturalEnemies?: NaturalEnemy[];
    knowledgeArticles?: KnowledgeArticle[];
  };
}

const STORAGE_KEY_VERSION = 'hikmat_tani_knowledge_version';
const STORAGE_KEY_LAST_SYNC = 'hikmat_tani_knowledge_last_sync';
const DEFAULT_INITIAL_VERSION = 'v1.0.0';

export class ClientKnowledgeSyncEngine {
  private currentStatus: KnowledgeSyncStatus = 'IDLE';
  private statusMessage: string = 'Informasi tersimpan siap digunakan.';
  private listeners: Array<(info: KnowledgeSyncInfo) => void> = [];

  constructor() {
    // Inisialisasi status awal
    const localVersion = this.getLocalVersion();
    const lastSyncAt = this.getLastSyncTime();
    this.statusMessage = lastSyncAt
      ? 'Informasi tersimpan di perangkat.'
      : 'Informasi siap digunakan.';
  }

  /**
   * Mengambil versi knowledge yang tersimpan di perangkat lokal
   */
  public getLocalVersion(): string {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return localStorage.getItem(STORAGE_KEY_VERSION) || DEFAULT_INITIAL_VERSION;
      }
    } catch {
      // Abaikan jika localStorage tidak dapat diakses
    }
    return DEFAULT_INITIAL_VERSION;
  }

  /**
   * Menyimpan versi knowledge terkini ke local storage
   */
  public setLocalVersion(version: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STORAGE_KEY_VERSION, version);
        localStorage.setItem(STORAGE_KEY_LAST_SYNC, new Date().toISOString());
      }
    } catch {
      // Abaikan jika localStorage tidak dapat diakses
    }
  }

  /**
   * Mengambil waktu terakhir sinkronisasi knowledge berhasil
   */
  public getLastSyncTime(): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return localStorage.getItem(STORAGE_KEY_LAST_SYNC);
      }
    } catch {
      // Abaikan
    }
    return null;
  }

  /**
   * Mendaftarkan subscriber untuk memantau status pembaruan informasi
   */
  public subscribe(listener: (info: KnowledgeSyncInfo) => void): () => void {
    this.listeners.push(listener);
    listener(this.getSyncInfo());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Mengambil snapshot informasi sinkronisasi saat ini
   */
  public getSyncInfo(): KnowledgeSyncInfo {
    return {
      status: this.currentStatus,
      message: this.statusMessage,
      localVersion: this.getLocalVersion(),
      lastSyncAt: this.getLastSyncTime(),
    };
  }

  private notify(updatedCount?: number): void {
    const info: KnowledgeSyncInfo = {
      status: this.currentStatus,
      message: this.statusMessage,
      localVersion: this.getLocalVersion(),
      lastSyncAt: this.getLastSyncTime(),
      updatedEntitiesCount: updatedCount,
    };
    this.listeners.forEach((fn) => {
      try {
        fn(info);
      } catch (err) {
        console.error('Error in knowledge sync listener:', err);
      }
    });
  }

  /**
   * Validasi struktur payload sebelum diterapkan ke IndexedDB
   */
  public validatePayload(payload: any): boolean {
    if (!payload || typeof payload !== 'object') return false;
    if (!payload.version || typeof payload.version !== 'string') return false;

    const data = payload.changes || payload;
    const collections = [
      'references',
      'fertilizers',
      'riceVarieties',
      'opts',
      'naturalEnemies',
      'knowledgeArticles',
    ];

    for (const coll of collections) {
      if (data[coll] !== undefined) {
        if (!Array.isArray(data[coll])) return false;
        for (const item of data[coll]) {
          if (!item || typeof item !== 'object' || !item.id) {
            return false;
          }
        }
      }
    }

    return true;
  }

  /**
   * Menerapkan bundle/updates ke Dexie secara atomik menggunakan Dexie Transaction
   */
  public async applyKnowledgeAtomically(
    bundleOrUpdates: KnowledgeBundleData | KnowledgeUpdatesData
  ): Promise<{ success: boolean; appliedCount: number }> {
    const isValid = this.validatePayload(bundleOrUpdates);
    if (!isValid) {
      throw new Error('Payload knowledge tidak valid atau korup. Transaksi dibatalkan.');
    }

    const data = 'changes' in bundleOrUpdates ? bundleOrUpdates.changes : bundleOrUpdates;
    const version = bundleOrUpdates.version;

    let appliedCount = 0;

    // Transaksi Atomik Dexie
    await db.transaction(
      'rw',
      [
        db.references,
        db.fertilizers,
        db.riceVarieties,
        db.opts,
        db.naturalEnemies,
        db.knowledgeArticles,
      ],
      async () => {
        // 1. References
        if (data.references && data.references.length > 0) {
          await db.references.bulkPut(data.references);
          appliedCount += data.references.length;
        }

        // 2. Fertilizers
        if (data.fertilizers && data.fertilizers.length > 0) {
          await db.fertilizers.bulkPut(data.fertilizers);
          appliedCount += data.fertilizers.length;
        }

        // 3. Varieties
        if (data.riceVarieties && data.riceVarieties.length > 0) {
          await db.riceVarieties.bulkPut(data.riceVarieties);
          appliedCount += data.riceVarieties.length;
        }

        // 4. OPTs
        if (data.opts && data.opts.length > 0) {
          await db.opts.bulkPut(data.opts);
          appliedCount += data.opts.length;
        }

        // 5. Natural Enemies
        if (data.naturalEnemies && data.naturalEnemies.length > 0) {
          await db.naturalEnemies.bulkPut(data.naturalEnemies);
          appliedCount += data.naturalEnemies.length;
        }

        // 6. Knowledge Articles
        if (data.knowledgeArticles && data.knowledgeArticles.length > 0) {
          await db.knowledgeArticles.bulkPut(data.knowledgeArticles);
          appliedCount += data.knowledgeArticles.length;
        }
      }
    );

    // Simpan versi baru HANYA jika transaksi selesai dengan sukses tanpa error
    this.setLocalVersion(version);

    return { success: true, appliedCount };
  }

  /**
   * Menjalankan proses pemeriksaan dan sinkronisasi knowledge dengan server
   */
  public async syncKnowledge(options?: {
    forceFull?: boolean;
    baseUrl?: string;
  }): Promise<{ success: boolean; updatedCount: number; message: string }> {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    // 1. Jika offline: Jangan menunggu API, biarkan Dexie lokal melayani pengguna
    if (!isOnline) {
      this.currentStatus = 'OFFLINE_FALLBACK';
      this.statusMessage = 'Informasi yang tersimpan tetap dapat digunakan.';
      this.notify(0);
      return {
        success: true,
        updatedCount: 0,
        message: this.statusMessage,
      };
    }

    const baseUrl = options?.baseUrl || '/api/v1/knowledge';
    const localVersion = this.getLocalVersion();

    try {
      this.currentStatus = 'CHECKING';
      this.statusMessage = 'Memeriksa pembaruan informasi...';
      this.notify();

      // Step A: Cek versi server terlebih dahulu (hemat kuota data)
      const versionRes = await fetch(`${baseUrl}/version`, {
        headers: { 'Accept': 'application/json' },
      });

      if (!versionRes.ok) {
        throw new Error(`Server status ${versionRes.status}`);
      }

      const versionJson = await versionRes.json();
      const serverVersion = versionJson?.data?.version;

      // Jika versi server sama dengan lokal dan tidak diminta force full:
      if (serverVersion && serverVersion === localVersion && !options?.forceFull) {
        this.currentStatus = 'SUCCESS';
        this.statusMessage = 'Informasi sudah diperbarui.';
        this.notify(0);
        return {
          success: true,
          updatedCount: 0,
          message: this.statusMessage,
        };
      }

      // Step B: Mengunduh data
      this.currentStatus = 'SYNCING';
      this.statusMessage = 'Memperbarui informasi...';
      this.notify();

      let appliedCount = 0;

      if (!localVersion || localVersion === DEFAULT_INITIAL_VERSION || options?.forceFull) {
        // Ambil full bundle jika belum memiliki data atau force
        const bundleRes = await fetch(`${baseUrl}/bundle`, {
          headers: { 'Accept': 'application/json' },
        });

        if (!bundleRes.ok) throw new Error(`Gagal mengunduh bundle: ${bundleRes.status}`);
        const bundleJson = await bundleRes.json();

        const result = await this.applyKnowledgeAtomically(bundleJson.data);
        appliedCount = result.appliedCount;
      } else {
        // Ambil incremental updates
        const updatesRes = await fetch(
          `${baseUrl}/updates?since=${encodeURIComponent(localVersion)}`,
          {
            headers: { 'Accept': 'application/json' },
          }
        );

        if (!updatesRes.ok) throw new Error(`Gagal mengunduh updates: ${updatesRes.status}`);
        const updatesJson = await updatesRes.json();
        const updatesData: KnowledgeUpdatesData = updatesJson.data;

        if (updatesData.isFullSyncRequired) {
          // Jika server merekomendasikan full sync
          const fullRes = await fetch(`${baseUrl}/bundle`);
          const fullJson = await fullRes.json();
          const result = await this.applyKnowledgeAtomically(fullJson.data);
          appliedCount = result.appliedCount;
        } else if (updatesData.hasUpdates) {
          const result = await this.applyKnowledgeAtomically(updatesData);
          appliedCount = result.appliedCount;
        } else {
          // Tidak ada perubahan
          this.setLocalVersion(updatesData.version || serverVersion);
        }
      }

      this.currentStatus = 'SUCCESS';
      this.statusMessage = 'Informasi sudah diperbarui.';
      this.notify(appliedCount);

      return {
        success: true,
        updatedCount: appliedCount,
        message: this.statusMessage,
      };
    } catch (error: any) {
      console.warn('Knowledge sync warning (graceful fallback):', error?.message);
      this.currentStatus = 'ERROR';
      this.statusMessage =
        'Informasi terbaru belum tersedia. Informasi yang tersimpan tetap dapat digunakan.';
      this.notify(0);

      return {
        success: false,
        updatedCount: 0,
        message: this.statusMessage,
      };
    }
  }
}

export const clientKnowledgeSync = new ClientKnowledgeSyncEngine();
