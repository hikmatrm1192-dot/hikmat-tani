/**
 * HIKMAT TANI - Weather & External Info Domain Models (Langkah 12)
 * 
 * Prinsip:
 * - Data cuaca disajikan dalam terminologi sederhana yang mudah dipahami petani.
 * - Informasi cuaca adalah konteks pendukung lapang, BUKAN fondasi kaku aplikasi.
 * - Tersimpan secara offline-first dan siap ditampilkan saat tidak ada koneksi.
 */

import { ISODateString, Latitude, Longitude } from './common.ts';

export type WeatherConditionType =
  | 'CLEAR' // Cerah
  | 'PARTLY_CLOUDY' // Cerah Berawan
  | 'CLOUDY' // Berawan / Mendung
  | 'FOG' // Berkabut
  | 'DRIZZLE' // Gerimis
  | 'LIGHT_RAIN' // Hujan Ringan
  | 'MODERATE_RAIN' // Hujan Sedang
  | 'HEAVY_RAIN' // Hujan Lebat
  | 'THUNDERSTORM' // Hujan Petir
  | 'UNKNOWN'; // Tidak Diketahui

export interface WeatherCurrent {
  temperature: number; // Derajat Celcius (°C)
  condition: string; // Deskripsi ramah: "Cerah Berawan", "Hujan Sedang"
  conditionType: WeatherConditionType;
  conditionCode: number; // WMO Weather Interpretation Code
  humidity: number; // Kelembapan relatif (%)
  windSpeed: number; // Kecepatan angin (km/jam)
  rainProbability: number; // Kemungkinan hujan (%)
  rainMm?: number; // Curah hujan terukur/terprediksi (mm)
  updatedAt: ISODateString; // Waktu data diperbarui
  source: 'LIVE' | 'CACHE' | 'FALLBACK';
}

export interface WeatherDailyForecast {
  date: string; // YYYY-MM-DD
  dayLabel: string; // "Hari Ini", "Besok", "Senin", "Selasa", dll
  condition: string;
  conditionType: WeatherConditionType;
  conditionCode: number;
  tempMax: number;
  tempMin: number;
  rainProbability: number;
  rainMm?: number;
}

export interface WeatherData {
  latitude: Latitude;
  longitude: Longitude;
  locationName?: string;
  timezone: string;
  current: WeatherCurrent;
  daily: WeatherDailyForecast[];
  cachedAt: ISODateString;
  isOfflineFallback?: boolean;
}

export interface RegionalAlert {
  id: string;
  districtId?: string;
  title: string;
  severity: 'INFO' | 'WARNING' | 'DANGER';
  description: string;
  source: string;
  issuedAt: ISODateString;
  expiresAt: ISODateString;
  affectedRegions: string[];
}
