/**
 * HIKMAT TANI - Public Application Configuration Service (Langkah 15)
 * 
 * Mengambil data konfigurasi resmi HIKMAT TANI dari server (rekening, bank, QRIS, status donasi, kontak).
 * Dilengkapi dengan penyimpanan cache lokal dan fallback offline sehingga aplikasi petani
 * tetap berfungsi 100% mandiri ketika tidak ada jaringan internet.
 */

export interface PublicAppConfig {
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
  updatedAt?: string;
}

const DEFAULT_OFFICIAL_CONFIG: PublicAppConfig = {
  appName: 'HIKMAT TANI',
  slogan: 'CERDAS BERTANI, BIJAK MENGAMBIL KEPUTUSAN.',
  logoUrl: '/logo-hikmat-tani-1024.png',
  description: 'Sistem Rekomendasi Budidaya Padi & Catatan Lapang Mandiri 100% Offline untuk Petani Nusantara.',
  supportTitle: 'Dukung HIKMAT TANI',
  supportDescription: 'Inisiatif Mandiri Teknologi Pertanian Padi Nusantara',
  contactPhone: '+62 812-3456-7890',
  contactEmail: 'kontak@hikmattani.id',
  donationActive: true,
  donationRecipientName: 'Pengelola HIKMAT TANI',
  donationBankName: 'Bank Mandiri',
  donationAccountNumber: '132-00-9876543-2',
  donationEwalletNumber: '0812-3456-7890 (GoPay/OVO/DANA)',
  donationQrisImage: '',
  donationUrl: '',
  updatedAt: new Date().toISOString(),
};

const CACHE_KEY = 'hikmat_public_app_config_cache';

export class PublicConfigService {
  private static instance: PublicConfigService;

  private constructor() {}

  public static getInstance(): PublicConfigService {
    if (!PublicConfigService.instance) {
      PublicConfigService.instance = new PublicConfigService();
    }
    return PublicConfigService.instance;
  }

  /**
   * Mengambil konfigurasi publik terbaru dari server dengan fallback cache & default offline
   */
  public async getPublicConfig(): Promise<PublicAppConfig> {
    try {
      const res = await fetch('/api/v1/config/public');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const configData: PublicAppConfig = {
            ...DEFAULT_OFFICIAL_CONFIG,
            ...json.data,
          };
          // Simpan ke cache lokal
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(configData));
          } catch {
            // Abaikan jika storage penuh
          }
          return configData;
        }
      }
    } catch {
      // Offline / jaringan gagal, gunakan cache atau default
    }

    // Coba baca dari cache lokal
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        return {
          ...DEFAULT_OFFICIAL_CONFIG,
          ...JSON.parse(cached),
        };
      }
    } catch {
      // Abaikan jika json corrupt
    }

    return { ...DEFAULT_OFFICIAL_CONFIG };
  }

  /**
   * Mengambil konfigurasi tersimpan secara sinkronus untuk render cepat instan
   */
  public getCachedConfigSync(): PublicAppConfig {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        return {
          ...DEFAULT_OFFICIAL_CONFIG,
          ...JSON.parse(cached),
        };
      }
    } catch {
      // Abaikan
    }
    return { ...DEFAULT_OFFICIAL_CONFIG };
  }
}

export const publicConfigService = PublicConfigService.getInstance();
