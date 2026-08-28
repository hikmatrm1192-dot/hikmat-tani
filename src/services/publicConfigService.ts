/**
 * HIKMAT TANI - Public Application Configuration Service (Langkah 15 & 16)
 * 
 * Mengambil data konfigurasi resmi HIKMAT TANI dari server (rekening, bank, QRIS, status donasi, kontak, dan identitas visual/branding).
 * Dilengkapi dengan penyimpanan cache lokal, listener reaktif, dan fallback offline sehingga aplikasi petani
 * tetap berfungsi 100% mandiri dan langsung merender identitas aktif saat offline.
 */

import { useEffect, useState } from 'react';

export interface PublicAppConfig {
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
  updatedAt?: string;
}

export const DEFAULT_OFFICIAL_CONFIG: PublicAppConfig = {
  appName: 'HIKMAT TANI',
  slogan: 'CERDAS BERTANI, BIJAK MENGAMBIL KEPUTUSAN.',
  logoUrl: '/icon-512.png',
  logoPrimary: '/icon-512.png',
  logoHorizontal: '/logo-hikmat-tani-full.png',
  appIcon: '/icon-192.png',
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
  private listeners: Set<(config: PublicAppConfig) => void> = new Set();
  private currentConfig: PublicAppConfig;

  private constructor() {
    this.currentConfig = this.getCachedConfigSync();
    this.applyBrandingToDocument(this.currentConfig);
  }

  public static getInstance(): PublicConfigService {
    if (!PublicConfigService.instance) {
      PublicConfigService.instance = new PublicConfigService();
    }
    return PublicConfigService.instance;
  }

  /**
   * Subscribe ke perubahan konfigurasi secara real-time
   */
  public subscribe(listener: (config: PublicAppConfig) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(config: PublicAppConfig): void {
    this.currentConfig = config;
    this.applyBrandingToDocument(config);
    this.listeners.forEach((listener) => {
      try {
        listener(config);
      } catch (err) {
        console.error('[PublicConfigService] Listener error:', err);
      }
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hikmat_brand_config_updated', { detail: config }));
    }
  }

  /**
   * Menerapkan branding ke elemen global browser (document title & favicon)
   */
  public applyBrandingToDocument(config: PublicAppConfig): void {
    if (typeof document === 'undefined') return;

    try {
      if (config.appName) {
        const titleText = `${config.appName} — ${config.slogan || 'CERDAS BERTANI, BIJAK MENGAMBIL KEPUTUSAN.'}`;
        document.title = titleText;
      }

      const iconUrl = config.appIcon || config.logoPrimary || '/icon-192.png';
      let faviconLink = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
      if (faviconLink && iconUrl) {
        faviconLink.href = iconUrl;
      }
    } catch {
      // Abaikan jika browser membatasi DOM
    }
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
            logoPrimary: json.data.logoPrimary || json.data.logoUrl || DEFAULT_OFFICIAL_CONFIG.logoPrimary,
            logoHorizontal: json.data.logoHorizontal || DEFAULT_OFFICIAL_CONFIG.logoHorizontal,
            appIcon: json.data.appIcon || DEFAULT_OFFICIAL_CONFIG.appIcon,
          };
          // Simpan ke cache lokal
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(configData));
          } catch {
            // Abaikan jika storage penuh
          }
          this.notify(configData);
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
        const parsed = JSON.parse(cached);
        const configData: PublicAppConfig = {
          ...DEFAULT_OFFICIAL_CONFIG,
          ...parsed,
          logoPrimary: parsed.logoPrimary || parsed.logoUrl || DEFAULT_OFFICIAL_CONFIG.logoPrimary,
          logoHorizontal: parsed.logoHorizontal || DEFAULT_OFFICIAL_CONFIG.logoHorizontal,
          appIcon: parsed.appIcon || DEFAULT_OFFICIAL_CONFIG.appIcon,
        };
        this.notify(configData);
        return configData;
      }
    } catch {
      // Abaikan jika json corrupt
    }

    this.notify(DEFAULT_OFFICIAL_CONFIG);
    return { ...DEFAULT_OFFICIAL_CONFIG };
  }

  /**
   * Mengambil konfigurasi tersimpan secara sinkronus untuk render cepat instan
   */
  public getCachedConfigSync(): PublicAppConfig {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          ...DEFAULT_OFFICIAL_CONFIG,
          ...parsed,
          logoPrimary: parsed.logoPrimary || parsed.logoUrl || DEFAULT_OFFICIAL_CONFIG.logoPrimary,
          logoHorizontal: parsed.logoHorizontal || DEFAULT_OFFICIAL_CONFIG.logoHorizontal,
          appIcon: parsed.appIcon || DEFAULT_OFFICIAL_CONFIG.appIcon,
        };
      }
    } catch {
      // Abaikan
    }
    return { ...DEFAULT_OFFICIAL_CONFIG };
  }

  /**
   * Memperbarui cache lokal dan menyebarkan event ke seluruh komponen aplikasi secara instan
   */
  public updateLocalConfig(newConfig: Partial<PublicAppConfig>): PublicAppConfig {
    const current = this.getCachedConfigSync();
    const updated: PublicAppConfig = {
      ...current,
      ...newConfig,
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(updated));
    } catch {
      // Abaikan
    }

    this.notify(updated);
    return updated;
  }

  /**
   * Mengembalikan konfigurasi ke setelan default resmi HIKMAT TANI
   */
  public resetToDefault(): PublicAppConfig {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(DEFAULT_OFFICIAL_CONFIG));
    } catch {
      // Abaikan
    }

    this.notify(DEFAULT_OFFICIAL_CONFIG);
    return { ...DEFAULT_OFFICIAL_CONFIG };
  }
}

export const publicConfigService = PublicConfigService.getInstance();

/**
 * Custom React Hook untuk mendapatkan data konfigurasi dan identitas visual aplikasi yang reaktif
 */
export function useBrandConfig(): PublicAppConfig {
  const [config, setConfig] = useState<PublicAppConfig>(() =>
    publicConfigService.getCachedConfigSync()
  );

  useEffect(() => {
    // Sinkronisasi data awal
    setConfig(publicConfigService.getCachedConfigSync());

    // Subscribe ke pembaruan lokal & server
    const unsubscribe = publicConfigService.subscribe((latest) => {
      setConfig(latest);
    });

    // Ambil data terbaru dari server jika online
    publicConfigService.getPublicConfig().then((latest) => {
      setConfig(latest);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return config;
}

