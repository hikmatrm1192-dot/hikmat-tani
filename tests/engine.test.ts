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
import { Activity, CropSeason, FertilizerApplication, Land, OptObservation } from '../src/types/index.ts';

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
