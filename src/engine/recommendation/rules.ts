/**
 * HIKMAT TANI - Initial Agronomy Rules (Starter / Review Set)
 * 
 * Prinsip:
 * - Rekomendasi berupa SARAN ilmiah santun, bukan perintah mutlak.
 * - Menggunakan bahasa: "Disarankan...", "Perlu diperhatikan...", "Dapat dipertimbangkan...".
 * - Menghindari kata imperatif seperti "Anda harus...", "Lakukan sekarang...".
 * - Setiap saran berbasis ilmu menyertakan referenceIds yang valid.
 * - Jika data tidak lengkap, sampaikan secara jujur tanpa membuat tebakan liar.
 */

import { AgronomyRule } from './types.ts';

export const INITIAL_AGRONOMY_RULES: AgronomyRule[] = [
  // --- RULE 1: Informasi Fase Pertumbuhan Musim Tanam Aktif ---
  {
    id: 'rule-phase-context',
    name: 'Konteks Fase Pertumbuhan Aktif',
    description: 'Memberikan informasi fase fenologis tanaman padi saat ini untuk pertimbangan manajemen lapang.',
    contextType: 'GROWTH_STAGE',
    priority: 'INFO',
    referenceIds: ['ref-litbang-padi-2020'],
    isApplicable: (ctx) => ctx.status === 'ACTIVE' && ctx.hst !== null && ctx.hst >= 0,
    evaluate: (ctx) => {
      if (ctx.hst === null) return null;
      const phase = ctx.growthPhase;

      return {
        id: `rec-phase-${ctx.cropSeasonId}-${ctx.hst}`,
        cropSeasonId: ctx.cropSeasonId,
        contextType: 'GROWTH_STAGE',
        title: `Informasi Fase: ${phase.label} (${ctx.hst} HST)`,
        message: `Berdasarkan catatan umur ${ctx.hst} HST, tanaman diperkirakan sedang berada pada fase ${phase.label}. ${phase.description}. Perlu diperhatikan kondisi kelembapan tanah dan kebutuhan tanaman pada fase ini.`,
        basis: `Perhitungan umur ${ctx.hst} HST terhadap total umur varietas ${phase.varietyDurationDays} hari (${phase.isEstimated ? 'estimasi generik' : 'berdasarkan varietas'}).`,
        confidence: phase.isEstimated ? 'MEDIUM' : 'HIGH',
        priority: 'INFO',
        referenceIds: ['ref-litbang-padi-2020'],
        createdAt: new Date().toISOString(),
      };
    },
  },

  // --- RULE 2: Riwayat dan Pemantauan Pemupukan ---
  {
    id: 'rule-fert-history',
    name: 'Konteks Riwayat Pemupukan',
    description: 'Menyajikan informasi catatan aplikasi pupuk yang telah dilakukan sebagai bahan pertimbangan petani.',
    contextType: 'FERTILIZER',
    priority: 'LOW',
    referenceIds: ['ref-pupuk-kementan-2021', 'ref-litbang-padi-2020'],
    isApplicable: (ctx) => ctx.recentFertilization.totalAppliedKg > 0,
    evaluate: (ctx) => {
      const fert = ctx.recentFertilization;
      const lastActDate = fert.activity?.activityDate
        ? `pada ${fert.activity.activityDate.split('T')[0]}`
        : '';

      const nSummary = fert.accumulatedNutrientsKg['N']
        ? `N: ${fert.accumulatedNutrientsKg['N']} kg`
        : '';
      const pSummary = fert.accumulatedNutrientsKg['P2O5']
        ? `P2O5: ${fert.accumulatedNutrientsKg['P2O5']} kg`
        : '';
      const kSummary = fert.accumulatedNutrientsKg['K2O']
        ? `K2O: ${fert.accumulatedNutrientsKg['K2O']} kg`
        : '';

      const nutrientDetails = [nSummary, pSummary, kSummary].filter(Boolean).join(', ');

      return {
        id: `rec-fert-hist-${ctx.cropSeasonId}`,
        cropSeasonId: ctx.cropSeasonId,
        contextType: 'FERTILIZER',
        title: 'Ringkasan Catatan Pemupukan Lapang',
        message: `Tercatat total ${fert.totalAppliedKg} kg pupuk telah diaplikasikan ${lastActDate}. Akumulasi hara terhitung: ${
          nutrientDetails || 'Belum ada rincian formula hara'
        }. Disarankan tetap menjaga keseimbangan hara sesuai kebutuhan fase tanaman saat ini.`,
        basis: 'Akumulasi catatan kegiatan pemupukan yang telah diinput petani.',
        confidence: 'HIGH',
        priority: 'LOW',
        referenceIds: ['ref-pupuk-kementan-2021'],
        createdAt: new Date().toISOString(),
      };
    },
  },

  // --- RULE 3: Pemantauan Pengamatan OPT Berkala ---
  {
    id: 'rule-opt-monitoring',
    name: 'Konteks Pengamatan OPT & Musuh Alami',
    description: 'Mendorong pengamatan mingguan dan pelestarian musuh alami sesuai prinsip PHT.',
    contextType: 'OPT_CONTROL',
    priority: 'MEDIUM',
    referenceIds: ['ref-pht-padi-2019'],
    isApplicable: (ctx) => ctx.recentOptObservation.observations.length > 0,
    evaluate: (ctx) => {
      const opt = ctx.recentOptObservation;
      const obsCount = opt.observations.length;
      const isSevere = opt.hasActiveInfestation;

      return {
        id: `rec-opt-obs-${ctx.cropSeasonId}`,
        cropSeasonId: ctx.cropSeasonId,
        contextType: 'OPT_CONTROL',
        title: 'Pertimbangan Pengamatan Hama & Penyakit (PHT)',
        message: isSevere
          ? `Terdapat catatan pengamatan gejala OPT dengan intensitas yang perlu diwaspadai. Disarankan melakukan pengamatan petak secara lebih cermat pada rumpun sampel, memeriksa populasi musuh alami di kanopi/pangkal batang, dan mengutamakan sanitasi atau pengaturan air sebelum tindakan kimiawi.`
          : `Tercatat ${obsCount} pengamatan OPT pada petak sawah. Disarankan melanjutkan pengamatan rutin mingguan secara berkala untuk memantau keseimbangan populasi hama dan musuh alami.`,
        basis: 'Prinsip 4 Pilar Pengendalian Hama Terpadu (PHT) Tanaman Padi Ditlin Kementan.',
        confidence: 'HIGH',
        priority: isSevere ? 'HIGH' : 'MEDIUM',
        referenceIds: ['ref-pht-padi-2019'],
        createdAt: new Date().toISOString(),
      };
    },
  },

  // --- RULE 4: Data Kualitas Belum Lengkap (Missing Data Safety) ---
  {
    id: 'rule-missing-data-warning',
    name: 'Peringatan Kelengkapan Data Musim Tanam',
    description: 'Memberi tahu pengguna secara transparan jika data penting belum dicatat sehingga tidak terjadi estimasi spekulatif.',
    contextType: 'OTHER',
    priority: 'INFO',
    referenceIds: ['ref-litbang-padi-2020'],
    isApplicable: (ctx) => !ctx.dataQuality.isComplete,
    evaluate: (ctx) => {
      const notes = ctx.dataQuality.missingDataNotes.join(' ');
      return {
        id: `rec-missing-data-${ctx.cropSeasonId}`,
        cropSeasonId: ctx.cropSeasonId,
        contextType: 'OTHER',
        title: 'Kelengkapan Data Musim Tanam',
        message: `Informasi belum lengkap: ${notes} Sistem belum dapat menghitung parameter spesifik secara akurat tanpa data tersebut. Catatan dapat dilengkapi kapan saja sesuai kondisi lapangan.`,
        basis: 'Pemeriksaan integritas kelengkapan catatan musim tanam.',
        confidence: 'HIGH',
        priority: 'INFO',
        referenceIds: ['ref-litbang-padi-2020'],
        createdAt: new Date().toISOString(),
      };
    },
  },
];
