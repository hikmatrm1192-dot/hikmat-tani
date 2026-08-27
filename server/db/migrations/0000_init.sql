-- ============================================================
-- HIKMAT TANI - PostgreSQL Initial Schema Migration (0000_init.sql)
-- Generated for PostgreSQL 14+ / Supabase / Neon / Cloud SQL
-- ============================================================

-- 1. DATA PETANI & AUTENTIKASI
CREATE TABLE IF NOT EXISTS auth_users (
    id TEXT PRIMARY KEY,
    anonymous_id TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'farmer',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS farmers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone_number TEXT,
    village TEXT,
    district TEXT,
    regency TEXT,
    province TEXT,
    farmer_group_name TEXT,
    auth_user_id TEXT UNIQUE REFERENCES auth_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. DATA BUDIDAYA
CREATE TABLE IF NOT EXISTS lands (
    id TEXT PRIMARY KEY,
    farmer_id TEXT NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    area_m2 INTEGER NOT NULL,
    soil_type TEXT NOT NULL,
    irrigation_type TEXT NOT NULL,
    village TEXT,
    district TEXT,
    regency TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crop_seasons (
    id TEXT PRIMARY KEY,
    land_id TEXT NOT NULL REFERENCES lands(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL,
    variety_id TEXT NOT NULL,
    planting_date TEXT NOT NULL,
    harvest_date TEXT,
    target_yield_ton DOUBLE PRECISION NOT NULL,
    actual_yield_ton DOUBLE PRECISION,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    crop_season_id TEXT NOT NULL REFERENCES crop_seasons(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    hst INTEGER NOT NULL,
    activity_type TEXT NOT NULL,
    notes TEXT,
    photo_url TEXT,
    cost_rupiah INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_fertilizers (
    id TEXT PRIMARY KEY,
    activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    fertilizer_id TEXT NOT NULL,
    amount_kg DOUBLE PRECISION NOT NULL,
    application_method TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_opt_observations (
    id TEXT PRIMARY KEY,
    activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    opt_id TEXT NOT NULL,
    severity TEXT NOT NULL,
    affected_area_percentage DOUBLE PRECISION NOT NULL,
    symptoms TEXT,
    control_action_taken TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. DATA KEPUTUSAN (3-Layer Decision Engine)
CREATE TABLE IF NOT EXISTS recommendations (
    id TEXT PRIMARY KEY,
    crop_season_id TEXT NOT NULL REFERENCES crop_seasons(id) ON DELETE CASCADE,
    hst INTEGER NOT NULL,
    recommendation_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT NOT NULL,
    source_rule_id TEXT NOT NULL,
    reference_id TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS farmer_decisions (
    id TEXT PRIMARY KEY,
    recommendation_id TEXT NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
    decision TEXT NOT NULL, -- 'FOLLOW' | 'ADJUST' | 'REJECT'
    reason TEXT,
    adjusted_data JSONB,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS actual_actions (
    id TEXT PRIMARY KEY,
    decision_id TEXT NOT NULL REFERENCES farmer_decisions(id) ON DELETE CASCADE,
    activity_id TEXT REFERENCES activities(id) ON DELETE SET NULL,
    action_description TEXT NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. DATA SINKRONISASI & IDEMPOTENCY (Two-Way Sync)
CREATE TABLE IF NOT EXISTS processed_operations (
    operation_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    farmer_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sync_journal (
    id TEXT PRIMARY KEY,
    farmer_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    payload JSONB,
    is_tombstone BOOLEAN NOT NULL DEFAULT FALSE,
    server_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. DATA MASTER / KNOWLEDGE BASE
CREATE TABLE IF NOT EXISTS fertilizers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    n_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
    p2o5_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
    k2o_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
    description TEXT,
    dosage_guidelines TEXT
);

CREATE TABLE IF NOT EXISTS varieties (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    maturity_days INTEGER NOT NULL,
    potential_yield_ton DOUBLE PRECISION NOT NULL,
    avg_yield_ton DOUBLE PRECISION NOT NULL,
    resistance_profile TEXT,
    ecosystem_suitability TEXT,
    description TEXT
);

CREATE TABLE IF NOT EXISTS opts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    latin_name TEXT,
    category TEXT NOT NULL,
    symptoms TEXT NOT NULL,
    economic_threshold TEXT,
    control_pht TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS natural_enemies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    latin_name TEXT,
    type TEXT NOT NULL,
    target_opt TEXT NOT NULL,
    characteristics TEXT
);

CREATE TABLE IF NOT EXISTS references (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    institution TEXT NOT NULL,
    year INTEGER NOT NULL,
    document_url TEXT
);

CREATE TABLE IF NOT EXISTS knowledge_articles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    content_markdown TEXT NOT NULL,
    author TEXT,
    reference_id TEXT REFERENCES references(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
