import {
  pgTable,
  text,
  integer,
  doublePrecision,
  timestamp,
  boolean,
  jsonb,
} from 'drizzle-orm/pg-core';

/**
 * HIKMAT TANI - Server Database Schema (PostgreSQL Drizzle ORM)
 * 
 * Terbagi menjadi 4 Domain Data Utama:
 * 1. DATA PETANI & AUTENTIKASI
 * 2. DATA BUDIDAYA
 * 3. DATA KEPUTUSAN (3-Layer Decision Engine)
 * 4. DATA MASTER / KNOWLEDGE BASE
 */

// ==========================================
// 1. DATA PETANI & AUTENTIKASI
// ==========================================

export const farmers = pgTable('farmers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phoneNumber: text('phone_number'),
  nik: text('nik'),
  pinHash: text('pin_hash'),
  salt: text('salt'),
  village: text('village'),
  district: text('district'),
  regency: text('regency'),
  province: text('province'),
  farmerGroupName: text('farmer_group_name'),
  authUserId: text('auth_user_id').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const authUsers = pgTable('auth_users', {
  id: text('id').primaryKey(),
  anonymousId: text('anonymous_id').unique(),
  role: text('role').default('farmer').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// 2. DATA BUDIDAYA
// ==========================================

export const lands = pgTable('lands', {
  id: text('id').primaryKey(),
  farmerId: text('farmer_id').references(() => farmers.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  areaM2: integer('area_m2').notNull(),
  soilType: text('soil_type').notNull(),
  irrigationType: text('irrigation_type').notNull(),
  village: text('village'),
  district: text('district'),
  regency: text('regency'),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  status: text('status').default('ACTIVE').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const cropSeasons = pgTable('crop_seasons', {
  id: text('id').primaryKey(),
  landId: text('land_id').references(() => lands.id, { onDelete: 'cascade' }).notNull(),
  seasonNumber: integer('season_number').notNull(),
  varietyId: text('variety_id').notNull(),
  plantingDate: text('planting_date').notNull(),
  harvestDate: text('harvest_date'),
  targetYieldTon: doublePrecision('target_yield_ton').notNull(),
  actualYieldTon: doublePrecision('actual_yield_ton'),
  status: text('status').default('ACTIVE').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const activities = pgTable('activities', {
  id: text('id').primaryKey(),
  cropSeasonId: text('crop_season_id').references(() => cropSeasons.id, { onDelete: 'cascade' }).notNull(),
  date: text('date').notNull(),
  hst: integer('hst').notNull(),
  activityType: text('activity_type').notNull(),
  notes: text('notes'),
  photoUrl: text('photo_url'),
  costRupiah: integer('cost_rupiah'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const activityFertilizers = pgTable('activity_fertilizers', {
  id: text('id').primaryKey(),
  activityId: text('activity_id').references(() => activities.id, { onDelete: 'cascade' }).notNull(),
  fertilizerId: text('fertilizer_id').notNull(),
  amountKg: doublePrecision('amount_kg').notNull(),
  applicationMethod: text('application_method').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const activityOptObservations = pgTable('activity_opt_observations', {
  id: text('id').primaryKey(),
  activityId: text('activity_id').references(() => activities.id, { onDelete: 'cascade' }).notNull(),
  optId: text('opt_id').notNull(),
  severity: text('severity').notNull(),
  affectedAreaPercentage: doublePrecision('affected_area_percentage').notNull(),
  symptoms: text('symptoms'),
  controlActionTaken: text('control_action_taken'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// 3. DATA KEPUTUSAN (3-Layer Decision Engine)
// ==========================================

export const recommendations = pgTable('recommendations', {
  id: text('id').primaryKey(),
  cropSeasonId: text('crop_season_id').references(() => cropSeasons.id, { onDelete: 'cascade' }).notNull(),
  hst: integer('hst').notNull(),
  recommendationType: text('recommendation_type').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  priority: text('priority').notNull(),
  sourceRuleId: text('source_rule_id').notNull(),
  referenceId: text('reference_id'),
  payload: jsonb('payload'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const farmerDecisions = pgTable('farmer_decisions', {
  id: text('id').primaryKey(),
  recommendationId: text('recommendation_id').references(() => recommendations.id, { onDelete: 'cascade' }).notNull(),
  decision: text('decision').notNull(), // 'FOLLOW' | 'ADJUST' | 'REJECT'
  reason: text('reason'),
  adjustedData: jsonb('adjusted_data'),
  decidedAt: timestamp('decided_at', { withTimezone: true }).defaultNow().notNull(),
});

export const actualActions = pgTable('actual_actions', {
  id: text('id').primaryKey(),
  decisionId: text('decision_id').references(() => farmerDecisions.id, { onDelete: 'cascade' }).notNull(),
  activityId: text('activity_id').references(() => activities.id, { onDelete: 'set null' }),
  actionDescription: text('action_description').notNull(),
  executedAt: timestamp('executed_at', { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// 5. DATA SINKRONISASI & IDEMPOTENCY (Two-Way Sync)
// ==========================================

export const processedOperations = pgTable('processed_operations', {
  operationId: text('operation_id').primaryKey(),
  userId: text('user_id').notNull(),
  farmerId: text('farmer_id').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }).defaultNow().notNull(),
});

export const syncJournal = pgTable('sync_journal', {
  id: text('id').primaryKey(),
  farmerId: text('farmer_id').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(), // 'CREATE' | 'UPDATE' | 'DELETE'
  payload: jsonb('payload'),
  isTombstone: boolean('is_tombstone').default(false).notNull(),
  serverTimestamp: timestamp('server_timestamp', { withTimezone: true }).defaultNow().notNull(),
});

export const fertilizers = pgTable('fertilizers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'ANORGANIK' | 'ORGANIK' | 'HAYATI'
  nPercent: doublePrecision('n_percent').default(0).notNull(),
  p2o5Percent: doublePrecision('p2o5_percent').default(0).notNull(),
  k2oPercent: doublePrecision('k2o_percent').default(0).notNull(),
  description: text('description'),
  dosageGuidelines: text('dosage_guidelines'),
});

export const varieties = pgTable('varieties', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  maturityDays: integer('maturity_days').notNull(),
  potentialYieldTon: doublePrecision('potential_yield_ton').notNull(),
  avgYieldTon: doublePrecision('avg_yield_ton').notNull(),
  resistanceProfile: text('resistance_profile'),
  ecosystemSuitability: text('ecosystem_suitability'),
  description: text('description'),
});

export const opts = pgTable('opts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  latinName: text('latin_name'),
  category: text('category').notNull(), // 'HAMA' | 'PENYAKIT' | 'GULMA'
  symptoms: text('symptoms').notNull(),
  economicThreshold: text('economic_threshold'),
  controlPht: text('control_pht').notNull(),
});

export const naturalEnemies = pgTable('natural_enemies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  latinName: text('latin_name'),
  type: text('type').notNull(), // 'PREDATOR' | 'PARASITOID' | 'PATOGEN'
  targetOpt: text('target_opt').notNull(),
  characteristics: text('characteristics'),
});

export const knowledgeArticles = pgTable('knowledge_articles', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  category: text('category').notNull(),
  contentMarkdown: text('content_markdown').notNull(),
  author: text('author'),
  referenceId: text('reference_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const references = pgTable('references', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  title: text('title').notNull(),
  institution: text('institution').notNull(),
  year: integer('year').notNull(),
  documentUrl: text('document_url'),
});

// ==========================================
// 6. ROLE & ADMIN MANAGEMENT (Langkah 15)
// ==========================================

export const adminUsers = pgTable('admin_users', {
  id: text('id').primaryKey(),
  username: text('username').unique().notNull(),
  email: text('email').unique(),
  fullName: text('full_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  salt: text('salt').notNull(),
  role: text('role').notNull(), // 'MANAGER' | 'SUPER_ADMIN'
  isActive: boolean('is_active').default(true).notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const appConfigs = pgTable('app_configs', {
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
  donationActive: boolean('donation_active').default(true).notNull(),
  donationRecipientName: text('donation_recipient_name'),
  donationBankName: text('donation_bank_name'),
  donationAccountNumber: text('donation_account_number'),
  donationEwalletNumber: text('donation_ewallet_number'),
  donationQrisImage: text('donation_qris_image'),
  donationUrl: text('donation_url'),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const adminAuditLogs = pgTable('admin_audit_logs', {
  id: text('id').primaryKey(),
  actorId: text('actor_id').notNull(),
  actorName: text('actor_name').notNull(),
  actorRole: text('actor_role').notNull(), // 'MANAGER' | 'SUPER_ADMIN'
  action: text('action').notNull(), // 'UPDATE_CONFIG' | 'UPDATE_QRIS' | 'CREATE_MANAGER' | 'UPDATE_MANAGER' | 'DELETE_MANAGER' | 'LOGIN' | 'TOGGLE_DONATION'
  details: jsonb('details'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// 5. TRANSACTIONAL REPLICATION OUTBOX
// ==========================================

export const replicationOutbox = pgTable('replication_outbox', {
  id: text('id').primaryKey(),
  operationId: text('operation_id').unique().notNull(),
  entityType: text('entity_type').notNull(), // 'FARMER' | 'LAND' | 'CROP_SEASON' | 'ACTIVITY' | etc.
  entityId: text('entity_id').notNull(),
  farmerId: text('farmer_id').notNull(),
  action: text('action').notNull(), // 'CREATE' | 'UPDATE' | 'DELETE'
  payload: jsonb('payload').notNull(),
  version: integer('version').default(1).notNull(),
  status: text('status').default('PENDING').notNull(), // 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  retryCount: integer('retry_count').default(0).notNull(),
  maxRetries: integer('max_retries').default(5).notNull(),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  lockedBy: text('locked_by'),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});


