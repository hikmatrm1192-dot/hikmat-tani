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

export type WeatherRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

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
  humidity?: number;
  windSpeed?: number; // km/jam
  windDirection?: string; // e.g. "Timur", "Tenggara"
  windDirectionDeg?: number;
  riskLevel?: WeatherRiskLevel; // Rendah, Sedang, Tinggi
  riskReason?: string;
}

export type MediumTermTrendType = 'WETTER' | 'NORMAL' | 'DRIER';
export type RainProbabilityTrend = 'INCREASING' | 'NORMAL' | 'DECREASING';

export interface MediumTermTrend {
  weekNumber: 1 | 2 | 3 | 4;
  label: string; // "Minggu 1 (7-13 Hari)", dsb
  dateRange: string; // "07 Sep - 13 Sep"
  trendType: MediumTermTrendType; // 'WETTER' | 'NORMAL' | 'DRIER'
  trendLabel: string; // "Kecenderungan Lebih Basah", "Sekitar Normal", "Kecenderungan Lebih Kering"
  rainTrend: RainProbabilityTrend; // 'INCREASING' | 'NORMAL' | 'DECREASING'
  rainTrendLabel: string; // "Peluang Hujan Meningkat", "Peluang Hujan Stabil", "Peluang Hujan Menurun"
  estimatedRainMmRange: string; // "30 - 60 mm/minggu"
  tempAnomalyLabel: string; // "Suhu sekitar rata-rata musiman"
  desc: string; // Penjelasan probabilistik ramah petani
  agronomicImpact: string; // Catatan tindakan lapang
}

export type SeasonalRainfallTendency = 'ABOVE_NORMAL' | 'NORMAL' | 'BELOW_NORMAL';
export type SeasonalTempTendency = 'WARMER' | 'NORMAL' | 'COOLER';
export type ForecastConfidence = 'MODERATE' | 'LOW' | 'VERY_LOW';

export interface SeasonalOutlookMonth {
  monthIndex: number; // 1, 2, 3
  monthName: string; // "September 2026", "Oktober 2026", dll
  rainfallTendency: SeasonalRainfallTendency; // 'ABOVE_NORMAL' | 'NORMAL' | 'BELOW_NORMAL'
  rainfallTendencyLabel: string; // "Atas Normal (Lebih Basah)", "Normal", "Bawah Normal (Lebih Kering)"
  tempTendency: SeasonalTempTendency;
  tempTendencyLabel: string;
  confidence: ForecastConfidence; // 'MODERATE' | 'LOW' | 'VERY_LOW'
  confidenceLabel: string; // "Sedang (Ketidakpastian Wajar)", "Rendah (Ketidakpastian Tinggi)"
  monsoonPhase: string; // "Transisi Musim Kemarau ke Hujan", "Puncak Musim Hujan", dll
  summary: string;
  waterGuidance: string; // Panduan persiapan air & pola tanam
}

export type AgriRecommendationCategory =
  | 'FERTILIZER' // Pemupukan
  | 'SPRAYING' // Penyemprotan & Pestisida
  | 'WATER' // Tata Air & Drainase
  | 'OPT' // Pengamatan Hama & Penyakit
  | 'HARVEST' // Panen & Penjemuran Gabah
  | 'GENERAL'; // Umum

export interface AgriWeatherRecommendation {
  id: string;
  category: AgriRecommendationCategory;
  categoryLabel: string;
  urgency: 'INFO' | 'WARNING' | 'ALERT';
  title: string;
  reason: string; // Mengapa saran ini muncul berdasarkan cuaca & kondisi tanaman
  actionItem: string; // Tindakan konkret di sawah
  cropContext?: string; // Status tanaman terkait (HST, fase, riwayat)
  weatherContext?: string; // Kondisi cuaca pemicu
}

export interface WeatherData {
  latitude: Latitude;
  longitude: Longitude;
  locationName?: string;
  timezone: string;
  current: WeatherCurrent;
  daily: WeatherDailyForecast[];
  mediumTermTrends?: MediumTermTrend[];
  seasonalOutlooks?: SeasonalOutlookMonth[];
  dataSource?: string;
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

/**
 * FieldWeatherContext — Kontrak data konteks cuaca lapang untuk Recommendation Engine.
 * Cuaca bersifat sebagai data referensi/informasi tambahan (modifier kontekstual),
 * BUKAN decision maker mutlak.
 */
export interface FieldWeatherContext {
  isAvailable: boolean;
  source: 'LIVE' | 'CACHE' | 'FALLBACK';
  conditionType: WeatherConditionType;
  rainProbability: number;
  humidity: number;
  windSpeed: number;
  rainMm: number;
  hasHeavyRainForecast: boolean;
  forecastSummary?: string;
}
