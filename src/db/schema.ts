/**
 * HIKMAT TANI - Dexie Database Schema Definitions
 * 
 * Version: 1
 * 
 * Catatan:
 * - Menggunakan primary key UUID client-generated ('id').
 * - Index dibuat spesifik untuk query relasional dan filter umum di lapangan.
 * - IndexedDB bukan RDBMS relasional penuh, integritas referensi dijaga di repository layer.
 */

export const DB_NAME = 'HikmatTaniDB';
export const DB_VERSION = 1;

export const SCHEMA_V1 = {
  // --- Data Petani & Lahan ---
  farmers: 'id, name, phoneNumber, createdAt',
  lands: 'id, farmerId, name, [farmerId+name], createdAt',
  cropSeasons: 'id, landId, status, plantingDate, [landId+status], createdAt',

  // --- Sejarah Kejadian Budidaya (Event Data) ---
  activities: 'id, cropSeasonId, category, activityDate, [cropSeasonId+category], [cropSeasonId+activityDate], createdAt',
  fertilizerApplications: 'id, activityId, fertilizerId, createdAt',
  optObservations: 'id, activityId, optId, isUnknown, createdAt',

  // --- Tiga Lapisan Keputusan (Three-Layer Decision Architecture) ---
  recommendations: 'id, cropSeasonId, contextType, priority, [cropSeasonId+contextType], createdAt',
  farmerDecisions: 'id, cropSeasonId, recommendationId, decision, createdAt',
  actualActions: 'id, cropSeasonId, activityId, decisionId, actionType, performedAt, createdAt',

  // --- Master Data & Referensi (Knowledge Base) ---
  fertilizers: 'id, name, type, *aliases, referenceId, createdAt',
  opts: 'id, commonName, category, *aliases, referenceId, createdAt',
  naturalEnemies: 'id, name, type, *targetOptIds, referenceId, createdAt',
  riceVarieties: 'id, name, *aliases, referenceId, createdAt',
  references: 'id, title, validationStatus, createdAt',
  knowledgeArticles: 'id, category, title, status, referenceId, *tags, createdAt',

  // --- System & Sinkronisasi ---
  syncOutbox: 'id, operationId, status, entityType, [entityType+entityId], createdAt',
  backupMetadata: 'id, backupVersion, createdAt',
};
