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
import * as d1Schema from '../db/d1/schema.ts';
import { eq, or, sql } from 'drizzle-orm';

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
  private isInitialized = false;

  private constructor() {
    // Operasi inisialisasi default ditunda ke ensureInitialized() (lazy runtime)
    // demi kompatibilitas penuh dengan Cloudflare Workers edge runtime (mencegah error 10021).
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Memastikan store default telah di-seed sebelum operasi runtime pertama.
   * Bersifat idempotent dan hanya dieksekusi saat ada request/runtime aktif.
   */
  private ensureInitialized(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.seedDefaultAccounts();
  }

  /**
   * Helper: Hash PIN menggunakan PBKDF2 dengan salt unik
   */
  public hashPin(pin: string, salt: string): string {
    return crypto.pbkdf2Sync(pin, salt, 10000, 64, 'sha512').toString('hex');
  }

  /**
   * Helper: Generate salt acak secara aman (kompatibel Node.js dan Cloudflare Edge Runtime)
   */
  public generateSalt(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomBytes === 'function') {
      try {
        return crypto.randomBytes(16).toString('hex');
      } catch {
        // Fallback jika randomBytes dilarang pada konteks tertentu
      }
    }
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
      const array = new Uint8Array(16);
      globalThis.crypto.getRandomValues(array);
      return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
    }
    return Math.random().toString(36).slice(2, 18);
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
   * Helper untuk mendapatkan variasi representasi nomor HP (08..., 628..., +628...)
   */
  public getPhoneVariations(phone: string): string[] {
    const clean = phone.trim().replace(/[\s-]/g, '');
    const set = new Set<string>();
    set.add(clean);

    let digits = clean;
    if (digits.startsWith('+62')) {
      digits = digits.slice(3);
    } else if (digits.startsWith('62')) {
      digits = digits.slice(2);
    } else if (digits.startsWith('0')) {
      digits = digits.slice(1);
    }

    if (digits.length >= 8) {
      set.add(`0${digits}`);
      set.add(`62${digits}`);
      set.add(`+62${digits}`);
    }

    return Array.from(set);
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
   * Seed akun default awal untuk pengujian (idempotent)
   */
  private seedDefaultAccounts(): void {
    if (this.farmersStore.has('farmer_sutrisno')) {
      return;
    }
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

  public saveAccount(account: StoredFarmerAccount): void {
    this.farmersStore.set(account.id, account);
    if (account.nik) {
      this.nikIndex.set(account.nik, account.id);
    }
    if (account.phoneNumber) {
      const variations = this.getPhoneVariations(account.phoneNumber);
      for (const v of variations) {
        this.phoneIndex.set(v, account.id);
      }
    }
    if (account.authUserId) {
      this.userIndex.set(account.authUserId, account.id);
    }
  }

  /**
   * Reset store kembali ke default seed (untuk test suite)
   */
  public resetStore(): void {
    this.farmersStore.clear();
    this.nikIndex.clear();
    this.phoneIndex.clear();
    this.userIndex.clear();
    this.isInitialized = true;
    this.seedDefaultAccounts();
  }

  /**
   * Registrasi Identitas Petani Baru (Sinkron - Memory)
   */
  public registerFarmer(params: RegisterFarmerParams): {
    success: boolean;
    token: string;
    user: { id: string; role: string; isAnonymous: boolean };
    farmer: SanitizedFarmerProfile;
  } {
    this.ensureInitialized();

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
    const phoneVariations = this.getPhoneVariations(cleanPhone);
    for (const v of phoneVariations) {
      if (this.phoneIndex.has(v)) {
        throw {
          statusCode: 409,
          code: 'DUPLICATE_PHONE',
          message: 'Nomor HP ini sudah terdaftar. Silakan gunakan menu Masuk / Login.',
        };
      }
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
   * Registrasi Identitas Petani Baru dengan Persistensi Database (D1 / SQL)
   */
  public async registerFarmerAsync(
    params: RegisterFarmerParams,
    d1Db?: any
  ): Promise<{
    success: boolean;
    token: string;
    user: { id: string; role: string; isAnonymous: boolean };
    farmer: SanitizedFarmerProfile;
  }> {
    this.ensureInitialized();

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

    // 5. Cek Duplikasi di Memory Store terlebih dahulu
    if (this.nikIndex.has(cleanNik)) {
      throw {
        statusCode: 409,
        code: 'DUPLICATE_NIK',
        message: 'NIK KTP ini sudah terdaftar. Silakan gunakan menu Masuk / Login.',
      };
    }
    const phoneVariations = this.getPhoneVariations(cleanPhone);
    for (const v of phoneVariations) {
      if (this.phoneIndex.has(v)) {
        throw {
          statusCode: 409,
          code: 'DUPLICATE_PHONE',
          message: 'Nomor HP ini sudah terdaftar. Silakan gunakan menu Masuk / Login.',
        };
      }
    }

    // 6. Cek Duplikasi di Database D1 jika tersedia
    if (d1Db) {
      try {
        const existingFarmers = await d1Db
          .select()
          .from(d1Schema.farmers)
          .where(
            or(
              eq(d1Schema.farmers.nik, cleanNik),
              eq(d1Schema.farmers.phoneNumber, cleanPhone)
            )
          );

        if (existingFarmers && existingFarmers.length > 0) {
          const match = existingFarmers[0];
          if (match.nik === cleanNik) {
            throw {
              statusCode: 409,
              code: 'DUPLICATE_NIK',
              message: 'NIK KTP ini sudah terdaftar. Silakan gunakan menu Masuk / Login.',
            };
          }
          throw {
            statusCode: 409,
            code: 'DUPLICATE_PHONE',
            message: 'Nomor HP ini sudah terdaftar. Silakan gunakan menu Masuk / Login.',
          };
        }
      } catch (err: any) {
        if (err.statusCode === 409) throw err;
        console.warn('[AuthService] D1 duplicate check fallback warning:', err);
      }
    }

    // 7. Generate Internal Identity & Password Hashing
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

    // 8. Persist ke Database D1 jika tersedia
    if (d1Db) {
      let authUserInserted = false;
      try {
        // Insert auth_users
        await d1Db.insert(d1Schema.authUsers).values({
          id: authUserId,
          farmerId: farmerId,
          phoneNumber: cleanPhone,
          role: 'farmer',
          isActive: true,
          lastSeenAt: now,
          createdAt: now,
          updatedAt: now,
        });
        authUserInserted = true;

        // Insert farmers
        await d1Db.insert(d1Schema.farmers).values({
          id: farmerId,
          name: newAccount.name,
          phone: cleanPhone,
          phoneNumber: cleanPhone,
          nik: cleanNik,
          pinHash,
          salt,
          address: `${newAccount.village || ''}, ${newAccount.district || ''}`.trim(),
          village: newAccount.village,
          district: newAccount.district,
          regency: newAccount.regency,
          province: newAccount.province,
          farmerGroupName: newAccount.farmerGroupName,
          authUserId,
          createdAt: now,
          updatedAt: now,
        });
      } catch (err: any) {
        console.error('[AuthService] Gagal persist pendaftaran ke basis data D1:', err?.message || 'Database write error');

        // Rollback / kompensasi: hapus auth_users jika sudah terlanjur di-insert
        if (authUserInserted) {
          try {
            await d1Db.delete(d1Schema.authUsers).where(eq(d1Schema.authUsers.id, authUserId));
          } catch (cleanupErr) {
            console.error('[AuthService] Rollback auth_users gagal:', cleanupErr);
          }
        }

        // Jangan simpan ke cache memori, jangan buat JWT session token, gagalkan registrasi
        throw {
          statusCode: 500,
          code: 'PERSISTENCE_FAILED',
          message: 'Pendaftaran gagal disimpan ke basis data Cloudflare D1. Silakan coba beberapa saat lagi.',
        };
      }
    }

    // Simpan ke in-memory cache HANYA setelah persistensi DB berhasil
    this.saveAccount(newAccount);

    // 9. Buat JWT Session Token
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
   * Login Petani dengan NIK atau Nomor HP + PIN (Sinkron - Memory)
   */
  public loginFarmer(params: LoginFarmerParams): {
    success: boolean;
    token: string;
    user: { id: string; role: string; isAnonymous: boolean };
    farmer: SanitizedFarmerProfile;
  } {
    this.ensureInitialized();

    if (!params.identifier || !params.pin) {
      throw {
        statusCode: 400,
        code: 'MISSING_CREDENTIALS',
        message: 'NIK/Nomor HP dan PIN wajib diisi',
      };
    }

    const cleanIdentifier = params.identifier.trim().replace(/[\s-]/g, '');
    let farmerId = this.nikIndex.get(cleanIdentifier);

    if (!farmerId) {
      const phoneVars = this.getPhoneVariations(cleanIdentifier);
      for (const v of phoneVars) {
        if (this.phoneIndex.has(v)) {
          farmerId = this.phoneIndex.get(v);
          break;
        }
      }
    }

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
   * Login Petani dengan Persistensi Database (D1 / SQL)
   */
  public async loginFarmerAsync(
    params: LoginFarmerParams,
    d1Db?: any
  ): Promise<{
    success: boolean;
    token: string;
    user: { id: string; role: string; isAnonymous: boolean };
    farmer: SanitizedFarmerProfile;
  }> {
    this.ensureInitialized();

    if (!params.identifier || !params.pin) {
      throw {
        statusCode: 400,
        code: 'MISSING_CREDENTIALS',
        message: 'NIK/Nomor HP dan PIN wajib diisi',
      };
    }

    const cleanIdentifier = params.identifier.trim().replace(/[\s-]/g, '');
    let matchedAccount: StoredFarmerAccount | null = null;

    // 1. Cari di Database D1 jika client database tersedia
    if (d1Db) {
      try {
        const phoneVars = this.getPhoneVariations(cleanIdentifier);
        const conditions = [
          eq(d1Schema.farmers.nik, cleanIdentifier),
          ...phoneVars.map((pv) => eq(d1Schema.farmers.phoneNumber, pv)),
          ...phoneVars.map((pv) => eq(d1Schema.farmers.phone, pv)),
        ];

        const dbFarmers = await d1Db
          .select()
          .from(d1Schema.farmers)
          .where(or(...conditions));

        if (dbFarmers && dbFarmers.length > 0) {
          const dbRow = dbFarmers[0];
          matchedAccount = {
            id: dbRow.id,
            authUserId: dbRow.authUserId || `usr_${dbRow.id}`,
            name: dbRow.name,
            nik: dbRow.nik || cleanIdentifier,
            phoneNumber: dbRow.phoneNumber || dbRow.phone || cleanIdentifier,
            pinHash: dbRow.pinHash || '',
            salt: dbRow.salt || '',
            role: 'farmer',
            village: dbRow.village || undefined,
            district: dbRow.district || undefined,
            regency: dbRow.regency || undefined,
            province: dbRow.province || undefined,
            farmerGroupName: dbRow.farmerGroupName || undefined,
            createdAt: dbRow.createdAt || new Date().toISOString(),
            updatedAt: dbRow.updatedAt || new Date().toISOString(),
          };

          // Cache di in-memory store
          this.saveAccount(matchedAccount);
        }
      } catch (err) {
        console.warn('[AuthService] D1 login query fallback to memory:', err);
      }
    }

    // 2. Fallback pencarian di Memory Store jika belum ditemukan di D1
    if (!matchedAccount) {
      let farmerId = this.nikIndex.get(cleanIdentifier);
      if (!farmerId) {
        const phoneVars = this.getPhoneVariations(cleanIdentifier);
        for (const v of phoneVars) {
          if (this.phoneIndex.has(v)) {
            farmerId = this.phoneIndex.get(v);
            break;
          }
        }
      }

      if (farmerId) {
        matchedAccount = this.farmersStore.get(farmerId) || null;
      }
    }

    if (!matchedAccount) {
      throw {
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'NIK/Nomor HP atau PIN tidak cocok. Pastikan Anda telah terdaftar.',
      };
    }

    // 3. Verifikasi PIN dengan PBKDF2 hash
    if (!matchedAccount.salt || !matchedAccount.pinHash) {
      throw {
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Kredensial keamanan akun belum dikonfigurasi.',
      };
    }

    const expectedHash = this.hashPin(params.pin.trim(), matchedAccount.salt);
    if (expectedHash !== matchedAccount.pinHash) {
      throw {
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'NIK/Nomor HP atau PIN tidak cocok. Silakan coba kembali.',
      };
    }

    // 4. Buat JWT Session Token
    const sessionRes = this.generateSessionToken({
      userId: matchedAccount.authUserId,
      role: matchedAccount.role || 'farmer',
      isAnonymous: false,
      farmerId: matchedAccount.id,
      name: matchedAccount.name,
      phoneNumber: matchedAccount.phoneNumber,
    });

    return {
      success: true,
      token: sessionRes.token,
      user: {
        id: matchedAccount.authUserId,
        role: matchedAccount.role || 'farmer',
        isAnonymous: false,
      },
      farmer: this.sanitizeProfile(matchedAccount),
    };
  }

  /**
   * Mengambil profil petani berdasarkan farmerId (Sinkron / Memory)
   */
  public getFarmerProfile(farmerId: string): SanitizedFarmerProfile | null {
    this.ensureInitialized();
    const account = this.farmersStore.get(farmerId);
    if (!account) return null;
    return this.sanitizeProfile(account);
  }

  /**
   * Mengambil profil petani berdasarkan farmerId dengan fallback lookup ke Database D1
   */
  public async getFarmerProfileAsync(farmerId: string, d1Db?: any): Promise<SanitizedFarmerProfile | null> {
    this.ensureInitialized();
    const cached = this.farmersStore.get(farmerId);
    if (cached) return this.sanitizeProfile(cached);

    if (d1Db) {
      try {
        const rows = await d1Db
          .select()
          .from(d1Schema.farmers)
          .where(eq(d1Schema.farmers.id, farmerId));
        if (rows && rows.length > 0) {
          const r = rows[0];
          const acc: StoredFarmerAccount = {
            id: r.id,
            authUserId: r.authUserId || `usr_${r.id}`,
            name: r.name,
            nik: r.nik || '',
            phoneNumber: r.phoneNumber || '',
            pinHash: r.pinHash || '',
            salt: r.salt || '',
            role: 'farmer',
            village: r.village || undefined,
            district: r.district || undefined,
            regency: r.regency || undefined,
            province: r.province || undefined,
            farmerGroupName: r.farmerGroupName || undefined,
            createdAt: r.createdAt || new Date().toISOString(),
            updatedAt: r.updatedAt || new Date().toISOString(),
          };
          this.saveAccount(acc);
          return this.sanitizeProfile(acc);
        }
      } catch (err) {
        console.warn('[AuthService] D1 getFarmerProfile fallback warning:', err);
      }
    }
    return null;
  }

  /**
   * Mengambil profil petani berdasarkan authUserId
   */
  public getFarmerProfileByUserId(userId: string): SanitizedFarmerProfile | null {
    this.ensureInitialized();
    const farmerId = this.userIndex.get(userId);
    if (!farmerId) return null;
    return this.getFarmerProfile(farmerId);
  }

  /**
   * Mengambil profil petani berdasarkan NIK (Memory store)
   */
  public getFarmerProfileByNik(nik: string): SanitizedFarmerProfile | null {
    this.ensureInitialized();
    const farmerId = this.nikIndex.get(nik.trim());
    if (!farmerId) return null;
    return this.getFarmerProfile(farmerId);
  }

  /**
   * Mengambil profil petani berdasarkan nomor telepon (Memory store)
   */
  public getFarmerProfileByPhone(phone: string): SanitizedFarmerProfile | null {
    this.ensureInitialized();
    const phoneVars = this.getPhoneVariations(phone.trim().replace(/[\s-]/g, ''));
    for (const v of phoneVars) {
      if (this.phoneIndex.has(v)) {
        const farmerId = this.phoneIndex.get(v)!;
        return this.getFarmerProfile(farmerId);
      }
    }
    return null;
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

