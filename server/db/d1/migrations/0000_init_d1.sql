-- ============================================================
-- HIKMAT TANI - Cloudflare D1 (SQLite) Initial Schema Migration (0000_init_d1.sql)
-- Generated for Cloudflare D1 / SQLite 3
-- ============================================================

-- 1. DATA PETANI & AUTENTIKASI
CREATE TABLE IF NOT EXISTS auth_users (
    id TEXT PRIMARY KEY NOT NULL,
    anonymous_id TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'farmer',
    is_active INTEGER NOT NULL DEFAULT 1,
    last_seen_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS farmers (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    phone_number TEXT,
    nik TEXT,
    pin_hash TEXT,
    salt TEXT,
    village TEXT,
    district TEXT,
    regency TEXT,
    province TEXT,
    farmer_group_name TEXT,
    auth_user_id TEXT UNIQUE REFERENCES auth_users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- 2. DATA BUDIDAYA
CREATE TABLE IF NOT EXISTS lands (
    id TEXT PRIMARY KEY NOT NULL,
    farmer_id TEXT NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    area_m2 INTEGER NOT NULL,
    soil_type TEXT NOT NULL,
    irrigation_type TEXT NOT NULL,
    village TEXT,
    district TEXT,
    regency TEXT,
    latitude REAL,
    longitude REAL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS crop_seasons (
    id TEXT PRIMARY KEY NOT NULL,
    land_id TEXT NOT NULL REFERENCES lands(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL,
    variety_id TEXT REFERENCES varieties(id) ON DELETE SET NULL,
    planting_date TEXT NOT NULL,
    harvest_date TEXT,
    target_yield_ton REAL NOT NULL,
    actual_yield_ton REAL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY NOT NULL,
    crop_season_id TEXT NOT NULL REFERENCES crop_seasons(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    hst INTEGER NOT NULL,
    activity_type TEXT NOT NULL,
    notes TEXT,
    photo_url TEXT,
    cost_rupiah INTEGER,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS activity_fertilizers (
    id TEXT PRIMARY KEY NOT NULL,
    activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    fertilizer_id TEXT NOT NULL REFERENCES fertilizers(id) ON DELETE CASCADE,
    amount_kg REAL NOT NULL,
    application_method TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS activity_opt_observations (
    id TEXT PRIMARY KEY NOT NULL,
    activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    opt_id TEXT REFERENCES opts(id) ON DELETE SET NULL,
    severity TEXT NOT NULL,
    affected_area_percentage REAL NOT NULL,
    symptoms TEXT,
    control_action_taken TEXT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- 3. DATA KEPUTUSAN (3-Layer Decision Engine)
CREATE TABLE IF NOT EXISTS recommendations (
    id TEXT PRIMARY KEY NOT NULL,
    crop_season_id TEXT NOT NULL REFERENCES crop_seasons(id) ON DELETE CASCADE,
    hst INTEGER NOT NULL,
    recommendation_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT NOT NULL,
    source_rule_id TEXT NOT NULL,
    reference_id TEXT,
    payload TEXT, -- JSON text
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS farmer_decisions (
    id TEXT PRIMARY KEY NOT NULL,
    recommendation_id TEXT NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
    decision TEXT NOT NULL, -- 'FOLLOW' | 'ADJUST' | 'REJECT'
    reason TEXT,
    adjusted_data TEXT, -- JSON text
    decided_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS actual_actions (
    id TEXT PRIMARY KEY NOT NULL,
    decision_id TEXT NOT NULL REFERENCES farmer_decisions(id) ON DELETE CASCADE,
    activity_id TEXT REFERENCES activities(id) ON DELETE SET NULL,
    action_description TEXT NOT NULL,
    executed_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- 5. DATA SINKRONISASI & IDEMPOTENCY (Two-Way Sync)
CREATE TABLE IF NOT EXISTS processed_operations (
    operation_id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    farmer_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    processed_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS sync_journal (
    id TEXT PRIMARY KEY NOT NULL,
    farmer_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    payload TEXT, -- JSON text
    is_tombstone INTEGER NOT NULL DEFAULT 0,
    server_timestamp TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- 4. DATA MASTER / KNOWLEDGE BASE
CREATE TABLE IF NOT EXISTS fertilizers (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    n_percent REAL NOT NULL DEFAULT 0,
    p2o5_percent REAL NOT NULL DEFAULT 0,
    k2o_percent REAL NOT NULL DEFAULT 0,
    description TEXT,
    dosage_guidelines TEXT
);

CREATE TABLE IF NOT EXISTS varieties (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    maturity_days INTEGER NOT NULL,
    potential_yield_ton REAL NOT NULL,
    avg_yield_ton REAL NOT NULL,
    resistance_profile TEXT,
    ecosystem_suitability TEXT,
    description TEXT
);

CREATE TABLE IF NOT EXISTS opts (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    latin_name TEXT,
    category TEXT NOT NULL,
    symptoms TEXT NOT NULL,
    economic_threshold TEXT,
    control_pht TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS natural_enemies (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    latin_name TEXT,
    type TEXT NOT NULL,
    target_opt TEXT NOT NULL,
    characteristics TEXT
);

CREATE TABLE IF NOT EXISTS "references" (
    id TEXT PRIMARY KEY NOT NULL,
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    institution TEXT NOT NULL,
    year INTEGER NOT NULL,
    document_url TEXT
);

CREATE TABLE IF NOT EXISTS knowledge_articles (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    content_markdown TEXT NOT NULL,
    author TEXT,
    reference_id TEXT REFERENCES "references"(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- 6. ROLE & ADMIN MANAGEMENT
CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY NOT NULL,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_login_at TEXT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS app_configs (
    id TEXT PRIMARY KEY NOT NULL,
    app_name TEXT NOT NULL DEFAULT 'HIKMAT TANI',
    slogan TEXT NOT NULL DEFAULT 'CERDAS BERTANI, BIJAK MENGAMBIL KEPUTUSAN.',
    logo_url TEXT NOT NULL DEFAULT '/icon-512.png',
    logo_primary TEXT NOT NULL DEFAULT '/icon-512.png',
    logo_horizontal TEXT NOT NULL DEFAULT '/logo-hikmat-tani-full.png',
    app_icon TEXT NOT NULL DEFAULT '/icon-192.png',
    description TEXT NOT NULL,
    contact_phone TEXT,
    contact_email TEXT,
    support_title TEXT NOT NULL DEFAULT 'Dukung HIKMAT TANI',
    support_description TEXT NOT NULL DEFAULT 'Inisiatif Mandiri Teknologi Pertanian Padi Nusantara',
    donation_active INTEGER NOT NULL DEFAULT 1,
    donation_recipient_name TEXT,
    donation_bank_name TEXT,
    donation_account_number TEXT,
    donation_ewallet_number TEXT,
    donation_qris_image TEXT,
    donation_url TEXT,
    updated_by TEXT,
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id TEXT PRIMARY KEY NOT NULL,
    actor_id TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT, -- JSON text
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
