/**
 * HIKMAT TANI - Server Weather Proxy Service (Langkah 12)
 * 
 * Prinsip:
 * - Backend bertindak sebagai proxy aman dan isolator provider eksternal.
 * - API keys / konfigurasi provider tidak pernah bocor ke browser client.
 * - Server Caching: Mencegah banjir request ke provider eksternal (TTL 30 menit).
 * - Fallback & Error Isolation: Jika provider mati/timeout, server tetap mengembalikan data aman.
 * - Bahasa Ramah Petani: Menerjemahkan kode meteorologi WMO menjadi istilah santun dan mudah dipahami.
 */

import {
  WeatherConditionType,
  WeatherCurrent,
  WeatherDailyForecast,
  WeatherData,
} from '../../src/types/weather.ts';

interface CacheEntry {
  data: WeatherData;
  timestamp: number;
}

export class WeatherService {
  // In-Memory Server Cache (Key: `${lat.toFixed(2)}_${lon.toFixed(2)}`)
  private cache: Map<string, CacheEntry> = new Map();
  private cacheTtlMs: number = 30 * 60 * 1000; // 30 Menit

  /**
   * Helper konversi WMO Weather Code ke Bahasa Indonesia ramah petani
   */
  public static mapWmoCode(code: number): {
    condition: string;
    conditionType: WeatherConditionType;
  } {
    switch (code) {
      case 0:
        return { condition: 'Cerah', conditionType: 'CLEAR' };
      case 1:
        return { condition: 'Cerah Berawan', conditionType: 'PARTLY_CLOUDY' };
      case 2:
        return { condition: 'Sebagian Berawan', conditionType: 'PARTLY_CLOUDY' };
      case 3:
        return { condition: 'Berawan', conditionType: 'CLOUDY' };
      case 45:
      case 48:
        return { condition: 'Berkabut', conditionType: 'FOG' };
      case 51:
      case 53:
      case 55:
        return { condition: 'Gerimis', conditionType: 'DRIZZLE' };
      case 61:
        return { condition: 'Hujan Ringan', conditionType: 'LIGHT_RAIN' };
      case 63:
        return { condition: 'Hujan Sedang', conditionType: 'MODERATE_RAIN' };
      case 65:
        return { condition: 'Hujan Lebat', conditionType: 'HEAVY_RAIN' };
      case 80:
      case 81:
        return { condition: 'Hujan Lokal', conditionType: 'LIGHT_RAIN' };
      case 82:
        return { condition: 'Hujan Deras Lokal', conditionType: 'HEAVY_RAIN' };
      case 95:
      case 96:
      case 99:
        return { condition: 'Hujan Disertai Petir', conditionType: 'THUNDERSTORM' };
      default:
        return { condition: 'Berawan Sebagian', conditionType: 'PARTLY_CLOUDY' };
    }
  }

  /**
   * Format nama hari dalam Bahasa Indonesia ramah petani
   */
  public static getIndonesianDayLabel(targetDateStr: string, index: number): string {
    if (index === 0) return 'Hari Ini';
    if (index === 1) return 'Besok';

    const targetDate = new Date(targetDateStr);
    if (isNaN(targetDate.getTime())) return `Hari +${index}`;

    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    return days[targetDate.getDay()] || `Hari +${index}`;
  }

  /**
   * Ambil data cuaca untuk koordinat tertentu
   */
  public async getWeather(
    lat: number,
    lon: number,
    options?: { forceRefresh?: boolean; mockFetcher?: (url: string) => Promise<any> }
  ): Promise<WeatherData> {
    // Validasi input koordinat
    if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
      throw new Error('Koordinat lintang (lat) dan bujur (lon) harus berupa angka valid.');
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new Error('Rentang koordinat tidak valid (Lat: -90 s.d 90, Lon: -180 s.d 180).');
    }

    const cacheKey = `${lat.toFixed(2)}_${lon.toFixed(2)}`;
    const now = Date.now();

    // 1. Cek Cache Server
    if (!options?.forceRefresh && this.cache.has(cacheKey)) {
      const entry = this.cache.get(cacheKey)!;
      if (now - entry.timestamp < this.cacheTtlMs) {
        return {
          ...entry.data,
          current: {
            ...entry.data.current,
            source: 'CACHE',
          },
        };
      }
    }

    // 2. Request ke Provider Eksternal (Open-Meteo) via Server Proxy
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation,rain&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum&timezone=auto&forecast_days=5`;

      let json: any;
      if (options?.mockFetcher) {
        json = await options.mockFetcher(url);
      } else {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000); // 6 detik timeout

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'HikmatTani-WeatherProxy/1.0',
          },
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Provider weather error HTTP ${response.status}`);
        }

        json = await response.json();
      }

      const weatherData = this.parseProviderResponse(lat, lon, json);

      // Simpan ke Cache Server
      this.cache.set(cacheKey, {
        data: weatherData,
        timestamp: now,
      });

      return weatherData;
    } catch (error: any) {
      console.warn(`[WeatherService] Upstream fetch failed for (${lat}, ${lon}):`, error?.message);

      // Jika ada stale cache, gunakan stale cache daripada gagal total
      if (this.cache.has(cacheKey)) {
        const staleEntry = this.cache.get(cacheKey)!;
        return {
          ...staleEntry.data,
          current: {
            ...staleEntry.data.current,
            source: 'CACHE',
          },
          isOfflineFallback: true,
        };
      }

      // Jika tidak ada cache sama sekali, buat data estimasi aman (safe fallback)
      return this.generateSafeFallback(lat, lon);
    }
  }

  /**
   * Parser respons terstruktur dari Open-Meteo API
   */
  public parseProviderResponse(lat: number, lon: number, json: any): WeatherData {
    if (!json || typeof json !== 'object') {
      throw new Error('Format data cuaca tidak valid dari upstream provider.');
    }

    const currentRaw = json.current || {};
    const dailyRaw = json.daily || {};

    const wmoCode = currentRaw.weather_code ?? 1;
    const { condition, conditionType } = WeatherService.mapWmoCode(wmoCode);

    // Ambil probabilitas hujan hari ini dari daily jika tidak ada di current
    const dailyRainProb = dailyRaw.precipitation_probability_max?.[0] ?? 20;

    const current: WeatherCurrent = {
      temperature: Math.round((currentRaw.temperature_2m ?? 29) * 10) / 10,
      condition,
      conditionType,
      conditionCode: wmoCode,
      humidity: Math.round(currentRaw.relative_humidity_2m ?? 75),
      windSpeed: Math.round(currentRaw.wind_speed_10m ?? 8),
      rainProbability: Math.round(dailyRainProb),
      rainMm: currentRaw.rain !== undefined ? Math.round(currentRaw.rain * 10) / 10 : 0,
      updatedAt: new Date().toISOString(),
      source: 'LIVE',
    };

    const daily: WeatherDailyForecast[] = [];
    const dates: string[] = dailyRaw.time || [];

    for (let i = 0; i < dates.length && i < 5; i++) {
      const code = dailyRaw.weather_code?.[i] ?? 1;
      const parsed = WeatherService.mapWmoCode(code);
      daily.push({
        date: dates[i],
        dayLabel: WeatherService.getIndonesianDayLabel(dates[i], i),
        condition: parsed.condition,
        conditionType: parsed.conditionType,
        conditionCode: code,
        tempMax: Math.round(dailyRaw.temperature_2m_max?.[i] ?? 32),
        tempMin: Math.round(dailyRaw.temperature_2m_min?.[i] ?? 24),
        rainProbability: Math.round(dailyRaw.precipitation_probability_max?.[i] ?? 20),
        rainMm:
          dailyRaw.precipitation_sum?.[i] !== undefined
            ? Math.round(dailyRaw.precipitation_sum[i] * 10) / 10
            : undefined,
      });
    }

    return {
      latitude: lat,
      longitude: lon,
      timezone: json.timezone || 'Asia/Jakarta',
      current,
      daily,
      cachedAt: new Date().toISOString(),
    };
  }

  /**
   * Fallback aman saat provider tidak dapat dijangkau dan belum ada cache
   */
  public generateSafeFallback(lat: number, lon: number): WeatherData {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const current: WeatherCurrent = {
      temperature: 29,
      condition: 'Cerah Berawan',
      conditionType: 'PARTLY_CLOUDY',
      conditionCode: 1,
      humidity: 75,
      windSpeed: 6,
      rainProbability: 25,
      rainMm: 0,
      updatedAt: now.toISOString(),
      source: 'FALLBACK',
    };

    const daily: WeatherDailyForecast[] = [
      {
        date: todayStr,
        dayLabel: 'Hari Ini',
        condition: 'Cerah Berawan',
        conditionType: 'PARTLY_CLOUDY',
        conditionCode: 1,
        tempMax: 32,
        tempMin: 24,
        rainProbability: 25,
      },
      {
        date: new Date(now.getTime() + 86400000).toISOString().split('T')[0],
        dayLabel: 'Besok',
        condition: 'Berawan',
        conditionType: 'CLOUDY',
        conditionCode: 3,
        tempMax: 31,
        tempMin: 24,
        rainProbability: 30,
      },
    ];

    return {
      latitude: lat,
      longitude: lon,
      timezone: 'Asia/Jakarta',
      current,
      daily,
      cachedAt: now.toISOString(),
      isOfflineFallback: true,
    };
  }

  /**
   * Bersihkan cache server (untuk pengujian)
   */
  public clearCache(): void {
    this.cache.clear();
  }
}

export const weatherService = new WeatherService();
