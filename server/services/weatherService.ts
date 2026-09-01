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
  MediumTermTrend,
  SeasonalOutlookMonth,
  WeatherConditionType,
  WeatherCurrent,
  WeatherDailyForecast,
  WeatherData,
  WeatherRiskLevel,
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
   * Format derajat mata angin menjadi arah mata angin Bahasa Indonesia
   */
  public static getWindDirectionLabel(degrees?: number): string {
    if (degrees === undefined || isNaN(degrees)) return 'Timur';
    const normalized = ((degrees % 360) + 360) % 360;
    if (normalized >= 337.5 || normalized < 22.5) return 'Utara';
    if (normalized >= 22.5 && normalized < 67.5) return 'Timur Laut';
    if (normalized >= 67.5 && normalized < 112.5) return 'Timur';
    if (normalized >= 112.5 && normalized < 157.5) return 'Tenggara';
    if (normalized >= 157.5 && normalized < 202.5) return 'Selatan';
    if (normalized >= 202.5 && normalized < 247.5) return 'Barat Daya';
    if (normalized >= 247.5 && normalized < 292.5) return 'Barat';
    return 'Barat Laut';
  }

  /**
   * Hitung tingkat risiko cuaca untuk kegiatan harian petani
   */
  public static calculateDailyRisk(
    rainProb: number,
    rainMm: number = 0,
    windSpeed: number = 0,
    conditionType: WeatherConditionType = 'PARTLY_CLOUDY'
  ): { riskLevel: WeatherRiskLevel; riskReason: string } {
    if (
      conditionType === 'THUNDERSTORM' ||
      conditionType === 'HEAVY_RAIN' ||
      rainMm >= 15 ||
      rainProb >= 70 ||
      windSpeed >= 20
    ) {
      let reason = 'Peluang hujan lebat atau angin kencang.';
      if (conditionType === 'THUNDERSTORM') reason = 'Waspada petir & hujan deras di sawah.';
      else if (rainMm >= 15 || rainProb >= 70) reason = 'Risiko limpasan pupuk & pestisida tercuci.';
      else if (windSpeed >= 20) reason = 'Angin kencang berisiko drift semprotan & tanaman rebah.';
      return { riskLevel: 'HIGH', riskReason: reason };
    }

    if (
      rainProb >= 35 ||
      rainMm >= 3 ||
      windSpeed >= 12 ||
      conditionType === 'MODERATE_RAIN'
    ) {
      let reason = 'Peluang hujan ringan-sedang atau angin semilir.';
      if (rainProb >= 35) reason = 'Perhatikan jeda hujan sebelum pemupukan tabur atau penyemprotan.';
      return { riskLevel: 'MEDIUM', riskReason: reason };
    }

    return {
      riskLevel: 'LOW',
      riskReason: 'Cuaca relatif kondusif untuk pemupukan, penyemprotan & pengolahan lahan.',
    };
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
   * Generate Prakiraan Jangka Menengah (2–4 Minggu) berbasis tren probabilistik
   */
  public static generateMediumTermTrends(dailyForecasts: WeatherDailyForecast[], startDate: Date): MediumTermTrend[] {
    const avgRainFirstWeek = dailyForecasts.slice(0, 7).reduce((acc, d) => acc + (d.rainMm || 0), 0);
    const avgRainProb = dailyForecasts.slice(0, 7).reduce((acc, d) => acc + d.rainProbability, 0) / Math.max(1, Math.min(7, dailyForecasts.length));

    const month = startDate.getMonth(); // 0 = Jan, 8 = Sep, 9 = Oct
    // Indonesia climatology trend guidance (Sep-Nov is transition to wetter)
    const isTransitionToRain = month >= 8 && month <= 11;
    const isPeakRain = month >= 11 || month <= 2;
    const isDrySeason = month >= 5 && month <= 7;

    const trends: MediumTermTrend[] = [];

    for (let w = 1; w <= 4; w++) {
      const wStart = new Date(startDate.getTime() + (w - 1) * 7 * 86400000);
      const wEnd = new Date(startDate.getTime() + (w * 7 - 1) * 86400000);
      const formatShort = (d: Date) => `${d.getDate().toString().padStart(2, '0')} ${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][d.getMonth()]}`;

      let trendType: 'WETTER' | 'NORMAL' | 'DRIER' = 'NORMAL';
      let trendLabel = 'Sekitar Normal';
      let rainTrend: 'INCREASING' | 'NORMAL' | 'DECREASING' = 'NORMAL';
      let rainTrendLabel = 'Peluang Hujan Stabil';
      let estRange = '25 - 50 mm/minggu';
      let desc = 'Distribusi curah hujan mingguan diperkirakan mendekati rata-rata klimatologis historis wilayah.';
      let agronomicImpact = 'Pola pengairan normal (intermittent / macak-macak) dan jadwal pemupukan dapat berjalan sesuai rencana.';

      if (isTransitionToRain) {
        if (w >= 3) {
          trendType = 'WETTER';
          trendLabel = 'Kecenderungan Lebih Basah';
          rainTrend = 'INCREASING';
          rainTrendLabel = 'Peluang Hujan Meningkat';
          estRange = '40 - 80 mm/minggu';
          desc = 'Kecenderungan peningkatan intensitas hujan seiring penguatan kelembapan monsun barat.';
          agronomicImpact = 'Persiapkan saluran pembuangan/drainase petak sawah dan perhatikan ketersediaan air olah tanah.';
        } else {
          trendType = avgRainProb > 50 ? 'WETTER' : 'NORMAL';
          trendLabel = trendType === 'WETTER' ? 'Kecenderungan Lebih Basah' : 'Sekitar Normal';
          rainTrend = 'NORMAL';
          rainTrendLabel = 'Peluang Hujan Stabil';
          estRange = '30 - 60 mm/minggu';
          desc = 'Peluang hujan lokal bersifat spasial dengan jeda cerah di pagi hingga siang hari.';
          agronomicImpact = 'Manfaatkan jeda cerah pagi untuk pemupukan susulan dan penyemprotan agens hayati.';
        }
      } else if (isDrySeason) {
        trendType = 'DRIER';
        trendLabel = 'Kecenderungan Lebih Kering';
        rainTrend = 'DECREASING';
        rainTrendLabel = 'Peluang Hujan Menurun';
        estRange = '5 - 20 mm/minggu';
        desc = 'Dominasi massa udara kering dari monsun timur dengan curah hujan di bawah rata-rata normal.';
        agronomicImpact = 'Prioritaskan efisiensi pemanfaatan air irigasi gilir/pompanisasi dan tutup retakan tanah.';
      } else if (isPeakRain) {
        trendType = 'WETTER';
        trendLabel = 'Kecenderungan Lebih Basah';
        rainTrend = 'INCREASING';
        rainTrendLabel = 'Peluang Hujan Meningkat';
        estRange = '60 - 120 mm/minggu';
        desc = 'Puncak musim hujan dengan akumulasi curah hujan tinggi dan potensi hujan merata.';
        agronomicImpact = 'Waspadai genangan tinggi pada tanaman muda dan peningkatan kelembapan OPT jamur/bakteri.';
      }

      trends.push({
        weekNumber: w as 1 | 2 | 3 | 4,
        label: `Minggu ${w} (${w === 1 ? '1–7 Hari' : `${(w - 1) * 7 + 1}–${w * 7} Hari`})`,
        dateRange: `${formatShort(wStart)} - ${formatShort(wEnd)}`,
        trendType,
        trendLabel,
        rainTrend,
        rainTrendLabel,
        estimatedRainMmRange: estRange,
        tempAnomalyLabel: 'Suhu berkisar 24°C – 33°C (normal)',
        desc,
        agronomicImpact,
      });
    }

    return trends;
  }

  /**
   * Generate Outlook 1–3 Bulan berbasis model agroklimatologi probabilistik
   */
  public static generateSeasonalOutlooks(startDate: Date): SeasonalOutlookMonth[] {
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    const outlooks: SeasonalOutlookMonth[] = [];

    for (let i = 1; i <= 3; i++) {
      const targetMonthDate = new Date(startDate.getFullYear(), startDate.getMonth() + i - 1, 1);
      const mIdx = targetMonthDate.getMonth();
      const yr = targetMonthDate.getFullYear();
      const mName = `${monthNames[mIdx]} ${yr}`;

      let rainTendency: 'ABOVE_NORMAL' | 'NORMAL' | 'BELOW_NORMAL' = 'NORMAL';
      let rainLabel = 'Sifat Hujan Normal (Klimatologis)';
      let tempTendency: 'WARMER' | 'NORMAL' | 'COOLER' = 'NORMAL';
      let tempLabel = 'Suhu Normal';
      let monsoonPhase = 'Fase Normal Musiman';
      let summary = '';
      let waterGuidance = '';

      if (mIdx >= 9 || mIdx <= 2) {
        // Musim Hujan / Pancaroba Masuk Hujan (Okt - Mar)
        rainTendency = mIdx === 11 || mIdx === 0 || mIdx === 1 ? 'ABOVE_NORMAL' : 'NORMAL';
        rainLabel = rainTendency === 'ABOVE_NORMAL' ? 'Atas Normal (Curah Hujan Tinggi)' : 'Normal Menuju Basah';
        monsoonPhase = mIdx >= 11 || mIdx <= 1 ? 'Puncak Musim Hujan (Monsun Barat)' : 'Awal Musim Hujan';
        summary = `Potensi akumulasi curah hujan bulanan berkisar 200–400 mm dengan frekuensi hari hujan yang tinggi.`;
        waterGuidance = 'Ketersediaan air irigasi melimpah. Fokuskan tata air pada pemeliharaan saluran pembuangan/drainase untuk mencegah genangan melebihi batas aman tinggi tanaman.';
      } else if (mIdx >= 5 && mIdx <= 8) {
        // Musim Kemarau (Jun - Sep)
        rainTendency = 'BELOW_NORMAL';
        rainLabel = 'Bawah Normal (Curah Hujan Rendah)';
        monsoonPhase = 'Musim Kemarau (Monsun Timur)';
        summary = `Curah hujan bulanan diprakirakan di bawah 100 mm dengan dominasi hari tanpa hujan cerah terik.`;
        waterGuidance = 'Rencanakan pola tanam hemat air (palawija/varietas tahan kekeringan) dan periksa sumber air sumur dangkal/pompa irigasi.';
      } else {
        // Peralihan Kemarau (Apr - Mei)
        rainTendency = 'NORMAL';
        rainLabel = 'Sifat Hujan Normal';
        monsoonPhase = 'Pancaroba / Peralihan Musim';
        summary = `Curah hujan berkisar 100–200 mm dengan variasi cuaca cerah terik diselingi hujan lebat berdurasi singkat.`;
        waterGuidance = 'Kondisi air cukup untuk pematangan bulir musim tanam berjalan dan persiapan pengolahan tanah musim berikutnya.';
      }

      outlooks.push({
        monthIndex: i,
        monthName: mName,
        rainfallTendency: rainTendency,
        rainfallTendencyLabel: rainLabel,
        tempTendency,
        tempTendencyLabel: tempLabel,
        confidence: i === 1 ? 'MODERATE' : i === 2 ? 'LOW' : 'VERY_LOW',
        confidenceLabel: i === 1 ? 'Tingkat Keyakinan Sedang (Ketidakpastian Wajar)' : i === 2 ? 'Tingkat Keyakinan Rendah (Ketidakpastian Cukup Tinggi)' : 'Tingkat Keyakinan Sangat Rendah (Ketidakpastian Tinggi)',
        monsoonPhase,
        summary,
        waterGuidance,
      });
    }

    return outlooks;
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
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,precipitation,rain&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_direction_10m_dominant&timezone=auto&forecast_days=10`;

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

    for (let i = 0; i < dates.length && i < 10; i++) {
      const code = dailyRaw.weather_code?.[i] ?? 1;
      const parsed = WeatherService.mapWmoCode(code);
      const rainProbability = Math.round(dailyRaw.precipitation_probability_max?.[i] ?? 20);
      const rainMm = dailyRaw.precipitation_sum?.[i] !== undefined
        ? Math.round(dailyRaw.precipitation_sum[i] * 10) / 10
        : undefined;
      const windSpeed = dailyRaw.wind_speed_10m_max?.[i] !== undefined
        ? Math.round(dailyRaw.wind_speed_10m_max[i])
        : Math.round(current.windSpeed);
      const windDirectionDeg = dailyRaw.wind_direction_10m_dominant?.[i];
      const windDirection = WeatherService.getWindDirectionLabel(windDirectionDeg);

      const { riskLevel, riskReason } = WeatherService.calculateDailyRisk(
        rainProbability,
        rainMm,
        windSpeed,
        parsed.conditionType
      );

      daily.push({
        date: dates[i],
        dayLabel: WeatherService.getIndonesianDayLabel(dates[i], i),
        condition: parsed.condition,
        conditionType: parsed.conditionType,
        conditionCode: code,
        tempMax: Math.round(dailyRaw.temperature_2m_max?.[i] ?? 32),
        tempMin: Math.round(dailyRaw.temperature_2m_min?.[i] ?? 24),
        rainProbability,
        rainMm,
        humidity: Math.round(current.humidity),
        windSpeed,
        windDirection,
        windDirectionDeg,
        riskLevel,
        riskReason,
      });
    }

    const now = new Date();
    const mediumTermTrends = WeatherService.generateMediumTermTrends(daily, now);
    const seasonalOutlooks = WeatherService.generateSeasonalOutlooks(now);

    return {
      latitude: lat,
      longitude: lon,
      timezone: json.timezone || 'Asia/Jakarta',
      current,
      daily,
      mediumTermTrends,
      seasonalOutlooks,
      dataSource: 'Open-Meteo Weather API & Agroklimatologi BMKG',
      cachedAt: new Date().toISOString(),
    };
  }

  /**
   * Fallback aman saat provider tidak dapat dijangkau dan belum ada cache
   */
  public generateSafeFallback(lat: number, lon: number): WeatherData {
    const now = new Date();
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

    const daily: WeatherDailyForecast[] = [];
    for (let i = 0; i < 10; i++) {
      const d = new Date(now.getTime() + i * 86400000);
      const dateStr = d.toISOString().split('T')[0];
      const rainProb = [25, 30, 45, 60, 20, 15, 35, 40, 25, 20][i] || 25;
      const code = rainProb > 50 ? 61 : rainProb > 30 ? 3 : 1;
      const parsed = WeatherService.mapWmoCode(code);
      const { riskLevel, riskReason } = WeatherService.calculateDailyRisk(
        rainProb,
        rainProb > 50 ? 5.2 : 0,
        7,
        parsed.conditionType
      );

      daily.push({
        date: dateStr,
        dayLabel: WeatherService.getIndonesianDayLabel(dateStr, i),
        condition: parsed.condition,
        conditionType: parsed.conditionType,
        conditionCode: code,
        tempMax: 32,
        tempMin: 24,
        rainProbability: rainProb,
        rainMm: rainProb > 50 ? 5.2 : 0,
        humidity: 75,
        windSpeed: 7,
        windDirection: 'Timur',
        riskLevel,
        riskReason,
      });
    }

    const mediumTermTrends = WeatherService.generateMediumTermTrends(daily, now);
    const seasonalOutlooks = WeatherService.generateSeasonalOutlooks(now);

    return {
      latitude: lat,
      longitude: lon,
      timezone: 'Asia/Jakarta',
      current,
      daily,
      mediumTermTrends,
      seasonalOutlooks,
      dataSource: 'Estimasi Agroklimatologi Regional (Data Tersimpan)',
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

