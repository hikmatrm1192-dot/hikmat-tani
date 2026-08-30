/**
 * HIKMAT TANI - Agriculture Logic Engine Unit & Acceptance Tests
 * 
 * Verifikasi Mendalam Sesuai Spesifikasi:
 * A. HST Engine: tanggal sama, 1 hari, 30 hari, tanggal invalid, timezone boundary.
 * B. Growth Phase Engine: HST rendah, menengah, tinggi, umur varietas variatif, varietas tidak tersedia.
 * C. Nutrient Engine: Urea (N 46%), NPK (15-15-15+10S), jumlah nol, jumlah negatif ditolak, komposisi kosong.
 * D. Timeline Engine: aktivitas acak, tanggal sama, musim tanam tanpa aktivitas.
 * E. Context Engine: data lengkap, data sebagian, data kosong/belum tanam.
 * F. Recommendation Engine: evaluasi saran, keterlacakan referensi, data tidak lengkap, tidak menghasilkan farmer decision.
 */

import {
  buildActivityTimeline,
  buildFieldContext,
  calculateDosePerHa,
  calculateHST,
  calculateNutrients,
  determineGrowthPhase,
  evaluateRecommendations,
  hectaresToSquareMeters,
  kgToGrams,
  squareMetersToHectares,
} from '../src/engine/index.ts';
import {
  Activity,
  CropSeason,
  FertilizerApplication,
  FieldWeatherContext,
  Land,
  OptObservation,
  WeatherData,
} from '../src/types/index.ts';

export interface EngineTestResult {
  suite: string;
  name: string;
  passed: boolean;
  message: string;
}

export async function runEngineTests(): Promise<{
  allPassed: boolean;
  total: number;
  passed: number;
  failed: number;
  results: EngineTestResult[];
}> {
  const results: EngineTestResult[] = [];

  function test(suite: string, name: string, fn: () => void) {
    try {
      fn();
      results.push({
        suite,
        name,
        passed: true,
        message: 'Lolos uji verifikasi.',
      });
    } catch (err: any) {
      results.push({
        suite,
        name,
        passed: false,
        message: err?.message || String(err),
      });
    }
  }

  // ==========================================
  // SUITE A: HST Engine
  // ==========================================
  test('HST Engine', 'A1. Tanggal tanam dan target sama (0 HST)', () => {
    const res = calculateHST('2026-08-01', '2026-08-01');
    if (!res.isValid || res.hst !== 0) {
      throw new Error(`HST harus 0 pada hari tanam, didapat: ${res.hst}`);
    }
  });

  test('HST Engine', 'A2. Selisih 1 hari kalender (1 HST)', () => {
    const res = calculateHST('2026-08-01', '2026-08-02');
    if (!res.isValid || res.hst !== 1) {
      throw new Error(`HST harus 1, didapat: ${res.hst}`);
    }
  });

  test('HST Engine', 'A3. Selisih 30 hari kalender (30 HST)', () => {
    const res = calculateHST('2026-08-01', '2026-08-31');
    if (!res.isValid || res.hst !== 30) {
      throw new Error(`HST harus 30, didapat: ${res.hst}`);
    }
  });

  test('HST Engine', 'A4. Penanganan tanggal tidak valid (Invalid Date Handling)', () => {
    const res = calculateHST('tanggal-rusak', '2026-08-01');
    if (res.isValid || res.hst !== null || !res.error) {
      throw new Error('Tanggal invalid harus menghasilkan isValid: false dan pesan error');
    }
  });

  test('HST Engine', 'A5. Normalisasi Timezone Boundary (ISO dengan offset berbeda)', () => {
    // 2026-08-01T23:59:00+07:00 vs 2026-08-02T01:00:00+07:00 (selisih hari kalender murni)
    const res = calculateHST('2026-08-01T23:59:00Z', '2026-08-02T00:01:00Z');
    if (!res.isValid || res.hst !== 1) {
      throw new Error(`Timezone boundary harus konsisten menghasilkan 1 HST, didapat: ${res.hst}`);
    }
  });

  // ==========================================
  // SUITE B: Growth Phase Engine
  // ==========================================
  test('Growth Phase', 'B1. HST Rendah (Vegetatif Awal)', () => {
    const phase = determineGrowthPhase(7, 120);
    if (phase.stageCategory !== 'VEGETATIVE' || phase.phaseCode !== 'VEGETATIVE_EARLY') {
      throw new Error(`7 HST pada varietas 120 hari harus VEGETATIVE_EARLY, didapat: ${phase.phaseCode}`);
    }
  });

  test('Growth Phase', 'B2. HST Menengah (Primordia & Bunting)', () => {
    // 60 HST pada varietas 120 hari (50% umur) -> Generatif Inisiasi Malai / Primordia
    const phase = determineGrowthPhase(60, 120);
    if (phase.stageCategory !== 'GENERATIVE' || phase.phaseCode !== 'GENERATIVE_PANICLE_INITIATION') {
      throw new Error(`60 HST pada 120 hari harus GENERATIVE_PANICLE_INITIATION, didapat: ${phase.phaseCode}`);
    }
  });

  test('Growth Phase', 'B3. HST Tinggi (Pematangan / Siap Panen)', () => {
    // 112 HST pada varietas 115 hari (97% umur)
    const phase = determineGrowthPhase(112, 115);
    if (phase.stageCategory !== 'RIPENING' || phase.phaseCode !== 'RIPENING_MATURE_HARVEST') {
      throw new Error(`112 HST pada 115 hari harus RIPENING_MATURE_HARVEST, didapat: ${phase.phaseCode}`);
    }
  });

  test('Growth Phase', 'B4. Varietas dengan Umur Berbeda (Genjah 95 hari vs Dalam 140 hari)', () => {
    // 50 HST pada varietas genjah 95 hari (>50%) -> Bunting/Berbunga
    const genjah = determineGrowthPhase(50, 95);
    // 50 HST pada varietas dalam 140 hari (<40%) -> Vegetatif Anakan
    const dalam = determineGrowthPhase(50, 140);

    if (genjah.stageCategory === dalam.stageCategory) {
      throw new Error('Varietas dengan umur berbeda harus menghasilkan fase fenologi yang disesuaikan');
    }
  });

  test('Growth Phase', 'B5. Data Umur Varietas Tidak Tersedia (Estimasi Generik)', () => {
    const phase = determineGrowthPhase(30, null);
    if (!phase.isEstimated || !phase.notes) {
      throw new Error('Fase tanpa data varietas harus ditandai isEstimated: true dan memiliki catatan');
    }
  });

  // ==========================================
  // SUITE C: Nutrient Engine & Unit Conversion
  // ==========================================
  test('Nutrient Engine', 'C1. Perhitungan Pupuk Tunggal Urea 100 kg (N 46%)', () => {
    const res = calculateNutrients(100, { N: 46 });
    if (!res.isValid || res.primarySummary.N_kg !== 46) {
      throw new Error(`N murni harus 46 kg, didapat: ${res.primarySummary.N_kg}`);
    }
  });

  test('Nutrient Engine', 'C2. Perhitungan Pupuk Majemuk NPK Phonska 100 kg (15-15-15 + 10S)', () => {
    const res = calculateNutrients(100, { N: 15, P2O5: 15, K2O: 15, S: 10 });
    if (
      res.primarySummary.N_kg !== 15 ||
      res.primarySummary.P2O5_kg !== 15 ||
      res.primarySummary.K2O_kg !== 15 ||
      res.primarySummary.S_kg !== 10
    ) {
      throw new Error('Kandungan hara NPK Phonska tidak sesuai');
    }
  });

  test('Nutrient Engine', 'C3. Jumlah Pupuk Nol (0 kg)', () => {
    const res = calculateNutrients(0, { N: 46 });
    if (!res.isValid || res.primarySummary.N_kg !== 0) {
      throw new Error('Aplikasi 0 kg harus valid dengan hara 0 kg');
    }
  });

  test('Nutrient Engine', 'C4. Jumlah Pupuk Negatif Harus Ditolak', () => {
    const res = calculateNutrients(-50, { N: 46 });
    if (res.isValid || !res.error) {
      throw new Error('Jumlah pupuk negatif harus ditolak (isValid: false)');
    }
  });

  test('Nutrient Engine', 'C5. Komposisi Kosong / Tidak Diketahui', () => {
    const res = calculateNutrients(50, null);
    if (!res.isValid || Object.keys(res.nutrientsKg).length !== 0) {
      throw new Error('Komposisi kosong harus menghasilkan nutrient list kosong tanpa crash');
    }
  });

  test('Unit Conversion', 'C6. Konversi Luas & Dosis per Hektar', () => {
    const ha = squareMetersToHectares(7500); // 7500 m2 = 0.75 ha
    if (ha !== 0.75) throw new Error(`7500 m2 harus 0.75 ha, didapat: ${ha}`);

    const m2 = hectaresToSquareMeters(1.2);
    if (m2 !== 12000) throw new Error(`1.2 ha harus 12000 m2, didapat: ${m2}`);

    const grams = kgToGrams(50);
    if (grams !== 50000) throw new Error(`50 kg harus 50000 gram, didapat: ${grams}`);

    const dosePerHa = calculateDosePerHa(75, 0.75); // 75kg pada 0.75ha = 100 kg/ha
    if (dosePerHa !== 100) throw new Error(`Dosis harus 100 kg/ha, didapat: ${dosePerHa}`);
  });

  // ==========================================
  // SUITE D: Activity Timeline Engine
  // ==========================================
  const dummySeason: CropSeason = {
    id: 'season-test-1',
    landId: 'land-1',
    commodity: 'Padi',
    varietyName: 'Inpari 32 HDB',
    plantingDate: '2026-08-01T00:00:00.000Z',
    plantedAreaHa: 1.0,
    status: 'ACTIVE',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };

  test('Timeline Engine', 'D1. Aktivitas Acak Terurut Kronologis', () => {
    const rawActs: Activity[] = [
      {
        id: 'act-3',
        cropSeasonId: 'season-test-1',
        category: 'OPT',
        activityDate: '2026-08-25T00:00:00.000Z',
        hst: 24,
        createdAt: '2026-08-25T00:00:00.000Z',
        updatedAt: '2026-08-25T00:00:00.000Z',
      },
      {
        id: 'act-1',
        cropSeasonId: 'season-test-1',
        category: 'FERTILIZER',
        activityDate: '2026-08-10T00:00:00.000Z',
        hst: 9,
        createdAt: '2026-08-10T00:00:00.000Z',
        updatedAt: '2026-08-10T00:00:00.000Z',
      },
      {
        id: 'act-2',
        cropSeasonId: 'season-test-1',
        category: 'IRRIGATION',
        activityDate: '2026-08-18T00:00:00.000Z',
        hst: 17,
        createdAt: '2026-08-18T00:00:00.000Z',
        updatedAt: '2026-08-18T00:00:00.000Z',
      },
    ];

    const timeline = buildActivityTimeline({
      cropSeason: dummySeason,
      activities: rawActs,
    });

    // Harus terurut: Tanam (01 Aug) -> act-1 (10 Aug) -> act-2 (18 Aug) -> act-3 (25 Aug)
    if (timeline.length !== 4) throw new Error(`Timeline harus berisi 4 event, didapat: ${timeline.length}`);
    if (timeline[0].category !== 'PLANTING') throw new Error('Event pertama harus hari tanam');
    if (timeline[1].activityId !== 'act-1') throw new Error('Event kedua harus act-1');
    if (timeline[3].activityId !== 'act-3') throw new Error('Event terakhir harus act-3');
  });

  test('Timeline Engine', 'D2. Aktivitas dengan Tanggal Sama Tidak Hilang', () => {
    const rawActs: Activity[] = [
      {
        id: 'act-a',
        cropSeasonId: 'season-test-1',
        category: 'FERTILIZER',
        activityDate: '2026-08-10T00:00:00.000Z',
        hst: 9,
        createdAt: '2026-08-10T00:00:00.000Z',
        updatedAt: '2026-08-10T00:00:00.000Z',
      },
      {
        id: 'act-b',
        cropSeasonId: 'season-test-1',
        category: 'IRRIGATION',
        activityDate: '2026-08-10T00:00:00.000Z',
        hst: 9,
        createdAt: '2026-08-10T00:00:00.000Z',
        updatedAt: '2026-08-10T00:00:00.000Z',
      },
    ];

    const timeline = buildActivityTimeline({
      cropSeason: dummySeason,
      activities: rawActs,
    });

    if (timeline.length !== 3) throw new Error('Kedua aktivitas bertanggal sama harus ada di timeline');
  });

  test('Timeline Engine', 'D3. Musim Tanam Tanpa Aktivitas', () => {
    const timeline = buildActivityTimeline({
      cropSeason: dummySeason,
      activities: [],
    });
    if (timeline.length !== 1 || timeline[0].category !== 'PLANTING') {
      throw new Error('Musim tanam tanpa aktivitas harus hanya menampilkan event tanam');
    }
  });

  // ==========================================
  // SUITE E: Context Engine
  // ==========================================
  test('Context Engine', 'E1. Kondisi Lapangan dengan Data Lengkap', () => {
    const fertApp: FertilizerApplication = {
      id: 'fa-1',
      activityId: 'act-fert',
      fertilizerName: 'Urea',
      amountKg: 50,
      applicationMethod: 'BROADCAST',
      calculatedNutrients: { N_kg: 23 },
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
    };
    const optObs: OptObservation = {
      id: 'obs-1',
      activityId: 'act-opt',
      isUnknown: false,
      optId: 'opt-wereng-coklat',
      attackSeverity: 'LIGHT',
      attackLocation: ['STEM'],
      createdAt: '2026-08-12T00:00:00.000Z',
      updatedAt: '2026-08-12T00:00:00.000Z',
    };

    const ctx = buildFieldContext({
      cropSeason: dummySeason,
      land: { id: 'land-1', farmerId: 'farmer-1', name: 'Petak Barat', areaHa: 1.0, createdAt: '', updatedAt: '' },
      activities: [
        { id: 'act-fert', cropSeasonId: dummySeason.id, category: 'FERTILIZER', activityDate: '2026-08-10', hst: 9, createdAt: '', updatedAt: '' },
        { id: 'act-opt', cropSeasonId: dummySeason.id, category: 'OPT', activityDate: '2026-08-12', hst: 11, createdAt: '', updatedAt: '' },
      ],
      fertilizerApplications: [fertApp],
      optObservations: [optObs],
      targetDate: '2026-08-20',
      varietyDurationDays: 120,
    });

    if (ctx.hst !== 19) throw new Error(`HST harus 19, didapat: ${ctx.hst}`);
    if (ctx.recentFertilization.totalAppliedKg !== 50) throw new Error('Total pupuk harus 50kg');
    if (ctx.recentOptObservation.observations.length !== 1) throw new Error('OPT observation harus 1');
    if (!ctx.dataQuality.isComplete) throw new Error('Data quality harus lengkap');
  });

  test('Context Engine', 'E2. Kondisi Lapangan dengan Data Sebagian (Tanpa Tanggal Tanam)', () => {
    const incompleteSeason: CropSeason = {
      id: 'season-no-date',
      landId: 'land-1',
      commodity: 'Padi',
      plantingDate: '',
      plantedAreaHa: 0,
      status: 'ACTIVE',
      createdAt: '',
      updatedAt: '',
    };

    const ctx = buildFieldContext({
      cropSeason: incompleteSeason,
      targetDate: '2026-08-20',
    });

    if (ctx.hst !== null) throw new Error('HST harus null jika tanggal tanam belum ada');
    if (ctx.dataQuality.isComplete) throw new Error('Data quality harus ditandai tidak lengkap');
    if (!ctx.dataQuality.missingDataNotes.some((n) => n.includes('Tanggal tanam'))) {
      throw new Error('Harus ada catatan bahwa tanggal tanam belum dicatat');
    }
  });

  test('Context Engine', 'E3. Weather Context Contract: Mendukung LIVE, CACHE, FALLBACK, null, dan undefined', () => {
    // 1. Validasi source LIVE
    const liveWeather: FieldWeatherContext = {
      isAvailable: true,
      source: 'LIVE',
      conditionType: 'CLEAR',
      rainProbability: 10,
      humidity: 70,
      windSpeed: 5,
      rainMm: 0,
      hasHeavyRainForecast: false,
      forecastSummary: 'Cerah sepanjang hari',
    };
    const ctxLive = buildFieldContext({
      cropSeason: dummySeason,
      weatherContext: liveWeather,
    });
    if (!ctxLive.weatherContext || ctxLive.weatherContext.source !== 'LIVE' || !ctxLive.weatherContext.isAvailable) {
      throw new Error('Weather context LIVE gagal dipasang pada FieldContext');
    }

    // 2. Validasi source CACHE
    const cacheWeather: FieldWeatherContext = {
      isAvailable: true,
      source: 'CACHE',
      conditionType: 'CLOUDY',
      rainProbability: 45,
      humidity: 80,
      windSpeed: 8,
      rainMm: 2,
      hasHeavyRainForecast: false,
    };
    const ctxCache = buildFieldContext({
      cropSeason: dummySeason,
      weatherContext: cacheWeather,
    });
    if (!ctxCache.weatherContext || ctxCache.weatherContext.source !== 'CACHE') {
      throw new Error('Weather context CACHE gagal dipasang pada FieldContext');
    }

    // 3. Validasi source FALLBACK
    const fallbackWeather: FieldWeatherContext = {
      isAvailable: true,
      source: 'FALLBACK',
      conditionType: 'LIGHT_RAIN',
      rainProbability: 60,
      humidity: 85,
      windSpeed: 10,
      rainMm: 5,
      hasHeavyRainForecast: false,
    };
    const ctxFallback = buildFieldContext({
      cropSeason: dummySeason,
      weatherContext: fallbackWeather,
    });
    if (!ctxFallback.weatherContext || ctxFallback.weatherContext.source !== 'FALLBACK') {
      throw new Error('Weather context FALLBACK gagal dipasang pada FieldContext');
    }

    // 4. Validasi null
    const ctxNull = buildFieldContext({
      cropSeason: dummySeason,
      weatherContext: null,
    });
    if (ctxNull.weatherContext !== null) {
      throw new Error('Weather context bernilai null harus dipertahankan sebagai null');
    }

    // 5. Validasi undefined (default argument)
    const ctxUndefined = buildFieldContext({
      cropSeason: dummySeason,
    });
    if (ctxUndefined.weatherContext !== null && ctxUndefined.weatherContext !== undefined) {
      throw new Error('Weather context undefined harus valid dan bernilai null/undefined');
    }
  });

  test('Context Engine', 'E4. WeatherData Conversion: Konversi deterministik WeatherData ke FieldWeatherContext', () => {
    // 1. WeatherData LIVE dengan prakiraan hujan lebat di daily
    const mockWeatherDataLive: WeatherData = {
      latitude: -6.57,
      longitude: 107.75,
      locationName: 'Subang',
      timezone: 'Asia/Jakarta',
      cachedAt: '2026-08-30T10:00:00.000Z',
      current: {
        temperature: 28,
        condition: 'Cerah Berawan',
        conditionType: 'PARTLY_CLOUDY',
        conditionCode: 2,
        humidity: 75,
        windSpeed: 12,
        rainProbability: 25,
        rainMm: 0,
        updatedAt: '2026-08-30T10:00:00.000Z',
        source: 'LIVE',
      },
      daily: [
        {
          date: '2026-08-30',
          dayLabel: 'Hari Ini',
          condition: 'Cerah Berawan',
          conditionType: 'PARTLY_CLOUDY',
          conditionCode: 2,
          tempMax: 32,
          tempMin: 23,
          rainProbability: 25,
          rainMm: 0,
        },
        {
          date: '2026-08-31',
          dayLabel: 'Besok',
          condition: 'Hujan Lebat',
          conditionType: 'HEAVY_RAIN',
          conditionCode: 65,
          tempMax: 29,
          tempMin: 22,
          rainProbability: 90,
          rainMm: 35,
        },
      ],
    };

    const ctxLive = buildFieldContext({
      cropSeason: dummySeason,
      weatherData: mockWeatherDataLive,
    });

    if (!ctxLive.weatherContext) {
      throw new Error('FieldWeatherContext gagal diekstrak dari WeatherData');
    }
    if (ctxLive.weatherContext.source !== 'LIVE') {
      throw new Error('Source cuaca harus LIVE');
    }
    if (ctxLive.weatherContext.conditionType !== 'PARTLY_CLOUDY') {
      throw new Error('Condition type tidak sesuai');
    }
    if (!ctxLive.weatherContext.hasHeavyRainForecast) {
      throw new Error('hasHeavyRainForecast harus bernilai true karena ada HEAVY_RAIN di daily');
    }
    if (ctxLive.weatherContext.forecastSummary !== 'Cerah Berawan') {
      throw new Error('forecastSummary harus sesuai kondisi cuaca');
    }

    // 2. WeatherData dengan isOfflineFallback: true
    const mockWeatherDataFallback: WeatherData = {
      latitude: -6.57,
      longitude: 107.75,
      timezone: 'Asia/Jakarta',
      cachedAt: '2026-08-30T00:00:00.000Z',
      isOfflineFallback: true,
      current: {
        temperature: 27,
        condition: 'Berawan',
        conditionType: 'CLOUDY',
        conditionCode: 3,
        humidity: 80,
        windSpeed: 10,
        rainProbability: 40,
        updatedAt: '2026-08-30T00:00:00.000Z',
        source: 'FALLBACK',
      },
      daily: [],
    };

    const ctxFallback = buildFieldContext({
      cropSeason: dummySeason,
      weatherData: mockWeatherDataFallback,
    });

    if (!ctxFallback.weatherContext || ctxFallback.weatherContext.source !== 'FALLBACK') {
      throw new Error('Weather context harus mendeteksi fallback source');
    }

    // 3. WeatherData null & undefined
    const ctxNull = buildFieldContext({
      cropSeason: dummySeason,
      weatherData: null,
    });
    if (ctxNull.weatherContext !== null) {
      throw new Error('WeatherData null harus menghasilkan weatherContext null');
    }

    const ctxUndef = buildFieldContext({
      cropSeason: dummySeason,
      weatherData: undefined,
    });
    if (ctxUndef.weatherContext !== null && ctxUndef.weatherContext !== undefined) {
      throw new Error('WeatherData undefined harus menghasilkan weatherContext null/undefined');
    }
  });

  // ==========================================
  // SUITE F: Recommendation Engine & Architecture
  // ==========================================
  test('Recommendation Engine', 'F1. Evaluasi Rekomendasi pada Kondisi Lengkap', () => {
    const ctx = buildFieldContext({
      cropSeason: dummySeason,
      targetDate: '2026-08-15',
      varietyDurationDays: 120,
    });

    const recs = evaluateRecommendations(ctx);
    if (recs.length === 0) throw new Error('Harus menghasilkan rekomendasi fase');

    const phaseRec = recs.find((r) => r.contextType === 'GROWTH_STAGE');
    if (!phaseRec) throw new Error('Rekomendasi konteks fase harus terbentuk');
    if (phaseRec.referenceIds.length === 0) throw new Error('Rekomendasi harus memiliki rujukan ilmiah (traceable)');
    if (phaseRec.message.includes('Anda harus')) {
      throw new Error('Rekomendasi tidak boleh bernada memaksa (harus santun)');
    }
  });

  test('Recommendation Engine', 'F2. Evaluasi pada Data Tidak Lengkap Tidak Menghasilkan Tebakan', () => {
    const incompleteSeason: CropSeason = {
      id: 'season-incomp',
      landId: 'land-1',
      commodity: 'Padi',
      plantingDate: '',
      plantedAreaHa: 0,
      status: 'ACTIVE',
      createdAt: '',
      updatedAt: '',
    };

    const ctx = buildFieldContext({
      cropSeason: incompleteSeason,
      targetDate: '2026-08-15',
    });

    const recs = evaluateRecommendations(ctx);
    const missingRec = recs.find((r) => r.contextType === 'OTHER');
    if (!missingRec || !missingRec.message.includes('belum lengkap')) {
      throw new Error('Sistem harus secara transparan menginformasikan bahwa data belum lengkap');
    }
  });

  test('Recommendation Engine', 'F3. Rekomendasi Murni Tidak Mengubah FarmerDecision atau ActualAction', () => {
    const ctx = buildFieldContext({
      cropSeason: dummySeason,
      targetDate: '2026-08-15',
    });

    const recs = evaluateRecommendations(ctx);
    for (const r of recs) {
      // Pastikan objek hanya bertipe EvaluatedRecommendation dan tidak ada modifikasi status keputusan
      if ('decision' in r || 'actualActionId' in r) {
        throw new Error('Recommendation tidak boleh mencampuradukkan status keputusan petani');
      }
    }
  });

  test('Recommendation Engine', 'F4. Invariance Rekomendasi: Struktur dasar rekomendasi tetap utuh dan cuaca hanya menambahkan pertimbangan', () => {
    const baseCtx = buildFieldContext({
      cropSeason: dummySeason,
      targetDate: '2026-08-15',
      varietyDurationDays: 120,
    });

    const mockWeatherData: WeatherData = {
      latitude: -6.57,
      longitude: 107.75,
      timezone: 'Asia/Jakarta',
      cachedAt: '2026-08-30T10:00:00.000Z',
      current: {
        temperature: 30,
        condition: 'Hujan Ringan',
        conditionType: 'LIGHT_RAIN',
        conditionCode: 61,
        humidity: 85,
        windSpeed: 10,
        rainProbability: 70,
        rainMm: 5,
        updatedAt: '2026-08-30T10:00:00.000Z',
        source: 'LIVE',
      },
      daily: [],
    };

    const weatherCtx = buildFieldContext({
      cropSeason: dummySeason,
      targetDate: '2026-08-15',
      varietyDurationDays: 120,
      weatherData: mockWeatherData,
    });

    const recsBase = evaluateRecommendations(baseCtx);
    const recsWeather = evaluateRecommendations(weatherCtx);

    if (recsBase.length !== recsWeather.length) {
      throw new Error('Jumlah rekomendasi harus sama persis antara dengan atau tanpa weatherData');
    }

    for (let i = 0; i < recsBase.length; i++) {
      if (recsBase[i].id !== recsWeather[i].id) {
        throw new Error(`ID rekomendasi ke-${i} tidak cocok`);
      }
      if (recsBase[i].priority !== recsWeather[i].priority) {
        throw new Error(`Prioritas rekomendasi ${recsBase[i].id} tidak boleh diubah oleh cuaca`);
      }
      if (recsBase[i].confidence !== recsWeather[i].confidence) {
        throw new Error(`Confidence rekomendasi ${recsBase[i].id} tidak boleh diubah oleh cuaca`);
      }
      // Pesan dasar tetap terkandung di dalam pesan yang diperkaya
      if (!recsWeather[i].message.startsWith(recsBase[i].message)) {
        throw new Error(`Pesan dasar rekomendasi ${recsBase[i].id} harus tetap dipertahankan`);
      }
    }
  });

  test('Recommendation Engine', 'F5. Fertilizer + Rain: Pertimbangan cuaca disematkan secara santun tanpa membatalkan pemupukan', () => {
    const fertActivity: Activity = {
      id: 'act-fert-1',
      cropSeasonId: dummySeason.id,
      category: 'FERTILIZER',
      activityDate: '2026-08-14',
      hst: 20,
      notes: 'Pemupukan awal',
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    };

    const fertApp: FertilizerApplication = {
      id: 'fa-1',
      activityId: fertActivity.id,
      fertilizerId: 'urea-1',
      fertilizerName: 'Urea',
      amountKg: 50,
      applicationMethod: 'BROADCAST',
      calculatedNutrients: { N_kg: 23 },
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    };

    const rainWeather: WeatherData = {
      latitude: -6.57,
      longitude: 107.75,
      timezone: 'Asia/Jakarta',
      cachedAt: '2026-08-30T10:00:00.000Z',
      current: {
        temperature: 28,
        condition: 'Hujan Sedang',
        conditionType: 'MODERATE_RAIN',
        conditionCode: 63,
        humidity: 88,
        windSpeed: 10,
        rainProbability: 80,
        rainMm: 15,
        updatedAt: '2026-08-30T10:00:00.000Z',
        source: 'LIVE',
      },
      daily: [],
    };

    const ctx = buildFieldContext({
      cropSeason: dummySeason,
      activities: [fertActivity],
      fertilizerApplications: [fertApp],
      weatherData: rainWeather,
    });

    const recs = evaluateRecommendations(ctx);
    const fertRec = recs.find((r) => r.contextType === 'FERTILIZER');

    if (!fertRec) throw new Error('Rekomendasi pemupukan harus tetap dihasilkan');
    if (!fertRec.message.includes('Pertimbangan cuaca')) {
      throw new Error('Pertimbangan cuaca harus disematkan pada rekomendasi pemupukan');
    }
    if (!fertRec.message.includes('limpasan air')) {
      throw new Error('Pertimbangan limpasan air harus disampaikan sebagai saran timing');
    }
    if (fertRec.message.includes('Batalkan') || fertRec.message.includes('Dilarang')) {
      throw new Error('Tidak boleh menggunakan kata imperatif membatalkan');
    }
  });

  test('Recommendation Engine', 'F6. OPT + High Humidity: Menyarankan peningkatan monitoring PHT bukan perintah semprot kimiawi', () => {
    const optActivity: Activity = {
      id: 'act-opt-1',
      cropSeasonId: dummySeason.id,
      category: 'OPT',
      activityDate: '2026-08-14',
      hst: 20,
      notes: 'Pengamatan rutin',
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    };

    const optObs: OptObservation = {
      id: 'opt-obs-1',
      activityId: optActivity.id,
      optId: 'opt-blas',
      isUnknown: false,
      attackSeverity: 'LIGHT',
      attackLocation: ['LEAF'],
      observedSymptoms: 'Bercak belah ketupat di beberapa helai daun',
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    };

    const humidWeather: WeatherData = {
      latitude: -6.57,
      longitude: 107.75,
      timezone: 'Asia/Jakarta',
      cachedAt: '2026-08-30T10:00:00.000Z',
      current: {
        temperature: 26,
        condition: 'Berawan Lembap',
        conditionType: 'CLOUDY',
        conditionCode: 3,
        humidity: 92,
        windSpeed: 8,
        rainProbability: 30,
        rainMm: 0,
        updatedAt: '2026-08-30T10:00:00.000Z',
        source: 'LIVE',
      },
      daily: [],
    };

    const ctx = buildFieldContext({
      cropSeason: dummySeason,
      activities: [optActivity],
      optObservations: [optObs],
      weatherData: humidWeather,
    });

    const recs = evaluateRecommendations(ctx);
    const optRec = recs.find((r) => r.contextType === 'OPT_CONTROL');

    if (!optRec) throw new Error('Rekomendasi OPT harus tetap dihasilkan');
    if (!optRec.message.includes('Kelembapan udara cukup tinggi')) {
      throw new Error('Harus memuat informasi kelembapan tinggi');
    }
    if (!optRec.message.includes('prinsip PHT') && !optRec.message.includes('pengamatan')) {
      throw new Error('Harus menekankan pengamatan dan prinsip PHT');
    }
    if (optRec.message.includes('Segera semprot') || optRec.message.includes('Wajib pestisida')) {
      throw new Error('Tidak boleh memerintahkan semprot kimia secara otomatis');
    }
  });

  test('Recommendation Engine', 'F7. Ripening / Harvest Stage + Weather Context', () => {
    // Tanaman pada umur siap panen (misal 115 HST dari 120 hari)
    const lateSeason: CropSeason = {
      ...dummySeason,
      plantingDate: '2026-04-25',
    };

    const clearWeather: WeatherData = {
      latitude: -6.57,
      longitude: 107.75,
      timezone: 'Asia/Jakarta',
      cachedAt: '2026-08-30T10:00:00.000Z',
      current: {
        temperature: 31,
        condition: 'Cerah',
        conditionType: 'CLEAR',
        conditionCode: 0,
        humidity: 60,
        windSpeed: 8,
        rainProbability: 10,
        rainMm: 0,
        updatedAt: '2026-08-30T10:00:00.000Z',
        source: 'LIVE',
      },
      daily: [],
    };

    const ctx = buildFieldContext({
      cropSeason: lateSeason,
      targetDate: '2026-08-20', // ~117 HST
      varietyDurationDays: 120,
      weatherData: clearWeather,
    });

    const recs = evaluateRecommendations(ctx);
    const phaseRec = recs.find((r) => r.contextType === 'GROWTH_STAGE');

    if (!phaseRec) throw new Error('Rekomendasi fase panen harus terbentuk');
    if (!phaseRec.message.includes('cerah berawan') && !phaseRec.message.includes('mendukung')) {
      throw new Error('Pertimbangan cuaca cerah harus memperkaya rekomendasi pasca-panen/pematangan');
    }
  });

  test('Recommendation Engine', 'F8. Fallback Weather Safety: Sumber FALLBACK hanya memberikan catatan umum wilayah', () => {
    const fertActivity: Activity = {
      id: 'act-fert-2',
      cropSeasonId: dummySeason.id,
      category: 'FERTILIZER',
      activityDate: '2026-08-14',
      hst: 20,
      notes: 'Pemupukan susulan',
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    };
    const fertApp: FertilizerApplication = {
      id: 'fa-2',
      activityId: fertActivity.id,
      fertilizerId: 'urea-1',
      fertilizerName: 'Urea',
      amountKg: 25,
      applicationMethod: 'BROADCAST',
      calculatedNutrients: { N_kg: 11.5 },
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    };

    const fallbackWeather: WeatherData = {
      latitude: -6.57,
      longitude: 107.75,
      timezone: 'Asia/Jakarta',
      cachedAt: '2026-08-30T00:00:00.000Z',
      isOfflineFallback: true,
      current: {
        temperature: 27,
        condition: 'Berawan',
        conditionType: 'CLOUDY',
        conditionCode: 3,
        humidity: 80,
        windSpeed: 10,
        rainProbability: 40,
        updatedAt: '2026-08-30T00:00:00.000Z',
        source: 'FALLBACK',
      },
      daily: [],
    };

    const ctx = buildFieldContext({
      cropSeason: dummySeason,
      activities: [fertActivity],
      fertilizerApplications: [fertApp],
      weatherData: fallbackWeather,
    });

    const recs = evaluateRecommendations(ctx);
    const fertRec = recs.find((r) => r.contextType === 'FERTILIZER');

    if (!fertRec) throw new Error('Rekomendasi pemupukan harus tetap dihasilkan');
    if (!fertRec.message.includes('perkiraan wilayah')) {
      throw new Error('Sumber FALLBACK harus menggunakan frase perkiraan wilayah');
    }
    if (fertRec.priority === 'CRITICAL') {
      throw new Error('Sumber FALLBACK dilarang menghasilkan prioritas CRITICAL');
    }
  });

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  return {
    allPassed: failed === 0,
    total,
    passed,
    failed,
    results,
  };
}
