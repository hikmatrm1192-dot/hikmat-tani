import {
  sqliteTable,
  text,
  integer,
  real,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * HIKMAT TANI - Cloudflare D1 Database Schema (SQLite Drizzle ORM)
 * 
 * Skema database terpisah khusus untuk arsitektur Cloudflare D1 (SQLite).
 * Paralel dengan skema PostgreSQL (/server/db/schema.ts) tanpa mengubah
 * atau merusak skema lama.
 * 
 * Konversi Tipe Data (PostgreSQL -> SQLite/D1):
 * - pgTable -> sqliteTable
 * - doublePrecision -> real
 * - boolean -> integer({ mode: 'boolean' })
 * - timestamp({ withTimezone: true }) -> text (ISO 8601 string) dengan default CURRENT_TIMESTAMP
 * - jsonb -> text({ mode: 'json' })
 * 
 * Terbagi menjadi 4 Domain Data Utama:
 * 1. DATA PETANI & AUTENTIKASI
 * 2. DATA BUDIDAYA
 * 3. DATA KEPUTUSAN (3-Layer Decision Engine)
 * 4. DATA MASTER / KNOWLEDGE BASE
 * 5. DATA SINKRONISASI & IDEMPOTENCY (Two-Way Sync)
 * 6. ROLE & ADMIN MANAGEMENT
 */

// ==========================================
// 1. DATA PETANI & AUTENTIKASI
// ==========================================

export const farmers = sqliteTable('farmers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phoneNumber: text('phone_number'),
  village: text('village'),
  district: text('district'),
  regency: text('regency'),
  province: text('province'),
  farmerGroupName: text('farmer_group_name'),
  authUserId: text('auth_user_id').unique().references(() => authUsers.id, { onDelete: 'set null' }),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const authUsers = sqliteTable('auth_users', {
  id: text('id').primaryKey(),
  anonymousId: text('anonymous_id').unique(),
  role: text('role').default('farmer').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  lastSeenAt: text('last_seen_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

// ==========================================
// 2. DATA BUDIDAYA
// ==========================================

export const lands = sqliteTable('lands', {
  id: text('id').primaryKey(),
  farmerId: text('farmer_id').references(() => farmers.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  areaM2: integer('area_m2').notNull(),
  soilType: text('soil_type').notNull(),
  irrigationType: text('irrigation_type').notNull(),
  village: text('village'),
  district: text('district'),
  regency: text('regency'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  status: text('status').default('ACTIVE').notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const cropSeasons = sqliteTable('crop_seasons', {
  id: text('id').primaryKey(),
  landId: text('land_id').references(() => lands.id, { onDelete: 'cascade' }).notNull(),
  seasonNumber: integer('season_number').notNull(),
  varietyId: text('variety_id').references(() => varieties.id, { onDelete: 'set null' }),
  plantingDate: text('planting_date').notNull(),
  harvestDate: text('harvest_date'),
  targetYieldTon: real('target_yield_ton').notNull(),
  actualYieldTon: real('actual_yield_ton'),
  status: text('status').default('ACTIVE').notNull(),
  notes: text('notes'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const activities = sqliteTable('activities', {
  id: text('id').primaryKey(),
  cropSeasonId: text('crop_season_id').references(() => cropSeasons.id, { onDelete: 'cascade' }).notNull(),
  date: text('date').notNull(),
  hst: integer('hst').notNull(),
  activityType: text('activity_type').notNull(),
  notes: text('notes'),
  photoUrl: text('photo_url'),
  costRupiah: integer('cost_rupiah'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const activityFertilizers = sqliteTable('activity_fertilizers', {
  id: text('id').primaryKey(),
  activityId: text('activity_id').references(() => activities.id, { onDelete: 'cascade' }).notNull(),
  fertilizerId: text('fertilizer_id').references(() => fertilizers.id, { onDelete: 'cascade' }).notNull(),
  amountKg: real('amount_kg').notNull(),
  applicationMethod: text('application_method').notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const activityOptObservations = sqliteTable('activity_opt_observations', {
  id: text('id').primaryKey(),
  activityId: text('activity_id').references(() => activities.id, { onDelete: 'cascade' }).notNull(),
  optId: text('opt_id').references(() => opts.id, { onDelete: 'set null' }),
  severity: text('severity').notNull(),
  affectedAreaPercentage: real('affected_area_percentage').notNull(),
  symptoms: text('symptoms'),
  controlActionTaken: text('control_action_taken'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

// ==========================================
// 3. DATA KEPUTUSAN (3-Layer Decision Engine)
// ==========================================

export const recommendations = sqliteTable('recommendations', {
  id: text('id').primaryKey(),
  cropSeasonId: text('crop_season_id').references(() => cropSeasons.id, { onDelete: 'cascade' }).notNull(),
  hst: integer('hst').notNull(),
  recommendationType: text('recommendation_type').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  priority: text('priority').notNull(),
  sourceRuleId: text('source_rule_id').notNull(),
  referenceId: text('reference_id'),
  payload: text('payload', { mode: 'json' }),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const farmerDecisions = sqliteTable('farmer_decisions', {
  id: text('id').primaryKey(),
  recommendationId: text('recommendation_id').references(() => recommendations.id, { onDelete: 'cascade' }).notNull(),
  decision: text('decision').notNull(), // 'FOLLOW' | 'ADJUST' | 'REJECT'
  reason: text('reason'),
  adjustedData: text('adjusted_data', { mode: 'json' }),
  decidedAt: text('decided_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const actualActions = sqliteTable('actual_actions', {
  id: text('id').primaryKey(),
  decisionId: text('decision_id').references(() => farmerDecisions.id, { onDelete: 'cascade' }).notNull(),
  activityId: text('activity_id').references(() => activities.id, { onDelete: 'set null' }),
  actionDescription: text('action_description').notNull(),
  executedAt: text('executed_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

// ==========================================
// 5. DATA SINKRONISASI & IDEMPOTENCY (Two-Way Sync)
// ==========================================

export const processedOperations = sqliteTable('processed_operations', {
  operationId: text('operation_id').primaryKey(),
  userId: text('user_id').notNull(),
  farmerId: text('farmer_id').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(),
  processedAt: text('processed_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const syncJournal = sqliteTable('sync_journal', {
  id: text('id').primaryKey(),
  farmerId: text('farmer_id').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(), // 'CREATE' | 'UPDATE' | 'DELETE'
  payload: text('payload', { mode: 'json' }),
  isTombstone: integer('is_tombstone', { mode: 'boolean' }).default(false).notNull(),
  serverTimestamp: text('server_timestamp').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

// ==========================================
// 4. DATA MASTER / KNOWLEDGE BASE
// ==========================================

export const fertilizers = sqliteTable('fertilizers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'ANORGANIK' | 'ORGANIK' | 'HAYATI'
  nPercent: real('n_percent').default(0).notNull(),
  p2o5Percent: real('p2o5_percent').default(0).notNull(),
  k2oPercent: real('k2o_percent').default(0).notNull(),
  description: text('description'),
  dosageGuidelines: text('dosage_guidelines'),
});

export const varieties = sqliteTable('varieties', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  maturityDays: integer('maturity_days').notNull(),
  potentialYieldTon: real('potential_yield_ton').notNull(),
  avgYieldTon: real('avg_yield_ton').notNull(),
  resistanceProfile: text('resistance_profile'),
  ecosystemSuitability: text('ecosystem_suitability'),
  description: text('description'),
});

export const opts = sqliteTable('opts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  latinName: text('latin_name'),
  category: text('category').notNull(), // 'HAMA' | 'PENYAKIT' | 'GULMA'
  symptoms: text('symptoms').notNull(),
  economicThreshold: text('economic_threshold'),
  controlPht: text('control_pht').notNull(),
});

export const naturalEnemies = sqliteTable('natural_enemies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  latinName: text('latin_name'),
  type: text('type').notNull(), // 'PREDATOR' | 'PARASITOID' | 'PATOGEN'
  targetOpt: text('target_opt').notNull(),
  characteristics: text('characteristics'),
});

export const references = sqliteTable('references', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  title: text('title').notNull(),
  institution: text('institution').notNull(),
  year: integer('year').notNull(),
  documentUrl: text('document_url'),
});

export const knowledgeArticles = sqliteTable('knowledge_articles', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  category: text('category').notNull(),
  contentMarkdown: text('content_markdown').notNull(),
  author: text('author'),
  referenceId: text('reference_id').references(() => references.id, { onDelete: 'set null' }),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

// ==========================================
// 6. ROLE & ADMIN MANAGEMENT
// ==========================================

export const adminUsers = sqliteTable('admin_users', {
  id: text('id').primaryKey(),
  username: text('username').unique().notNull(),
  email: text('email').unique(),
  fullName: text('full_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  salt: text('salt').notNull(),
  role: text('role').notNull(), // 'MANAGER' | 'SUPER_ADMIN'
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  lastLoginAt: text('last_login_at'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const appConfigs = sqliteTable('app_configs', {
  id: text('id').primaryKey(), // singleton id e.g. 'official_config'
  appName: text('app_name').default('HIKMAT TANI').notNull(),
  slogan: text('slogan').default('CERDAS BERTANI, BIJAK MENGAMBIL KEPUTUSAN.').notNull(),
  logoUrl: text('logo_url').default('/icon-512.png').notNull(),
  logoPrimary: text('logo_primary').default('/icon-512.png').notNull(),
  logoHorizontal: text('logo_horizontal').default('/logo-hikmat-tani-full.png').notNull(),
  appIcon: text('app_icon').default('/icon-192.png').notNull(),
  description: text('description').notNull(),
  contactPhone: text('contact_phone'),
  contactEmail: text('contact_email'),
  supportTitle: text('support_title').default('Dukung HIKMAT TANI').notNull(),
  supportDescription: text('support_description').default('Inisiatif Mandiri Teknologi Pertanian Padi Nusantara').notNull(),
  donationActive: integer('donation_active', { mode: 'boolean' }).default(true).notNull(),
  donationRecipientName: text('donation_recipient_name'),
  donationBankName: text('donation_bank_name'),
  donationAccountNumber: text('donation_account_number'),
  donationEwalletNumber: text('donation_ewallet_number'),
  donationQrisImage: text('donation_qris_image'),
  donationUrl: text('donation_url'),
  updatedBy: text('updated_by'),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const adminAuditLogs = sqliteTable('admin_audit_logs', {
  id: text('id').primaryKey(),
  actorId: text('actor_id').notNull(),
  actorName: text('actor_name').notNull(),
  actorRole: text('actor_role').notNull(), // 'MANAGER' | 'SUPER_ADMIN'
  action: text('action').notNull(), // 'UPDATE_CONFIG' | 'UPDATE_QRIS' | 'CREATE_MANAGER' | 'UPDATE_MANAGER' | 'DELETE_MANAGER' | 'LOGIN' | 'TOGGLE_DONATION'
  details: text('details', { mode: 'json' }),
  ipAddress: text('ip_address'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});
