/**
 * HIKMAT TANI - Client Weather Service (Langkah 12)
 * 
 * Prinsip:
 * - Offline-First: Selalu mengutamakan ketersediaan informasi di lapang.
 * - Cache Cerdas: Menyimpan perkiraan cuaca terakhir di penyimpanan lokal (localStorage).
 * - Graceful Fallback: Kegagalan koneksi atau API tidak pernah merusak fungsionalitas aplikasi.
 * - Santun & Bersahabat: Menyajikan status dan waktu pembaruan dalam bahasa yang mudah dimengerti.
 */

import { WeatherData } from '../types/weather.ts';

const CACHE_PREFIX = 'hikmat_tani_weather_';
const LAST_WEATHER_KEY = 'hikmat_tani_weather_last';
const CACHE_MAX_AGE_MS = 60 * 60 * 1000; // 1 Jam cache lokal

export interface WeatherFetchResult {
  data: WeatherData | null;
  status: 'ONLINE_FRESH' | 'OFFLINE_CACHE' | 'NO_DATA' | 'ERROR';
  message: string;
}

export class ClientWeatherService {
  private memoryCache: Map<string, string> = new Map();

  /**
   * Mengambil data cuaca berdasarkan koordinat
   */
  public async getWeather(
    lat: number,
    lon: number,
    options?: { forceRefresh?: boolean; baseUrl?: string }
  ): Promise<WeatherFetchResult> {
    const cacheKey = `${CACHE_PREFIX}${lat.toFixed(2)}_${lon.toFixed(2)}`;
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    // 1. Ambil dari Cache Lokal jika ada
    const cachedData = this.getLocalCache(cacheKey);

    // 2. Jika Sedang Offline:
    if (!isOnline) {
      if (cachedData) {
        return {
          data: {
            ...cachedData,
            isOfflineFallback: true,
          },
          status: 'OFFLINE_CACHE',
          message: 'Menampilkan informasi terakhir yang tersimpan.',
        };
      }

      return {
        data: null,
        status: 'NO_DATA',
        message: 'Informasi cuaca belum tersedia di perangkat.',
      };
    }

    // 3. Jika Online dan Cache masih segar & tidak diminta force:
    if (!options?.forceRefresh && cachedData) {
      const cacheAge = Date.now() - new Date(cachedData.cachedAt).getTime();
      if (cacheAge < CACHE_MAX_AGE_MS) {
        return {
          data: cachedData,
          status: 'ONLINE_FRESH',
          message: 'Informasi cuaca terkini.',
        };
      }
    }

    // 4. Request ke Backend Proxy
    const baseUrl = options?.baseUrl || '/api/v1/info/weather';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000); // 7 detik

      const response = await fetch(`${baseUrl}?lat=${lat}&lon=${lon}`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Server error HTTP ${response.status}`);
      }

      const json = await response.json();
      if (!json.success || !json.data) {
        throw new Error(json.error?.message || 'Data cuaca tidak valid');
      }

      const weatherData: WeatherData = json.data;

      // Simpan ke Cache Lokal
      this.saveLocalCache(cacheKey, weatherData);

      return {
        data: weatherData,
        status: 'ONLINE_FRESH',
        message: 'Informasi cuaca terkini.',
      };
    } catch (error: any) {
      console.warn('[ClientWeatherService] Fetch warning:', error?.message);

      // Fallback ke cache lokal lama jika tersedia
      if (cachedData) {
        return {
          data: {
            ...cachedData,
            isOfflineFallback: true,
          },
          status: 'OFFLINE_CACHE',
          message: 'Menampilkan informasi terakhir yang tersimpan.',
        };
      }

      // Cek apakah ada cache cuaca terakhir dari koordinat lain
      const lastGlobalCache = this.getLocalCache(LAST_WEATHER_KEY);
      if (lastGlobalCache) {
        return {
          data: {
            ...lastGlobalCache,
            isOfflineFallback: true,
          },
          status: 'OFFLINE_CACHE',
          message: 'Menampilkan informasi perkiraan terakhir yang tersimpan.',
        };
      }

      return {
        data: null,
        status: 'ERROR',
        message: 'Informasi cuaca belum dapat diperbarui.',
      };
    }
  }

  /**
   * Membaca cache dari localStorage (atau memory fallback)
   */
  public getLocalCache(key: string): WeatherData | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(key);
        if (raw) {
          return JSON.parse(raw);
        }
      } else if (this.memoryCache.has(key)) {
        const raw = this.memoryCache.get(key)!;
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Gagal membaca cache cuaca:', e);
    }
    return null;
  }

  /**
   * Menyimpan data cuaca ke localStorage (dan memory fallback)
   */
  public saveLocalCache(key: string, data: WeatherData): void {
    try {
      const serialized = JSON.stringify(data);
      this.memoryCache.set(key, serialized);
      this.memoryCache.set(LAST_WEATHER_KEY, serialized);

      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(key, serialized);
        localStorage.setItem(LAST_WEATHER_KEY, serialized);
      }
    } catch (e) {
      console.warn('Gagal menyimpan cache cuaca:', e);
    }
  }

  /**
   * Helper format waktu pembaruan ramah pengguna (contoh: "Diperbarui 10 menit lalu")
   */
  public static formatUpdatedTime(isoString: string): string {
    if (!isoString) return 'Belum diperbarui';

    const updated = new Date(isoString);
    if (isNaN(updated.getTime())) return 'Waktu tidak valid';

    const diffMs = Date.now() - updated.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Diperbarui baru saja';
    if (diffMins < 60) return `Diperbarui ${diffMins} menit lalu`;
    if (diffHours < 24) return `Diperbarui ${diffHours} jam lalu`;
    return `Diperbarui ${diffDays} hari lalu`;
  }
}

export const clientWeatherService = new ClientWeatherService();
