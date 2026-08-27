/**
 * HIKMAT TANI - Role & Admin Management Service (Langkah 15)
 * 
 * Prinsip:
 * 1. Role terpisah: FARMER (default/petani), MANAGER (pengelola), SUPER_ADMIN (admin utama).
 * 2. Autentikasi dan otorisasi terverifikasi di server.
 * 3. Tidak menanam data sensitif/kredensial di bundle frontend.
 * 4. Konfigurasi resmi aplikasi (rekening, kontak, QRIS, status donasi) dapat dikelola secara dinamis.
 * 5. Setiap perubahan konfigurasi dan manajemen pengelola dicatat dalam audit log.
 */

import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';
import { authService, AuthSessionPayload } from './authService.ts';

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

  // In-memory store (memastikan ketersediaan instan & fallback aman)
  private adminUsers: Map<string, AdminUser> = new Map();
  private auditLogs: AdminAuditLog[] = [];
  private officialConfig: OfficialAppConfig;

  private constructor() {
    // 1. Inisialisasi default official config
    this.officialConfig = {
      appName: 'HIKMAT TANI',
      slogan: 'CERDAS BERTANI, BIJAK MENGAMBIL KEPUTUSAN.',
      logoUrl: '/logo-hikmat-tani-1024.png',
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
      donationQrisImage: '', // Siap diisi via upload pengelola
      donationUrl: '',
      updatedBy: 'system',
      updatedAt: new Date().toISOString(),
    };

    // 2. Inisialisasi akun Super Admin default & manager
    this.seedDefaultAdmin();
  }

  public static getInstance(): AdminService {
    if (!AdminService.instance) {
      AdminService.instance = new AdminService();
    }
    return AdminService.instance;
  }

  /**
   * Helper Keamanan: Hash Password dengan PBKDF2 (HMAC-SHA512)
   */
  public hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    const useSalt = salt || crypto.randomBytes(16).toString('hex');
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
        const { hash, salt } = this.hashPassword(envPassword, existing.salt || crypto.randomBytes(16).toString('hex'));
        existing.passwordHash = hash;
        existing.salt = salt;
        existing.updatedAt = new Date().toISOString();
      }
      return;
    }

    // Buat akun Super Admin tunggal
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = envPassword
      ? this.hashPassword(envPassword, salt).hash
      : this.hashPassword('SuperPappizeeFallbackSecret2026!', salt).hash;

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
   * Seed Super Admin & Manager awal secara aman
   * Akun Utama: pappizee (hikmat.rm1192@gmail.com) sebagai SUPER_ADMIN
   */
  private seedDefaultAdmin() {
    this.reprovisionSuperAdminPassword();

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

  /**
   * Autentikasi Pengelola / Super Admin (Bisa menggunakan Username ATAU Email)
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
      const envPassword = getSuperAdminInitialPasswordFromEnv();
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
   * Ganti Kata Sandi Akun Sendiri (MANAGER / SUPER_ADMIN)
   */
  public changePassword(
    actor: AuthSessionPayload,
    currentPasswordPlain: string,
    newPasswordPlain: string,
    ipAddress?: string
  ): { success: boolean; message: string } {
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
   * Mengambil Konfigurasi Publik (Dapat diakses petani & halaman Dukung HIKMAT TANI)
   */
  public getPublicConfig(): {
    appName: string;
    slogan: string;
    logoUrl: string;
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
    return {
      appName: this.officialConfig.appName,
      slogan: this.officialConfig.slogan,
      logoUrl: this.officialConfig.logoUrl,
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

  /**
   * Mengambil Konfigurasi Lengkap Pengelola (MANAGER / SUPER_ADMIN)
   */
  public getAdminConfig(actor: AuthSessionPayload): OfficialAppConfig {
    this.assertIsAdmin(actor);
    return { ...this.officialConfig };
  }

  /**
   * Memperbarui Konfigurasi Resmi HIKMAT TANI (MANAGER / SUPER_ADMIN)
   */
  public updateAdminConfig(
    actor: AuthSessionPayload,
    payload: Partial<OfficialAppConfig>,
    ipAddress?: string
  ): OfficialAppConfig {
    this.assertIsAdmin(actor);

    const oldConfig = { ...this.officialConfig };

    // Update field yang diizinkan
    if (payload.appName) this.officialConfig.appName = payload.appName.trim();
    if (payload.slogan) this.officialConfig.slogan = payload.slogan.trim();
    if (payload.description) this.officialConfig.description = payload.description.trim();
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
   * Upload / Update Gambar QRIS Donasi
   */
  public updateQrisImage(
    actor: AuthSessionPayload,
    qrisImagePayload: string,
    ipAddress?: string
  ): { success: boolean; donationQrisImage: string } {
    this.assertIsAdmin(actor);

    if (typeof qrisImagePayload !== 'string') {
      throw new Error('Payload gambar QRIS harus berupa string.');
    }

    const trimmed = qrisImagePayload.trim();

    // Validasi ukuran maksimum (2.5 MB base64 string ~ 3.5MB karakter)
    if (trimmed.length > 3_500_000) {
      throw new Error('Ukuran berkas gambar QRIS melebihi batas maksimum 2.5MB.');
    }

    // Validasi format: boleh kosong (reset), data URI gambar raster aman (PNG, JPEG, WEBP), atau URL aman
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
   * Manajemen Akun Pengelola: Daftar Akun (SUPER_ADMIN ONLY)
   */
  public listManagers(actor: AuthSessionPayload): Array<Omit<AdminUser, 'passwordHash' | 'salt'>> {
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

  /**
   * Manajemen Akun Pengelola: Buat Pengelola Baru (SUPER_ADMIN ONLY)
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
   * Manajemen Akun Pengelola: Ubah Status/Data Pengelola (SUPER_ADMIN ONLY)
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
    this.assertIsSuperAdmin(actor);

    const user = this.adminUsers.get(managerId);
    if (!user) {
      throw new Error('Akun pengelola tidak ditemukan.');
    }

    // Jangan izinkan menonaktifkan akun sendiri jika superadmin
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
   * Manajemen Akun Pengelola: Hapus Pengelola (SUPER_ADMIN ONLY)
   */
  public deleteManager(actor: AuthSessionPayload, managerId: string, ipAddress?: string): boolean {
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
   * Audit Logs (MANAGER / SUPER_ADMIN)
   */
  public getAuditLogs(actor: AuthSessionPayload, limit: number = 50): AdminAuditLog[] {
    this.assertIsAdmin(actor);
    return [...this.auditLogs].reverse().slice(0, limit);
  }

  /**
   * Helper: Catat Log Audit
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
