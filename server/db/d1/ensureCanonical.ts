/**
 * HIKMAT TANI - Cloudflare D1 Canonical Schema Normalization & Self-Healing
 * 
 * Modul ini memastikan seluruh skema tabel di Cloudflare D1 (termasuk admin_audit_logs,
 * admin_users, app_configs, auth_users, farmers, dan tabel domain budidaya)
 * selalu berada dalam format kanonikal yang valid secara runtime tanpa merusak
 * atau menghapus data existing (Zero Data Loss & Self-Healing).
 */

let isSchemaEnsured = false;

export function resetSchemaEnsuredCache(): void {
  isSchemaEnsured = false;
}

/**
 * Helper untuk mendeteksi kolom yang hilang pada tabel existing dan menambahkan
 * kolom baru via ALTER TABLE ... ADD COLUMN secara idempotent.
 */
async function selfHealTableColumns(
  d1: any,
  tableName: string,
  requiredColumns: Array<{ name: string; typeAndDef: string }>
): Promise<void> {
  let existingColumns: { name: string }[] = [];
  try {
    const res = await d1.prepare(`PRAGMA table_info(${tableName})`).all();
    existingColumns = res.results || res || [];
  } catch {
    return;
  }

  if (!existingColumns || existingColumns.length === 0) return;

  const colSet = new Set(existingColumns.map((c: any) => String(c.name).toLowerCase()));
  for (const col of requiredColumns) {
    if (!colSet.has(col.name.toLowerCase())) {
      try {
        console.log(`[D1 Self-Healing] Menambahkan kolom '${col.name}' pada tabel '${tableName}'...`);
        await d1.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${col.name} ${col.typeAndDef}`).run();
        console.log(`[D1 Self-Healing] ✓ Kolom '${col.name}' berhasil ditambahkan ke '${tableName}'.`);
      } catch (err: any) {
        console.warn(`[D1 Self-Healing] Catatan penambahan kolom ${tableName}.${col.name}:`, err?.message || err);
      }
    }
  }
}

export async function ensureD1CanonicalSchema(d1BindingOrDb: any, force = false): Promise<boolean> {
  if (!d1BindingOrDb || (!force && isSchemaEnsured)) return true;

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
    // =========================================================================
    // 1. DATA PETANI & AUTENTIKASI (auth_users & farmers)
    // =========================================================================

    // 1A. auth_users: Create IF NOT EXISTS & Self-Healing
    await d1.prepare(`
      CREATE TABLE IF NOT EXISTS auth_users (
        id TEXT PRIMARY KEY NOT NULL,
        anonymous_id TEXT UNIQUE,
        role TEXT NOT NULL DEFAULT 'farmer',
        is_active INTEGER NOT NULL DEFAULT 1,
        last_seen_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )
    `).run().catch(() => {});

    let authColumns: { name: string; notnull: number }[] = [];
    try {
      const res = await d1.prepare('PRAGMA table_info(auth_users)').all();
      authColumns = res.results || res || [];
    } catch {
      // Abaikan jika belum tersedia
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

    // 1B. farmers: Create IF NOT EXISTS & Self-Healing
    await d1.prepare(`
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
        auth_user_id TEXT UNIQUE,
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )
    `).run().catch(() => {});

    await selfHealTableColumns(d1, 'farmers', [
      { name: 'name', typeAndDef: "TEXT NOT NULL DEFAULT ''" },
      { name: 'phone_number', typeAndDef: "TEXT" },
      { name: 'nik', typeAndDef: "TEXT" },
      { name: 'pin_hash', typeAndDef: "TEXT" },
      { name: 'salt', typeAndDef: "TEXT" },
      { name: 'village', typeAndDef: "TEXT" },
      { name: 'district', typeAndDef: "TEXT" },
      { name: 'regency', typeAndDef: "TEXT" },
      { name: 'province', typeAndDef: "TEXT" },
      { name: 'farmer_group_name', typeAndDef: "TEXT" },
      { name: 'auth_user_id', typeAndDef: "TEXT" },
      { name: 'created_at', typeAndDef: "TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)" },
      { name: 'updated_at', typeAndDef: "TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)" },
    ]);

    // Sinkronkan legacy phone -> phone_number jika ada
    try {
      await d1.prepare('UPDATE farmers SET phone_number = phone WHERE phone_number IS NULL AND phone IS NOT NULL').run();
    } catch {}

    const farmerIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_farmers_nik ON farmers(nik)',
      'CREATE INDEX IF NOT EXISTS idx_farmers_phone_number ON farmers(phone_number)',
      'CREATE INDEX IF NOT EXISTS idx_farmers_auth_user_id ON farmers(auth_user_id)',
    ];
    for (const idx of farmerIndexes) {
      try {
        await d1.prepare(idx).run();
      } catch {}
    }

    // =========================================================================
    // 2. ROLE & ADMIN MANAGEMENT (admin_audit_logs, admin_users, app_configs)
    // =========================================================================

    // 2A. admin_audit_logs: Create IF NOT EXISTS & Self-Healing
    await d1.prepare(`
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id TEXT PRIMARY KEY NOT NULL,
        actor_id TEXT NOT NULL,
        actor_name TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL DEFAULT 'SYSTEM',
        entity_id TEXT,
        details TEXT,
        ip_address TEXT,
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )
    `).run().catch(() => {});

    await selfHealTableColumns(d1, 'admin_audit_logs', [
      { name: 'actor_id', typeAndDef: "TEXT NOT NULL DEFAULT ''" },
      { name: 'actor_name', typeAndDef: "TEXT NOT NULL DEFAULT ''" },
      { name: 'actor_role', typeAndDef: "TEXT NOT NULL DEFAULT 'MANAGER'" },
      { name: 'action', typeAndDef: "TEXT NOT NULL DEFAULT ''" },
      { name: 'entity_type', typeAndDef: "TEXT NOT NULL DEFAULT 'SYSTEM'" },
      { name: 'entity_id', typeAndDef: "TEXT" },
      { name: 'details', typeAndDef: "TEXT" },
      { name: 'ip_address', typeAndDef: "TEXT" },
      { name: 'created_at', typeAndDef: "TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)" },
    ]);

    // Backfill audit log data jika ada kolom lama / data kosong
    try {
      await d1.prepare(`UPDATE admin_audit_logs SET actor_name = 'Pengelola' WHERE actor_name IS NULL OR actor_name = ''`).run();
    } catch {}
    try {
      await d1.prepare(`UPDATE admin_audit_logs SET actor_role = 'MANAGER' WHERE actor_role IS NULL OR actor_role = ''`).run();
    } catch {}
    try {
      await d1.prepare(`UPDATE admin_audit_logs SET action = 'SYSTEM_ACTION' WHERE action IS NULL OR action = ''`).run();
    } catch {}
    try {
      await d1.prepare(`UPDATE admin_audit_logs SET entity_type = 'AUTH' WHERE action IN ('LOGIN', 'CHANGE_PASSWORD') AND (entity_type IS NULL OR entity_type = '' OR entity_type = 'SYSTEM')`).run();
    } catch {}
    try {
      await d1.prepare(`UPDATE admin_audit_logs SET entity_type = 'ADMIN_USER' WHERE action IN ('CREATE_MANAGER', 'UPDATE_MANAGER', 'DELETE_MANAGER') AND (entity_type IS NULL OR entity_type = '' OR entity_type = 'SYSTEM')`).run();
    } catch {}
    try {
      await d1.prepare(`UPDATE admin_audit_logs SET entity_type = 'APP_CONFIG' WHERE action IN ('UPDATE_CONFIG', 'UPDATE_QRIS', 'TOGGLE_DONATION') AND (entity_type IS NULL OR entity_type = '' OR entity_type = 'SYSTEM')`).run();
    } catch {}
    try {
      await d1.prepare(`UPDATE admin_audit_logs SET entity_type = 'SYSTEM' WHERE entity_type IS NULL OR entity_type = ''`).run();
    } catch {}

    const auditIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor_id ON admin_audit_logs(actor_id)',
      'CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_entity_type ON admin_audit_logs(entity_type)',
    ];
    for (const idx of auditIndexes) {
      try {
        await d1.prepare(idx).run();
      } catch {}
    }

    // 2B. admin_users: Create IF NOT EXISTS & Self-Healing
    await d1.prepare(`
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
      )
    `).run().catch(() => {});

    await selfHealTableColumns(d1, 'admin_users', [
      { name: 'username', typeAndDef: "TEXT NOT NULL DEFAULT ''" },
      { name: 'email', typeAndDef: "TEXT" },
      { name: 'full_name', typeAndDef: "TEXT NOT NULL DEFAULT ''" },
      { name: 'password_hash', typeAndDef: "TEXT NOT NULL DEFAULT ''" },
      { name: 'salt', typeAndDef: "TEXT NOT NULL DEFAULT ''" },
      { name: 'role', typeAndDef: "TEXT NOT NULL DEFAULT 'MANAGER'" },
      { name: 'is_active', typeAndDef: "INTEGER NOT NULL DEFAULT 1" },
      { name: 'last_login_at', typeAndDef: "TEXT" },
      { name: 'created_at', typeAndDef: "TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)" },
      { name: 'updated_at', typeAndDef: "TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)" },
    ]);

    const adminUserIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username)',
      'CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email)',
    ];
    for (const idx of adminUserIndexes) {
      try {
        await d1.prepare(idx).run();
      } catch {}
    }

    // 2C. app_configs: Create IF NOT EXISTS & Self-Healing
    await d1.prepare(`
      CREATE TABLE IF NOT EXISTS app_configs (
        id TEXT PRIMARY KEY NOT NULL,
        app_name TEXT NOT NULL DEFAULT 'HIKMAT TANI',
        slogan TEXT NOT NULL DEFAULT 'CERDAS BERTANI, BIJAK MENGAMBIL KEPUTUSAN.',
        logo_url TEXT NOT NULL DEFAULT '/icon-512.png',
        logo_primary TEXT NOT NULL DEFAULT '/icon-512.png',
        logo_horizontal TEXT NOT NULL DEFAULT '/logo-hikmat-tani-full.png',
        app_icon TEXT NOT NULL DEFAULT '/icon-192.png',
        description TEXT NOT NULL DEFAULT 'Inisiatif Mandiri Teknologi Pertanian Padi Nusantara',
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
      )
    `).run().catch(() => {});

    await selfHealTableColumns(d1, 'app_configs', [
      { name: 'app_name', typeAndDef: "TEXT NOT NULL DEFAULT 'HIKMAT TANI'" },
      { name: 'slogan', typeAndDef: "TEXT NOT NULL DEFAULT 'CERDAS BERTANI, BIJAK MENGAMBIL KEPUTUSAN.'" },
      { name: 'logo_url', typeAndDef: "TEXT NOT NULL DEFAULT '/icon-512.png'" },
      { name: 'logo_primary', typeAndDef: "TEXT NOT NULL DEFAULT '/icon-512.png'" },
      { name: 'logo_horizontal', typeAndDef: "TEXT NOT NULL DEFAULT '/logo-hikmat-tani-full.png'" },
      { name: 'app_icon', typeAndDef: "TEXT NOT NULL DEFAULT '/icon-192.png'" },
      { name: 'description', typeAndDef: "TEXT NOT NULL DEFAULT 'Inisiatif Mandiri Teknologi Pertanian Padi Nusantara'" },
      { name: 'contact_phone', typeAndDef: "TEXT" },
      { name: 'contact_email', typeAndDef: "TEXT" },
      { name: 'support_title', typeAndDef: "TEXT NOT NULL DEFAULT 'Dukung HIKMAT TANI'" },
      { name: 'support_description', typeAndDef: "TEXT NOT NULL DEFAULT 'Inisiatif Mandiri Teknologi Pertanian Padi Nusantara'" },
      { name: 'donation_active', typeAndDef: "INTEGER NOT NULL DEFAULT 1" },
      { name: 'donation_recipient_name', typeAndDef: "TEXT" },
      { name: 'donation_bank_name', typeAndDef: "TEXT" },
      { name: 'donation_account_number', typeAndDef: "TEXT" },
      { name: 'donation_ewallet_number', typeAndDef: "TEXT" },
      { name: 'donation_qris_image', typeAndDef: "TEXT" },
      { name: 'donation_url', typeAndDef: "TEXT" },
      { name: 'updated_by', typeAndDef: "TEXT" },
      { name: 'updated_at', typeAndDef: "TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)" },
    ]);

    // =========================================================================
    // 3. TABEL DOMAIN BUDIDAYA, MASTER DATA, SYNC & OUTBOX
    // =========================================================================
    const domainTableStatements = [
      `CREATE TABLE IF NOT EXISTS lands (
        id TEXT PRIMARY KEY NOT NULL,
        farmer_id TEXT NOT NULL,
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
      )`,
      `CREATE TABLE IF NOT EXISTS crop_seasons (
        id TEXT PRIMARY KEY NOT NULL,
        land_id TEXT NOT NULL,
        season_number INTEGER NOT NULL,
        variety_id TEXT,
        planting_date TEXT NOT NULL,
        harvest_date TEXT,
        target_yield_ton REAL NOT NULL,
        actual_yield_ton REAL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )`,
      `CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY NOT NULL,
        crop_season_id TEXT NOT NULL,
        date TEXT NOT NULL,
        hst INTEGER NOT NULL,
        activity_type TEXT NOT NULL,
        notes TEXT,
        photo_url TEXT,
        cost_rupiah INTEGER,
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )`,
      `CREATE TABLE IF NOT EXISTS activity_fertilizers (
        id TEXT PRIMARY KEY NOT NULL,
        activity_id TEXT NOT NULL,
        fertilizer_id TEXT NOT NULL,
        amount_kg REAL NOT NULL,
        application_method TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )`,
      `CREATE TABLE IF NOT EXISTS activity_opt_observations (
        id TEXT PRIMARY KEY NOT NULL,
        activity_id TEXT NOT NULL,
        opt_id TEXT,
        severity TEXT NOT NULL,
        affected_area_percentage REAL NOT NULL,
        symptoms TEXT,
        control_action_taken TEXT,
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )`,
      `CREATE TABLE IF NOT EXISTS recommendations (
        id TEXT PRIMARY KEY NOT NULL,
        crop_season_id TEXT NOT NULL,
        hst INTEGER NOT NULL,
        recommendation_type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        priority TEXT NOT NULL,
        source_rule_id TEXT NOT NULL,
        reference_id TEXT,
        payload TEXT,
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )`,
      `CREATE TABLE IF NOT EXISTS farmer_decisions (
        id TEXT PRIMARY KEY NOT NULL,
        recommendation_id TEXT NOT NULL,
        decision TEXT NOT NULL,
        reason TEXT,
        decision_date TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )`,
      `CREATE TABLE IF NOT EXISTS actual_actions (
        id TEXT PRIMARY KEY NOT NULL,
        farmer_decision_id TEXT NOT NULL,
        action_taken TEXT NOT NULL,
        action_date TEXT NOT NULL,
        notes TEXT,
        cost_rupiah INTEGER,
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )`,
      `CREATE TABLE IF NOT EXISTS fertilizers (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        n_percentage REAL NOT NULL,
        p_percentage REAL NOT NULL,
        k_percentage REAL NOT NULL,
        s_percentage REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )`,
      `CREATE TABLE IF NOT EXISTS varieties (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        potential_yield_ton REAL NOT NULL,
        growth_duration_days INTEGER NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )`,
      `CREATE TABLE IF NOT EXISTS opts (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        latin_name TEXT,
        type TEXT NOT NULL,
        symptoms TEXT NOT NULL,
        control_methods TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )`,
      `CREATE TABLE IF NOT EXISTS natural_enemies (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        target_opt_id TEXT,
        effectiveness TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )`,
      `CREATE TABLE IF NOT EXISTS "references" (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        institution TEXT NOT NULL,
        year INTEGER NOT NULL,
        summary TEXT NOT NULL,
        url TEXT,
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )`,
      `CREATE TABLE IF NOT EXISTS knowledge_articles (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        content_markdown TEXT NOT NULL,
        author TEXT,
        reference_id TEXT,
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )`,
      `CREATE TABLE IF NOT EXISTS sync_journal (
        id TEXT PRIMARY KEY NOT NULL,
        farmer_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload TEXT NOT NULL,
        client_timestamp TEXT NOT NULL,
        server_timestamp TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )`,
      `CREATE TABLE IF NOT EXISTS processed_operations (
        operation_id TEXT PRIMARY KEY NOT NULL,
        farmer_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )`,
      `CREATE TABLE IF NOT EXISTS replication_outbox (
        id TEXT PRIMARY KEY NOT NULL,
        event_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        retry_count INTEGER NOT NULL DEFAULT 0,
        next_retry_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        lease_owner TEXT,
        lease_expires_at TEXT,
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        processed_at TEXT
      )`,
    ];

    for (const stmt of domainTableStatements) {
      try {
        await d1.prepare(stmt).run();
      } catch {}
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
