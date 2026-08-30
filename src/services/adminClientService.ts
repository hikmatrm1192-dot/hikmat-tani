/**
 * HIKMAT TANI - Admin Client Service (Langkah 15)
 * 
 * Mengelola komunikasi HTTP client untuk Portal Pengelola:
 * - Login & Sesi Token Pengelola (MANAGER / SUPER_ADMIN)
 * - Pembaruan Konfigurasi Resmi
 * - Pengunggahan Gambar QRIS
 * - Riwayat Catatan Audit
 * - Manajemen Akun Pengelola (Khusus SUPER_ADMIN)
 */

export interface AdminProfile {
  id: string;
  username: string;
  email?: string;
  fullName: string;
  role: 'MANAGER' | 'SUPER_ADMIN';
}

export interface AdminAppConfig {
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

export interface ManagerAccount {
  id: string;
  username: string;
  email?: string;
  fullName: string;
  role: 'MANAGER' | 'SUPER_ADMIN';
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogItem {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: 'MANAGER' | 'SUPER_ADMIN';
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
}

const ADMIN_TOKEN_KEY = 'hikmat_admin_jwt_token';
const ADMIN_USER_KEY = 'hikmat_admin_user_info';

export class AdminClientService {
  private static instance: AdminClientService;

  private constructor() {}

  public static getInstance(): AdminClientService {
    if (!AdminClientService.instance) {
      AdminClientService.instance = new AdminClientService();
    }
    return AdminClientService.instance;
  }

  public getToken(): string | null {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY) || localStorage.getItem(ADMIN_TOKEN_KEY);
  }

  public getStoredAdmin(): AdminProfile | null {
    try {
      const raw = sessionStorage.getItem(ADMIN_USER_KEY) || localStorage.getItem(ADMIN_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  public setSession(token: string, admin: AdminProfile, rememberMe: boolean = true) {
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem(ADMIN_TOKEN_KEY, token);
    storage.setItem(ADMIN_USER_KEY, JSON.stringify(admin));
  }

  public logout() {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    sessionStorage.removeItem(ADMIN_USER_KEY);
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
  }

  private getAuthHeaders(): HeadersInit {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  /**
   * Login Pengelola (MANAGER / SUPER_ADMIN)
   */
  public async login(
    username: string,
    passwordPlain: string,
    rememberMe: boolean = true
  ): Promise<{ success: boolean; admin?: AdminProfile; error?: string }> {
    try {
      const res = await fetch('/api/v1/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: passwordPlain }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        return {
          success: false,
          error: json?.error?.message || 'Login gagal. Periksa kembali nama pengguna dan kata sandi.',
        };
      }

      const { token, admin } = json.data;
      this.setSession(token, admin, rememberMe);

      return { success: true, admin };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Gagal terhubung ke server pengelola.',
      };
    }
  }

  /**
   * Mengubah Kata Sandi Akun Pengelola Sendiri
   */
  public async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch('/api/v1/admin/auth/change-password', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        return {
          success: false,
          error: json?.error?.message || 'Gagal mengubah kata sandi.',
        };
      }

      return {
        success: true,
        message: json.message || 'Kata sandi berhasil diperbarui dengan aman.',
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Koneksi ke server gagal.' };
    }
  }

  /**
   * Membaca Konfigurasi Resmi Lengkap
   */
  public async getConfig(): Promise<{ success: boolean; data?: AdminAppConfig; error?: string }> {
    try {
      const res = await fetch('/api/v1/admin/config', {
        headers: this.getAuthHeaders(),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        if (res.status === 401 || res.status === 403) {
          this.logout();
        }
        return { success: false, error: json?.error?.message || 'Gagal memuat konfigurasi pengelola.' };
      }

      return { success: true, data: json.data };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Koneksi ke server gagal.' };
    }
  }

  /**
   * Memperbarui Konfigurasi Resmi
   */
  public async updateConfig(
    payload: Partial<AdminAppConfig>
  ): Promise<{ success: boolean; data?: AdminAppConfig; error?: string }> {
    try {
      const res = await fetch('/api/v1/admin/config', {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json?.error?.message || 'Gagal menyimpan perubahan konfigurasi.' };
      }

      return { success: true, data: json.data };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Koneksi ke server gagal.' };
    }
  }

  /**
   * Upload QRIS
   */
  public async uploadQris(
    qrisImageBase64: string
  ): Promise<{ success: boolean; donationQrisImage?: string; error?: string }> {
    try {
      const res = await fetch('/api/v1/admin/qris', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ qrisImage: qrisImageBase64 }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json?.error?.message || 'Gagal memperbarui QRIS.' };
      }

      return { success: true, donationQrisImage: json.data.donationQrisImage };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Koneksi ke server gagal.' };
    }
  }

  /**
   * Mengambil Catatan Audit (Audit Log)
   */
  public async getAuditLogs(
    limit: number = 50
  ): Promise<{ success: boolean; data?: AuditLogItem[]; error?: string }> {
    try {
      const res = await fetch(`/api/v1/admin/audit-logs?limit=${limit}`, {
        headers: this.getAuthHeaders(),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json?.error?.message || 'Gagal memuat catatan audit.' };
      }

      return { success: true, data: json.data };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Koneksi ke server gagal.' };
    }
  }

  /**
   * Daftar Pengelola (SUPER_ADMIN ONLY)
   */
  public async listManagers(): Promise<{ success: boolean; data?: ManagerAccount[]; error?: string }> {
    try {
      const res = await fetch('/api/v1/admin/managers', {
        headers: this.getAuthHeaders(),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json?.error?.message || 'Gagal memuat daftar pengelola.' };
      }

      return { success: true, data: json.data };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Koneksi ke server gagal.' };
    }
  }

  /**
   * Buat Pengelola Baru (SUPER_ADMIN ONLY)
   */
  public async createManager(payload: {
    username: string;
    passwordPlain: string;
    fullName: string;
    email?: string;
    role?: 'MANAGER' | 'SUPER_ADMIN';
  }): Promise<{ success: boolean; data?: ManagerAccount; error?: string }> {
    try {
      const res = await fetch('/api/v1/admin/managers', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json?.error?.message || 'Gagal membuat akun pengelola.' };
      }

      return { success: true, data: json.data };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Koneksi ke server gagal.' };
    }
  }

  /**
   * Ubah Pengelola (SUPER_ADMIN ONLY)
   */
  public async updateManager(
    managerId: string,
    payload: {
      fullName?: string;
      email?: string;
      role?: 'MANAGER' | 'SUPER_ADMIN';
      isActive?: boolean;
      passwordPlain?: string;
    }
  ): Promise<{ success: boolean; data?: ManagerAccount; error?: string }> {
    try {
      const res = await fetch(`/api/v1/admin/managers/${managerId}`, {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json?.error?.message || 'Gagal memperbarui akun pengelola.' };
      }

      return { success: true, data: json.data };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Koneksi ke server gagal.' };
    }
  }

  /**
   * Hapus Pengelola (SUPER_ADMIN ONLY)
   */
  public async deleteManager(
    managerId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`/api/v1/admin/managers/${managerId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json?.error?.message || 'Gagal menghapus pengelola.' };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Koneksi ke server gagal.' };
    }
  }
}

export const adminClientService = AdminClientService.getInstance();
