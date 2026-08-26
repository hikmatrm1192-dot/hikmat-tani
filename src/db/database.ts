/**
 * HIKMAT TANI - Main Dexie Database Instance & Initialization
 */

import Dexie, { type Table } from 'dexie';
import {
  Activity,
  ActualAction,
  BackupMetadata,
  CropSeason,
  Farmer,
  FarmerDecision,
  Fertilizer,
  FertilizerApplication,
  KnowledgeArticle,
  Land,
  NaturalEnemy,
  Opt,
  OptObservation,
  Recommendation,
  Reference,
  RiceVariety,
  SyncOutboxItem,
} from '../types/index.ts';
import { DB_NAME, DB_VERSION, SCHEMA_V1 } from './schema.ts';
import {
  SEED_FERTILIZERS,
  SEED_KNOWLEDGE_ARTICLES,
  SEED_NATURAL_ENEMIES,
  SEED_OPTS,
  SEED_REFERENCES,
  SEED_VARIETIES,
} from './seedData.ts';

export class HikmatTaniDatabase extends Dexie {
  // --- Data Petani & Lahan ---
  farmers!: Table<Farmer, string>;
  lands!: Table<Land, string>;
  cropSeasons!: Table<CropSeason, string>;

  // --- Sejarah Kejadian Budidaya ---
  activities!: Table<Activity, string>;
  fertilizerApplications!: Table<FertilizerApplication, string>;
  optObservations!: Table<OptObservation, string>;

  // --- Tiga Lapisan Keputusan ---
  recommendations!: Table<Recommendation, string>;
  farmerDecisions!: Table<FarmerDecision, string>;
  actualActions!: Table<ActualAction, string>;

  // --- Master Data & Referensi ---
  fertilizers!: Table<Fertilizer, string>;
  opts!: Table<Opt, string>;
  naturalEnemies!: Table<NaturalEnemy, string>;
  riceVarieties!: Table<RiceVariety, string>;
  references!: Table<Reference, string>;
  knowledgeArticles!: Table<KnowledgeArticle, string>;

  // --- System & Outbox ---
  syncOutbox!: Table<SyncOutboxItem, string>;
  backupMetadata!: Table<BackupMetadata & { id: string }, string>;

  constructor() {
    super(DB_NAME);

    // Schema Version 1
    this.version(DB_VERSION).stores(SCHEMA_V1);
  }
}

/**
 * Instance singleton database untuk aplikasi
 */
export const db = new HikmatTaniDatabase();

/**
 * Meminta izin persistensi browser agar IndexedDB tidak dihapus otomatis
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof window !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persist();
      return isPersisted;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Inisialisasi Database & Seeding Idempotent
 * Memastikan master data tersedia tanpa menduplikasi data yang sudah ada.
 */
export async function initializeDatabase(): Promise<{
  isInitialized: boolean;
  isPersisted: boolean;
  seedCounts: {
    references: number;
    fertilizers: number;
    varieties: number;
    opts: number;
    naturalEnemies: number;
    articles: number;
  };
}> {
  await db.open();
  const isPersisted = await requestPersistentStorage();

  const seedCounts = {
    references: 0,
    fertilizers: 0,
    varieties: 0,
    opts: 0,
    naturalEnemies: 0,
    articles: 0,
  };

  // Seed Data secara atomik menggunakan Dexie transaction
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
      for (const item of SEED_REFERENCES) {
        const existing = await db.references.get(item.id);
        if (!existing) {
          await db.references.add(item);
          seedCounts.references++;
        }
      }

      // 2. Fertilizers
      for (const item of SEED_FERTILIZERS) {
        const existing = await db.fertilizers.get(item.id);
        if (!existing) {
          await db.fertilizers.add(item);
          seedCounts.fertilizers++;
        }
      }

      // 3. Varieties
      for (const item of SEED_VARIETIES) {
        const existing = await db.riceVarieties.get(item.id);
        if (!existing) {
          await db.riceVarieties.add(item);
          seedCounts.varieties++;
        }
      }

      // 4. OPTs
      for (const item of SEED_OPTS) {
        const existing = await db.opts.get(item.id);
        if (!existing) {
          await db.opts.add(item);
          seedCounts.opts++;
        }
      }

      // 5. Natural Enemies
      for (const item of SEED_NATURAL_ENEMIES) {
        const existing = await db.naturalEnemies.get(item.id);
        if (!existing) {
          await db.naturalEnemies.add(item);
          seedCounts.naturalEnemies++;
        }
      }

      // 6. Knowledge Articles
      for (const item of SEED_KNOWLEDGE_ARTICLES) {
        const existing = await db.knowledgeArticles.get(item.id);
        if (!existing) {
          await db.knowledgeArticles.add(item);
          seedCounts.articles++;
        }
      }
    }
  );

  return {
    isInitialized: true,
    isPersisted,
    seedCounts,
  };
}
