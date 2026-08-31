/**
 * HIKMAT TANI - Initial Agronomy Rules (Starter / Review Set)
 * 
 * Prinsip:
 * - Rekomendasi berupa SARAN ilmiah santun, bukan perintah mutlak.
 * - Menggunakan bahasa: "Disarankan...", "Perlu diperhatikan...", "Dapat dipertimbangkan...".
 * - Menghindari kata imperatif seperti "Anda harus...", "Lakukan sekarang...".
 * - Setiap saran berbasis ilmu menyertakan referenceIds yang valid.
 * - Jika data tidak lengkap, sampaikan secara jujur tanpa membuat tebakan liar.
 * - Korelasi gejala, bagian tanaman, tingkat serangan, umur/HST, dan petunjuk visual dengan pustaka PHT.
 */

import { SEED_OPTS } from '../../db/seedData.ts';
import { matchOptRelevance } from '../optRelevanceEngine.ts';
import { AgronomyRule, EvaluatedRecommendation } from './types.ts';

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
        metadata: {
          sourceActivity: `Umur Tanaman Padi (${ctx.hst} HST)`,
          mainFinding: `Fase ${phase.label} (${phase.phaseCode})`,
          attentionReason: `Perhatian manajemen air, kelembapan petak, dan pemantauan anakan pada fase ${phase.label}.`,
          supportingReference: 'Balitpa Kementan (2020) — Petunjuk Lapang Budidaya Padi',
          hst: ctx.hst,
        },
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
        metadata: {
          sourceActivity: `Catatan Pemupukan Lapang ${lastActDate}`,
          mainFinding: `Total ${fert.totalAppliedKg} kg pupuk diaplikasikan (${nutrientDetails || 'Formula hara'})`,
          attentionReason: `Evaluasi kecukupan hara sesuai target fase pertumbuhan tanaman (${ctx.growthPhase.label}).`,
          supportingReference: 'Puslitbangtan (2021) — Rekomendasi Pemupukan Spesifik Lokasi',
          hst: ctx.hst ?? undefined,
        },
        createdAt: new Date().toISOString(),
      };
    },
  },

  // --- RULE 3: Pemantauan Pengamatan OPT & Rekomendasi PHT Bersahabat ---
  {
    id: 'rule-opt-monitoring',
    name: 'Konteks Pengamatan OPT & Musuh Alami',
    description: 'Mengkorelasikan data pengamatan lapang dengan pertimbangan 4 Pilar PHT, ambang kendali, dan pelestarian musuh alami.',
    contextType: 'OPT_CONTROL',
    priority: 'MEDIUM',
    referenceIds: ['ref-pht-padi-2019', 'ref-litbang-padi-2020'],
    isApplicable: (ctx) =>
      ctx.recentOptObservation.observations.length > 0 || ctx.recentOptObservation.activity !== null,
    evaluate: (ctx) => {
      const opt = ctx.recentOptObservation;
      const obsList = opt.observations;
      const isSevere = opt.hasActiveInfestation;
      const availableOpts = ctx.availableOpts && ctx.availableOpts.length > 0 ? ctx.availableOpts : SEED_OPTS;

      const actDateStr = opt.activity?.activityDate
        ? opt.activity.activityDate.split('T')[0]
        : 'Terbaru';
      const hstLabel = ctx.hst !== null && ctx.hst >= 0 ? `${ctx.hst} HST` : ctx.growthPhase.label;
      const sourceActivityStr = `Pengamatan Lapang (${actDateStr} • ${hstLabel})`;

      // Jika ada satu atau lebih baris observasi
      if (obsList.length > 0) {
        const results: EvaluatedRecommendation[] = [];

        for (let i = 0; i < obsList.length; i++) {
          const obs = obsList[i];
          const isUnknown = Boolean(obs.isUnknown);
          const optName = obs.customOptName || (isUnknown ? 'Gejala Lapang Belum Dikenal' : 'Hama/Penyakit Tanaman');
          const severity = obs.attackSeverity || 'LIGHT';
          const locations =
            obs.attackLocation && obs.attackLocation.length > 0
              ? obs.attackLocation
                  .map((loc) => {
                    switch (loc) {
                      case 'LEAF':
                        return 'daun';
                      case 'STEM':
                        return 'batang';
                      case 'ROOT':
                        return 'akar';
                      case 'PANICLE':
                        return 'malai / bulir';
                      case 'SEEDLING':
                        return 'persemaian';
                      default:
                        return loc.toLowerCase();
                    }
                  })
                  .join(', ')
              : 'bagian tanaman';

          const severityLabel =
            severity === 'HEAVY'
              ? 'Tinggi (Perlu Waspada)'
              : severity === 'MEDIUM'
              ? 'Sedang'
              : 'Ringan (Aman)';

          const symptomText = obs.observedSymptoms
            ? ` Gejala yang teramati: "${obs.observedSymptoms}".`
            : '';

          // Lakukan korelasi agronomi cerdas via matchOptRelevance
          const searchQuery = `${obs.customOptName || ''} ${obs.observedSymptoms || ''}`.trim();
          const matches = searchQuery
            ? matchOptRelevance(availableOpts, searchQuery, {
                attackLocations: obs.attackLocation,
                visualTokens: obs.visualClues || [],
              })
            : [];
          const topMatch = matches.length > 0 ? matches[0] : null;

          // KASUS 1: OPT Belum Teridentifikasi / Gejala Lapang Tidak Dikenal
          if (isUnknown) {
            // Subkasus 1A: Ada rujukan agronomi pembanding yang relevan (misal: "padi kerdil dan daun menguning" -> Tungro/Wereng)
            if (topMatch && topMatch.score >= 20) {
              const matchedOpt = topMatch.opt;
              const enemyAdvice =
                matchedOpt.biologicalControl
                  ? matchedOpt.biologicalControl
                  : 'laba-laba atau kumbang pemburu';

              const basisText = `Korelasi gejala lapang pada ${locations} dengan rujukan ${matchedOpt.commonName} (${topMatch.relevanceLabel}).`;

              results.push({
                id: `rec-opt-obs-${ctx.cropSeasonId}-${obs.id || i}`,
                cropSeasonId: ctx.cropSeasonId,
                contextType: 'OPT_CONTROL',
                title: `Pertimbangan Lapang: ${optName}`,
                message: `Berdasarkan catatan pengamatan Anda pada ${locations} dengan intensitas ${severityLabel}.${symptomText} Jenis OPT belum teridentifikasi pasti, namun karakteristik gejala memiliki kemiripan pembanding dengan ${matchedOpt.commonName}. Disarankan tidak terburu-buru melakukan tindakan kimiawi; lengkapi pengamatan visual dengan memeriksa 10-20 rumpun sampel, pantau keberadaan musuh alami seperti ${enemyAdvice}, dan bandingkan tanda visual dengan panduan PHT sebelum mengambil keputusan.`,
                basis: basisText,
                confidence: topMatch.score >= 50 ? 'HIGH' : 'MEDIUM',
                priority: severity === 'HEAVY' ? 'HIGH' : severity === 'MEDIUM' ? 'MEDIUM' : 'LOW',
                referenceIds: ['ref-pht-padi-2019', 'ref-litbang-padi-2020'],
                metadata: {
                  sourceActivity: sourceActivityStr,
                  mainFinding: `Gejala: ${obs.observedSymptoms || optName} pada ${locations} (${severityLabel})`,
                  attentionReason: `Kemiripan karakteristik dengan ${matchedOpt.commonName} (${topMatch.similarityReason}).`,
                  supportingReference: `${matchedOpt.commonName} • Ditlin TP (2019) PHT Padi`,
                  optId: matchedOpt.id,
                  optName: matchedOpt.commonName,
                  customOptName: optName,
                  attackSeverity: severity,
                  attackLocation: obs.attackLocation,
                  observedSymptoms: obs.observedSymptoms,
                  isUnknown: true,
                  relevanceScore: topMatch.score,
                  relevanceLabel: topMatch.relevanceLabel,
                  matchedKeywords: topMatch.matchedKeywords,
                  visualClues: obs.visualClues,
                  hst: ctx.hst ?? undefined,
                },
                createdAt: new Date().toISOString(),
              });
            } else {
              // Subkasus 1B: Belum ada kecocokan pustaka yang cukup kuat (Mencegah Diagnosis Palsu)
              results.push({
                id: `rec-opt-obs-${ctx.cropSeasonId}-${obs.id || i}`,
                cropSeasonId: ctx.cropSeasonId,
                contextType: 'OPT_CONTROL',
                title: `Pengamatan Gejala Lapang: ${optName}`,
                message: `Tercatat gejala pada ${locations} dengan intensitas serangan ${severityLabel}.${symptomText} Jenis OPT spesifik belum teridentifikasi pasti. Disarankan tidak terburu-buru melakukan tindakan kimia; lengkapi pengamatan visual dengan memeriksa tanda spesifik (keberadaan serangga/kutu, pola bercak daun, atau kondisi pangkal batang), bandingkan dengan katalog panduan PHT, dan amati apakah musuh alami hadir di petak sawah.`,
                basis: 'Prinsip verifikasi lapang visual dan kelengkapan identifikasi gejala PHT Ditlin Kementan.',
                confidence: 'MEDIUM',
                priority: severity === 'HEAVY' ? 'HIGH' : 'MEDIUM',
                referenceIds: ['ref-pht-padi-2019'],
                metadata: {
                  sourceActivity: sourceActivityStr,
                  mainFinding: `Gejala: ${obs.observedSymptoms || optName} pada ${locations} (${severityLabel})`,
                  attentionReason: 'Jenis OPT belum teridentifikasi pasti; disarankan melengkapi pengamatan visual.',
                  supportingReference: 'Ditlin TP (2019) — Prinsip 4 Pilar PHT',
                  isUnknown: true,
                  customOptName: optName,
                  attackSeverity: severity,
                  attackLocation: obs.attackLocation,
                  observedSymptoms: obs.observedSymptoms,
                  visualClues: obs.visualClues,
                  hst: ctx.hst ?? undefined,
                },
                createdAt: new Date().toISOString(),
              });
            }
            continue;
          }

          // KASUS 2: OPT Dikenal / Terdaftar
          let advicePht = '';
          if (severity === 'HEAVY') {
            advicePht = `Disarankan melakukan pemeriksaan pada 10-20 rumpun sampel secara berkala untuk memastikan apakah telah melampaui ambang kendali ekonomi. Utamakan perbaikan kultur teknis (pengaturan air sawah, pembersihan pematang) dan periksa keberadaan musuh alami seperti laba-laba atau kumbang sebelum mempertimbangkan langkah kuratif lanjutan.`;
          } else if (severity === 'MEDIUM') {
            advicePht = `Disarankan memantau perkembangan gejala dalam 3-5 hari ke depan, menjaga kebersihan pematang, dan mengamati apakah populasi musuh alami mampu menekan perkembangan hama secara alami.`;
          } else {
            advicePht = `Kondisi serangan masih berada dalam batas aman. Disarankan melanjutkan pengamatan rutin mingguan dan menjaga kelestarian musuh alami di petak sawah tanpa perlu intervensi kimiawi.`;
          }

          results.push({
            id: `rec-opt-obs-${ctx.cropSeasonId}-${obs.id || i}`,
            cropSeasonId: ctx.cropSeasonId,
            contextType: 'OPT_CONTROL',
            title: `Pertimbangan PHT: Pengamatan ${optName} (${severityLabel})`,
            message: `Tercatat pengamatan ${optName} pada ${locations} dengan tingkat serangan ${severityLabel}.${symptomText} ${advicePht}`,
            basis: 'Prinsip 4 Pilar Pengendalian Hama Terpadu (PHT) Tanaman Padi Ditlin TP Kementan.',
            confidence: 'HIGH',
            priority: severity === 'HEAVY' ? 'HIGH' : severity === 'MEDIUM' ? 'MEDIUM' : 'LOW',
            referenceIds: ['ref-pht-padi-2019', 'ref-litbang-padi-2020'],
            metadata: {
              sourceActivity: sourceActivityStr,
              mainFinding: `${optName} pada ${locations} (${severityLabel})`,
              attentionReason: `Tingkat serangan ${severityLabel}; evaluasi ambang batas ekonomi dan kelestarian musuh alami.`,
              supportingReference: `${optName} • Ditlin TP (2019) PHT Padi`,
              optId: obs.optId || topMatch?.opt.id,
              optName,
              customOptName: optName,
              attackSeverity: severity,
              attackLocation: obs.attackLocation,
              observedSymptoms: obs.observedSymptoms,
              isUnknown: false,
              relevanceScore: topMatch?.score,
              matchedKeywords: topMatch?.matchedKeywords,
              visualClues: obs.visualClues,
              hst: ctx.hst ?? undefined,
            },
            createdAt: new Date().toISOString(),
          });
        }

        return results;
      }

      // Fallback umum jika tidak ada baris rincian observasi
      return {
        id: `rec-opt-obs-${ctx.cropSeasonId}`,
        cropSeasonId: ctx.cropSeasonId,
        contextType: 'OPT_CONTROL',
        title: 'Pertimbangan Pengamatan Hama & Penyakit (PHT)',
        message: isSevere
          ? `Terdapat catatan pengamatan gejala OPT dengan intensitas yang perlu diwaspadai. Disarankan melakukan pengamatan petak secara lebih cermat pada rumpun sampel, memeriksa populasi musuh alami di kanopi/pangkal batang, dan mengutamakan sanitasi atau pengaturan air sebelum tindakan kimiawi.`
          : `Tercatat pengamatan OPT pada petak sawah. Disarankan melanjutkan pengamatan rutin mingguan secara berkala untuk memantau keseimbangan populasi hama dan musuh alami.`,
        basis: 'Prinsip 4 Pilar Pengendalian Hama Terpadu (PHT) Tanaman Padi Ditlin Kementan.',
        confidence: 'HIGH',
        priority: isSevere ? 'HIGH' : 'MEDIUM',
        referenceIds: ['ref-pht-padi-2019'],
        metadata: {
          sourceActivity: sourceActivityStr,
          mainFinding: 'Catatan pengamatan kondisi pertanaman',
          attentionReason: 'Pemantauan rutin dan pelestarian musuh alami di petak sawah.',
          supportingReference: 'Ditlin TP (2019) — Prinsip 4 Pilar PHT',
          hst: ctx.hst ?? undefined,
        },
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
        metadata: {
          sourceActivity: 'Status Catatan Musim Tanam',
          mainFinding: 'Beberapa atribut data dasar belum terisi lengkap',
          attentionReason: notes || 'Perlu melengkapi varietas atau tanggal tanam untuk akurasi rekomendasi.',
          supportingReference: 'Panduan Pencatatan Mandiri HIKMAT TANI',
        },
        createdAt: new Date().toISOString(),
      };
    },
  },
];

