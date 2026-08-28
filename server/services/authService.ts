/**
 * HIKMAT TANI - Farmer Authentication & Identity Service
 * 
 * Prinsip:
 * 1. Identitas Petani adalah WAJIB: Tanpa sesi valid, akses ditolak.
 * 2. NIK KTP (16 digit) divalidasi & unik (bukan password).
 * 3. Kredensial PIN di-hash menggunakan PBKDF2 + cryptographically secure salt (tidak pernah plaintext).
 * 4. farmerId adalah identitas internal sistem yang ditentukan oleh server, BUKAN oleh client.
 * 5. Isolasi penuh antar petani: Sesi mengikat identitas userId dan farmerId secara immutable di JWT.
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.ts';

export interface AuthSessionPayload {
  userId: string;
  role: string;
  isAnonymous: boolean;
  farmerId: string;
  name?: string;
  phoneNumber?: string;
  issuedAt: number;
}

export interface RegisterFarmerParams {
  name: string;
  nik: string;
  phoneNumber: string;
  pin: string;
  village?: string;
  district?: string;
  regency?: string;
  province?: string;
  farmerGroupName?: string;
}

export interface LoginFarmerParams {
  identifier: string; // NIK atau Nomor HP
  pin: string;
}

export interface StoredFarmerAccount {
  id: string; // internal farmerId: farmer_xxx
  authUserId: string; // internal userId: usr_xxx
  name: string;
  nik: string;
  phoneNumber: string;
  pinHash: string;
  salt: string;
  role: string;
  village?: string;
  district?: string;
  regency?: string;
  province?: string;
  farmerGroupName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SanitizedFarmerProfile {
  id: string;
  name: string;
  nikMasked: string;
  phoneNumber: string;
  village?: string;
  district?: string;
  regency?: string;
  province?: string;
  farmerGroupName?: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export class AuthService {
  private static instance: AuthService;

  // In-Memory store untuk identitas petani terdaftar
  private farmersStore = new Map<string, StoredFarmerAccount>(); // keyed by farmerId
  private nikIndex = new Map<string, string>(); // nik -> farmerId
  private phoneIndex = new Map<string, string>(); // phoneNumber -> farmerId
  private userIndex = new Map<string, string>(); // authUserId -> farmerId

  private constructor() {
    this.seedDefaultAccounts();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Helper: Hash PIN menggunakan PBKDF2 dengan salt unik
   */
  public hashPin(pin: string, salt: string): string {
    return crypto.pbkdf2Sync(pin, salt, 10000, 64, 'sha512').toString('hex');
  }

  /**
   * Helper: Generate salt acak
   */
  public generateSalt(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Validasi Format NIK (16 digit angka)
   */
  public validateNik(nik: string): { isValid: boolean; message?: string } {
    if (!nik || typeof nik !== 'string') {
      return { isValid: false, message: 'NIK wajib diisi' };
    }
    const cleanNik = nik.trim();
    if (!/^\d{16}$/.test(cleanNik)) {
      return { isValid: false, message: 'NIK harus terdiri dari tepat 16 digit angka' };
    }
    return { isValid: true };
  }

  /**
   * Validasi Format Nomor Telepon (minimal 9 digit, maksimal 15 digit angka)
   */
  public validatePhone(phone: string): { isValid: boolean; message?: string; normalized?: string } {
    if (!phone || typeof phone !== 'string') {
      return { isValid: false, message: 'Nomor HP wajib diisi' };
    }
    const clean = phone.replace(/[\s-]/g, '');
    if (!/^(?:\+62|62|0)8[1-9][0-9]{6,11}$/.test(clean)) {
      return { isValid: false, message: 'Nomor HP tidak valid. Gunakan format contoh: 081234567890' };
    }
    return { isValid: true, normalized: clean };
  }

  /**
   * Validasi Format PIN (6 digit angka)
   */
  public validatePin(pin: string): { isValid: boolean; message?: string } {
    if (!pin || typeof pin !== 'string') {
      return { isValid: false, message: 'PIN keamanan wajib diisi' };
    }
    if (!/^\d{6}$/.test(pin.trim())) {
      return { isValid: false, message: 'PIN harus terdiri dari 6 digit angka' };
    }
    return { isValid: true };
  }

  /**
   * Mask NIK untuk tampilan aman (misal 3210********0001)
   */
  public maskNik(nik: string): string {
    if (!nik || nik.length < 8) return '****';
    return `${nik.slice(0, 4)}********${nik.slice(-4)}`;
  }

  /**
   * Seed akun default awal untuk pengujian
   */
  private seedDefaultAccounts(): void {
    const saltA = this.generateSalt();
    const pinHashA = this.hashPin('123456', saltA);
    const farmerA: StoredFarmerAccount = {
      id: 'farmer_sutrisno',
      authUserId: 'usr_sutrisno',
      name: 'Pak Sutrisno',
      nik: '3210010101750001',
      phoneNumber: '081234567890',
      pinHash: pinHashA,
      salt: saltA,
      role: 'farmer',
      village: 'Sukamaju',
      district: 'Kasokandel',
      regency: 'Majalengka',
      province: 'Jawa Barat',
      farmerGroupName: 'Kelompok Tani Sri Rejeki',
      createdAt: '2026-08-01T08:00:00.000Z',
      updatedAt: '2026-08-01T08:00:00.000Z',
    };
    this.saveAccount(farmerA);
  }

  private saveAccount(account: StoredFarmerAccount): void {
    this.farmersStore.set(account.id, account);
    this.nikIndex.set(account.nik, account.id);
    this.phoneIndex.set(account.phoneNumber.replace(/[\s-]/g, ''), account.id);
    this.userIndex.set(account.authUserId, account.id);
  }

  /**
   * Reset store kembali ke default seed (untuk test suite)
   */
  public resetStore(): void {
    this.farmersStore.clear();
    this.nikIndex.clear();
    this.phoneIndex.clear();
    this.userIndex.clear();
    this.seedDefaultAccounts();
  }

  /**
   * Registrasi Identitas Petani Baru
   */
  public registerFarmer(params: RegisterFarmerParams): {
    success: boolean;
    token: string;
    user: { id: string; role: string; isAnonymous: boolean };
    farmer: SanitizedFarmerProfile;
  } {
    // 1. Validasi Nama
    if (!params.name || params.name.trim().length < 2) {
      throw { statusCode: 400, code: 'INVALID_NAME', message: 'Nama lengkap minimal 2 karakter' };
    }

    // 2. Validasi NIK
    const nikCheck = this.validateNik(params.nik);
    if (!nikCheck.isValid) {
      throw { statusCode: 400, code: 'INVALID_NIK', message: nikCheck.message };
    }
    const cleanNik = params.nik.trim();

    // 3. Validasi Nomor HP
    const phoneCheck = this.validatePhone(params.phoneNumber);
    if (!phoneCheck.isValid || !phoneCheck.normalized) {
      throw { statusCode: 400, code: 'INVALID_PHONE', message: phoneCheck.message };
    }
    const cleanPhone = phoneCheck.normalized;

    // 4. Validasi PIN
    const pinCheck = this.validatePin(params.pin);
    if (!pinCheck.isValid) {
      throw { statusCode: 400, code: 'INVALID_PIN', message: pinCheck.message };
    }

    // 5. Cek Duplikasi NIK & Nomor HP
    if (this.nikIndex.has(cleanNik)) {
      throw {
        statusCode: 409,
        code: 'DUPLICATE_NIK',
        message: 'NIK KTP ini sudah terdaftar. Silakan gunakan menu Masuk / Login.',
      };
    }
    if (this.phoneIndex.has(cleanPhone)) {
      throw {
        statusCode: 409,
        code: 'DUPLICATE_PHONE',
        message: 'Nomor HP ini sudah terdaftar. Silakan gunakan menu Masuk / Login.',
      };
    }

    // 6. Generate Internal Identity & Password Hashing
    const now = new Date().toISOString();
    const authUserId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const farmerId = `farmer_${authUserId}`;
    const salt = this.generateSalt();
    const pinHash = this.hashPin(params.pin.trim(), salt);

    const newAccount: StoredFarmerAccount = {
      id: farmerId,
      authUserId,
      name: params.name.trim(),
      nik: cleanNik,
      phoneNumber: cleanPhone,
      pinHash,
      salt,
      role: 'farmer',
      village: params.village?.trim() || 'Sukamaju',
      district: params.district?.trim() || 'Kasokandel',
      regency: params.regency?.trim() || 'Majalengka',
      province: params.province?.trim() || 'Jawa Barat',
      farmerGroupName: params.farmerGroupName?.trim() || 'Kelompok Tani Mandiri',
      createdAt: now,
      updatedAt: now,
    };

    this.saveAccount(newAccount);

    // 7. Buat JWT Session Token
    const sessionRes = this.generateSessionToken({
      userId: authUserId,
      role: 'farmer',
      isAnonymous: false,
      farmerId,
      name: newAccount.name,
      phoneNumber: cleanPhone,
    });

    return {
      success: true,
      token: sessionRes.token,
      user: {
        id: authUserId,
        role: 'farmer',
        isAnonymous: false,
      },
      farmer: this.sanitizeProfile(newAccount),
    };
  }

  /**
   * Login Petani dengan NIK atau Nomor HP + PIN
   */
  public loginFarmer(params: LoginFarmerParams): {
    success: boolean;
    token: string;
    user: { id: string; role: string; isAnonymous: boolean };
    farmer: SanitizedFarmerProfile;
  } {
    if (!params.identifier || !params.pin) {
      throw {
        statusCode: 400,
        code: 'MISSING_CREDENTIALS',
        message: 'NIK/Nomor HP dan PIN wajib diisi',
      };
    }

    const cleanIdentifier = params.identifier.trim().replace(/[\s-]/g, '');
    let farmerId = this.nikIndex.get(cleanIdentifier) || this.phoneIndex.get(cleanIdentifier);

    if (!farmerId) {
      throw {
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'NIK/Nomor HP atau PIN tidak cocok. Pastikan Anda telah terdaftar.',
      };
    }

    const account = this.farmersStore.get(farmerId);
    if (!account) {
      throw {
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Akun petani tidak ditemukan',
      };
    }

    // Verifikasi PIN dengan PBKDF2 hash
    const expectedHash = this.hashPin(params.pin.trim(), account.salt);
    if (expectedHash !== account.pinHash) {
      throw {
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'NIK/Nomor HP atau PIN tidak cocok. Silakan coba kembali.',
      };
    }

    // Buat JWT Session Token
    const sessionRes = this.generateSessionToken({
      userId: account.authUserId,
      role: account.role || 'farmer',
      isAnonymous: false,
      farmerId: account.id,
      name: account.name,
      phoneNumber: account.phoneNumber,
    });

    return {
      success: true,
      token: sessionRes.token,
      user: {
        id: account.authUserId,
        role: account.role || 'farmer',
        isAnonymous: false,
      },
      farmer: this.sanitizeProfile(account),
    };
  }

  /**
   * Mengambil profil petani berdasarkan farmerId
   */
  public getFarmerProfile(farmerId: string): SanitizedFarmerProfile | null {
    const account = this.farmersStore.get(farmerId);
    if (!account) return null;
    return this.sanitizeProfile(account);
  }

  /**
   * Mengambil profil petani berdasarkan authUserId
   */
  public getFarmerProfileByUserId(userId: string): SanitizedFarmerProfile | null {
    const farmerId = this.userIndex.get(userId);
    if (!farmerId) return null;
    return this.getFarmerProfile(farmerId);
  }

  /**
   * Menghasilkan token sesi aman
   */
  public generateSessionToken(payload: {
    userId: string;
    role?: string;
    isAnonymous?: boolean;
    farmerId?: string;
    name?: string;
    phoneNumber?: string;
  }): { token: string; expiresIn: string; session: AuthSessionPayload } {
    const session: AuthSessionPayload = {
      userId: payload.userId,
      role: payload.role || 'farmer',
      isAnonymous: payload.isAnonymous ?? false,
      farmerId: payload.farmerId || (payload.role === 'SUPER_ADMIN' || payload.role === 'MANAGER' ? 'manager-system' : `farmer_${payload.userId}`),
      name: payload.name,
      phoneNumber: payload.phoneNumber,
      issuedAt: Date.now(),
    };

    const token = jwt.sign(session, config.jwtSecret, {
      expiresIn: '30d',
      algorithm: 'HS256',
    });

    return {
      token,
      expiresIn: '30d',
      session,
    };
  }

  /**
   * Memverifikasi token JWT
   */
  public verifyToken(token: string): AuthSessionPayload | null {
    try {
      const decoded = jwt.verify(token, config.jwtSecret, {
        algorithms: ['HS256'],
      }) as AuthSessionPayload;
      return decoded;
    } catch {
      return null;
    }
  }

  /**
   * Helper sanitasi profil petani tanpa password/PIN
   */
  private sanitizeProfile(account: StoredFarmerAccount): SanitizedFarmerProfile {
    return {
      id: account.id,
      name: account.name,
      nikMasked: this.maskNik(account.nik),
      phoneNumber: account.phoneNumber,
      village: account.village,
      district: account.district,
      regency: account.regency,
      province: account.province,
      farmerGroupName: account.farmerGroupName,
      role: account.role,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  /**
   * Backward compatibility helper
   */
  public processAnonymousOrRegister(params: {
    anonymousId?: string;
    farmerName?: string;
    phoneNumber?: string;
    village?: string;
  }): {
    success: boolean;
    token: string;
    user: { id: string; role: string; isAnonymous: boolean };
    farmer: { id: string; name: string; village?: string };
  } {
    const userId = params.anonymousId || `usr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const farmerId = `farmer_${userId}`;
    const isAnonymous = !params.farmerName;

    const sessionRes = this.generateSessionToken({
      userId,
      role: 'farmer',
      isAnonymous,
      farmerId,
      name: params.farmerName || 'Petani Mandiri',
    });

    return {
      success: true,
      token: sessionRes.token,
      user: {
        id: userId,
        role: 'farmer',
        isAnonymous,
      },
      farmer: {
        id: farmerId,
        name: params.farmerName || 'Petani Mandiri (Lokal)',
        village: params.village || 'Sukamaju',
      },
    };
  }
}

export const authService = AuthService.getInstance();
