/**
 * HIKMAT TANI - Main Dexie Database Instance & Farmer-Partitioned Multi-Tenancy (Langkah 6 & 8)
 * 
 * Prinsip:
 * 1. Setiap petani yang masuk ke perangkat memiliki partisi database lokal terisolasi (HikmatTaniDB_{farmerId}).
 * 2. Petani A tidak dapat membaca atau menimpa data Petani B pada browser/perangkat yang sama.
 * 3. Master Data Agronomi (BBPadi / Ditlin) otomatis di-seed ke setiap partisi secara offline-first.
 * 4. Objek `db` diekspor sebagai Proxy transparan sehingga seluruh repository otomatis mengarah ke partisi aktif.
 */

import Dexie, { type Table } from 'dexie';
import {
  Activity,
  ActualAction,
  BackupMetadata,
  CropSeason,
  CultivationExpense,
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
  Seedbed,
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
  seedbeds!: Table<Seedbed, string>;
  expenses!: Table<CultivationExpense, string>;

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

  constructor(customName: string = DB_NAME) {
    super(customName);

    // Schema Version 1
    this.version(DB_VERSION).stores(SCHEMA_V1);
  }
}

// Map cache instance database per farmer
const dbInstances = new Map<string, HikmatTaniDatabase>();
let currentActiveFarmerId: string = 'default';

/**
 * Menghasilkan nama database terisolasi untuk farmer tertentu
 */
export function getPartitionDbName(farmerId?: string): string {
  if (!farmerId || farmerId === 'default') {
    return DB_NAME;
  }
  // Sanitize name for IndexedDB safety
  const safeId = farmerId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${DB_NAME}_${safeId}`;
}

/**
 * Mengambil atau membuat instance database untuk farmerId tertentu
 */
export function getDatabase(farmerId?: string): HikmatTaniDatabase {
  const targetId = farmerId || currentActiveFarmerId || 'default';
  const dbName = getPartitionDbName(targetId);

  if (!dbInstances.has(dbName)) {
    const newDb = new HikmatTaniDatabase(dbName);
    dbInstances.set(dbName, newDb);
  }

  return dbInstances.get(dbName)!;
}

/**
 * Mengubah partisi aktif saat petani login atau berpindah akun
 */
export function setActiveFarmerDb(farmerId: string): HikmatTaniDatabase {
  currentActiveFarmerId = farmerId || 'default';
  return getDatabase(currentActiveFarmerId);
}

/**
 * Mengambil farmerId yang sedang aktif di database lokal
 */
export function getActiveFarmerId(): string {
  return currentActiveFarmerId;
}

/**
 * Proxy singleton `db` yang secara dinamis selalu merujuk ke database partisi aktif
 */
export const db = new Proxy({} as HikmatTaniDatabase, {
  get(_target, prop: string | symbol) {
    const activeDb = getDatabase(currentActiveFarmerId);
    const value = (activeDb as any)[prop];
    if (typeof value === 'function') {
      return value.bind(activeDb);
    }
    return value;
  },
});

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
 * Inisialisasi Database & Seeding Idempotent untuk partisi tertentu
 */
export async function initializeDatabase(farmerId?: string): Promise<{
  isInitialized: boolean;
  isPersisted: boolean;
  dbName: string;
  seedCounts: {
    references: number;
    fertilizers: number;
    varieties: number;
    opts: number;
    naturalEnemies: number;
    articles: number;
  };
}> {
  const targetDb = getDatabase(farmerId);
  await targetDb.open();
  const isPersisted = await requestPersistentStorage();

  const seedCounts = {
    references: 0,
    fertilizers: 0,
    varieties: 0,
    opts: 0,
    naturalEnemies: 0,
    articles: 0,
  };

  // Seed Master Data secara atomik ke partisi ini
  await targetDb.transaction(
    'rw',
    [
      targetDb.references,
      targetDb.fertilizers,
      targetDb.riceVarieties,
      targetDb.opts,
      targetDb.naturalEnemies,
      targetDb.knowledgeArticles,
    ],
    async () => {
      // 1. References
      for (const item of SEED_REFERENCES) {
        const existing = await targetDb.references.get(item.id);
        await targetDb.references.put(item);
        if (!existing) seedCounts.references++;
      }

      // 2. Fertilizers
      for (const item of SEED_FERTILIZERS) {
        const existing = await targetDb.fertilizers.get(item.id);
        await targetDb.fertilizers.put(item);
        if (!existing) seedCounts.fertilizers++;
      }

      // 3. Varieties
      for (const item of SEED_VARIETIES) {
        const existing = await targetDb.riceVarieties.get(item.id);
        await targetDb.riceVarieties.put(item);
        if (!existing) seedCounts.varieties++;
      }

      // 4. OPTs
      for (const item of SEED_OPTS) {
        const existing = await targetDb.opts.get(item.id);
        await targetDb.opts.put(item);
        if (!existing) seedCounts.opts++;
      }

      // 5. Natural Enemies
      for (const item of SEED_NATURAL_ENEMIES) {
        const existing = await targetDb.naturalEnemies.get(item.id);
        await targetDb.naturalEnemies.put(item);
        if (!existing) seedCounts.naturalEnemies++;
      }

      // 6. Knowledge Articles
      for (const item of SEED_KNOWLEDGE_ARTICLES) {
        const existing = await targetDb.knowledgeArticles.get(item.id);
        await targetDb.knowledgeArticles.put(item);
        if (!existing) seedCounts.articles++;
      }
    }
  );

  return {
    isInitialized: true,
    isPersisted,
    dbName: targetDb.name,
    seedCounts,
  };
}
