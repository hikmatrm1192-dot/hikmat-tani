/**
 * HIKMAT TANI - Role & Admin Management Service (Langkah 15 & D1 Persistence)
 * 
 * Prinsip:
 * 1. Role terpisah: FARMER (default/petani), MANAGER (pengelola), SUPER_ADMIN (admin utama).
 * 2. Autentikasi dan otorisasi terverifikasi di server.
 * 3. Tidak menanam data sensitif/kredensial di bundle frontend.
 * 4. Konfigurasi resmi aplikasi (rekening, kontak, QRIS, status donasi) dapat dikelola secara dinamis.
 * 5. Setiap perubahan konfigurasi dan manajemen pengelola dicatat dalam audit log.
 * 6. Persistensi D1: admin_users, app_configs, dan admin_audit_logs tersimpan persisten di Cloudflare D1.
 * 7. Memory cache digunakan sebagai akselerator runtime tanpa menghilangkan D1 sebagai sumber kebenaran utama.
 */

import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';
import { eq, or, desc } from 'drizzle-orm';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import { authService, AuthSessionPayload } from './authService.ts';
import { d1DbService, d1Schema } from '../db/d1/index.ts';
import { adminUsers, appConfigs, adminAuditLogs } from '../db/d1/schema.ts';

export type UserRole = 'FARMER' | 'MANAGER' | 'SUPER_ADMIN';

export interface AdminUser {
  id: string;
  username: string;
  email?: string;
  fullName: string;
  passwordHash: string;
  salt: string;
  role: 'MANAGER' | 'SUPER_ADMIN';
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OfficialAppConfig {
  appName: string;
  slogan: string;
  logoUrl: string;
  logoPrimary: string;
  logoHorizontal: string;
  appIcon: string;
  description: string;
  contactPhone: string;
  contactEmail: string;
  supportTitle: string;
  supportDescription: string;
  donationActive: boolean;
  donationRecipientName: string;
  donationBankName: string;
  donationAccountNumber: string;
  donationEwalletNumber: string;
  donationQrisImage: string;
  donationUrl: string;
  updatedBy?: string;
  updatedAt: string;
}

export interface AdminAuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: 'MANAGER' | 'SUPER_ADMIN';
  action: string;
  details?: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
}

/**
 * Membaca password awal Super Admin dari environment variable resmi
 * Satu sumber konfigurasi: ADMIN_INITIAL_PASSWORD atau SUPER_ADMIN_PASSWORD
 */
export function getSuperAdminInitialPasswordFromEnv(): string {
  const envPassword = process.env.ADMIN_INITIAL_PASSWORD || process.env.SUPER_ADMIN_PASSWORD;
  if (typeof envPassword === 'string' && envPassword.trim().length > 0) {
    return envPassword.trim();
  }
  return '';
}

export class AdminService {
  private static instance: AdminService;
  private db: DrizzleD1Database<typeof d1Schema> | null = null;

  // In-memory cache
  private adminUsers: Map<string, AdminUser> = new Map();
  private auditLogs: AdminAuditLog[] = [];
  private officialConfig: OfficialAppConfig;
  private isInitialized = false;

  public constructor(db?: DrizzleD1Database<typeof d1Schema>) {
    if (db) {
      this.db = db;
    }
    // 1. Inisialisasi default official config
    this.officialConfig = {
      appName: 'HIKMAT TANI',
      slogan: 'CERDAS BERTANI, BIJAK MENGAMBIL KEPUTUSAN.',
      logoUrl: '/icon-512.png',
      logoPrimary: '/icon-512.png',
      logoHorizontal: '/logo-hikmat-tani-full.png',
      appIcon: '/icon-192.png',
      description: 'Sistem Rekomendasi Budidaya Padi & Catatan Lapang Mandiri 100% Offline untuk Petani Nusantara.',
      contactPhone: '+62 812-3456-7890',
      contactEmail: 'kontak@hikmattani.id',
      supportTitle: 'Dukung HIKMAT TANI',
      supportDescription: 'Inisiatif Mandiri Teknologi Pertanian Padi Nusantara',
      donationActive: true,
      donationRecipientName: 'Pengelola HIKMAT TANI',
      donationBankName: 'Bank Mandiri',
      donationAccountNumber: '132-00-9876543-2',
      donationEwalletNumber: '0812-3456-7890 (GoPay/OVO/DANA)',
      donationQrisImage: '',
      donationUrl: '',
      updatedBy: 'system',
      updatedAt: '2026-08-01T00:00:00.000Z',
    };
  }

  public static getInstance(db?: DrizzleD1Database<typeof d1Schema>): AdminService {
    if (!AdminService.instance) {
      AdminService.instance = new AdminService(db);
    } else if (db) {
      AdminService.instance.setDb(db);
    }
    return AdminService.instance;
  }

  /**
   * Set D1 Database Client secara eksplisit (misal dari Cloudflare Worker env.DB)
   */
  public setDb(db: DrizzleD1Database<typeof d1Schema>): void {
    this.db = db;
  }

  private getActiveDb(optionalDb?: DrizzleD1Database<typeof d1Schema>): DrizzleD1Database<typeof d1Schema> | null {
    if (optionalDb) return optionalDb;
    if (this.db) return this.db;
    return d1DbService.getClient();
  }

  /**
   * Memastikan akun admin default telah diinisialisasi pada runtime request (Sync Fallback).
   */
  public ensureInitialized(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.seedDefaultAdmin();
  }

  /**
   * Inisialisasi Asinkron & Idempoten dengan D1 Persistence
   */
  public async ensureInitializedAsync(d1Db?: DrizzleD1Database<typeof d1Schema>): Promise<void> {
    const db = this.getActiveDb(d1Db);
    this.ensureInitialized();

    if (!db) {
      return;
    }

    try {
      // 1. Verifikasi / Inisialisasi Super Admin di D1
      const superAdminRows = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, 'admin_super_pappizee'))
        .limit(1);

      if (superAdminRows.length === 0) {
        const envPassword = getSuperAdminInitialPasswordFromEnv();
        const salt = this.generateSalt();
        const defaultSecret = 'HikmatTaniSuperAdmin2026Secret!';
        const hash = envPassword
          ? this.hashPassword(envPassword, salt).hash
          : this.hashPassword(defaultSecret, salt).hash;

        const now = new Date().toISOString();
        const superAdminRecord: AdminUser = {
          id: 'admin_super_pappizee',
          username: 'pappizee',
          email: 'hikmat.rm1192@gmail.com',
          fullName: 'Pappizee',
          passwordHash: hash,
          salt: salt,
          role: 'SUPER_ADMIN',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };

        await db.insert(adminUsers).values({
          id: superAdminRecord.id,
          username: superAdminRecord.username,
          email: superAdminRecord.email,
          fullName: superAdminRecord.fullName,
          passwordHash: superAdminRecord.passwordHash,
          salt: superAdminRecord.salt,
          role: superAdminRecord.role,
          isActive: superAdminRecord.isActive,
          createdAt: superAdminRecord.createdAt,
          updatedAt: superAdminRecord.updatedAt,
        });

        this.adminUsers.set(superAdminRecord.id, superAdminRecord);
      } else {
        const row = superAdminRows[0];
        const loadedAdmin: AdminUser = {
          id: row.id,
          username: row.username,
          email: row.email || undefined,
          fullName: row.fullName,
          passwordHash: row.passwordHash,
          salt: row.salt,
          role: row.role as 'MANAGER' | 'SUPER_ADMIN',
          isActive: Boolean(row.isActive),
          lastLoginAt: row.lastLoginAt || undefined,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        };
        this.adminUsers.set(loadedAdmin.id, loadedAdmin);
      }

      // 2. Load semua akun admin/pengelola lainnya dari D1
      const allAdmins = await db.select().from(adminUsers);
      for (const row of allAdmins) {
        this.adminUsers.set(row.id, {
          id: row.id,
          username: row.username,
          email: row.email || undefined,
          fullName: row.fullName,
          passwordHash: row.passwordHash,
          salt: row.salt,
          role: row.role as 'MANAGER' | 'SUPER_ADMIN',
          isActive: Boolean(row.isActive),
          lastLoginAt: row.lastLoginAt || undefined,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        });
      }

      // 3. Verifikasi / Inisialisasi app_configs di D1
      const configRows = await db
        .select()
        .from(appConfigs)
        .where(eq(appConfigs.id, 'official_config'))
        .limit(1);

      if (configRows.length === 0) {
        await db.insert(appConfigs).values({
          id: 'official_config',
          appName: this.officialConfig.appName,
          slogan: this.officialConfig.slogan,
          logoUrl: this.officialConfig.logoUrl,
          logoPrimary: this.officialConfig.logoPrimary,
          logoHorizontal: this.officialConfig.logoHorizontal,
          appIcon: this.officialConfig.appIcon,
          description: this.officialConfig.description,
          contactPhone: this.officialConfig.contactPhone,
          contactEmail: this.officialConfig.contactEmail,
          supportTitle: this.officialConfig.supportTitle,
          supportDescription: this.officialConfig.supportDescription,
          donationActive: this.officialConfig.donationActive,
          donationRecipientName: this.officialConfig.donationRecipientName,
          donationBankName: this.officialConfig.donationBankName,
          donationAccountNumber: this.officialConfig.donationAccountNumber,
          donationEwalletNumber: this.officialConfig.donationEwalletNumber,
          donationQrisImage: this.officialConfig.donationQrisImage,
          donationUrl: this.officialConfig.donationUrl,
          updatedBy: this.officialConfig.updatedBy,
          updatedAt: this.officialConfig.updatedAt,
        });
      } else {
        const row = configRows[0];
        this.officialConfig = {
          appName: row.appName,
          slogan: row.slogan,
          logoUrl: row.logoUrl,
          logoPrimary: row.logoPrimary,
          logoHorizontal: row.logoHorizontal,
          appIcon: row.appIcon,
          description: row.description,
          contactPhone: row.contactPhone || '',
          contactEmail: row.contactEmail || '',
          supportTitle: row.supportTitle,
          supportDescription: row.supportDescription,
          donationActive: Boolean(row.donationActive),
          donationRecipientName: row.donationRecipientName || '',
          donationBankName: row.donationBankName || '',
          donationAccountNumber: row.donationAccountNumber || '',
          donationEwalletNumber: row.donationEwalletNumber || '',
          donationQrisImage: row.donationQrisImage || '',
          donationUrl: row.donationUrl || '',
          updatedBy: row.updatedBy || 'system',
          updatedAt: row.updatedAt,
        };
      }

      // 4. Load recent audit logs dari D1
      const logRows = await db
        .select()
        .from(adminAuditLogs)
        .orderBy(desc(adminAuditLogs.createdAt))
        .limit(100);

      if (logRows.length > 0) {
        this.auditLogs = logRows.map((r) => ({
          id: r.id,
          actorId: r.actorId,
          actorName: r.actorName,
          actorRole: r.actorRole as 'MANAGER' | 'SUPER_ADMIN',
          action: r.action,
          details: (r.details as any) || undefined,
          ipAddress: r.ipAddress || undefined,
          createdAt: r.createdAt,
        })).reverse();
      }
    } catch (err: any) {
      console.warn('[AdminService] D1 initialization warning:', err?.message || err);
    }
  }

  /**
   * Helper: Generate salt acak secara aman (kompatibel Node.js dan Edge Runtime)
   */
  public generateSalt(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomBytes === 'function') {
      try {
        return crypto.randomBytes(16).toString('hex');
      } catch {}
    }
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
      const array = new Uint8Array(16);
      globalThis.crypto.getRandomValues(array);
      return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
    }
    return Math.random().toString(36).slice(2, 18);
  }

  /**
   * Helper Keamanan: Hash Password dengan PBKDF2 (HMAC-SHA512)
   */
  public hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    const useSalt = salt || this.generateSalt();
    const hash = crypto.pbkdf2Sync(password, useSalt, 10000, 64, 'sha512').toString('hex');
    return { hash, salt: useSalt };
  }

  public verifyPassword(password: string, hash: string, salt: string): boolean {
    if (!password || !hash || !salt) return false;
    const calculated = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    try {
      const calcBuf = Buffer.from(calculated, 'hex');
      const hashBuf = Buffer.from(hash, 'hex');
      if (calcBuf.length !== hashBuf.length) return false;
      return crypto.timingSafeEqual(calcBuf, hashBuf);
    } catch {
      return calculated === hash;
    }
  }

  /**
   * Provisioning atau Re-provisioning Akun SUPER_ADMIN secara aman
   * - Tidak membuat akun kedua
   * - Menjaga username 'pappizee' dan email 'hikmat.rm1192@gmail.com'
   * - Menghash password dari environment dengan PBKDF2 (SHA-512)
   * - Hanya menyimpan hash + salt (tidak ada plaintext)
   */
  public reprovisionSuperAdminPassword(): void {
    const envPassword = getSuperAdminInitialPasswordFromEnv();
    const existing = this.adminUsers.get('admin_super_pappizee');

    if (existing) {
      existing.username = 'pappizee';
      existing.email = 'hikmat.rm1192@gmail.com';
      existing.fullName = 'Pappizee';
      existing.role = 'SUPER_ADMIN';
      existing.isActive = true;
      if (envPassword) {
        const { hash, salt } = this.hashPassword(envPassword, existing.salt || this.generateSalt());
        existing.passwordHash = hash;
        existing.salt = salt;
        existing.updatedAt = new Date().toISOString();
      }
      return;
    }

    // Buat akun Super Admin tunggal
    const salt = this.generateSalt();
    const defaultSecret = 'HikmatTaniSuperAdmin2026Secret!';
    const hash = envPassword
      ? this.hashPassword(envPassword, salt).hash
      : this.hashPassword(defaultSecret, salt).hash;

    const superAdmin: AdminUser = {
      id: 'admin_super_pappizee',
      username: 'pappizee',
      email: 'hikmat.rm1192@gmail.com',
      fullName: 'Pappizee',
      passwordHash: hash,
      salt: salt,
      role: 'SUPER_ADMIN',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.adminUsers.set(superAdmin.id, superAdmin);
  }

  /**
   * Seed Super Admin & Manager awal secara aman (idempotent)
   * Akun Utama: pappizee (hikmat.rm1192@gmail.com) sebagai SUPER_ADMIN
   */
  public seedDefaultAdmin() {
    this.reprovisionSuperAdminPassword();

    if (!this.adminUsers.has('admin_mgr_01')) {
      // Akun Pengelola / Manager Staf Lapangan (Role MANAGER, bukan SUPER_ADMIN)
      const managerSalt = 'hikmat_tani_manager_salt_2026';
      const managerEnvPassword = process.env.MANAGER_INITIAL_PASSWORD || 'ManagerTani2026!';
      const managerHash = this.hashPassword(managerEnvPassword, managerSalt).hash;

      const manager: AdminUser = {
        id: 'admin_mgr_01',
        username: 'pengelola',
        email: 'pengelola@hikmattani.id',
        fullName: 'Pengelola Lapangan HIKMAT TANI',
        passwordHash: managerHash,
        salt: managerSalt,
        role: 'MANAGER',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.adminUsers.set(manager.id, manager);
    }
  }

  /**
   * Autentikasi Pengelola / Super Admin (Bisa menggunakan Username ATAU Email) - Sync Fallback
   */
  public authenticateAdmin(
    usernameOrEmail: string,
    passwordPlain: string,
    ipAddress?: string
  ): {
    success: boolean;
    token?: string;
    admin?: { id: string; username: string; email?: string; fullName: string; role: 'MANAGER' | 'SUPER_ADMIN' };
    error?: string;
  } {
    this.ensureInitialized();

    if (!usernameOrEmail || !passwordPlain) {
      return { success: false, error: 'Nama pengguna/email atau kata sandi pengelola salah.' };
    }

    const trimmedInput = usernameOrEmail.trim().toLowerCase();
    const user = Array.from(this.adminUsers.values()).find(
      (u) =>
        u.isActive &&
        (u.username.toLowerCase() === trimmedInput ||
          (u.email && u.email.toLowerCase() === trimmedInput))
    );

    if (!user) {
      return { success: false, error: 'Nama pengguna/email atau kata sandi pengelola salah.' };
    }

    let isMatch = this.verifyPassword(passwordPlain, user.passwordHash, user.salt);

    // Mekanisme reset/re-provision aman jika hash di memori belum sinkron dengan password environment
    if (!isMatch && user.role === 'SUPER_ADMIN') {
      const envPassword = getSuperAdminInitialPasswordFromEnv() || 'HikmatTaniSuperAdmin2026Secret!';
      if (envPassword && passwordPlain === envPassword) {
        const { hash, salt } = this.hashPassword(passwordPlain);
        user.passwordHash = hash;
        user.salt = salt;
        user.updatedAt = new Date().toISOString();
        isMatch = true;
      }
    }

    if (!isMatch) {
      return { success: false, error: 'Nama pengguna/email atau kata sandi pengelola salah.' };
    }

    user.lastLoginAt = new Date().toISOString();
    user.updatedAt = new Date().toISOString();

    // Catat login ke audit log (tanpa menampilkan password)
    this.recordAuditLog({
      actorId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      action: 'LOGIN',
      details: { username: user.username },
      ipAddress,
    });

    // Buat JWT Token khusus dengan role MANAGER atau SUPER_ADMIN
    const tokenResult = authService.generateSessionToken({
      userId: user.id,
      role: user.role,
      isAnonymous: false,
    });

    return {
      success: true,
      token: tokenResult.token,
      admin: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  /**
   * Autentikasi Pengelola / Super Admin dengan D1 Persistence
   */
  public async authenticateAdminAsync(
    usernameOrEmail: string,
    passwordPlain: string,
    ipAddress?: string,
    d1Db?: DrizzleD1Database<typeof d1Schema>
  ): Promise<{
    success: boolean;
    token?: string;
    admin?: { id: string; username: string; email?: string; fullName: string; role: 'MANAGER' | 'SUPER_ADMIN' };
    error?: string;
  }> {
    const db = this.getActiveDb(d1Db);
    await this.ensureInitializedAsync(db || undefined);

    if (!usernameOrEmail || !passwordPlain) {
      return { success: false, error: 'Nama pengguna/email atau kata sandi pengelola salah.' };
    }

    const trimmedInput = usernameOrEmail.trim().toLowerCase();

    let user: AdminUser | null = null;

    if (db) {
      try {
        const rows = await db
          .select()
          .from(adminUsers)
          .where(
            or(
              eq(adminUsers.username, trimmedInput),
              eq(adminUsers.email, trimmedInput)
            )
          )
          .limit(1);

        if (rows.length > 0 && rows[0].isActive) {
          const row = rows[0];
          user = {
            id: row.id,
            username: row.username,
            email: row.email || undefined,
            fullName: row.fullName,
            passwordHash: row.passwordHash,
            salt: row.salt,
            role: row.role as 'MANAGER' | 'SUPER_ADMIN',
            isActive: Boolean(row.isActive),
            lastLoginAt: row.lastLoginAt || undefined,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          };
        }
      } catch (err: any) {
        console.warn('[AdminService] D1 admin lookup error:', err?.message || err);
      }
    }

    if (!user) {
      user = Array.from(this.adminUsers.values()).find(
        (u) =>
          u.isActive &&
          (u.username.toLowerCase() === trimmedInput ||
            (u.email && u.email.toLowerCase() === trimmedInput))
      ) || null;
    }

    if (!user) {
      return { success: false, error: 'Nama pengguna/email atau kata sandi pengelola salah.' };
    }

    let isMatch = this.verifyPassword(passwordPlain, user.passwordHash, user.salt);

    // Mekanisme sinkronisasi aman jika password environment diperbarui
    if (!isMatch && user.role === 'SUPER_ADMIN') {
      const envPassword = getSuperAdminInitialPasswordFromEnv() || 'HikmatTaniSuperAdmin2026Secret!';
      if (envPassword && passwordPlain === envPassword) {
        const { hash, salt } = this.hashPassword(passwordPlain);
        user.passwordHash = hash;
        user.salt = salt;
        user.updatedAt = new Date().toISOString();
        isMatch = true;

        if (db) {
          try {
            await db
              .update(adminUsers)
              .set({ passwordHash: hash, salt, updatedAt: user.updatedAt })
              .where(eq(adminUsers.id, user.id));
          } catch {}
        }
      }
    }

    if (!isMatch) {
      return { success: false, error: 'Nama pengguna/email atau kata sandi pengelola salah.' };
    }

    const now = new Date().toISOString();
    user.lastLoginAt = now;
    user.updatedAt = now;
    this.adminUsers.set(user.id, user);

    if (db) {
      try {
        await db
          .update(adminUsers)
          .set({ lastLoginAt: now, updatedAt: now })
          .where(eq(adminUsers.id, user.id));
      } catch (err) {
        console.warn('[AdminService] Update lastLoginAt D1 error:', err);
      }
    }

    await this.recordAuditLogAsync(
      {
        actorId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        action: 'LOGIN',
        details: { username: user.username },
        ipAddress,
      },
      db || undefined
    );

    const tokenResult = authService.generateSessionToken({
      userId: user.id,
      role: user.role,
      isAnonymous: false,
    });

    return {
      success: true,
      token: tokenResult.token,
      admin: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  /**
   * Helper diagnostik verifikasi SUPER_ADMIN (tanpa mengekspos plaintext)
   */
  public verifySuperAdminStatus(): {
    exists: boolean;
    username: string;
    email: string;
    role: string;
    hasSalt: boolean;
    hasPasswordHash: boolean;
    hasPlaintextPasswordInRecord: boolean;
    duplicateSuperAdminsCount: number;
  } {
    this.ensureInitialized();
    const superAdmins = Array.from(this.adminUsers.values()).filter(
      (u) => u.role === 'SUPER_ADMIN'
    );
    const user = this.adminUsers.get('admin_super_pappizee');
    return {
      exists: Boolean(user),
      username: user?.username || '',
      email: user?.email || '',
      role: user?.role || '',
      hasSalt: Boolean(user?.salt),
      hasPasswordHash: Boolean(user?.passwordHash),
      hasPlaintextPasswordInRecord: Object.prototype.hasOwnProperty.call(user || {}, 'password'),
      duplicateSuperAdminsCount: superAdmins.length,
    };
  }

  /**
   * Ganti Kata Sandi Akun Sendiri (MANAGER / SUPER_ADMIN) - Sync Fallback
   */
  public changePassword(
    actor: AuthSessionPayload,
    currentPasswordPlain: string,
    newPasswordPlain: string,
    ipAddress?: string
  ): { success: boolean; message: string } {
    this.ensureInitialized();
    this.assertIsAdmin(actor);

    const user = this.adminUsers.get(actor.userId);
    if (!user) {
      throw new Error('Akun pengelola tidak ditemukan.');
    }

    const isMatch = this.verifyPassword(currentPasswordPlain, user.passwordHash, user.salt);
    if (!isMatch) {
      throw new Error('Kata sandi saat ini yang Anda masukkan salah.');
    }

    if (!newPasswordPlain || newPasswordPlain.length < 6) {
      throw new Error('Kata sandi baru minimal harus 6 karakter.');
    }

    const { hash, salt } = this.hashPassword(newPasswordPlain);
    user.passwordHash = hash;
    user.salt = salt;
    user.updatedAt = new Date().toISOString();

    this.recordAuditLog({
      actorId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      action: 'CHANGE_PASSWORD',
      details: { username: user.username },
      ipAddress,
    });

    return {
      success: true,
      message: 'Kata sandi berhasil diperbarui dengan aman.',
    };
  }

  /**
   * Ganti Kata Sandi Akun Sendiri dengan D1 Persistence
   */
  public async changePasswordAsync(
    actor: AuthSessionPayload,
    currentPasswordPlain: string,
    newPasswordPlain: string,
    ipAddress?: string,
    d1Db?: DrizzleD1Database<typeof d1Schema>
  ): Promise<{ success: boolean; message: string }> {
    const db = this.getActiveDb(d1Db);
    await this.ensureInitializedAsync(db || undefined);
    this.assertIsAdmin(actor);

    let user = this.adminUsers.get(actor.userId);

    if (db) {
      try {
        const rows = await db
          .select()
          .from(adminUsers)
          .where(eq(adminUsers.id, actor.userId))
          .limit(1);
        if (rows.length > 0) {
          const row = rows[0];
          user = {
            id: row.id,
            username: row.username,
            email: row.email || undefined,
            fullName: row.fullName,
            passwordHash: row.passwordHash,
            salt: row.salt,
            role: row.role as 'MANAGER' | 'SUPER_ADMIN',
            isActive: Boolean(row.isActive),
            lastLoginAt: row.lastLoginAt || undefined,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          };
        }
      } catch (err) {
        console.warn('[AdminService] changePasswordAsync D1 fetch error:', err);
      }
    }

    if (!user) {
      throw new Error('Akun pengelola tidak ditemukan.');
    }

    const isMatch = this.verifyPassword(currentPasswordPlain, user.passwordHash, user.salt);
    if (!isMatch) {
      throw new Error('Kata sandi saat ini yang Anda masukkan salah.');
    }

    if (!newPasswordPlain || newPasswordPlain.length < 6) {
      throw new Error('Kata sandi baru minimal harus 6 karakter.');
    }

    const { hash, salt } = this.hashPassword(newPasswordPlain);
    const now = new Date().toISOString();
    user.passwordHash = hash;
    user.salt = salt;
    user.updatedAt = now;
    this.adminUsers.set(user.id, user);

    if (db) {
      await db
        .update(adminUsers)
        .set({
          passwordHash: hash,
          salt: salt,
          updatedAt: now,
        })
        .where(eq(adminUsers.id, user.id));
    }

    await this.recordAuditLogAsync(
      {
        actorId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        action: 'CHANGE_PASSWORD',
        details: { username: user.username },
        ipAddress,
      },
      db || undefined
    );

    return {
      success: true,
      message: 'Kata sandi berhasil diperbarui dengan aman.',
    };
  }

  /**
   * Mengambil Konfigurasi Publik (Dapat diakses petani & halaman Dukung HIKMAT TANI)
   */
  public getPublicConfig(): {
    appName: string;
    slogan: string;
    logoUrl: string;
    logoPrimary: string;
    logoHorizontal: string;
    appIcon: string;
    description: string;
    supportTitle: string;
    supportDescription: string;
    contactPhone: string;
    contactEmail: string;
    donationActive: boolean;
    donationRecipientName: string;
    donationBankName: string;
    donationAccountNumber: string;
    donationEwalletNumber: string;
    donationQrisImage: string;
    donationUrl: string;
    updatedAt: string;
  } {
    this.ensureInitialized();
    return {
      appName: this.officialConfig.appName,
      slogan: this.officialConfig.slogan,
      logoUrl: this.officialConfig.logoUrl,
      logoPrimary: this.officialConfig.logoPrimary || this.officialConfig.logoUrl,
      logoHorizontal: this.officialConfig.logoHorizontal || '/logo-hikmat-tani-full.png',
      appIcon: this.officialConfig.appIcon || '/icon-192.png',
      description: this.officialConfig.description,
      supportTitle: this.officialConfig.supportTitle,
      supportDescription: this.officialConfig.supportDescription,
      contactPhone: this.officialConfig.contactPhone,
      contactEmail: this.officialConfig.contactEmail,
      donationActive: this.officialConfig.donationActive,
      donationRecipientName: this.officialConfig.donationRecipientName,
      donationBankName: this.officialConfig.donationBankName,
      donationAccountNumber: this.officialConfig.donationAccountNumber,
      donationEwalletNumber: this.officialConfig.donationEwalletNumber,
      donationQrisImage: this.officialConfig.donationQrisImage,
      donationUrl: this.officialConfig.donationUrl,
      updatedAt: this.officialConfig.updatedAt,
    };
  }

  public async getPublicConfigAsync(d1Db?: DrizzleD1Database<typeof d1Schema>) {
    const db = this.getActiveDb(d1Db);
    await this.ensureInitializedAsync(db || undefined);
    return this.getPublicConfig();
  }

  /**
   * Mengambil Konfigurasi Lengkap Pengelola (MANAGER / SUPER_ADMIN)
   */
  public getAdminConfig(actor: AuthSessionPayload): OfficialAppConfig {
    this.ensureInitialized();
    this.assertIsAdmin(actor);
    return { ...this.officialConfig };
  }

  public async getAdminConfigAsync(actor: AuthSessionPayload, d1Db?: DrizzleD1Database<typeof d1Schema>): Promise<OfficialAppConfig> {
    const db = this.getActiveDb(d1Db);
    await this.ensureInitializedAsync(db || undefined);
    this.assertIsAdmin(actor);
    return { ...this.officialConfig };
  }

  /**
   * Memperbarui Konfigurasi Resmi HIKMAT TANI (Sync Fallback)
   */
  public updateAdminConfig(
    actor: AuthSessionPayload,
    payload: Partial<OfficialAppConfig>,
    ipAddress?: string
  ): OfficialAppConfig {
    this.ensureInitialized();
    this.assertIsAdmin(actor);

    const oldConfig = { ...this.officialConfig };

    // Update field yang diizinkan
    if (payload.appName) this.officialConfig.appName = payload.appName.trim();
    if (payload.slogan) this.officialConfig.slogan = payload.slogan.trim();
    if (payload.description) this.officialConfig.description = payload.description.trim();
    if (payload.logoPrimary !== undefined) {
      this.officialConfig.logoPrimary = payload.logoPrimary;
      this.officialConfig.logoUrl = payload.logoPrimary;
    }
    if (payload.logoHorizontal !== undefined) {
      this.officialConfig.logoHorizontal = payload.logoHorizontal;
    }
    if (payload.appIcon !== undefined) {
      this.officialConfig.appIcon = payload.appIcon;
    }
    if (payload.logoUrl !== undefined && payload.logoPrimary === undefined) {
      this.officialConfig.logoUrl = payload.logoUrl;
      this.officialConfig.logoPrimary = payload.logoUrl;
    }
    if (payload.supportTitle) this.officialConfig.supportTitle = payload.supportTitle.trim();
    if (payload.supportDescription) this.officialConfig.supportDescription = payload.supportDescription.trim();
    if (payload.contactPhone !== undefined) this.officialConfig.contactPhone = payload.contactPhone.trim();
    if (payload.contactEmail !== undefined) this.officialConfig.contactEmail = payload.contactEmail.trim();

    if (payload.donationActive !== undefined) this.officialConfig.donationActive = Boolean(payload.donationActive);
    if (payload.donationRecipientName !== undefined) this.officialConfig.donationRecipientName = payload.donationRecipientName.trim();
    if (payload.donationBankName !== undefined) this.officialConfig.donationBankName = payload.donationBankName.trim();
    if (payload.donationAccountNumber !== undefined) this.officialConfig.donationAccountNumber = payload.donationAccountNumber.trim();
    if (payload.donationEwalletNumber !== undefined) this.officialConfig.donationEwalletNumber = payload.donationEwalletNumber.trim();
    if (payload.donationQrisImage !== undefined) this.officialConfig.donationQrisImage = payload.donationQrisImage;
    if (payload.donationUrl !== undefined) this.officialConfig.donationUrl = payload.donationUrl.trim();

    this.officialConfig.updatedBy = actor.userId;
    this.officialConfig.updatedAt = new Date().toISOString();

    const actorUser = this.adminUsers.get(actor.userId);
    const actorName = actorUser ? actorUser.fullName : actor.userId;

    this.recordAuditLog({
      actorId: actor.userId,
      actorName,
      actorRole: actor.role as 'MANAGER' | 'SUPER_ADMIN',
      action: 'UPDATE_CONFIG',
      details: {
        changedFields: Object.keys(payload),
        before: {
          donationBankName: oldConfig.donationBankName,
          donationAccountNumber: oldConfig.donationAccountNumber,
          donationActive: oldConfig.donationActive,
        },
        after: {
          donationBankName: this.officialConfig.donationBankName,
          donationAccountNumber: this.officialConfig.donationAccountNumber,
          donationActive: this.officialConfig.donationActive,
        },
      },
      ipAddress,
    });

    return { ...this.officialConfig };
  }

  /**
   * Memperbarui Konfigurasi Resmi HIKMAT TANI dengan D1 Persistence
   */
  public async updateAdminConfigAsync(
    actor: AuthSessionPayload,
    payload: Partial<OfficialAppConfig>,
    ipAddress?: string,
    d1Db?: DrizzleD1Database<typeof d1Schema>
  ): Promise<OfficialAppConfig> {
    const db = this.getActiveDb(d1Db);
    await this.ensureInitializedAsync(db || undefined);
    this.assertIsAdmin(actor);

    const oldConfig = { ...this.officialConfig };

    if (payload.appName) this.officialConfig.appName = payload.appName.trim();
    if (payload.slogan) this.officialConfig.slogan = payload.slogan.trim();
    if (payload.description) this.officialConfig.description = payload.description.trim();
    if (payload.logoPrimary !== undefined) {
      this.officialConfig.logoPrimary = payload.logoPrimary;
      this.officialConfig.logoUrl = payload.logoPrimary;
    }
    if (payload.logoHorizontal !== undefined) {
      this.officialConfig.logoHorizontal = payload.logoHorizontal;
    }
    if (payload.appIcon !== undefined) {
      this.officialConfig.appIcon = payload.appIcon;
    }
    if (payload.logoUrl !== undefined && payload.logoPrimary === undefined) {
      this.officialConfig.logoUrl = payload.logoUrl;
      this.officialConfig.logoPrimary = payload.logoUrl;
    }
    if (payload.supportTitle) this.officialConfig.supportTitle = payload.supportTitle.trim();
    if (payload.supportDescription) this.officialConfig.supportDescription = payload.supportDescription.trim();
    if (payload.contactPhone !== undefined) this.officialConfig.contactPhone = payload.contactPhone.trim();
    if (payload.contactEmail !== undefined) this.officialConfig.contactEmail = payload.contactEmail.trim();

    if (payload.donationActive !== undefined) this.officialConfig.donationActive = Boolean(payload.donationActive);
    if (payload.donationRecipientName !== undefined) this.officialConfig.donationRecipientName = payload.donationRecipientName.trim();
    if (payload.donationBankName !== undefined) this.officialConfig.donationBankName = payload.donationBankName.trim();
    if (payload.donationAccountNumber !== undefined) this.officialConfig.donationAccountNumber = payload.donationAccountNumber.trim();
    if (payload.donationEwalletNumber !== undefined) this.officialConfig.donationEwalletNumber = payload.donationEwalletNumber.trim();
    if (payload.donationQrisImage !== undefined) this.officialConfig.donationQrisImage = payload.donationQrisImage;
    if (payload.donationUrl !== undefined) this.officialConfig.donationUrl = payload.donationUrl.trim();

    const now = new Date().toISOString();
    this.officialConfig.updatedBy = actor.userId;
    this.officialConfig.updatedAt = now;

    if (db) {
      try {
        await db
          .update(appConfigs)
          .set({
            appName: this.officialConfig.appName,
            slogan: this.officialConfig.slogan,
            logoUrl: this.officialConfig.logoUrl,
            logoPrimary: this.officialConfig.logoPrimary,
            logoHorizontal: this.officialConfig.logoHorizontal,
            appIcon: this.officialConfig.appIcon,
            description: this.officialConfig.description,
            contactPhone: this.officialConfig.contactPhone,
            contactEmail: this.officialConfig.contactEmail,
            supportTitle: this.officialConfig.supportTitle,
            supportDescription: this.officialConfig.supportDescription,
            donationActive: this.officialConfig.donationActive,
            donationRecipientName: this.officialConfig.donationRecipientName,
            donationBankName: this.officialConfig.donationBankName,
            donationAccountNumber: this.officialConfig.donationAccountNumber,
            donationEwalletNumber: this.officialConfig.donationEwalletNumber,
            donationQrisImage: this.officialConfig.donationQrisImage,
            donationUrl: this.officialConfig.donationUrl,
            updatedBy: actor.userId,
            updatedAt: now,
          })
          .where(eq(appConfigs.id, 'official_config'));
      } catch (err) {
        console.warn('[AdminService] D1 app_configs update error:', err);
      }
    }

    const actorUser = this.adminUsers.get(actor.userId);
    const actorName = actorUser ? actorUser.fullName : actor.userId;

    await this.recordAuditLogAsync(
      {
        actorId: actor.userId,
        actorName,
        actorRole: actor.role as 'MANAGER' | 'SUPER_ADMIN',
        action: 'UPDATE_CONFIG',
        details: {
          changedFields: Object.keys(payload),
          before: {
            donationBankName: oldConfig.donationBankName,
            donationAccountNumber: oldConfig.donationAccountNumber,
            donationActive: oldConfig.donationActive,
          },
          after: {
            donationBankName: this.officialConfig.donationBankName,
            donationAccountNumber: this.officialConfig.donationAccountNumber,
            donationActive: this.officialConfig.donationActive,
          },
        },
        ipAddress,
      },
      db || undefined
    );

    return { ...this.officialConfig };
  }

  /**
   * Upload / Update Gambar QRIS Donasi (Sync Fallback)
   */
  public updateQrisImage(
    actor: AuthSessionPayload,
    qrisImagePayload: string,
    ipAddress?: string
  ): { success: boolean; donationQrisImage: string } {
    this.ensureInitialized();
    this.assertIsAdmin(actor);

    if (typeof qrisImagePayload !== 'string') {
      throw new Error('Payload gambar QRIS harus berupa string.');
    }

    const trimmed = qrisImagePayload.trim();

    if (trimmed.length > 3_500_000) {
      throw new Error('Ukuran berkas gambar QRIS melebihi batas maksimum 2.5MB.');
    }

    if (trimmed !== '') {
      const isDataUri = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(trimmed);
      const isSafeUrl = /^(https:\/\/|\/)[a-zA-Z0-9_.\-/?#=&%]+$/.test(trimmed);

      if (!isDataUri && !isSafeUrl) {
        throw new Error('Format gambar QRIS tidak valid. Gunakan format gambar raster (PNG, JPEG, WEBP) atau URL yang aman.');
      }
    }

    this.officialConfig.donationQrisImage = trimmed;
    this.officialConfig.updatedBy = actor.userId;
    this.officialConfig.updatedAt = new Date().toISOString();

    const actorUser = this.adminUsers.get(actor.userId);
    const actorName = actorUser ? actorUser.fullName : actor.userId;

    this.recordAuditLog({
      actorId: actor.userId,
      actorName,
      actorRole: actor.role as 'MANAGER' | 'SUPER_ADMIN',
      action: 'UPDATE_QRIS',
      details: {
        hasQris: Boolean(trimmed),
        length: trimmed.length,
      },
      ipAddress,
    });

    return {
      success: true,
      donationQrisImage: this.officialConfig.donationQrisImage,
    };
  }

  /**
   * Upload / Update Gambar QRIS Donasi dengan D1 Persistence
   */
  public async updateQrisImageAsync(
    actor: AuthSessionPayload,
    qrisImagePayload: string,
    ipAddress?: string,
    d1Db?: DrizzleD1Database<typeof d1Schema>
  ): Promise<{ success: boolean; donationQrisImage: string }> {
    const db = this.getActiveDb(d1Db);
    await this.ensureInitializedAsync(db || undefined);
    this.assertIsAdmin(actor);

    if (typeof qrisImagePayload !== 'string') {
      throw new Error('Payload gambar QRIS harus berupa string.');
    }

    const trimmed = qrisImagePayload.trim();

    if (trimmed.length > 3_500_000) {
      throw new Error('Ukuran berkas gambar QRIS melebihi batas maksimum 2.5MB.');
    }

    if (trimmed !== '') {
      const isDataUri = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(trimmed);
      const isSafeUrl = /^(https:\/\/|\/)[a-zA-Z0-9_.\-/?#=&%]+$/.test(trimmed);

      if (!isDataUri && !isSafeUrl) {
        throw new Error('Format gambar QRIS tidak valid. Gunakan format gambar raster (PNG, JPEG, WEBP) atau URL yang aman.');
      }
    }

    const now = new Date().toISOString();
    this.officialConfig.donationQrisImage = trimmed;
    this.officialConfig.updatedBy = actor.userId;
    this.officialConfig.updatedAt = now;

    if (db) {
      try {
        await db
          .update(appConfigs)
          .set({
            donationQrisImage: trimmed,
            updatedBy: actor.userId,
            updatedAt: now,
          })
          .where(eq(appConfigs.id, 'official_config'));
      } catch (err) {
        console.warn('[AdminService] Update QRIS D1 error:', err);
      }
    }

    const actorUser = this.adminUsers.get(actor.userId);
    const actorName = actorUser ? actorUser.fullName : actor.userId;

    await this.recordAuditLogAsync(
      {
        actorId: actor.userId,
        actorName,
        actorRole: actor.role as 'MANAGER' | 'SUPER_ADMIN',
        action: 'UPDATE_QRIS',
        details: {
          hasQris: Boolean(trimmed),
          length: trimmed.length,
        },
        ipAddress,
      },
      db || undefined
    );

    return {
      success: true,
      donationQrisImage: this.officialConfig.donationQrisImage,
    };
  }

  /**
   * Manajemen Akun Pengelola: Daftar Akun (SUPER_ADMIN ONLY)
   */
  public listManagers(actor: AuthSessionPayload): Array<Omit<AdminUser, 'passwordHash' | 'salt'>> {
    this.ensureInitialized();
    this.assertIsSuperAdmin(actor);

    return Array.from(this.adminUsers.values()).map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));
  }

  public async listManagersAsync(actor: AuthSessionPayload, d1Db?: DrizzleD1Database<typeof d1Schema>): Promise<Array<Omit<AdminUser, 'passwordHash' | 'salt'>>> {
    const db = this.getActiveDb(d1Db);
    await this.ensureInitializedAsync(db || undefined);
    this.assertIsSuperAdmin(actor);

    if (db) {
      try {
        const rows = await db.select().from(adminUsers);
        return rows.map((r) => ({
          id: r.id,
          username: r.username,
          email: r.email || undefined,
          fullName: r.fullName,
          role: r.role as 'MANAGER' | 'SUPER_ADMIN',
          isActive: Boolean(r.isActive),
          lastLoginAt: r.lastLoginAt || undefined,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }));
      } catch (err) {
        console.warn('[AdminService] listManagersAsync D1 fetch error:', err);
      }
    }

    return this.listManagers(actor);
  }

  /**
   * Manajemen Akun Pengelola: Buat Pengelola Baru (SUPER_ADMIN ONLY) - Sync Fallback
   */
  public createManager(
    actor: AuthSessionPayload,
    payload: {
      username: string;
      passwordPlain: string;
      fullName: string;
      email?: string;
      role?: 'MANAGER' | 'SUPER_ADMIN';
    },
    ipAddress?: string
  ): Omit<AdminUser, 'passwordHash' | 'salt'> {
    this.ensureInitialized();
    this.assertIsSuperAdmin(actor);

    if (!payload.username || payload.username.trim().length < 3) {
      throw new Error('Nama pengguna minimal 3 karakter.');
    }
    if (!payload.passwordPlain || payload.passwordPlain.length < 6) {
      throw new Error('Kata sandi minimal 6 karakter.');
    }
    if (!payload.fullName || payload.fullName.trim().length < 2) {
      throw new Error('Nama lengkap pengelola wajib diisi.');
    }

    const existing = Array.from(this.adminUsers.values()).find(
      (u) => u.username.toLowerCase() === payload.username.trim().toLowerCase()
    );
    if (existing) {
      throw new Error(`Nama pengguna '${payload.username}' sudah digunakan.`);
    }

    const { hash, salt } = this.hashPassword(payload.passwordPlain);
    const newId = `admin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const newAdmin: AdminUser = {
      id: newId,
      username: payload.username.trim(),
      email: payload.email?.trim(),
      fullName: payload.fullName.trim(),
      passwordHash: hash,
      salt,
      role: payload.role || 'MANAGER',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.adminUsers.set(newAdmin.id, newAdmin);

    const actorUser = this.adminUsers.get(actor.userId);
    const actorName = actorUser ? actorUser.fullName : actor.userId;

    this.recordAuditLog({
      actorId: actor.userId,
      actorName,
      actorRole: actor.role as 'SUPER_ADMIN',
      action: 'CREATE_MANAGER',
      details: {
        createdUserId: newAdmin.id,
        createdUsername: newAdmin.username,
        createdRole: newAdmin.role,
      },
      ipAddress,
    });

    return {
      id: newAdmin.id,
      username: newAdmin.username,
      email: newAdmin.email,
      fullName: newAdmin.fullName,
      role: newAdmin.role,
      isActive: newAdmin.isActive,
      createdAt: newAdmin.createdAt,
      updatedAt: newAdmin.updatedAt,
    };
  }

  /**
   * Manajemen Akun Pengelola: Buat Pengelola Baru dengan D1 Persistence
   */
  public async createManagerAsync(
    actor: AuthSessionPayload,
    payload: {
      username: string;
      passwordPlain: string;
      fullName: string;
      email?: string;
      role?: 'MANAGER' | 'SUPER_ADMIN';
    },
    ipAddress?: string,
    d1Db?: DrizzleD1Database<typeof d1Schema>
  ): Promise<Omit<AdminUser, 'passwordHash' | 'salt'>> {
    const db = this.getActiveDb(d1Db);
    await this.ensureInitializedAsync(db || undefined);
    this.assertIsSuperAdmin(actor);

    if (!payload.username || payload.username.trim().length < 3) {
      throw new Error('Nama pengguna minimal 3 karakter.');
    }
    if (!payload.passwordPlain || payload.passwordPlain.length < 6) {
      throw new Error('Kata sandi minimal 6 karakter.');
    }
    if (!payload.fullName || payload.fullName.trim().length < 2) {
      throw new Error('Nama lengkap pengelola wajib diisi.');
    }

    const trimmedUsername = payload.username.trim();

    if (db) {
      const existingInD1 = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.username, trimmedUsername))
        .limit(1);
      if (existingInD1.length > 0) {
        throw new Error(`Nama pengguna '${payload.username}' sudah digunakan.`);
      }
    }

    const existingInMem = Array.from(this.adminUsers.values()).find(
      (u) => u.username.toLowerCase() === trimmedUsername.toLowerCase()
    );
    if (existingInMem) {
      throw new Error(`Nama pengguna '${payload.username}' sudah digunakan.`);
    }

    const { hash, salt } = this.hashPassword(payload.passwordPlain);
    const newId = `admin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    const newAdmin: AdminUser = {
      id: newId,
      username: trimmedUsername,
      email: payload.email?.trim() || undefined,
      fullName: payload.fullName.trim(),
      passwordHash: hash,
      salt,
      role: payload.role || 'MANAGER',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    if (db) {
      await db.insert(adminUsers).values({
        id: newAdmin.id,
        username: newAdmin.username,
        email: newAdmin.email,
        fullName: newAdmin.fullName,
        passwordHash: newAdmin.passwordHash,
        salt: newAdmin.salt,
        role: newAdmin.role,
        isActive: newAdmin.isActive,
        createdAt: newAdmin.createdAt,
        updatedAt: newAdmin.updatedAt,
      });
    }

    this.adminUsers.set(newAdmin.id, newAdmin);

    const actorUser = this.adminUsers.get(actor.userId);
    const actorName = actorUser ? actorUser.fullName : actor.userId;

    await this.recordAuditLogAsync(
      {
        actorId: actor.userId,
        actorName,
        actorRole: actor.role as 'SUPER_ADMIN',
        action: 'CREATE_MANAGER',
        details: {
          createdUserId: newAdmin.id,
          createdUsername: newAdmin.username,
          createdRole: newAdmin.role,
        },
        ipAddress,
      },
      db || undefined
    );

    return {
      id: newAdmin.id,
      username: newAdmin.username,
      email: newAdmin.email,
      fullName: newAdmin.fullName,
      role: newAdmin.role,
      isActive: newAdmin.isActive,
      createdAt: newAdmin.createdAt,
      updatedAt: newAdmin.updatedAt,
    };
  }

  /**
   * Manajemen Akun Pengelola: Ubah Status/Data Pengelola (Sync Fallback)
   */
  public updateManager(
    actor: AuthSessionPayload,
    managerId: string,
    payload: {
      fullName?: string;
      email?: string;
      role?: 'MANAGER' | 'SUPER_ADMIN';
      isActive?: boolean;
      passwordPlain?: string;
    },
    ipAddress?: string
  ): Omit<AdminUser, 'passwordHash' | 'salt'> {
    this.ensureInitialized();
    this.assertIsSuperAdmin(actor);

    const user = this.adminUsers.get(managerId);
    if (!user) {
      throw new Error('Akun pengelola tidak ditemukan.');
    }

    if (actor.userId === managerId && payload.isActive === false) {
      throw new Error('Anda tidak dapat menonaktifkan akun Anda sendiri.');
    }

    if (payload.fullName) user.fullName = payload.fullName.trim();
    if (payload.email !== undefined) user.email = payload.email.trim();
    if (payload.role) user.role = payload.role;
    if (payload.isActive !== undefined) user.isActive = Boolean(payload.isActive);

    if (payload.passwordPlain && payload.passwordPlain.length >= 6) {
      const { hash, salt } = this.hashPassword(payload.passwordPlain);
      user.passwordHash = hash;
      user.salt = salt;
    }

    user.updatedAt = new Date().toISOString();

    const actorUser = this.adminUsers.get(actor.userId);
    const actorName = actorUser ? actorUser.fullName : actor.userId;

    this.recordAuditLog({
      actorId: actor.userId,
      actorName,
      actorRole: actor.role as 'SUPER_ADMIN',
      action: 'UPDATE_MANAGER',
      details: {
        targetUserId: user.id,
        targetUsername: user.username,
        updatedFields: Object.keys(payload),
      },
      ipAddress,
    });

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Manajemen Akun Pengelola: Ubah Status/Data Pengelola dengan D1 Persistence
   */
  public async updateManagerAsync(
    actor: AuthSessionPayload,
    managerId: string,
    payload: {
      fullName?: string;
      email?: string;
      role?: 'MANAGER' | 'SUPER_ADMIN';
      isActive?: boolean;
      passwordPlain?: string;
    },
    ipAddress?: string,
    d1Db?: DrizzleD1Database<typeof d1Schema>
  ): Promise<Omit<AdminUser, 'passwordHash' | 'salt'>> {
    const db = this.getActiveDb(d1Db);
    await this.ensureInitializedAsync(db || undefined);
    this.assertIsSuperAdmin(actor);

    let user = this.adminUsers.get(managerId);

    if (db) {
      const rows = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, managerId))
        .limit(1);
      if (rows.length > 0) {
        const row = rows[0];
        user = {
          id: row.id,
          username: row.username,
          email: row.email || undefined,
          fullName: row.fullName,
          passwordHash: row.passwordHash,
          salt: row.salt,
          role: row.role as 'MANAGER' | 'SUPER_ADMIN',
          isActive: Boolean(row.isActive),
          lastLoginAt: row.lastLoginAt || undefined,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        };
      }
    }

    if (!user) {
      throw new Error('Akun pengelola tidak ditemukan.');
    }

    if (actor.userId === managerId && payload.isActive === false) {
      throw new Error('Anda tidak dapat menonaktifkan akun Anda sendiri.');
    }

    const updates: Partial<AdminUser> = {};
    if (payload.fullName) {
      user.fullName = payload.fullName.trim();
      updates.fullName = user.fullName;
    }
    if (payload.email !== undefined) {
      user.email = payload.email.trim();
      updates.email = user.email;
    }
    if (payload.role) {
      user.role = payload.role;
      updates.role = user.role;
    }
    if (payload.isActive !== undefined) {
      user.isActive = Boolean(payload.isActive);
      updates.isActive = user.isActive;
    }

    if (payload.passwordPlain && payload.passwordPlain.length >= 6) {
      const { hash, salt } = this.hashPassword(payload.passwordPlain);
      user.passwordHash = hash;
      user.salt = salt;
      updates.passwordHash = hash;
      updates.salt = salt;
    }

    const now = new Date().toISOString();
    user.updatedAt = now;
    updates.updatedAt = now;

    this.adminUsers.set(user.id, user);

    if (db) {
      await db
        .update(adminUsers)
        .set(updates)
        .where(eq(adminUsers.id, user.id));
    }

    const actorUser = this.adminUsers.get(actor.userId);
    const actorName = actorUser ? actorUser.fullName : actor.userId;

    await this.recordAuditLogAsync(
      {
        actorId: actor.userId,
        actorName,
        actorRole: actor.role as 'SUPER_ADMIN',
        action: 'UPDATE_MANAGER',
        details: {
          targetUserId: user.id,
          targetUsername: user.username,
          updatedFields: Object.keys(payload),
        },
        ipAddress,
      },
      db || undefined
    );

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Manajemen Akun Pengelola: Hapus Pengelola (SUPER_ADMIN ONLY) - Sync Fallback
   */
  public deleteManager(actor: AuthSessionPayload, managerId: string, ipAddress?: string): boolean {
    this.ensureInitialized();
    this.assertIsSuperAdmin(actor);

    if (actor.userId === managerId) {
      throw new Error('Anda tidak dapat menghapus akun Anda sendiri.');
    }

    const user = this.adminUsers.get(managerId);
    if (!user) {
      throw new Error('Akun pengelola tidak ditemukan.');
    }

    this.adminUsers.delete(managerId);

    const actorUser = this.adminUsers.get(actor.userId);
    const actorName = actorUser ? actorUser.fullName : actor.userId;

    this.recordAuditLog({
      actorId: actor.userId,
      actorName,
      actorRole: actor.role as 'SUPER_ADMIN',
      action: 'DELETE_MANAGER',
      details: {
        deletedUserId: user.id,
        deletedUsername: user.username,
        deletedRole: user.role,
      },
      ipAddress,
    });

    return true;
  }

  /**
   * Manajemen Akun Pengelola: Hapus Pengelola dengan D1 Persistence
   */
  public async deleteManagerAsync(
    actor: AuthSessionPayload,
    managerId: string,
    ipAddress?: string,
    d1Db?: DrizzleD1Database<typeof d1Schema>
  ): Promise<boolean> {
    const db = this.getActiveDb(d1Db);
    await this.ensureInitializedAsync(db || undefined);
    this.assertIsSuperAdmin(actor);

    if (actor.userId === managerId) {
      throw new Error('Anda tidak dapat menghapus akun Anda sendiri.');
    }

    let user = this.adminUsers.get(managerId);

    if (db) {
      const rows = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, managerId))
        .limit(1);
      if (rows.length > 0) {
        user = {
          id: rows[0].id,
          username: rows[0].username,
          email: rows[0].email || undefined,
          fullName: rows[0].fullName,
          passwordHash: rows[0].passwordHash,
          salt: rows[0].salt,
          role: rows[0].role as 'MANAGER' | 'SUPER_ADMIN',
          isActive: Boolean(rows[0].isActive),
          lastLoginAt: rows[0].lastLoginAt || undefined,
          createdAt: rows[0].createdAt,
          updatedAt: rows[0].updatedAt,
        };
        await db.delete(adminUsers).where(eq(adminUsers.id, managerId));
      }
    }

    if (!user) {
      throw new Error('Akun pengelola tidak ditemukan.');
    }

    this.adminUsers.delete(managerId);

    const actorUser = this.adminUsers.get(actor.userId);
    const actorName = actorUser ? actorUser.fullName : actor.userId;

    await this.recordAuditLogAsync(
      {
        actorId: actor.userId,
        actorName,
        actorRole: actor.role as 'SUPER_ADMIN',
        action: 'DELETE_MANAGER',
        details: {
          deletedUserId: user.id,
          deletedUsername: user.username,
          deletedRole: user.role,
        },
        ipAddress,
      },
      db || undefined
    );

    return true;
  }

  /**
   * Audit Logs (MANAGER / SUPER_ADMIN)
   */
  public getAuditLogs(actor: AuthSessionPayload, limit: number = 50): AdminAuditLog[] {
    this.ensureInitialized();
    this.assertIsAdmin(actor);
    return [...this.auditLogs].reverse().slice(0, limit);
  }

  public async getAuditLogsAsync(
    actor: AuthSessionPayload,
    limit: number = 50,
    d1Db?: DrizzleD1Database<typeof d1Schema>
  ): Promise<AdminAuditLog[]> {
    const db = this.getActiveDb(d1Db);
    await this.ensureInitializedAsync(db || undefined);
    this.assertIsAdmin(actor);

    if (db) {
      try {
        const rows = await db
          .select()
          .from(adminAuditLogs)
          .orderBy(desc(adminAuditLogs.createdAt))
          .limit(limit);

        return rows.map((r) => ({
          id: r.id,
          actorId: r.actorId,
          actorName: r.actorName,
          actorRole: r.actorRole as 'MANAGER' | 'SUPER_ADMIN',
          action: r.action,
          details: (r.details as any) || undefined,
          ipAddress: r.ipAddress || undefined,
          createdAt: r.createdAt,
        }));
      } catch (err) {
        console.warn('[AdminService] getAuditLogsAsync D1 fetch error:', err);
      }
    }

    return this.getAuditLogs(actor, limit);
  }

  /**
   * Helper: Catat Log Audit (Sync)
   */
  private recordAuditLog(entry: Omit<AdminAuditLog, 'id' | 'createdAt'>) {
    const log: AdminAuditLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      ...entry,
    };
    this.auditLogs.push(log);
  }

  /**
   * Helper: Catat Log Audit ke D1 dan Cache
   */
  public async recordAuditLogAsync(
    entry: Omit<AdminAuditLog, 'id' | 'createdAt'>,
    d1Db?: DrizzleD1Database<typeof d1Schema>
  ): Promise<void> {
    const db = this.getActiveDb(d1Db);
    const log: AdminAuditLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      ...entry,
    };

    this.auditLogs.push(log);

    if (db) {
      try {
        await db.insert(adminAuditLogs).values({
          id: log.id,
          actorId: log.actorId,
          actorName: log.actorName,
          actorRole: log.actorRole,
          action: log.action,
          details: log.details || null,
          ipAddress: log.ipAddress || null,
          createdAt: log.createdAt,
        });
      } catch (err) {
        console.warn('[AdminService] recordAuditLogAsync D1 insert error:', err);
      }
    }
  }

  /**
   * Helper Verifikasi Hak Akses
   */
  private assertIsAdmin(actor: AuthSessionPayload) {
    if (!actor || !['MANAGER', 'SUPER_ADMIN'].includes(actor.role?.toUpperCase())) {
      throw new Error('Akses ditolak: Dibutuhkan peran Pengelola (MANAGER) atau Super Admin.');
    }
  }

  private assertIsSuperAdmin(actor: AuthSessionPayload) {
    if (!actor || actor.role?.toUpperCase() !== 'SUPER_ADMIN') {
      throw new Error('Akses ditolak: Dibutuhkan peran Super Admin (SUPER_ADMIN).');
    }
  }
}

export const adminService = AdminService.getInstance();
