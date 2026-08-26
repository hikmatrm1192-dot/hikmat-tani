/**
 * HIKMAT TANI - Rice Growth Phase Engine
 * 
 * Memetakan HST dan umur varietas padi ke dalam fase pertumbuhan fenologis standar.
 * Rujukan Ilmiah: Balai Besar Penelitian Tanaman Padi (BBPadi) Sukamandi.
 * 
 * Prinsip:
 * - Tidak menganggap semua varietas memiliki umur yang sama.
 * - Jika data umur varietas tidak tersedia, gunakan estimasi generik (115 hari)
 *   dan beri penanda isEstimated: true.
 * - Pure logic tanpa ketergantungan UI.
 */

export type GrowthStageCategory = 'VEGETATIVE' | 'GENERATIVE' | 'RIPENING' | 'PRE_PLANTING' | 'POST_HARVEST';

export interface GrowthPhaseInfo {
  phaseCode: string;
  label: string;
  stageCategory: GrowthStageCategory;
  description: string;
  hst: number;
  varietyDurationDays: number;
  isEstimated: boolean;
  notes?: string;
}

const DEFAULT_GENERIC_DURATION_DAYS = 115;

/**
 * Menentukan fase pertumbuhan tanaman padi berdasarkan HST dan total umur varietas.
 * 
 * @param hst Hari Setelah Tanam
 * @param varietyDurationDays Umur varietas hingga panen dalam hari (opsional, default generik 115 hari)
 */
export function determineGrowthPhase(
  hst: number | null | undefined,
  varietyDurationDays?: number | null
): GrowthPhaseInfo {
  if (hst === null || hst === undefined || isNaN(hst)) {
    return {
      phaseCode: 'UNKNOWN',
      label: 'Fase Belum Diketahui',
      stageCategory: 'VEGETATIVE',
      description: 'HST tidak tersedia sehingga fase pertumbuhan belum dapat dihitung.',
      hst: 0,
      varietyDurationDays: varietyDurationDays || DEFAULT_GENERIC_DURATION_DAYS,
      isEstimated: true,
      notes: 'Tanggal tanam belum dicatat.',
    };
  }

  const isEstimated = !varietyDurationDays || varietyDurationDays <= 0;
  const duration = isEstimated ? DEFAULT_GENERIC_DURATION_DAYS : (varietyDurationDays as number);

  // Jika HST negatif (Sebelum hari tanam / fase semai)
  if (hst < 0) {
    return {
      phaseCode: 'PRE_PLANTING',
      label: 'Pra-Tanam / Persemaian',
      stageCategory: 'PRE_PLANTING',
      description: 'Persiapan lahan atau fase bibit di persemaian sebelum pindah tanam ke sawah.',
      hst,
      varietyDurationDays: duration,
      isEstimated,
      notes: isEstimated ? 'Menggunakan asumsi umur generik 115 hari.' : undefined,
    };
  }

  // Hitung rasio kematangan relatif (0.0 sampai 1.0+)
  const ratio = hst / duration;

  if (ratio < 0.15) {
    // 0 - 15% umur (~0 - 18 HST untuk varietas 120 hari)
    return {
      phaseCode: 'VEGETATIVE_EARLY',
      label: 'Vegetatif Awal (Pemulihan & Perakaran)',
      stageCategory: 'VEGETATIVE',
      description: 'Tanaman sedang memulihkan diri dari stres pindah tanam dan membentuk akar baru.',
      hst,
      varietyDurationDays: duration,
      isEstimated,
      notes: isEstimated ? 'Estimasi generik (umur varietas spesifik belum dicatat).' : undefined,
    };
  } else if (ratio < 0.40) {
    // 15% - 40% umur (~18 - 48 HST)
    return {
      phaseCode: 'VEGETATIVE_ACTIVE_TILLERING',
      label: 'Vegetatif (Pembentukan Anakan Aktif - Maksimum)',
      stageCategory: 'VEGETATIVE',
      description: 'Fase pembentukan anakan baru, pertambahan tinggi batang, dan pembentukan kanopi daun.',
      hst,
      varietyDurationDays: duration,
      isEstimated,
      notes: isEstimated ? 'Estimasi generik (umur varietas spesifik belum dicatat).' : undefined,
    };
  } else if (ratio < 0.55) {
    // 40% - 55% umur (~48 - 66 HST)
    return {
      phaseCode: 'GENERATIVE_PANICLE_INITIATION',
      label: 'Generatif Awal (Inisiasi Malai / Primordia)',
      stageCategory: 'GENERATIVE',
      description: 'Awal pembentukan bakal malai di dalam pelepah daun (bunting muda).',
      hst,
      varietyDurationDays: duration,
      isEstimated,
      notes: isEstimated ? 'Estimasi generik (umur varietas spesifik belum dicatat).' : undefined,
    };
  } else if (ratio < 0.70) {
    // 55% - 70% umur (~66 - 84 HST)
    return {
      phaseCode: 'GENERATIVE_BOOTING_FLOWERING',
      label: 'Generatif (Bunting Tua & Berbunga / Antesis)',
      stageCategory: 'GENERATIVE',
      description: 'Malai keluar penuh (heading) dan proses penyerbukan/persarian bulir padi berlangsung.',
      hst,
      varietyDurationDays: duration,
      isEstimated,
      notes: isEstimated ? 'Estimasi generik (umur varietas spesifik belum dicatat).' : undefined,
    };
  } else if (ratio < 0.88) {
    // 70% - 88% umur (~84 - 105 HST)
    return {
      phaseCode: 'RIPENING_GRAIN_FILLING',
      label: 'Pematangan (Pengisian Bulir / Masak Susu - Kuning)',
      stageCategory: 'RIPENING',
      description: 'Akumulasi pati ke dalam gabah, bulir mulai menunduk dan warna daun mulai menguning bertahap.',
      hst,
      varietyDurationDays: duration,
      isEstimated,
      notes: isEstimated ? 'Estimasi generik (umur varietas spesifik belum dicatat).' : undefined,
    };
  } else if (ratio <= 1.05) {
    // 88% - 105% umur (~105 - 120 HST)
    return {
      phaseCode: 'RIPENING_MATURE_HARVEST',
      label: 'Pematangan Penuh (Masak Fisiologis / Siap Panen)',
      stageCategory: 'RIPENING',
      description: 'Kadar air bulir turun, 90-95% malai telah menguning, siap dipanen.',
      hst,
      varietyDurationDays: duration,
      isEstimated,
      notes: isEstimated ? 'Estimasi generik (umur varietas spesifik belum dicatat).' : undefined,
    };
  } else {
    // > 105% umur
    return {
      phaseCode: 'POST_HARVEST_OVERDUE',
      label: 'Lewat Umur Standar Varietas / Pasca-Panen',
      stageCategory: 'POST_HARVEST',
      description: 'Tanaman telah melewati batas umur panen normal varietas.',
      hst,
      varietyDurationDays: duration,
      isEstimated,
      notes: isEstimated ? 'Estimasi generik (umur varietas spesifik belum dicatat).' : undefined,
    };
  }
}
