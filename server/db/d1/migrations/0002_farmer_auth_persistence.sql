-- ============================================================
-- HIKMAT TANI - Cloudflare D1 Production Migration (0002_farmer_auth_persistence.sql)
-- Target Database: hikmat-tani-db (Cloudflare D1 SQLite)
-- 
-- Baseline Production Schema:
--   farmers: id, name, phone, email, address, created_at, updated_at
--   auth_users: id, farmer_id, phone_number, email, password_hash, role, is_active, created_at, updated_at
-- 
-- Karakteristik Keamanan Data:
-- 1. 100% Non-Destructive: Tidak melakukan DROP TABLE, DROP COLUMN, TRUNCATE, atau DELETE data existing.
-- 2. Menambahkan kolom baru untuk identitas, lokasi, dan keamanan autentikasi petani.
-- 3. Melakukan sinkronisasi nilai kolom eksisting (phone -> phone_number) secara aman tanpa menghapus kolom lama.
-- 4. Kompatibel penuh dengan authService.ts pada commit 2896491.
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

-- 3. Pembuatan Indeks Pencarian & Integritas Autentikasi
CREATE INDEX IF NOT EXISTS idx_farmers_nik ON farmers(nik);
CREATE INDEX IF NOT EXISTS idx_farmers_phone_number ON farmers(phone_number);
CREATE INDEX IF NOT EXISTS idx_farmers_auth_user_id ON farmers(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_auth_users_role ON auth_users(role);
CREATE INDEX IF NOT EXISTS idx_auth_users_farmer_id ON auth_users(farmer_id);
CREATE INDEX IF NOT EXISTS idx_auth_users_anonymous_id ON auth_users(anonymous_id);

-- 4. Sinkronisasi data existing secara non-destructive
UPDATE farmers SET phone_number = phone WHERE phone_number IS NULL AND phone IS NOT NULL;

