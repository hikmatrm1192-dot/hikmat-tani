-- ============================================================
-- HIKMAT TANI - Cloudflare D1 Production Migration (0003)
-- Normalize auth_users to the canonical D1 schema used by the app.
-- Canonical columns: id, anonymous_id, role, is_active,
-- last_seen_at, created_at, updated_at.
--
-- Safe intent: preserve all canonical auth data. Legacy-only columns
-- (farmer_id, phone_number, email, password_hash, etc.) are removed
-- from the auth_users table definition after their canonical data is
-- copied. Farmer credentials remain in farmers, where the application
-- persists phone_number, nik, pin_hash, and salt.
-- ============================================================

PRAGMA foreign_keys=OFF;

ALTER TABLE auth_users RENAME TO auth_users_legacy;

CREATE TABLE auth_users (
    id TEXT PRIMARY KEY NOT NULL,
    anonymous_id TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'farmer',
    is_active INTEGER NOT NULL DEFAULT 1,
    last_seen_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

INSERT INTO auth_users (
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
FROM auth_users_legacy;

DROP TABLE auth_users_legacy;

CREATE INDEX IF NOT EXISTS idx_auth_users_role ON auth_users(role);
CREATE INDEX IF NOT EXISTS idx_auth_users_anonymous_id ON auth_users(anonymous_id);

PRAGMA foreign_keys=ON;
