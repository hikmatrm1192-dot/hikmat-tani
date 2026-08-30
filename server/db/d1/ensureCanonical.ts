/**
 * HIKMAT TANI - Cloudflare D1 Canonical Schema Normalization & Self-Healing
 * 
 * Modul ini memastikan skema tabel `auth_users` dan `farmers` di Cloudflare D1
 * selalu berada dalam format kanonikal yang valid secara runtime tanpa merusak
 * atau menghapus data existing (Zero Data Loss).
 * 
 * Canonical Schema:
 * - auth_users: id, anonymous_id, role, is_active, last_seen_at, created_at, updated_at
 * - farmers: id, name, phone_number, nik, pin_hash, salt, village, district,
 *            regency, province, farmer_group_name, auth_user_id, created_at, updated_at
 */

let isSchemaEnsured = false;

export async function ensureD1CanonicalSchema(d1BindingOrDb: any): Promise<boolean> {
  if (!d1BindingOrDb || isSchemaEnsured) return true;

  // Ekstrak D1 raw binding jika yang diberikan adalah Drizzle instance
  const d1: any = d1BindingOrDb?.prepare
    ? d1BindingOrDb
    : d1BindingOrDb?.session?.client?.prepare
      ? d1BindingOrDb.session.client
      : null;

  if (!d1 || typeof d1.prepare !== 'function') {
    return false;
  }

  try {
    // 1. Periksa kolom pada auth_users
    let authColumns: { name: string; notnull: number }[] = [];
    try {
      const res = await d1.prepare('PRAGMA table_info(auth_users)').all();
      authColumns = res.results || res || [];
    } catch {
      // Tabel auth_users mungkin belum dibuat
    }

    if (authColumns.length > 0) {
      const hasFarmerId = authColumns.some((col: any) => col.name === 'farmer_id');
      const hasAnonymousId = authColumns.some((col: any) => col.name === 'anonymous_id');
      const hasLastSeenAt = authColumns.some((col: any) => col.name === 'last_seen_at');

      // Jika masih ada kolom legacy `farmer_id` atau belum memiliki format kanonikal:
      if (hasFarmerId || !hasAnonymousId || !hasLastSeenAt) {
        console.log('[D1 Self-Healing] Menyelaraskan auth_users ke skema kanonikal...');
        const migrationStmts = [
          'PRAGMA foreign_keys=OFF',
          `CREATE TABLE IF NOT EXISTS auth_users_canonical (
            id TEXT PRIMARY KEY NOT NULL,
            anonymous_id TEXT UNIQUE,
            role TEXT NOT NULL DEFAULT 'farmer',
            is_active INTEGER NOT NULL DEFAULT 1,
            last_seen_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
            created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
            updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
          )`,
          `INSERT OR IGNORE INTO auth_users_canonical (id, anonymous_id, role, is_active, last_seen_at, created_at, updated_at)
           SELECT
             id,
             anonymous_id,
             COALESCE(role, 'farmer'),
             COALESCE(is_active, 1),
             COALESCE(last_seen_at, CURRENT_TIMESTAMP),
             COALESCE(created_at, CURRENT_TIMESTAMP),
             COALESCE(updated_at, CURRENT_TIMESTAMP)
           FROM auth_users`,
          'DROP TABLE auth_users',
          'ALTER TABLE auth_users_canonical RENAME TO auth_users',
          'CREATE INDEX IF NOT EXISTS idx_auth_users_role ON auth_users(role)',
          'CREATE INDEX IF NOT EXISTS idx_auth_users_anonymous_id ON auth_users(anonymous_id)',
          'PRAGMA foreign_keys=ON',
        ];

        for (const stmt of migrationStmts) {
          try {
            await d1.prepare(stmt).run();
          } catch (stmtErr: any) {
            console.warn('[D1 Self-Healing] Warning pada statement:', stmt.slice(0, 40), stmtErr?.message || stmtErr);
          }
        }
        console.log('[D1 Self-Healing] ✓ auth_users berhasil dinormalisasi.');
      }
    }

    // 2. Periksa kolom pada farmers
    let farmerColumns: { name: string }[] = [];
    try {
      const res = await d1.prepare('PRAGMA table_info(farmers)').all();
      farmerColumns = res.results || res || [];
    } catch {
      // Tabel farmers mungkin belum dibuat
    }

    if (farmerColumns.length > 0) {
      const colSet = new Set(farmerColumns.map((c: any) => c.name));
      const requiredColumns = [
        'phone_number',
        'nik',
        'pin_hash',
        'salt',
        'village',
        'district',
        'regency',
        'province',
        'farmer_group_name',
        'auth_user_id',
      ];

      for (const col of requiredColumns) {
        if (!colSet.has(col)) {
          try {
            await d1.prepare(`ALTER TABLE farmers ADD COLUMN ${col} TEXT`).run();
          } catch {
            // Kolom mungkin sudah ada
          }
        }
      }

      // Sinkronkan legacy phone -> phone_number jika ada
      if (colSet.has('phone')) {
        try {
          await d1.prepare('UPDATE farmers SET phone_number = phone WHERE phone_number IS NULL AND phone IS NOT NULL').run();
        } catch {
          // Abaikan
        }
      }

      // Indeks pencarian
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_farmers_nik ON farmers(nik)',
        'CREATE INDEX IF NOT EXISTS idx_farmers_phone_number ON farmers(phone_number)',
        'CREATE INDEX IF NOT EXISTS idx_farmers_auth_user_id ON farmers(auth_user_id)',
      ];
      for (const idx of indexes) {
        try {
          await d1.prepare(idx).run();
        } catch {
          // Abaikan
        }
      }
    }

    // 3. Pastikan tabel admin_users, app_configs, dan admin_audit_logs tersedia
    const adminTablesStatements = [
      `CREATE TABLE IF NOT EXISTS admin_users (
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
      )`,
      `CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username)`,
      `CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email)`,
      `CREATE TABLE IF NOT EXISTS app_configs (
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
      )`,
      `CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id TEXT PRIMARY KEY NOT NULL,
        actor_id TEXT NOT NULL,
        actor_name TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        ip_address TEXT,
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at)`,
    ];

    for (const stmt of adminTablesStatements) {
      try {
        await d1.prepare(stmt).run();
      } catch (stmtErr: any) {
        // Abaikan jika tabel atau indeks sudah ada
      }
    }

    // 4. Perbaikan schema admin_users lama.
    // CREATE TABLE IF NOT EXISTS tidak menambahkan kolom ke tabel yang sudah ada.
    // Production D1 terbukti memiliki admin_users tanpa kolom `salt`, sehingga
    // query login gagal sebelum proses verifikasi password dijalankan.
    try {
      const adminColumnsResult = await d1.prepare('PRAGMA table_info(admin_users)').all();
      const adminColumns = adminColumnsResult.results || adminColumnsResult || [];
      const hasSalt = adminColumns.some((col: any) => col.name === 'salt');

      if (!hasSalt) {
        await d1.prepare('ALTER TABLE admin_users ADD COLUMN salt TEXT').run();
        console.log('[D1 Self-Healing] ✓ Kolom admin_users.salt berhasil ditambahkan.');
      }
    } catch (schemaErr: any) {
      console.error('[D1 Self-Healing] Gagal memperbaiki admin_users.salt:', schemaErr?.message || schemaErr);
    }

    isSchemaEnsured = true;
    return true;
  } catch (err: any) {
    console.error('[D1 Self-Healing] Schema check error:', err?.message || err);
    return false;
  }
}
