/**
 * HIKMAT TANI - Server Knowledge Service (Langkah 11C)
 * 
 * Mengelola Master Knowledge Agronomi, PHT, Varietas, Pupuk, dan Artikel Ilmiah.
 * 
 * Prinsip:
 * - Read-only / authoritative knowledge distribution dari server ke client.
 * - Terpisah secara tegas dari data operasional/pribadi petani.
 * - Mendukung Versioning, Full Bundle, Incremental Updates, dan Validasi Integritas.
 */

import {
  Fertilizer,
  KnowledgeArticle,
  NaturalEnemy,
  Opt,
  Reference,
  RiceVariety,
} from '../../src/types/index.ts';
import {
  SEED_FERTILIZERS,
  SEED_KNOWLEDGE_ARTICLES,
  SEED_NATURAL_ENEMIES,
  SEED_OPTS,
  SEED_REFERENCES,
  SEED_VARIETIES,
} from '../../src/db/seedData.ts';

export interface KnowledgeVersionInfo {
  version: string;
  updatedAt: string;
  totalEntities: number;
  counts: {
    references: number;
    fertilizers: number;
    riceVarieties: number;
    opts: number;
    naturalEnemies: number;
    knowledgeArticles: number;
  };
  statusSummary: {
    verified: number;
    review: number;
  };
}

export interface KnowledgeBundlePayload {
  version: string;
  updatedAt: string;
  references: Reference[];
  fertilizers: Fertilizer[];
  riceVarieties: RiceVariety[];
  opts: Opt[];
  naturalEnemies: NaturalEnemy[];
  knowledgeArticles: KnowledgeArticle[];
  metadata: {
    checksum?: string;
    totalEntities: number;
    serverTime: string;
  };
}

export interface KnowledgeUpdatesPayload {
  hasUpdates: boolean;
  version: string;
  since: string | null;
  updatedAt: string;
  isFullSyncRequired: boolean;
  changes: {
    references: Reference[];
    fertilizers: Fertilizer[];
    riceVarieties: RiceVariety[];
    opts: Opt[];
    naturalEnemies: NaturalEnemy[];
    knowledgeArticles: KnowledgeArticle[];
  };
  metadata: {
    totalChangedEntities: number;
    serverTime: string;
  };
}

export class KnowledgeService {
  private currentVersion: string = 'v1.1.0';
  private lastUpdatedAt: string = '2026-08-20T08:00:00.000Z';

  // In-Memory authoritative stores
  private referencesStore: Reference[] = [...SEED_REFERENCES];
  private fertilizersStore: Fertilizer[] = [...SEED_FERTILIZERS];
  private varietiesStore: RiceVariety[] = [...SEED_VARIETIES];
  private optsStore: Opt[] = [...SEED_OPTS];
  private naturalEnemiesStore: NaturalEnemy[] = [...SEED_NATURAL_ENEMIES];
  private articlesStore: KnowledgeArticle[] = [...SEED_KNOWLEDGE_ARTICLES];

  /**
   * Reset store kembali ke default seed (untuk keperluan pengujian)
   */
  public resetStore(): void {
    this.currentVersion = 'v1.1.0';
    this.lastUpdatedAt = '2026-08-20T08:00:00.000Z';
    this.referencesStore = [...SEED_REFERENCES];
    this.fertilizersStore = [...SEED_FERTILIZERS];
    this.varietiesStore = [...SEED_VARIETIES];
    this.optsStore = [...SEED_OPTS];
    this.naturalEnemiesStore = [...SEED_NATURAL_ENEMIES];
    this.articlesStore = [...SEED_KNOWLEDGE_ARTICLES];
  }

  /**
   * Mengambil metadata versi knowledge terkini secara ringan (hemat bandwidth)
   */
  public getVersionInfo(): KnowledgeVersionInfo {
    const allRefs = this.referencesStore;
    const allFerts = this.fertilizersStore;
    const allVars = this.varietiesStore;
    const allOpts = this.optsStore;
    const allEnemies = this.naturalEnemiesStore;
    const allArticles = this.articlesStore;

    const totalEntities =
      allRefs.length +
      allFerts.length +
      allVars.length +
      allOpts.length +
      allEnemies.length +
      allArticles.length;

    // Hitung status verifikasi dari seluruh artikel dan referensi
    let verified = 0;
    let review = 0;

    allRefs.forEach((r) => {
      if (r.validationStatus === 'VERIFIED') verified++;
      else review++;
    });

    allArticles.forEach((a) => {
      if (a.status === 'VERIFIED') verified++;
      else review++;
    });

    return {
      version: this.currentVersion,
      updatedAt: this.lastUpdatedAt,
      totalEntities,
      counts: {
        references: allRefs.length,
        fertilizers: allFerts.length,
        riceVarieties: allVars.length,
        opts: allOpts.length,
        naturalEnemies: allEnemies.length,
        knowledgeArticles: allArticles.length,
      },
      statusSummary: {
        verified,
        review,
      },
    };
  }

  /**
   * Mengambil Knowledge Bundle lengkap (instalasi awal, new device, recovery)
   */
  public getKnowledgeBundle(): KnowledgeBundlePayload {
    const totalEntities =
      this.referencesStore.length +
      this.fertilizersStore.length +
      this.varietiesStore.length +
      this.optsStore.length +
      this.naturalEnemiesStore.length +
      this.articlesStore.length;

    return {
      version: this.currentVersion,
      updatedAt: this.lastUpdatedAt,
      references: [...this.referencesStore],
      fertilizers: [...this.fertilizersStore],
      riceVarieties: [...this.varietiesStore],
      opts: [...this.optsStore],
      naturalEnemies: [...this.naturalEnemiesStore],
      knowledgeArticles: [...this.articlesStore],
      metadata: {
        totalEntities,
        serverTime: new Date().toISOString(),
      },
    };
  }

  /**
   * Mengambil update bertahap (incremental) sejak versi atau timestamp tertentu
   */
  public getKnowledgeUpdates(since?: string): KnowledgeUpdatesPayload {
    // 1. Jika tidak ada parameter since atau format tidak dikenal, minta full bundle
    if (!since || since.trim() === '') {
      return {
        hasUpdates: true,
        version: this.currentVersion,
        since: null,
        updatedAt: this.lastUpdatedAt,
        isFullSyncRequired: true,
        changes: {
          references: [...this.referencesStore],
          fertilizers: [...this.fertilizersStore],
          riceVarieties: [...this.varietiesStore],
          opts: [...this.optsStore],
          naturalEnemies: [...this.naturalEnemiesStore],
          knowledgeArticles: [...this.articlesStore],
        },
        metadata: {
          totalChangedEntities:
            this.referencesStore.length +
            this.fertilizersStore.length +
            this.varietiesStore.length +
            this.optsStore.length +
            this.naturalEnemiesStore.length +
            this.articlesStore.length,
          serverTime: new Date().toISOString(),
        },
      };
    }

    const cleanSince = since.trim();

    // 2. Jika client sudah memiliki versi yang persis sama
    if (cleanSince === this.currentVersion) {
      return {
        hasUpdates: false,
        version: this.currentVersion,
        since: cleanSince,
        updatedAt: this.lastUpdatedAt,
        isFullSyncRequired: false,
        changes: {
          references: [],
          fertilizers: [],
          riceVarieties: [],
          opts: [],
          naturalEnemies: [],
          knowledgeArticles: [],
        },
        metadata: {
          totalChangedEntities: 0,
          serverTime: new Date().toISOString(),
        },
      };
    }

    // 3. Filter berdasarkan timestamp jika client mengirimkan ISO string
    const sinceDate = new Date(cleanSince);
    const isValidDate = !isNaN(sinceDate.getTime());

    if (isValidDate) {
      const sinceIso = sinceDate.toISOString();
      const changedRefs = this.referencesStore.filter((r) => r.updatedAt > sinceIso);
      const changedFerts = this.fertilizersStore.filter((f) => f.updatedAt > sinceIso);
      const changedVars = this.varietiesStore.filter((v) => v.updatedAt > sinceIso);
      const changedOpts = this.optsStore.filter((o) => o.updatedAt > sinceIso);
      const changedEnemies = this.naturalEnemiesStore.filter((e) => e.updatedAt > sinceIso);
      const changedArticles = this.articlesStore.filter((a) => a.updatedAt > sinceIso);

      const totalChanged =
        changedRefs.length +
        changedFerts.length +
        changedVars.length +
        changedOpts.length +
        changedEnemies.length +
        changedArticles.length;

      return {
        hasUpdates: totalChanged > 0,
        version: this.currentVersion,
        since: cleanSince,
        updatedAt: this.lastUpdatedAt,
        isFullSyncRequired: false,
        changes: {
          references: changedRefs,
          fertilizers: changedFerts,
          riceVarieties: changedVars,
          opts: changedOpts,
          naturalEnemies: changedEnemies,
          knowledgeArticles: changedArticles,
        },
        metadata: {
          totalChangedEntities: totalChanged,
          serverTime: new Date().toISOString(),
        },
      };
    }

    // 4. Jika client mengirim versi lama (misal 'v1.0.0'), kembalikan seluruh data dan arahkan ke versi baru
    return {
      hasUpdates: true,
      version: this.currentVersion,
      since: cleanSince,
      updatedAt: this.lastUpdatedAt,
      isFullSyncRequired: false,
      changes: {
        references: [...this.referencesStore],
        fertilizers: [...this.fertilizersStore],
        riceVarieties: [...this.varietiesStore],
        opts: [...this.optsStore],
        naturalEnemies: [...this.naturalEnemiesStore],
        knowledgeArticles: [...this.articlesStore],
      },
      metadata: {
        totalChangedEntities:
          this.referencesStore.length +
          this.fertilizersStore.length +
          this.varietiesStore.length +
          this.optsStore.length +
          this.naturalEnemiesStore.length +
          this.articlesStore.length,
        serverTime: new Date().toISOString(),
      },
    };
  }

  /**
   * Menambahkan atau memperbarui artikel pengetahuan (untuk pengujian pembaruan)
   */
  public upsertArticle(article: KnowledgeArticle): void {
    const idx = this.articlesStore.findIndex((a) => a.id === article.id);
    const now = new Date().toISOString();
    const prepared = { ...article, updatedAt: now };

    if (idx >= 0) {
      this.articlesStore[idx] = prepared;
    } else {
      this.articlesStore.push(prepared);
    }

    this.lastUpdatedAt = now;
    this.currentVersion = `v1.1.${Date.now()}`;
  }

  /**
   * Menambahkan atau memperbarui OPT (untuk pengujian pembaruan)
   */
  public upsertOpt(opt: Opt): void {
    const idx = this.optsStore.findIndex((o) => o.id === opt.id);
    const now = new Date().toISOString();
    const prepared = { ...opt, updatedAt: now };

    if (idx >= 0) {
      this.optsStore[idx] = prepared;
    } else {
      this.optsStore.push(prepared);
    }

    this.lastUpdatedAt = now;
    this.currentVersion = `v1.1.${Date.now()}`;
  }

  /**
   * Validasi keabsahan struktur Knowledge Bundle / Updates dari server
   */
  public static validatePayload(payload: any): { isValid: boolean; error?: string } {
    if (!payload || typeof payload !== 'object') {
      return { isValid: false, error: 'Payload bukan objek valid' };
    }

    if (!payload.version || typeof payload.version !== 'string') {
      return { isValid: false, error: 'Versi knowledge hilang atau bukan string' };
    }

    // Periksa apakah bundle atau updates
    const target = payload.changes || payload;

    const collections = [
      'references',
      'fertilizers',
      'riceVarieties',
      'opts',
      'naturalEnemies',
      'knowledgeArticles',
    ];

    for (const coll of collections) {
      if (target[coll] !== undefined && !Array.isArray(target[coll])) {
        return { isValid: false, error: `Koleksi '${coll}' harus berupa array` };
      }

      if (Array.isArray(target[coll])) {
        for (const item of target[coll]) {
          if (!item || typeof item !== 'object' || !item.id || typeof item.id !== 'string') {
            return {
              isValid: false,
              error: `Item dalam '${coll}' tidak valid atau kehilangan atribut 'id'`,
            };
          }
        }
      }
    }

    return { isValid: true };
  }
}

export const knowledgeService = new KnowledgeService();
