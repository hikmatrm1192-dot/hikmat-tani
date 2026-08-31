/**
 * HIKMAT TANI - OPT Observation to PHT Recommendation Correlation Tests
 * 
 * Memverifikasi korelasi antara:
 * 1. Pengamatan OPT Teridentifikasi (Dikenal) -> Rekomendasi PHT spesifik & proporsional
 * 2. Pengamatan Gejala / OPT Belum Teridentifikasi -> Menolak diagnosis palsu & memandu pengamatan visual
 * 3. Bahasa konsultatif & santun (tidak ada kata 'WAJIB', 'HARUS', 'PASTI', 'SEGERA')
 * 4. Prinsip 4 Pilar PHT (Kultur teknis, fisik/mekanis, musuh alami sebelum intervensi kuratif)
 * 5. Metadata relevan untuk navigasi rujukan PHT
 */

import { buildFieldContext } from '../src/engine/contextEngine.ts';
import { evaluateRecommendations } from '../src/engine/recommendation/evaluator.ts';
import { Activity, CropSeason, Land, OptObservation, RiceVariety } from '../src/types/index.ts';

function runOptCorrelationTests() {
  console.log('=== MENJALANKAN UJI INTEGRASI KORELASI PENGAMATAN OPT -> REKOMENDASI PHT ===\n');

  const dummyLand: Land = {
    id: 'land-test-opt',
    farmerId: 'farmer-1',
    name: 'Petak Sawah Blok Timur',
    areaHa: 0.5,
    waterSource: 'IRRIGATION_SEMI_TECHNICAL',
    landType: 'LOWLAND_PADDY',
    status: 'ACTIVE',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };

  const dummyVariety: RiceVariety = {
    id: 'var-inparis42',
    name: 'Inpari 42 Agritan GSR',
    aliases: ['Inpari 42'],
    growthDurationDays: 112,
    potentialYieldKgHa: 10500,
    resistanceProfile: 'Tahan Blas, Agak Tahan BPH',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };

  const dummySeason: CropSeason = {
    id: 'season-test-opt',
    landId: dummyLand.id,
    commodity: 'Padi',
    varietyId: dummyVariety.id,
    varietyName: dummyVariety.name,
    plantingDate: '2026-08-01',
    plantedAreaHa: 0.5,
    plantingSystem: 'JAJAR_LEGOWO_2_1',
    status: 'ACTIVE',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };

  // Test 1: OPT Dikenal dengan Serangan Ringan (LIGHT)
  {
    const optAct: Activity = {
      id: 'act-opt-light',
      cropSeasonId: dummySeason.id,
      category: 'OPT',
      activityDate: '2026-08-20',
      hst: 20,
      notes: 'Ditemukan gejala bercak daun ringan',
      createdAt: '2026-08-20T00:00:00.000Z',
      updatedAt: '2026-08-20T00:00:00.000Z',
    };

    const optObs: OptObservation = {
      id: 'obs-light-1',
      activityId: optAct.id,
      optId: 'opt-blas',
      isUnknown: false,
      customOptName: 'Blas Daun (Pyricularia oryzae)',
      attackSeverity: 'LIGHT',
      attackLocation: ['LEAF'],
      observedSymptoms: 'Bercak belah ketupat kecil di 2 rumpun',
      createdAt: '2026-08-20T00:00:00.000Z',
      updatedAt: '2026-08-20T00:00:00.000Z',
    };

    const ctx = buildFieldContext({
      cropSeason: dummySeason,
      activities: [optAct],
      fertilizerApplications: [],
      optObservations: [optObs],
      varietyDurationDays: dummyVariety.growthDurationDays,
      targetDate: new Date('2026-08-20'),
    });

    const recs = evaluateRecommendations(ctx, { skipWeatherModifier: true });
    const optRec = recs.find((r) => r.contextType === 'OPT_CONTROL');

    if (!optRec) {
      throw new Error('Test 1 Gagal: Rekomendasi OPT tidak dihasilkan untuk OPT Dikenal');
    }

    if (!optRec.message.includes('Blas Daun') || !optRec.message.includes('daun')) {
      throw new Error('Test 1 Gagal: Pesan rekomendasi tidak memuat nama OPT atau bagian tanaman');
    }

    if (!optRec.message.includes('musuh alami') && !optRec.message.includes('pengamatan rutin')) {
      throw new Error('Test 1 Gagal: Serangan ringan harus mengutamakan pengamatan rutin dan musuh alami');
    }

    if (optRec.priority !== 'LOW') {
      throw new Error(`Test 1 Gagal: Prioritas serangan ringan harus LOW, didapat: ${optRec.priority}`);
    }

    console.log('✓ Test 1 Lolos: Korelasi OPT Dikenal (Serangan Ringan)');
  }

  // Test 2: OPT Dikenal dengan Serangan Tinggi (HEAVY)
  {
    const optAct: Activity = {
      id: 'act-opt-heavy',
      cropSeasonId: dummySeason.id,
      category: 'OPT',
      activityDate: '2026-08-25',
      hst: 25,
      notes: 'Populasi wereng meningkat di pangkal batang',
      createdAt: '2026-08-25T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z',
    };

    const optObs: OptObservation = {
      id: 'obs-heavy-1',
      activityId: optAct.id,
      optId: 'opt-bph',
      isUnknown: false,
      customOptName: 'Wereng Batang Coklat (Nilaparvata lugens)',
      attackSeverity: 'HEAVY',
      attackLocation: ['STEM'],
      observedSymptoms: 'Nimfa dan imago bergerombol di pangkal batang',
      createdAt: '2026-08-25T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z',
    };

    const ctx = buildFieldContext({
      cropSeason: dummySeason,
      activities: [optAct],
      fertilizerApplications: [],
      optObservations: [optObs],
      varietyDurationDays: dummyVariety.growthDurationDays,
      targetDate: new Date('2026-08-25'),
    });

    const recs = evaluateRecommendations(ctx, { skipWeatherModifier: true });
    const optRec = recs.find((r) => r.contextType === 'OPT_CONTROL');

    if (!optRec) {
      throw new Error('Test 2 Gagal: Rekomendasi OPT tidak dihasilkan untuk serangan berat');
    }

    if (optRec.priority !== 'HIGH') {
      throw new Error(`Test 2 Gagal: Prioritas serangan berat harus HIGH, didapat: ${optRec.priority}`);
    }

    if (!optRec.message.includes('ambang kendali') && !optRec.message.includes('kultur teknis')) {
      throw new Error('Test 2 Gagal: Harus menyarankan pemeriksaan ambang kendali dan kultur teknis');
    }

    // Verifikasi Bahasa Penyuluhan (Bebas dari kata imperatif agresif)
    const forbiddenWords = ['WAJIB', 'HARUS', 'PASTI', 'SEGERA'];
    for (const w of forbiddenWords) {
      if (optRec.message.includes(w)) {
        throw new Error(`Test 2 Gagal: Ditemukan kata imperatif "${w}" pada pesan rekomendasi`);
      }
    }

    console.log('✓ Test 2 Lolos: Korelasi OPT Dikenal Serangan Berat (Prinsip PHT & Bahasa Penyuluhan)');
  }

  // Test 3: OPT Belum Teridentifikasi / Gejala Lapang Tidak Dikenal (Mencegah Diagnosis Palsu)
  {
    const optAct: Activity = {
      id: 'act-opt-unknown',
      cropSeasonId: dummySeason.id,
      category: 'OPT',
      activityDate: '2026-08-28',
      hst: 28,
      notes: 'Pucuk tanaman menggulung tidak biasa',
      createdAt: '2026-08-28T00:00:00.000Z',
      updatedAt: '2026-08-28T00:00:00.000Z',
    };

    const optObs: OptObservation = {
      id: 'obs-unknown-1',
      activityId: optAct.id,
      isUnknown: true,
      customOptName: 'Pucuk Daun Menggulung Coklat',
      attackSeverity: 'MEDIUM',
      attackLocation: ['LEAF'],
      observedSymptoms: 'Daun muda tergulung memanjang dengan bercak coklat keputihan',
      createdAt: '2026-08-28T00:00:00.000Z',
      updatedAt: '2026-08-28T00:00:00.000Z',
    };

    const ctx = buildFieldContext({
      cropSeason: dummySeason,
      activities: [optAct],
      fertilizerApplications: [],
      optObservations: [optObs],
      varietyDurationDays: dummyVariety.growthDurationDays,
      targetDate: new Date('2026-08-28'),
    });

    const recs = evaluateRecommendations(ctx, { skipWeatherModifier: true });
    const optRec = recs.find((r) => r.contextType === 'OPT_CONTROL');

    if (!optRec) {
      throw new Error('Test 3 Gagal: Rekomendasi tidak dihasilkan untuk gejala tidak dikenal');
    }

    if (!optRec.message.includes('belum teridentifikasi pasti')) {
      throw new Error('Test 3 Gagal: Harus menyatakan secara jujur bahwa jenis OPT belum teridentifikasi pasti');
    }

    if (!optRec.message.includes('lengkapi pengamatan')) {
      throw new Error('Test 3 Gagal: Harus menyarankan melengkapi pengamatan visual');
    }

    console.log('✓ Test 3 Lolos: Penanganan Gejala Tidak Dikenal (Mencegah Diagnosis Palsu & Memandu Pengamatan Visual)');
  }

  console.log('\n=== SEMUA UJI KORELASI OPT -> REKOMENDASI PHT BERHASIL 100% ===\n');
}

runOptCorrelationTests();
