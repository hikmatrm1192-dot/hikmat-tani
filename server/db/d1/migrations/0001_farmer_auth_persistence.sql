-- ============================================================
-- HIKMAT TANI - Cloudflare D1 Schema Migration (0001_farmer_auth_persistence.sql)
-- Menyesuaikan schema D1 production untuk persistensi akun petani & autentikasi
-- Aman: Tidak DROP, tidak TRUNCATE, tidak DELETE data existing.
-- ============================================================

-- 1. Penambahan Kolom pada tabel 'farmers' untuk identitas & kredensial persisten
ALTER TABLE farmers ADD COLUMN phone_number TEXT;
ALTER TABLE farmers ADD COLUMN nik TEXT;
ALTER TABLE farmers ADD COLUMN pin_hash TEXT;
ALTER TABLE farmers ADD COLUMN salt TEXT;
ALTER TABLE farmers ADD COLUMN village TEXT;
ALTER TABLE farmers ADD COLUMN district TEXT;
ALTER TABLE farmers ADD COLUMN regency TEXT;
ALTER TABLE farmers ADD COLUMN province TEXT;
ALTER TABLE farmers ADD COLUMN farmer_group_name TEXT;
ALTER TABLE farmers ADD COLUMN auth_user_id TEXT;

-- 2. Penambahan Kolom pada tabel 'auth_users' untuk pelacakan sesi & identitas anonim
ALTER TABLE auth_users ADD COLUMN anonymous_id TEXT;
ALTER TABLE auth_users ADD COLUMN last_seen_at TEXT;

-- 3. Indeks Pencarian & Integritas Autentikasi
CREATE INDEX IF NOT EXISTS idx_farmers_nik ON farmers(nik);
CREATE INDEX IF NOT EXISTS idx_farmers_phone_number ON farmers(phone_number);
CREATE INDEX IF NOT EXISTS idx_farmers_auth_user_id ON farmers(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_auth_users_role ON auth_users(role);
CREATE INDEX IF NOT EXISTS idx_auth_users_farmer_id ON auth_users(farmer_id);
