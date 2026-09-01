/**
 * HIKMAT TANI - Client Auth & Session Service (Langkah 1 & 7)
 * 
 * Prinsip:
 * 1. Mengelola status autentikasi aktif di client.
 * 2. Mengaitkan sesi login dengan partisi IndexedDB lokal via `setActiveFarmerDb`.
 * 3. Menyediakan fungsi registrasi, login, logout, dan ganti akun secara offline-first.
 * 4. Mendukung multi-akun pada satu perangkat HP/komputer yang sama.
 */

import { initializeDatabase, setActiveFarmerDb } from '../db/database.ts';
import { syncEngine } from '../sync/syncEngine.ts';
import { Farmer } from '../types/index.ts';

export interface AuthSession {
  token: string;
  user: {
    id: string;
    role: string;
    isAnonymous: boolean;
  };
  farmer: {
    id: string;
    name: string;
    avatarUrl?: string;
    nikMasked: string;
    phoneNumber: string;
    village?: string;
    district?: string;
    regency?: string;
    province?: string;
    farmerGroupName?: string;
    role?: string;
  };
}

export interface RegisterInput {
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

export interface LoginInput {
  identifier: string; // NIK atau Nomor HP
  pin: string;
}

const STORAGE_AUTH_SESSION = 'hikmat_auth_session';
const STORAGE_TOKEN = 'hikmat_auth_token';
const STORAGE_SAVED_ACCOUNTS = 'hikmat_saved_farmer_accounts';

export class AuthClientService {
  private static instance: AuthClientService;
  private currentSession: AuthSession | null = null;
  private listeners: Set<(session: AuthSession | null) => void> = new Set();

  private constructor() {
    this.restoreSessionFromStorage();
  }

  public static getInstance(): AuthClientService {
    if (!AuthClientService.instance) {
      AuthClientService.instance = new AuthClientService();
    }
    return AuthClientService.instance;
  }

  /**
   * Mengembalikan sesi login saat ini (jika ada)
   */
  public getSession(): AuthSession | null {
    if (!this.currentSession) {
      this.restoreSessionFromStorage();
    }
    return this.currentSession;
  }

  /**
   * Mengembalikan token JWT aktif
   */
  public getToken(): string | null {
    return this.getSession()?.token || localStorage.getItem(STORAGE_TOKEN) || null;
  }

  /**
   * Mengembalikan farmerId dari sesi aktif
   */
  public getActiveFarmerId(): string | null {
    return this.getSession()?.farmer?.id || null;
  }

  /**
   * Alias untuk getActiveFarmerId
   */
  public getCurrentFarmerId(): string | null {
    return this.getActiveFarmerId();
  }

  /**
   * Cek apakah ada sesi aktif yang valid
   */
  public isAuthenticated(): boolean {
    return Boolean(this.getToken() && this.getActiveFarmerId());
  }

  /**
   * Berlangganan perubahan status login/logout
   */
  public subscribe(listener: (session: AuthSession | null) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentSession);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.currentSession);
    }
  }

  /**
   * Pulihkan sesi yang tersimpan di localStorage
   */
  private restoreSessionFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_AUTH_SESSION);
      if (raw) {
        const parsed = JSON.parse(raw) as AuthSession;
        if (parsed?.token && parsed?.farmer?.id) {
          this.currentSession = parsed;
          setActiveFarmerDb(parsed.farmer.id);
          syncEngine.setFarmerContext(parsed.farmer.id);
        }
      }
    } catch {
      this.currentSession = null;
    }
  }

  /**
   * Simpan sesi aktif ke localStorage dan aktifkan partisi database
   */
  private async persistSession(session: AuthSession): Promise<void> {
    this.currentSession = session;
    localStorage.setItem(STORAGE_AUTH_SESSION, JSON.stringify(session));
    localStorage.setItem(STORAGE_TOKEN, session.token);

    // Aktifkan partisi IndexedDB terisolasi untuk petani ini
    setActiveFarmerDb(session.farmer.id);
    await initializeDatabase(session.farmer.id);

    // Sinkronkan konteks syncEngine dengan farmerId baru
    syncEngine.setFarmerContext(session.farmer.id);

    // Simpan ke daftar akun perangkat untuk fitur ganti akun cepat
    this.saveToDeviceAccounts(session.farmer);

    this.notifyListeners();
  }

  /**
   * Daftar akun petani yang pernah login di perangkat ini
   */
  public getSavedAccounts(): Array<{
    id: string;
    name: string;
    nikMasked: string;
    phoneNumber: string;
    farmerGroupName?: string;
  }> {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_SAVED_ACCOUNTS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveToDeviceAccounts(farmer: AuthSession['farmer']): void {
    const list = this.getSavedAccounts().filter((a) => a.id !== farmer.id);
    list.unshift({
      id: farmer.id,
      name: farmer.name,
      nikMasked: farmer.nikMasked,
      phoneNumber: farmer.phoneNumber,
      farmerGroupName: farmer.farmerGroupName,
    });
    localStorage.setItem(STORAGE_SAVED_ACCOUNTS, JSON.stringify(list.slice(0, 5)));
  }

  /**
   * Registrasi Petani Baru
   */
  public async register(input: RegisterInput): Promise<{
    success: boolean;
    session?: AuthSession;
    error?: string;
  }> {
    try {
      const resp = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      const data = await resp.json().catch(() => ({}));

      // Ekstrak pesan error yang informatif dari berbagai kemungkinan struktur respon
      const extractedError =
        data?.error?.message ||
        data?.message ||
        (typeof data?.error === 'string' ? data.error : null);

      if (!resp.ok || data?.success === false) {
        return {
          success: false,
          error: extractedError || `Registrasi gagal (HTTP ${resp.status})`,
        };
      }

      // Dukung struktur respon bersarang (data.data) maupun datar (data)
      const payload = data?.data && typeof data.data === 'object' ? data.data : data;
      const token = payload?.token;
      const farmer = payload?.farmer;
      const user = payload?.user || (farmer?.id ? { id: `usr_${farmer.id}`, role: farmer?.role || 'farmer', isAnonymous: false } : undefined);

      if (!token || !farmer?.id) {
        return {
          success: false,
          error: extractedError || 'Respon pendaftaran dari server tidak memuat kredensial sesi yang valid.',
        };
      }

      const session: AuthSession = {
        token,
        user: user!,
        farmer,
      };

      await this.persistSession(session);

      return { success: true, session };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Gagal tersambung ke server. Pastikan koneksi internet aktif untuk registrasi.',
      };
    }
  }

  /**
   * Masuk Petani (Login)
   */
  public async login(input: LoginInput): Promise<{
    success: boolean;
    session?: AuthSession;
    error?: string;
  }> {
    try {
      const resp = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      const data = await resp.json().catch(() => ({}));

      const extractedError =
        data?.error?.message ||
        data?.message ||
        (typeof data?.error === 'string' ? data.error : null);

      if (!resp.ok || data?.success === false) {
        return {
          success: false,
          error: extractedError || `Login gagal: NIK/Nomor HP atau PIN salah`,
        };
      }

      const payload = data?.data && typeof data.data === 'object' ? data.data : data;
      const token = payload?.token;
      const farmer = payload?.farmer;
      const user = payload?.user || (farmer?.id ? { id: `usr_${farmer.id}`, role: farmer?.role || 'farmer', isAnonymous: false } : undefined);

      if (!token || !farmer?.id) {
        return {
          success: false,
          error: extractedError || 'Respon login dari server tidak memuat token sesi yang valid.',
        };
      }

      const session: AuthSession = {
        token,
        user: user!,
        farmer,
      };

      await this.persistSession(session);

      return { success: true, session };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Gagal tersambung ke server. Periksa jaringan Anda.',
      };
    }
  }

  /**
   * Keluar dari Sesi (Logout)
   * Menyimpan data lokal di IndexedDB tetap aman tanpa terhapus
   */
  public async logout(): Promise<void> {
    try {
      const token = this.getToken();
      if (token) {
        fetch('/api/v1/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }).catch(() => {});
      }
    } finally {
      this.currentSession = null;
      localStorage.removeItem(STORAGE_AUTH_SESSION);
      localStorage.removeItem(STORAGE_TOKEN);
      syncEngine.resetContext();
      setActiveFarmerDb('default');
      this.notifyListeners();
    }
  }

  /**
   * Mengubah profil petani aktif
   */
  public updateCurrentFarmerProfile(updates: Partial<Farmer>): void {
    if (this.currentSession?.farmer) {
      this.currentSession.farmer = {
        ...this.currentSession.farmer,
        ...updates,
      };
      localStorage.setItem(STORAGE_AUTH_SESSION, JSON.stringify(this.currentSession));
      this.notifyListeners();
    }
  }
}

export const authClientService = AuthClientService.getInstance();
