/**
 * HIKMAT TANI - Field Context Engine
 * 
 * Membaca dan mensintesis seluruh data kondisi musim tanam saat ini:
 * - HST saat ini
 * - Fase fenologis pertumbuhan
 * - Aktivitas terakhir
 * - Riwayat pemupukan terakhir & akumulasi unsur hara
 * - Pengamatan OPT terakhir
 * - Pengaturan pengairan terakhir
 * - Status kelengkapan data (data quality)
 * 
 * Prinsip:
 * - Context Engine TIDAK memberikan rekomendasi.
 * - Tugasnya murni: "Menggambarkan kondisi nyata lapangan saat ini".
 * - Menangani data tidak lengkap secara jujur tanpa asumsi liar.
 * - Pure logic tanpa ketergantungan UI.
 */

import {
  Activity,
  CropSeason,
  FertilizerApplication,
  Land,
  OptObservation,
} from '../types/index.ts';
import { determineGrowthPhase, GrowthPhaseInfo } from './growthPhase.ts';
import { calculateHST } from './hstCalculator.ts';
import { accumulateNutrients } from './nutrientEngine.ts';

export interface FieldContextDataQuality {
  hasPlantingDate: boolean;
  hasVariety: boolean;
  hasArea: boolean;
  isComplete: boolean;
  missingDataNotes: string[];
}

export interface FieldContext {
  cropSeasonId: string;
  landId?: string;
  landName?: string;
  commodity: string;
  varietyName?: string;
  varietyDurationDays?: number;
  plantedAreaHa: number;
  plantingSystem?: string;
  status: string;

  // Waktu & Fase
  targetDate: string;
  hst: number | null;
  growthPhase: GrowthPhaseInfo;

  // Catatan Kegiatan Terakhir
  lastActivity: Activity | null;
  recentFertilization: {
    activity: Activity | null;
    applications: FertilizerApplication[];
    accumulatedNutrientsKg: Record<string, number>;
    totalAppliedKg: number;
  };
  recentOptObservation: {
    activity: Activity | null;
    observations: OptObservation[];
    hasActiveInfestation: boolean;
  };
  recentWaterManagement: {
    activity: Activity | null;
    waterCondition?: string;
  };

  // Kualitas Kelengkapan Data
  dataQuality: FieldContextDataQuality;
}

export interface BuildFieldContextParams {
  cropSeason: CropSeason;
  land?: Land | null;
  activities?: Activity[];
  fertilizerApplications?: FertilizerApplication[];
  optObservations?: OptObservation[];
  targetDate?: string | Date;
  varietyDurationDays?: number | null;
}

/**
 * Membangun objek konteks kondisi lapangan saat ini.
 */
export function buildFieldContext({
  cropSeason,
  land,
  activities = [],
  fertilizerApplications = [],
  optObservations = [],
  targetDate = new Date(),
  varietyDurationDays,
}: BuildFieldContextParams): FieldContext {
  const targetDateStr =
    typeof targetDate === 'string'
      ? targetDate
      : targetDate.toISOString().split('T')[0];

  // 1. Validasi Kelengkapan Data (Data Quality)
  const missingDataNotes: string[] = [];
  const hasPlantingDate = Boolean(cropSeason.plantingDate);
  const hasVariety = Boolean(cropSeason.varietyName || cropSeason.varietyId);
  const hasArea = Boolean(cropSeason.plantedAreaHa && cropSeason.plantedAreaHa > 0);

  if (!hasPlantingDate) {
    missingDataNotes.push('Tanggal tanam belum dicatat.');
  }
  if (!hasVariety) {
    missingDataNotes.push('Varietas padi belum dicatat.');
  }
  if (!hasArea) {
    missingDataNotes.push('Luas lahan belum dicatat.');
  }

  // 2. Hitung HST
  let hst: number | null = null;
  if (hasPlantingDate && cropSeason.plantingDate) {
    const hstCalc = calculateHST(cropSeason.plantingDate, targetDateStr);
    if (hstCalc.isValid && hstCalc.hst !== null) {
      hst = hstCalc.hst;
    }
  }

  // 3. Tentukan Fase Pertumbuhan
  const duration = varietyDurationDays || null;
  const growthPhase = determineGrowthPhase(hst, duration);

  // 4. Urutkan aktivitas (terbaru di awal)
  const sortedActivities = [...activities].sort((a, b) => {
    return new Date(b.activityDate).getTime() - new Date(a.activityDate).getTime();
  });

  const lastActivity = sortedActivities.length > 0 ? sortedActivities[0] : null;

  // 5. Pemupukan Terakhir & Akumulasi Hara
  const fertActivities = sortedActivities.filter((a) => a.category === 'FERTILIZER');
  const recentFertActivity = fertActivities.length > 0 ? fertActivities[0] : null;
  const recentFertApps = recentFertActivity
    ? fertilizerApplications.filter((f) => f.activityId === recentFertActivity.id)
    : [];

  let totalAppliedKg = 0;
  const fertAppsForAccumulation: Array<{ amountKg: number; composition?: any }> = [];

  for (const fa of fertilizerApplications) {
    totalAppliedKg += fa.amountKg;
    // Jika calculatedNutrients tersimpan, konversikan kembali ke format komposisi estimasi
    if (fa.calculatedNutrients) {
      fertAppsForAccumulation.push({
        amountKg: fa.amountKg,
        composition: {
          N: fa.amountKg > 0 && fa.calculatedNutrients.N_kg ? (fa.calculatedNutrients.N_kg / fa.amountKg) * 100 : 0,
          P2O5: fa.amountKg > 0 && fa.calculatedNutrients.P2O5_kg ? (fa.calculatedNutrients.P2O5_kg / fa.amountKg) * 100 : 0,
          K2O: fa.amountKg > 0 && fa.calculatedNutrients.K2O_kg ? (fa.calculatedNutrients.K2O_kg / fa.amountKg) * 100 : 0,
          S: fa.amountKg > 0 && fa.calculatedNutrients.S_kg ? (fa.calculatedNutrients.S_kg / fa.amountKg) * 100 : 0,
        },
      });
    }
  }

  const accumulatedNutrientsKg = accumulateNutrients(fertAppsForAccumulation);

  // 6. Pengamatan OPT Terakhir
  const optActivities = sortedActivities.filter((a) => a.category === 'OPT');
  const recentOptActivity = optActivities.length > 0 ? optActivities[0] : null;
  const recentOptObs = recentOptActivity
    ? optObservations.filter((o) => o.activityId === recentOptActivity.id)
    : [];

  const hasActiveInfestation = recentOptObs.some(
    (o) => o.attackSeverity !== 'LIGHT' || (o.attackPercentage && o.attackPercentage > 5)
  );

  // 7. Pengairan Terakhir
  const waterActivities = sortedActivities.filter((a) => a.category === 'IRRIGATION');
  const recentWaterActivity = waterActivities.length > 0 ? waterActivities[0] : null;

  return {
    cropSeasonId: cropSeason.id,
    landId: cropSeason.landId,
    landName: land?.name,
    commodity: cropSeason.commodity || 'Padi',
    varietyName: cropSeason.varietyName,
    varietyDurationDays: duration || undefined,
    plantedAreaHa: cropSeason.plantedAreaHa || 0,
    plantingSystem: cropSeason.plantingSystem,
    status: cropSeason.status,

    targetDate: targetDateStr,
    hst,
    growthPhase,

    lastActivity,
    recentFertilization: {
      activity: recentFertActivity,
      applications: recentFertApps,
      accumulatedNutrientsKg,
      totalAppliedKg,
    },
    recentOptObservation: {
      activity: recentOptActivity,
      observations: recentOptObs,
      hasActiveInfestation,
    },
    recentWaterManagement: {
      activity: recentWaterActivity,
      waterCondition: recentWaterActivity?.notes,
    },

    dataQuality: {
      hasPlantingDate,
      hasVariety,
      hasArea,
      isComplete: missingDataNotes.length === 0,
      missingDataNotes,
    },
  };
}
