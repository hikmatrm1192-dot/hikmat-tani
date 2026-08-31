/**
 * HIKMAT TANI - OPT Observation to PHT Recommendation & Library Correlation Tests
 * 
 * Memverifikasi korelasi antara:
 * 1. Pengamatan OPT Teridentifikasi (Dikenal) -> Rekomendasi PHT spesifik & proporsional
 * 2. Pengamatan Gejala / OPT Belum Teridentifikasi -> Menolak diagnosis palsu & memandu pengamatan visual
 * 3. Bahasa konsultatif & santun (tidak ada kata 'WAJIB', 'HARUS', 'PASTI', 'SEGERA')
 * 4. Prinsip 4 Pilar PHT (Kultur teknis, fisik/mekanis, musuh alami sebelum intervensi kuratif)
 * 5. Metadata relevan untuk navigasi rujukan PHT
 * 6. Relevance Scoring Engine untuk Pencarian Pustaka:
 *    - Tokenisasi & normalisasi kata
 *    - Filter stopwords / kata noise non-agronomi
 *    - Deteksi frasa kunci agronomi (N-grams)
 *    - Pembobotan sinergi multi-gejala & bagian tanaman
 *    - Penolakan diagnosis palsu pada hasil rujukan pembanding
 *    - Penanganan query tanpa kemiripan (empty state)
 */

import { buildFieldContext } from '../src/engine/contextEngine.ts';
import { evaluateRecommendations } from '../src/engine/recommendation/evaluator.ts';
import {
  extractAgronomicTokens,
  matchOptRelevance,
  normalizeText,
} from '../src/engine/optRelevanceEngine.ts';
import { SEED_OPTS } from '../src/db/seedData.ts';
import {
  Activity,
  CropSeason,
  Land,
  OptObservation,
  RiceVariety,
} from '../src/types/index.ts';

export function runOptCorrelationTests() {
  console.log('=== MENJALANKAN UJI INTEGRASI KORELASI PENGAMATAN OPT -> REKOMENDASI PHT & PUSTAKA ===\n');

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

  // --------------------------------------------------------------------------
  // BAGIAN I: UJI REKOMENDASI ENGINE (PHT & DIAGNOSIS PALSU)
  // --------------------------------------------------------------------------

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

  // --------------------------------------------------------------------------
  // BAGIAN II: UJI RELEVANCE MATCHING ENGINE (PUSTAKA PHT)
  // --------------------------------------------------------------------------

  // Test 4: Pencarian OPT Terdaftar (Exact/Alias Match)
  {
    const query = 'Sundep';
    const matches = matchOptRelevance(SEED_OPTS, query);

    if (matches.length === 0) {
      throw new Error('Test 4 Gagal: Pencarian alias "Sundep" harus menemukan Penggerek Batang Padi');
    }

    const topMatch = matches[0];
    if (!topMatch.opt.id.includes('penggerek')) {
      throw new Error(`Test 4 Gagal: Top match untuk "Sundep" harus Penggerek Batang, didapat: ${topMatch.opt.commonName}`);
    }

    if (!topMatch.isExactMatch) {
      throw new Error('Test 4 Gagal: Alias resmi harus ditandai isExactMatch: true');
    }

    console.log('✓ Test 4 Lolos: Pencarian OPT Terdaftar (Exact & Alias Match)');
  }

  // Test 5: Gejala Bebas "Belum Tahu" (Temuan Pengguna: "daun menguning dan rumpun kerdil" + "gejala terlihat di petak tanaman")
  {
    const freeformQuery = 'daun menguning dan rumpun kerdil gejala terlihat di petak tanaman';
    const matches = matchOptRelevance(SEED_OPTS, freeformQuery, {
      attackLocations: ['LEAF', 'WHOLE_PLANT'],
    });

    if (matches.length === 0) {
      throw new Error('Test 5 Gagal: Gejala "daun menguning dan rumpun kerdil" tidak boleh menghasilkan 0 rujukan (OPT Tidak Ditemukan)!');
    }

    // Harus menemukan rujukan berkarakteristik kerdil/kuning (Tungro, Wereng Hijau, Wereng Coklat, dll.)
    const matchedOptIds = matches.map((m) => m.opt.id);
    const hasTungroOrWereng = matchedOptIds.some(
      (id) => id.includes('tungro') || id.includes('wereng')
    );

    if (!hasTungroOrWereng) {
      throw new Error('Test 5 Gagal: Gejala daun menguning & kerdil harus mencakup Tungro atau Wereng sebagai pembanding');
    }

    // Pastikan hasil pertama memiliki relevansi label yang tepat
    const topMatch = matches[0];
    if (!topMatch.relevanceLabel.includes('Rujukan Pembanding')) {
      throw new Error(`Test 5 Gagal: Input gejala bebas harus berlabel Rujukan Pembanding, didapat: ${topMatch.relevanceLabel}`);
    }

    // Pastikan tidak ada klaim diagnosis pasti
    if (!topMatch.disclaimer.includes('bukan diagnosis pasti')) {
      throw new Error('Test 5 Gagal: Disclaimer non-diagnosis harus selalu disertakan');
    }

    console.log(`✓ Test 5 Lolos: Pencarian Gejala Bebas ("${freeformQuery}" -> ${matches.length} Rujukan Pembanding Relevan)`);
  }

  // Test 6: Pembersihan Stopwords & Kata Noise Non-Agronomi
  {
    const noiseOnly = 'gejala terlihat di petak tanaman sawah';
    const extracted = extractAgronomicTokens(noiseOnly);

    // Semua kata noise di atas harus difilter keluar
    if (extracted.phrases.length > 0 || extracted.words.length > 0) {
      throw new Error(`Test 6 Gagal: Kata noise umum harus difilter, tersisa: ${extracted.words.join(', ')}`);
    }

    const mixedQuery = 'terlihat daun menguning di petak sawah tanaman';
    const mixedExtracted = extractAgronomicTokens(mixedQuery);

    if (!mixedExtracted.phrases.includes('daun menguning') && !mixedExtracted.stems.includes('kuning')) {
      throw new Error('Test 6 Gagal: Frasa bermakna "daun menguning" harus tetap terekstraksi dari query bernoise');
    }

    console.log('✓ Test 6 Lolos: Pembersihan Stopwords & Kata Noise Pengamatan');
  }

  // Test 7: Peningkatan Skor Relevansi Berdasarkan Bagian Tanaman (attackLocation)
  {
    const query = 'bercak';
    const matchWithoutLoc = matchOptRelevance(SEED_OPTS, query);
    const matchWithLeaf = matchOptRelevance(SEED_OPTS, query, {
      attackLocations: ['LEAF'],
    });

    const blasNoLoc = matchWithoutLoc.find((m) => m.opt.id.includes('blas'));
    const blasWithLoc = matchWithLeaf.find((m) => m.opt.id.includes('blas'));

    if (!blasNoLoc || !blasWithLoc) {
      throw new Error('Test 7 Gagal: Penyakit Blas harus ditemukan pada pencarian kata "bercak"');
    }

    if (blasWithLoc.score <= blasNoLoc.score) {
      throw new Error('Test 7 Gagal: Penambahan attackLocation LEAF harus meningkatkan skor relevansi OPT bergejala daun');
    }

    console.log('✓ Test 7 Lolos: Pembobotan Bagian Tanaman (attackLocation)');
  }

  // Test 8: Sinergi Multi-Gejala (Co-occurrence Bonus)
  {
    const singleSymptomQuery = 'menguning';
    const multiSymptomQuery = 'menguning kerdil';

    const matchSingle = matchOptRelevance(SEED_OPTS, singleSymptomQuery);
    const matchMulti = matchOptRelevance(SEED_OPTS, multiSymptomQuery);

    const tungroSingle = matchSingle.find((m) => m.opt.id.includes('tungro'));
    const tungroMulti = matchMulti.find((m) => m.opt.id.includes('tungro'));

    if (!tungroSingle || !tungroMulti) {
      throw new Error('Test 8 Gagal: Tungro harus ditemukan');
    }

    if (tungroMulti.score <= tungroSingle.score) {
      throw new Error('Test 8 Gagal: Multi-gejala (menguning + kerdil) harus menghasilkan skor sinergi yang lebih tinggi');
    }

    console.log('✓ Test 8 Lolos: Sinergi Multi-Gejala (Co-occurrence Scoring)');
  }

  // Test 9: Input Tanpa Makna Agronomi (Gibberish / No Match)
  {
    const gibberishQuery = 'xyzabc12345 nonagronomitest';
    const matches = matchOptRelevance(SEED_OPTS, gibberishQuery);

    if (matches.length !== 0) {
      throw new Error('Test 9 Gagal: Input tanpa makna agronomi harus menghasilkan 0 match untuk memicu empty state');
    }

    console.log('✓ Test 9 Lolos: Penanganan Query Tanpa Relevansi (Empty State)');
  }

  // Test 10: Prinsip Non-Diagnosis Pasti & Integritas Keputusan Petani
  {
    const query = 'pucuk kering mudah dicabut';
    const matches = matchOptRelevance(SEED_OPTS, query);

    if (matches.length === 0) {
      throw new Error('Test 10 Gagal: Gejala pucuk kering mudah dicabut harus menemukan Penggerek Batang');
    }

    for (const match of matches) {
      if (!match.isExactMatch) {
        if (!match.disclaimer || !match.disclaimer.includes('bukan diagnosis pasti')) {
          throw new Error('Test 10 Gagal: Setiap rujukan pembanding harus menyertakan disclaimer non-diagnosis pasti');
        }
      }
    }

    console.log('✓ Test 10 Lolos: Integritas Non-Diagnosis Pasti & Keputusan Mandiri Petani');
  }

  // --------------------------------------------------------------------------
  // BAGIAN III: UJI KORELASI KEGIATAN LAPANG -> PERLU DIPERHATIKAN BERANDA
  // --------------------------------------------------------------------------

  // Test 11: Korelasi Multi-Pengamatan OPT Menghasilkan Saran Terstruktur & Terurut
  {
    const act1: Activity = {
      id: 'act-multi-1',
      cropSeasonId: dummySeason.id,
      category: 'OPT',
      activityDate: '2026-08-25',
      hst: 25,
      notes: 'Pengamatan petak sawah blok A',
      createdAt: '2026-08-25T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z',
    };

    const obs1: OptObservation = {
      id: 'obs-multi-1',
      activityId: act1.id,
      optId: 'opt-bph',
      isUnknown: false,
      customOptName: 'Wereng Batang Coklat',
      attackSeverity: 'HEAVY',
      attackLocation: ['STEM'],
      observedSymptoms: 'Populasi wereng padat di pangkal batang',
      createdAt: '2026-08-25T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z',
    };

    const obs2: OptObservation = {
      id: 'obs-multi-2',
      activityId: act1.id,
      optId: 'opt-blas',
      isUnknown: false,
      customOptName: 'Blas Daun',
      attackSeverity: 'LIGHT',
      attackLocation: ['LEAF'],
      observedSymptoms: 'Bercak belah ketupat kecil sporadis',
      createdAt: '2026-08-25T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z',
    };

    const ctx = buildFieldContext({
      cropSeason: dummySeason,
      activities: [act1],
      fertilizerApplications: [],
      optObservations: [obs1, obs2],
      varietyDurationDays: dummyVariety.growthDurationDays,
      targetDate: new Date('2026-08-25'),
    });

    const recs = evaluateRecommendations(ctx, { skipWeatherModifier: true });
    const optRecs = recs.filter((r) => r.contextType === 'OPT_CONTROL');

    if (optRecs.length < 2) {
      throw new Error(`Test 11 Gagal: Harus menghasilkan saran pertimbangan untuk setiap pengamatan OPT, didapat ${optRecs.length}`);
    }

    // Saran serangan berat (HEAVY) harus berada di urutan teratas
    if (optRecs[0].priority !== 'HIGH' || !optRecs[0].title.includes('Wereng Batang Coklat')) {
      throw new Error('Test 11 Gagal: Saran serangan berat (Wereng) harus diprioritaskan di posisi pertama');
    }

    // Verifikasi metadata kontekstual untuk card Beranda
    for (const r of optRecs) {
      if (!r.metadata?.sourceActivity) {
        throw new Error('Test 11 Gagal: Metadata sourceActivity wajib terisi');
      }
      if (!r.metadata?.mainFinding) {
        throw new Error('Test 11 Gagal: Metadata mainFinding wajib terisi');
      }
      if (!r.metadata?.attentionReason) {
        throw new Error('Test 11 Gagal: Metadata attentionReason wajib terisi');
      }
      if (!r.metadata?.supportingReference) {
        throw new Error('Test 11 Gagal: Metadata supportingReference wajib terisi');
      }
    }

    console.log('✓ Test 11 Lolos: Multi-Pengamatan OPT Menghasilkan Saran Terstruktur dengan Metadata Lengkap');
  }

  // Test 12: Temuan "Padi kerdil dan daun menguning" menghasilkan saran rujukan agronomi santun
  {
    const actKerdil: Activity = {
      id: 'act-kerdil-1',
      cropSeasonId: dummySeason.id,
      category: 'OPT',
      activityDate: '2026-08-28',
      hst: 28,
      notes: 'Petani mencatat tanaman tampak kerdil dan daun menguning',
      createdAt: '2026-08-28T00:00:00.000Z',
      updatedAt: '2026-08-28T00:00:00.000Z',
    };

    const obsKerdil: OptObservation = {
      id: 'obs-kerdil-1',
      activityId: actKerdil.id,
      isUnknown: true,
      customOptName: 'Padi Kerdil Daun Menguning',
      attackSeverity: 'MEDIUM',
      attackLocation: ['LEAF', 'WHOLE_PLANT'],
      observedSymptoms: 'padi kerdil dan daun menguning di beberapa rumpun',
      createdAt: '2026-08-28T00:00:00.000Z',
      updatedAt: '2026-08-28T00:00:00.000Z',
    };

    const ctx = buildFieldContext({
      cropSeason: dummySeason,
      activities: [actKerdil],
      fertilizerApplications: [],
      optObservations: [obsKerdil],
      varietyDurationDays: dummyVariety.growthDurationDays,
      targetDate: new Date('2026-08-28'),
    });

    const recs = evaluateRecommendations(ctx, { skipWeatherModifier: true });
    const kerdilRec = recs.find((r) => r.contextType === 'OPT_CONTROL');

    if (!kerdilRec) {
      throw new Error('Test 12 Gagal: Rekomendasi tidak terbentuk untuk temuan kerdil daun menguning');
    }

    // Harus merujuk kemiripan dengan Tungro atau Wereng
    const isRelevantMatch =
      kerdilRec.message.includes('Tungro') ||
      kerdilRec.message.includes('Wereng') ||
      kerdilRec.basis.includes('Tungro') ||
      kerdilRec.basis.includes('Wereng');

    if (!isRelevantMatch) {
      throw new Error('Test 12 Gagal: Harus menemukan rujukan agronomi relevan (Tungro/Wereng) untuk gejala kerdil & menguning');
    }

    if (!kerdilRec.message.includes('belum teridentifikasi pasti')) {
      throw new Error('Test 12 Gagal: Harus mempertahankan prinsip tidak memvonis diagnosis pasti');
    }

    console.log('✓ Test 12 Lolos: Rujukan Agronomi Santun untuk Temuan "padi kerdil dan daun menguning"');
  }

  // Test 13: Pencatatan Kegiatan Tanpa Masalah Tidak Memaksakan Saran Berlebihan
  {
    const actNormal: Activity = {
      id: 'act-normal-1',
      cropSeasonId: dummySeason.id,
      category: 'IRRIGATION',
      activityDate: '2026-08-15',
      hst: 15,
      notes: 'Pengairan macak-macak kondisi sawah prima',
      createdAt: '2026-08-15T00:00:00.000Z',
      updatedAt: '2026-08-15T00:00:00.000Z',
    };

    const ctx = buildFieldContext({
      cropSeason: dummySeason,
      activities: [actNormal],
      fertilizerApplications: [],
      optObservations: [],
      varietyDurationDays: dummyVariety.growthDurationDays,
      targetDate: new Date('2026-08-15'),
    });

    const recs = evaluateRecommendations(ctx, { skipWeatherModifier: true });
    const optRecs = recs.filter((r) => r.contextType === 'OPT_CONTROL');

    if (optRecs.length > 0) {
      throw new Error('Test 13 Gagal: Jika tidak ada pengamatan OPT, tidak boleh memaksakan saran OPT!');
    }

    console.log('✓ Test 13 Lolos: Integritas Kondisi Normal (Tidak Memaksakan Saran Tanpa Dasar)');
  }

  console.log('\n=== SEMUA 13 UJI KORELASI OPT -> REKOMENDASI PHT & PUSTAKA BERHASIL 100% ===\n');
}

runOptCorrelationTests();
