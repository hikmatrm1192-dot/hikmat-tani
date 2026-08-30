/**
 * Cloudflare Worker admin authentication helpers.
 *
 * This module deliberately reads production secrets from the Worker `env`
 * object. It does not use process.env and never returns or logs plaintext
 * secrets.
 */

import { ensureD1CanonicalSchema } from '../db/d1/ensureCanonical.ts';

export const CANONICAL_SUPER_ADMIN_ID = 'admin_super_pappizee';
export const CANONICAL_SUPER_ADMIN_USERNAME = 'pappizee';
export const CANONICAL_SUPER_ADMIN_EMAIL = 'hikmat.rm1192@gmail.com';

export interface WorkerAdminEnv {
  SUPER_ADMIN_PASSWORD?: string;
}

export interface WorkerAdminRecord {
  id: string;
  username: string;
  email?: string;
  fullName: string;
  passwordHash: string;
  salt: string;
  role: 'MANAGER' | 'SUPER_ADMIN';
  isActive: boolean;
}

export interface WorkerAdminLoginResult {
  success: boolean;
  admin?: Omit<WorkerAdminRecord, 'passwordHash' | 'salt'>;
  error?: string;
}

type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  run: () => Promise<unknown>;
};

type D1Like = {
  prepare: (query: string) => D1Statement;
};

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array | null {
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function constantTimeEqualHex(left: string, right: string): boolean {
  const a = hexToBytes(left);
  const b = hexToBytes(right);
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function isCanonicalSuperAdminSecretMatch(
  userId: string,
  suppliedPassword: string,
  workerSecret: string | undefined,
): boolean {
  return userId === CANONICAL_SUPER_ADMIN_ID &&
    typeof workerSecret === 'string' &&
    workerSecret.length > 0 &&
    suppliedPassword === workerSecret;
}

export async function hashPasswordForWorker(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: 10000,
      hash: 'SHA-512',
    },
    key,
    512,
  );
  return bytesToHex(new Uint8Array(bits));
}

export async function verifyPasswordForWorker(
  password: string,
  storedHash: string,
  salt: string,
): Promise<boolean> {
  if (!password || !storedHash || !salt) return false;
  const calculated = await hashPasswordForWorker(password, salt);
  return constantTimeEqualHex(calculated, storedHash);
}

function sanitizeAdmin(row: WorkerAdminRecord): Omit<WorkerAdminRecord, 'passwordHash' | 'salt'> {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    isActive: row.isActive,
  };
}

/** Ensure legacy production D1 has every admin column required by Worker auth. */
async function ensureAdminSchemaColumns(db: D1Like): Promise<void> {
  const requiredColumns = [
    { name: 'salt', type: 'TEXT' },
    { name: 'last_login_at', type: 'TEXT' },
  ];

  for (const column of requiredColumns) {
    try {
      await db.prepare(`SELECT ${column.name} FROM admin_users LIMIT 1`).first();
    } catch (err: any) {
      const message = String(err?.message || err || '').toLowerCase();
      if (!message.includes('no such column') || !message.includes(column.name)) throw err;

      try {
        await db.prepare(`ALTER TABLE admin_users ADD COLUMN ${column.name} ${column.type}`).run();
      } catch (alterErr: any) {
        const alterMessage = String(alterErr?.message || alterErr || '').toLowerCase();
        if (!alterMessage.includes('duplicate column') && !alterMessage.includes('already exists')) {
          throw alterErr;
        }
      }
    }
  }
}

/**
 * The Worker admin route does not execute the Node AdminService bootstrap.
 * Provision the single canonical SUPER_ADMIN if the D1 row is missing.
 * This touches only admin_users and does not create audit/activity entries.
 */
async function ensureCanonicalSuperAdminAccount(
  db: D1Like,
  workerSecret: string | undefined,
): Promise<void> {
  if (!workerSecret) return;

  const existing = await db.prepare(`
    SELECT id FROM admin_users
    WHERE id = ? OR lower(username) = ? OR lower(email) = ?
    LIMIT 1
  `).bind(
    CANONICAL_SUPER_ADMIN_ID,
    CANONICAL_SUPER_ADMIN_USERNAME,
    CANONICAL_SUPER_ADMIN_EMAIL,
  ).first<{ id: string }>();

  if (existing) return;

  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const salt = bytesToHex(saltBytes);
  const passwordHash = await hashPasswordForWorker(workerSecret, salt);
  const now = new Date().toISOString();

  await db.prepare(`
    INSERT INTO admin_users
      (id, username, email, full_name, password_hash, salt, role, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    CANONICAL_SUPER_ADMIN_ID,
    CANONICAL_SUPER_ADMIN_USERNAME,
    CANONICAL_SUPER_ADMIN_EMAIL,
    'Pappizee',
    passwordHash,
    salt,
    'SUPER_ADMIN',
    1,
    now,
    now,
  ).run();
}

export async function authenticateAdminOnWorker(
  db: D1Like,
  env: WorkerAdminEnv,
  usernameOrEmail: string,
  passwordPlain: string,
  ipAddress: string,
): Promise<WorkerAdminLoginResult> {
  await ensureD1CanonicalSchema(db);

  const identifier = usernameOrEmail.trim().toLowerCase();
  if (!identifier || !passwordPlain) {
    return { success: false, error: 'Nama pengguna/email atau kata sandi pengelola salah.' };
  }

  try {
    await ensureAdminSchemaColumns(db);
    await ensureCanonicalSuperAdminAccount(db, env.SUPER_ADMIN_PASSWORD);
  } catch (schemaErr: any) {
    console.error('[Worker Admin Auth] admin_users schema/bootstrap failed:', schemaErr?.message || schemaErr);
    return { success: false, error: 'Database pengelola belum tersinkron dengan versi Worker terbaru.' };
  }

  const row = await db.prepare(`
    SELECT id, username, email, full_name, password_hash, salt, role, is_active
    FROM admin_users
    WHERE lower(username) = ? OR lower(email) = ?
    LIMIT 1
  `).bind(identifier, identifier).first<{
    id: string;
    username: string;
    email?: string | null;
    full_name: string;
    password_hash: string;
    salt: string | null;
    role: string;
    is_active: number | boolean;
  }>();

  if (!row || !Boolean(row.is_active)) {
    return { success: false, error: 'Nama pengguna/email atau kata sandi pengelola salah.' };
  }

  const admin: WorkerAdminRecord = {
    id: row.id,
    username: row.username,
    email: row.email || undefined,
    fullName: row.full_name,
    passwordHash: row.password_hash,
    salt: row.salt || '',
    role: row.role as 'MANAGER' | 'SUPER_ADMIN',
    isActive: Boolean(row.is_active),
  };

  let valid = await verifyPasswordForWorker(passwordPlain, admin.passwordHash, admin.salt);

  // Worker secret is a bootstrap/recovery secret for the canonical account.
  if (!valid && isCanonicalSuperAdminSecretMatch(admin.id, passwordPlain, env.SUPER_ADMIN_PASSWORD)) {
    const saltBytes = new Uint8Array(16);
    crypto.getRandomValues(saltBytes);
    const newSalt = bytesToHex(saltBytes);
    const newHash = await hashPasswordForWorker(passwordPlain, newSalt);

    await db.prepare(`
      UPDATE admin_users
      SET password_hash = ?, salt = ?, updated_at = ?
      WHERE id = ?
    `).bind(newHash, newSalt, new Date().toISOString(), CANONICAL_SUPER_ADMIN_ID).run();

    admin.passwordHash = newHash;
    admin.salt = newSalt;
    valid = true;
  }

  if (!valid) {
    return { success: false, error: 'Nama pengguna/email atau kata sandi pengelola salah.' };
  }

  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE admin_users SET last_login_at = ?, updated_at = ? WHERE id = ?
  `).bind(now, now, admin.id).run();

  await db.prepare(`
    INSERT INTO admin_audit_logs
      (id, actor_id, actor_name, actor_role, action, entity_type, entity_id, details, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    admin.id,
    admin.fullName,
    admin.role,
    'LOGIN',
    'AUTH',
    admin.id,
    JSON.stringify({ username: admin.username }),
    ipAddress,
    now,
  ).run();

  return { success: true, admin: sanitizeAdmin(admin) };
}
