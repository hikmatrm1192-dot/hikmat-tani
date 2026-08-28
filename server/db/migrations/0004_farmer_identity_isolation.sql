-- HIKMAT TANI - Migration 0004: Farmer Identity & Data Isolation
-- Menambahkan kolom NIK, PIN Hash, Salt, dan Index Keamanan pada tabel farmers dan auth_users

-- 1. Tambah kolom keamanan dan identitas pada tabel farmers jika belum ada
ALTER TABLE farmers ADD COLUMN IF NOT EXISTS nik VARCHAR(16);
ALTER TABLE farmers ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE farmers ADD COLUMN IF NOT EXISTS salt TEXT;

-- 2. Buat index unik untuk NIK dan Nomor HP agar mencegah duplikasi
CREATE UNIQUE INDEX IF NOT EXISTS idx_farmers_nik_unique ON farmers (nik) WHERE nik IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_farmers_phone_number ON farmers (phone_number);
CREATE INDEX IF NOT EXISTS idx_farmers_auth_user_id ON farmers (auth_user_id);

-- 3. Tambahkan index ownership pada tabel operasional untuk query terisolasi
CREATE INDEX IF NOT EXISTS idx_lands_farmer_id_status ON lands (farmer_id, status);
CREATE INDEX IF NOT EXISTS idx_sync_journal_farmer_timestamp ON sync_journal (farmer_id, server_timestamp);
CREATE INDEX IF NOT EXISTS idx_processed_operations_farmer ON processed_operations (farmer_id, operation_id);

-- 4. Tabel Master Agregasi Pengetahuan Lapangan (Aggregated Field Knowledge)
CREATE TABLE IF NOT EXISTS aggregated_field_knowledge (
    id VARCHAR(64) PRIMARY KEY,
    region_regency VARCHAR(100) NOT NULL,
    region_district VARCHAR(100),
    commodity VARCHAR(50) DEFAULT 'Padi' NOT NULL,
    topic_category VARCHAR(50) NOT NULL, -- OPT, VARIETY_PERFORMANCE, FERTILIZER_USAGE, PHENOLOGY
    opt_id VARCHAR(50),
    variety_id VARCHAR(50),
    sample_count INTEGER NOT NULL,
    k_anonymity_passed BOOLEAN DEFAULT true NOT NULL,
    dominant_growth_stage VARCHAR(100),
    severity_breakdown JSONB,
    recommendation_summary TEXT,
    insight_summary TEXT NOT NULL,
    confidence_level VARCHAR(20) DEFAULT 'MEDIUM' NOT NULL,
    aggregated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_field_knowledge_region_topic ON aggregated_field_knowledge (region_regency, topic_category);
CREATE INDEX IF NOT EXISTS idx_field_knowledge_opt ON aggregated_field_knowledge (opt_id);
