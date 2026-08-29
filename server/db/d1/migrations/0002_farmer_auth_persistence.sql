-- ============================================================
-- HIKMAT TANI - Cloudflare D1 Production Migration (0002_farmer_auth_persistence.sql)
-- Target Database: hikmat-tani-db (Cloudflare D1 SQLite)
--
-- 0001 already adds the farmer/auth persistence columns.
-- This migration must NOT repeat those ALTER TABLE statements,
-- otherwise a normal 0001 -> 0002 migration sequence fails with
-- "duplicate column name" errors.
-- ============================================================

-- 1. Additional indexes for D1 production lookup/integrity
CREATE INDEX IF NOT EXISTS idx_farmers_nik ON farmers(nik);
CREATE INDEX IF NOT EXISTS idx_farmers_phone_number ON farmers(phone_number);
CREATE INDEX IF NOT EXISTS idx_farmers_auth_user_id ON farmers(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_auth_users_role ON auth_users(role);
CREATE INDEX IF NOT EXISTS idx_auth_users_farmer_id ON auth_users(farmer_id);
CREATE INDEX IF NOT EXISTS idx_auth_users_anonymous_id ON auth_users(anonymous_id);

-- 2. Non-destructive synchronization of the legacy phone column
UPDATE farmers SET phone_number = phone WHERE phone_number IS NULL AND phone IS NOT NULL;
