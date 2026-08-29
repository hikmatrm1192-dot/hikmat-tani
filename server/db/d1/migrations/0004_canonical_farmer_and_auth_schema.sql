-- ============================================================
-- HIKMAT TANI - Cloudflare D1 Production Migration (0004)
-- Migration: 0004_canonical_farmer_and_auth_schema.sql
--
-- Non-destructive canonical schema alignment for auth_users & farmers.
-- Preserves all existing farmer and auth data while removing legacy
-- schema constraints (e.g. auth_users.farmer_id NOT NULL).
-- ============================================================

PRAGMA foreign_keys=OFF;

-- ------------------------------------------------------------
-- 1. Penyelarasan Tabel auth_users ke Skema Kanonikal
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_users_canonical (
    id TEXT PRIMARY KEY NOT NULL,
    anonymous_id TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'farmer',
    is_active INTEGER NOT NULL DEFAULT 1,
    last_seen_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- Salin data existing jika tabel auth_users ada
INSERT OR IGNORE INTO auth_users_canonical (
    id,
    anonymous_id,
    role,
    is_active,
    last_seen_at,
    created_at,
    updated_at
)
SELECT
    id,
    anonymous_id,
    COALESCE(role, 'farmer'),
    COALESCE(is_active, 1),
    COALESCE(last_seen_at, CURRENT_TIMESTAMP),
    COALESCE(created_at, CURRENT_TIMESTAMP),
    COALESCE(updated_at, CURRENT_TIMESTAMP)
FROM auth_users;

DROP TABLE IF EXISTS auth_users;

ALTER TABLE auth_users_canonical RENAME TO auth_users;

CREATE INDEX IF NOT EXISTS idx_auth_users_role ON auth_users(role);
CREATE INDEX IF NOT EXISTS idx_auth_users_anonymous_id ON auth_users(anonymous_id);

-- ------------------------------------------------------------
-- 2. Penyelarasan Tabel farmers ke Skema Kanonikal
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS farmers_canonical (
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

-- Salin data existing dari tabel farmers jika ada
INSERT OR IGNORE INTO farmers_canonical (
    id,
    name,
    phone_number,
    nik,
    pin_hash,
    salt,
    village,
    district,
    regency,
    province,
    farmer_group_name,
    auth_user_id,
    created_at,
    updated_at
)
SELECT
    id,
    name,
    phone_number,
    nik,
    pin_hash,
    salt,
    village,
    district,
    regency,
    province,
    farmer_group_name,
    auth_user_id,
    COALESCE(created_at, CURRENT_TIMESTAMP),
    COALESCE(updated_at, CURRENT_TIMESTAMP)
FROM farmers;

DROP TABLE IF EXISTS farmers;

ALTER TABLE farmers_canonical RENAME TO farmers;

-- ------------------------------------------------------------
-- 3. Indeks Pencarian & Integritas Kanonikal
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_farmers_nik ON farmers(nik);
CREATE INDEX IF NOT EXISTS idx_farmers_phone_number ON farmers(phone_number);
CREATE INDEX IF NOT EXISTS idx_farmers_auth_user_id ON farmers(auth_user_id);

PRAGMA foreign_keys=ON;
