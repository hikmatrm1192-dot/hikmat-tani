/**
 * HIKMAT TANI - Weather & External Info Test Suite (Langkah 12)
 * 
 * Pengujian:
 * 1. Weather API Success (Proxying & parsing WMO codes correctly)
 * 2. API Timeout Handling (Aborts gracefully without hanging)
 * 3. Upstream Provider Error (Handles 500/404 without crashing)
 * 4. Malformed Response Rejection (Handles corrupted upstream payloads safely)
 * 5. Server Cache (TTL caching avoids wasteful external requests)
 * 6. Location Validation (Missing or invalid coordinates rejected properly)
 * 7. Provider Credential Isolation (No secrets leaked to frontend / payload)
 * 8. Client Offline Fallback (Serves stored weather data when offline)
 * 9. Client Cache & Relative Time Formatting ("Diperbarui 10 menit lalu")
 * 10. Regional Alert Abstraction (No fake alarms generated)
 * 11. Agriculture Recommendation Independence (Engine runs 100% without weather)
 * 12. Weather WMO Code to Indonesian Translation
 */

import 'fake-indexeddb/auto';
import { WeatherService, weatherService } from '../server/services/weatherService.ts';
import { regionalAlertService } from '../server/services/regionalAlertService.ts';
import { ClientWeatherService } from '../src/services/weatherService.ts';
import { buildFieldContext } from '../src/engine/contextEngine.ts';
import { evaluateRecommendations } from '../src/engine/recommendation/evaluator.ts';
import { CropSeason, FieldWeatherContext, Land, WeatherData } from '../src/types/index.ts';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export async function runWeatherTests(): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}> {
  const results: TestResult[] = [];

  const runTest = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      results.push({ name, passed: true });
    } catch (err: any) {
      results.push({ name, passed: false, error: err?.message || String(err) });
    }
  };

  const clientService = new ClientWeatherService();
  weatherService.clearCache();

  // Mock Open-Meteo response
  const mockOpenMeteoResponse = {
    latitude: -6.57,
    longitude: 107.75,
    timezone: 'Asia/Jakarta',
    current: {
      temperature_2m: 29.4,
      relative_humidity_2m: 78,
      weather_code: 1, // Cerah Berawan
      wind_speed_10m: 7.2,
      rain: 0,
    },
    daily: {
      time: ['2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30', '2026-08-31'],
      weather_code: [1, 3, 61, 1, 2],
      temperature_2m_max: [32.1, 31.0, 29.5, 32.0, 31.5],
      temperature_2m_min: [24.0, 24.2, 23.8, 24.1, 24.0],
      precipitation_probability_max: [20, 40, 85, 15, 25],
      precipitation_sum: [0, 1.2, 12.5, 0, 0.4],
    },
  };

  // ==========================================
  // 1. Weather API Success & WMO Parsing
  // ==========================================
  await runTest('1. Weather API Success: Mengambil & mem-parsing data cuaca via proxy server', async () => {
    const customWeatherService = new WeatherService();
    const result = await customWeatherService.getWeather(-6.57, 107.75, {
      forceRefresh: true,
      mockFetcher: async () => mockOpenMeteoResponse,
    });

    if (!result || result.current.temperature !== 29.4) {
      throw new Error(`Suhu tidak sesuai: didapat ${result?.current?.temperature}, diharapkan 29.4`);
    }
    if (result.current.condition !== 'Cerah Berawan') {
      throw new Error(`Kondisi tidak sesuai: ${result.current.condition}`);
    }
    if (result.daily.length !== 5) {
      throw new Error(`Prakiraan harian harus 5 hari, didapat ${result.daily.length}`);
    }
    if (result.daily[0].dayLabel !== 'Hari Ini') {
      throw new Error(`Label hari pertama harus 'Hari Ini', didapat ${result.daily[0].dayLabel}`);
    }
    if (result.daily[1].dayLabel !== 'Besok') {
      throw new Error(`Label hari kedua harus 'Besok', didapat ${result.daily[1].dayLabel}`);
    }
  });

  // ==========================================
  // 2. API Timeout Handling
  // ==========================================
  await runTest('2. API Timeout Handling: Mengembalikan safe fallback jika upstream timeout', async () => {
    const customWeatherService = new WeatherService();
    const result = await customWeatherService.getWeather(-6.57, 107.75, {
      forceRefresh: true,
      mockFetcher: async () => {
        throw new Error('The operation was aborted due to timeout');
      },
    });

    if (!result || !result.current) {
      throw new Error('Safe fallback gagal dibuat saat timeout');
    }
    if (result.current.source !== 'FALLBACK') {
      throw new Error(`Source harus 'FALLBACK', didapat ${result.current.source}`);
    }
  });

  // ==========================================
  // 3. Upstream Provider Error (500 / 404)
  // ==========================================
  await runTest('3. Upstream Error: Menangani error HTTP provider secara anggun tanpa crash', async () => {
    const customWeatherService = new WeatherService();
    const result = await customWeatherService.getWeather(-6.57, 107.75, {
      forceRefresh: true,
      mockFetcher: async () => {
        throw new Error('Provider weather error HTTP 500 Internal Server Error');
      },
    });

    if (!result || typeof result.current.temperature !== 'number') {
      throw new Error('Gagal mengembalikan data cuaca fallback saat upstream error');
    }
  });

  // ==========================================
  // 4. Malformed Response Rejection
  // ==========================================
  await runTest('4. Malformed Response: Menolak respons rusak dari upstream provider', async () => {
    const customWeatherService = new WeatherService();
    const result = await customWeatherService.getWeather(-6.57, 107.75, {
      forceRefresh: true,
      mockFetcher: async () => 'Bukan JSON valid',
    });

    if (!result || result.current.source !== 'FALLBACK') {
      throw new Error('Seharusnya beralih ke safe fallback saat respons malformed');
    }
  });

  // ==========================================
  // 5. Server Cache
  // ==========================================
  await runTest('5. Server Cache: Menyimpan hasil di cache memory untuk koordinat yang sama', async () => {
    const customWeatherService = new WeatherService();
    let fetchCount = 0;

    const mockFetcher = async () => {
      fetchCount++;
      return mockOpenMeteoResponse;
    };

    // Request pertama: fetch
    const res1 = await customWeatherService.getWeather(-6.571, 107.752, { mockFetcher });
    // Request kedua: harus hit cache
    const res2 = await customWeatherService.getWeather(-6.572, 107.754, { mockFetcher });

    if (fetchCount !== 1) {
      throw new Error(`Fetch count seharusnya 1 karena cache hit, didapat ${fetchCount}`);
    }
    if (res2.current.source !== 'CACHE') {
      throw new Error(`Request kedua harus berstatus CACHE, didapat ${res2.current.source}`);
    }
  });

  // ==========================================
  // 6. Location Validation
  // ==========================================
  await runTest('6. Location Validation: Menolak koordinat di luar rentang valid atau NaN', async () => {
    const customWeatherService = new WeatherService();

    let threwNan = false;
    try {
      await customWeatherService.getWeather(NaN, 107.75);
    } catch {
      threwNan = true;
    }
    if (!threwNan) throw new Error('NaN latitude seharusnya melempar error');

    let threwOutOfRange = false;
    try {
      await customWeatherService.getWeather(999, 107.75);
    } catch {
      threwOutOfRange = true;
    }
    if (!threwOutOfRange) throw new Error('Out of range latitude seharusnya melempar error');
  });

  // ==========================================
  // 7. Provider Credential Isolation
  // ==========================================
  await runTest('7. Credential Isolation: Tidak ada secret/API key yang bocor ke payload respons', async () => {
    const customWeatherService = new WeatherService();
    const result = await customWeatherService.getWeather(-6.57, 107.75, {
      mockFetcher: async () => mockOpenMeteoResponse,
    });

    const serialized = JSON.stringify(result);
    if (
      serialized.toLowerCase().includes('apikey') ||
      serialized.toLowerCase().includes('secret') ||
      serialized.toLowerCase().includes('token')
    ) {
      throw new Error('Payload cuaca mengandung kata kunci kredensial/rahasia');
    }
  });

  // ==========================================
  // 8. Client Offline Fallback & Cache
  // ==========================================
  await runTest('8. Client Offline Fallback: Menampilkan data cache lokal saat offline', async () => {
    const testKey = 'hikmat_tani_weather_-6.57_107.75';
    const sampleData = {
      latitude: -6.57,
      longitude: 107.75,
      timezone: 'Asia/Jakarta',
      current: {
        temperature: 28,
        condition: 'Berawan',
        conditionType: 'CLOUDY' as const,
        conditionCode: 3,
        humidity: 80,
        windSpeed: 5,
        rainProbability: 30,
        updatedAt: '2026-08-26T12:00:00.000Z',
        source: 'CACHE' as const,
      },
      daily: [],
      cachedAt: '2026-08-26T12:00:00.000Z',
    };

    clientService.saveLocalCache(testKey, sampleData);
    const read = clientService.getLocalCache(testKey);

    if (!read || read.current.temperature !== 28) {
      throw new Error('Gagal menyimpan atau membaca cache lokal cuaca');
    }
  });

  // ==========================================
  // 9. Relative Time Formatting
  // ==========================================
  await runTest('9. Relative Time: Memformat waktu pembaruan dalam bahasa yang mudah dipahami', async () => {
    const nowIso = new Date().toISOString();
    const fiveMinAgoIso = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const twoHoursAgoIso = new Date(Date.now() - 2 * 3600 * 1000).toISOString();

    const textNow = ClientWeatherService.formatUpdatedTime(nowIso);
    const text5Min = ClientWeatherService.formatUpdatedTime(fiveMinAgoIso);
    const text2Hours = ClientWeatherService.formatUpdatedTime(twoHoursAgoIso);

    if (textNow !== 'Diperbarui baru saja') {
      throw new Error(`Format waktu 'baru saja' salah: ${textNow}`);
    }
    if (!text5Min.includes('5 menit lalu')) {
      throw new Error(`Format waktu 5 menit salah: ${text5Min}`);
    }
    if (!text2Hours.includes('2 jam lalu')) {
      throw new Error(`Format waktu 2 jam salah: ${text2Hours}`);
    }
  });

  // ==========================================
  // 10. Regional Alert Abstraction
  // ==========================================
  await runTest('10. Regional Alert Abstraction: Mengembalikan status bersih tanpa alarm palsu', async () => {
    const alerts = await regionalAlertService.getAlerts({ districtId: 'dist-subang-01' });

    if (!alerts || alerts.status !== 'NORMAL' || alerts.totalActive !== 0) {
      throw new Error('Regional alert service harus mengembalikan status NORMAL tanpa alarm palsu');
    }
    if (!Array.isArray(alerts.alerts) || alerts.alerts.length !== 0) {
      throw new Error('Daftar peringatan harus kosong jika belum ada sumber resmi terhubung');
    }
  });

  // ==========================================
  // 11. Agriculture Recommendation Independence
  // ==========================================
  await runTest('11. Recommendation Independence: Evaluator berjalan mulus tanpa ketergantungan cuaca', async () => {
    const sampleLand: Land = {
      id: 'land-test-01',
      farmerId: 'farmer-test',
      name: 'Petak Barat',
      areaHa: 0.5,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    };

    const sampleSeason: CropSeason = {
      id: 'season-test-01',
      landId: 'land-test-01',
      commodity: 'PADI',
      varietyName: 'Ciherang',
      plantedAreaHa: 0.5,
      plantingDate: '2026-08-01',
      status: 'ACTIVE',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    };

    // Evaluasi tanpa data cuaca
    const context = buildFieldContext({
      cropSeason: sampleSeason,
      land: sampleLand,
      activities: [],
      targetDate: new Date('2026-08-20'),
      varietyDurationDays: 120,
    });

    const recommendations = evaluateRecommendations(context);

    if (!Array.isArray(recommendations) || recommendations.length === 0) {
      throw new Error('Agriculture recommendation engine harus tetap menghasilkan saran tanpa cuaca');
    }
  });

  // ==========================================
  // 12. Weather WMO Code Translation
  // ==========================================
  await runTest('12. WMO Translation: Penerjemahan kode WMO ke Bahasa Indonesia ramah petani', async () => {
    const clear = WeatherService.mapWmoCode(0);
    const partlyCloudy = WeatherService.mapWmoCode(1);
    const lightRain = WeatherService.mapWmoCode(61);
    const thunderstorm = WeatherService.mapWmoCode(95);

    if (clear.condition !== 'Cerah' || clear.conditionType !== 'CLEAR') {
      throw new Error('WMO 0 harus Cerah');
    }
    if (partlyCloudy.condition !== 'Cerah Berawan' || partlyCloudy.conditionType !== 'PARTLY_CLOUDY') {
      throw new Error('WMO 1 harus Cerah Berawan');
    }
    if (lightRain.condition !== 'Hujan Ringan' || lightRain.conditionType !== 'LIGHT_RAIN') {
      throw new Error('WMO 61 harus Hujan Ringan');
    }
    if (thunderstorm.condition !== 'Hujan Disertai Petir' || thunderstorm.conditionType !== 'THUNDERSTORM') {
      throw new Error('WMO 95 harus Hujan Disertai Petir');
    }
  });

  // ==========================================
  // 13. Weather Context Contract Verification
  // ==========================================
  await runTest('13. Weather Context Contract: FieldWeatherContext mendukung LIVE, CACHE, FALLBACK, null, dan undefined', async () => {
    const dummySeason: CropSeason = {
      id: 'season-weather-contract',
      landId: 'land-test',
      commodity: 'PADI',
      varietyName: 'Inpari 32',
      plantedAreaHa: 1.0,
      plantingDate: '2026-08-01',
      status: 'ACTIVE',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    };

    // 1. LIVE
    const live: FieldWeatherContext = {
      isAvailable: true,
      source: 'LIVE',
      conditionType: 'CLEAR',
      rainProbability: 5,
      humidity: 65,
      windSpeed: 6,
      rainMm: 0,
      hasHeavyRainForecast: false,
      forecastSummary: 'Cerah Berawan',
    };
    const ctxLive = buildFieldContext({ cropSeason: dummySeason, weatherContext: live });
    if (!ctxLive.weatherContext || ctxLive.weatherContext.source !== 'LIVE' || !ctxLive.weatherContext.isAvailable) {
      throw new Error('Weather context LIVE gagal dipasang');
    }

    // 2. CACHE
    const cache: FieldWeatherContext = {
      isAvailable: true,
      source: 'CACHE',
      conditionType: 'CLOUDY',
      rainProbability: 50,
      humidity: 82,
      windSpeed: 12,
      rainMm: 3,
      hasHeavyRainForecast: false,
    };
    const ctxCache = buildFieldContext({ cropSeason: dummySeason, weatherContext: cache });
    if (!ctxCache.weatherContext || ctxCache.weatherContext.source !== 'CACHE') {
      throw new Error('Weather context CACHE gagal dipasang');
    }

    // 3. FALLBACK
    const fallback: FieldWeatherContext = {
      isAvailable: true,
      source: 'FALLBACK',
      conditionType: 'HEAVY_RAIN',
      rainProbability: 85,
      humidity: 90,
      windSpeed: 18,
      rainMm: 25,
      hasHeavyRainForecast: true,
      forecastSummary: 'Peluang hujan lebat tinggi',
    };
    const ctxFallback = buildFieldContext({ cropSeason: dummySeason, weatherContext: fallback });
    if (!ctxFallback.weatherContext || ctxFallback.weatherContext.source !== 'FALLBACK' || !ctxFallback.weatherContext.hasHeavyRainForecast) {
      throw new Error('Weather context FALLBACK gagal dipasang');
    }

    // 4. null
    const ctxNull = buildFieldContext({ cropSeason: dummySeason, weatherContext: null });
    if (ctxNull.weatherContext !== null) {
      throw new Error('Weather context null gagal diverifikasi');
    }

    // 5. undefined (default argument)
    const ctxUndef = buildFieldContext({ cropSeason: dummySeason });
    if (ctxUndef.weatherContext !== null && ctxUndef.weatherContext !== undefined) {
      throw new Error('Weather context undefined gagal diverifikasi');
    }
  });

  // ==========================================
  // 14. WeatherData Conversion to FieldWeatherContext
  // ==========================================
  await runTest('14. WeatherData Ingestion: buildFieldContext mengekstrak WeatherData secara deterministik & murni', async () => {
    const dummySeason: CropSeason = {
      id: 'season-weather-ingest',
      landId: 'land-test',
      commodity: 'PADI',
      varietyName: 'Ciherang',
      plantedAreaHa: 0.5,
      plantingDate: '2026-08-10',
      status: 'ACTIVE',
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
    };

    const weatherData: WeatherData = {
      latitude: -6.57,
      longitude: 107.75,
      locationName: 'Kasokandel',
      timezone: 'Asia/Jakarta',
      cachedAt: '2026-08-30T12:00:00.000Z',
      current: {
        temperature: 29,
        condition: 'Hujan Sedang',
        conditionType: 'MODERATE_RAIN',
        conditionCode: 63,
        humidity: 84,
        windSpeed: 14,
        rainProbability: 75,
        rainMm: 12,
        updatedAt: '2026-08-30T12:00:00.000Z',
        source: 'LIVE',
      },
      daily: [
        {
          date: '2026-08-30',
          dayLabel: 'Hari Ini',
          condition: 'Hujan Sedang',
          conditionType: 'MODERATE_RAIN',
          conditionCode: 63,
          tempMax: 30,
          tempMin: 23,
          rainProbability: 75,
          rainMm: 12,
        },
      ],
    };

    // Panggil buildFieldContext dengan WeatherData
    const ctx = buildFieldContext({
      cropSeason: dummySeason,
      weatherData,
    });

    if (!ctx.weatherContext) {
      throw new Error('weatherContext harus terdefinisi');
    }
    if (ctx.weatherContext.source !== 'LIVE') {
      throw new Error('source harus LIVE');
    }
    if (ctx.weatherContext.conditionType !== 'MODERATE_RAIN') {
      throw new Error('conditionType harus MODERATE_RAIN');
    }
    if (ctx.weatherContext.rainProbability !== 75) {
      throw new Error('rainProbability harus 75');
    }
    if (ctx.weatherContext.humidity !== 84) {
      throw new Error('humidity harus 84');
    }

    // Evaluator menghasilkan rekomendasi yang konsisten dan murni
    const recs = evaluateRecommendations(ctx);
    if (!Array.isArray(recs)) {
      throw new Error('evaluateRecommendations harus menghasilkan array');
    }
  });

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  return { total, passed, failed, results };
}

// Eksekusi jika dijalankan langsung (tsx tests/weather.test.ts)
if (process.argv[1]?.includes('weather.test')) {
  runWeatherTests().then((res) => {
    console.log(`\n=== HASIL UJI WEATHER & INFORMASI EKSTERNAL (LANGKAH 12) ===`);
    res.results.forEach((r) => {
      console.log(`${r.passed ? '✓' : '✗'} ${r.name}`);
      if (r.error) console.error(`  Error: ${r.error}`);
    });
    console.log(`Total: ${res.total} | Lolos: ${res.passed} | Gagal: ${res.failed}\n`);
    if (res.failed > 0) process.exit(1);
  });
}
