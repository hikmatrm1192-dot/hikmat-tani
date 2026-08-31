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
  FieldWeatherContext,
  Land,
  Opt,
  OptObservation,
  WeatherData,
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

  // Semua Pengamatan OPT Musim Ini (jika ada)
  allOptObservations?: OptObservation[];

  // Master OPT Pustaka (opsional untuk evaluasi)
  availableOpts?: Opt[];

  // Kualitas Kelengkapan Data
  dataQuality: FieldContextDataQuality;

  // Konteks Cuaca Tambahan (Opsional — Modifier Kontekstual, bukan Decision Maker)
  weatherContext?: FieldWeatherContext | null;
}

export interface BuildFieldContextParams {
  cropSeason: CropSeason;
  land?: Land | null;
  activities?: Activity[];
  fertilizerApplications?: FertilizerApplication[];
  optObservations?: OptObservation[];
  availableOpts?: Opt[];
  targetDate?: string | Date;
  varietyDurationDays?: number | null;
  weatherData?: WeatherData | null;
  weatherContext?: FieldWeatherContext | null;
}

/**
 * Ekstraksi deterministik WeatherData menjadi FieldWeatherContext murni.
 * Tanpa side-effect I/O (network/storage), murni transformasi data.
 */
export function extractFieldWeatherContext(
  weatherData?: WeatherData | null
): FieldWeatherContext | null {
  if (!weatherData || !weatherData.current) {
    return null;
  }

  const current = weatherData.current;
  const daily = Array.isArray(weatherData.daily) ? weatherData.daily : [];

  const hasHeavyRainDaily = daily.some(
    (d) =>
      d.conditionType === 'HEAVY_RAIN' ||
      d.conditionType === 'THUNDERSTORM' ||
      (typeof d.rainMm === 'number' && d.rainMm >= 20)
  );

  const hasHeavyRainCurrent =
    current.conditionType === 'HEAVY_RAIN' ||
    current.conditionType === 'THUNDERSTORM' ||
    (typeof current.rainMm === 'number' && current.rainMm >= 20);

  const hasHeavyRainForecast = hasHeavyRainCurrent || hasHeavyRainDaily;

  let source: 'LIVE' | 'CACHE' | 'FALLBACK' = current.source || 'FALLBACK';
  if (weatherData.isOfflineFallback && source === 'LIVE') {
    source = 'FALLBACK';
  }

  return {
    isAvailable: true,
    source,
    conditionType: current.conditionType || 'UNKNOWN',
    rainProbability: typeof current.rainProbability === 'number' ? current.rainProbability : 0,
    humidity: typeof current.humidity === 'number' ? current.humidity : 0,
    windSpeed: typeof current.windSpeed === 'number' ? current.windSpeed : 0,
    rainMm: typeof current.rainMm === 'number' ? current.rainMm : 0,
    hasHeavyRainForecast,
    forecastSummary: current.condition || undefined,
  };
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
  availableOpts = [],
  targetDate = new Date(),
  varietyDurationDays,
  weatherData = null,
  weatherContext = null,
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
  let recentOptObs = recentOptActivity
    ? optObservations.filter((o) => o.activityId === recentOptActivity.id)
    : [];

  // Fallback jika ada kegiatan OPT tetapi belum ada baris OptObservation tersendiri di DB
  if (recentOptActivity && recentOptObs.length === 0) {
    recentOptObs = [
      {
        id: `obs-fallback-${recentOptActivity.id}`,
        activityId: recentOptActivity.id,
        isUnknown: true,
        customOptName: recentOptActivity.notes ? recentOptActivity.notes.slice(0, 50) : 'Pengamatan OPT Lapang',
        observedSymptoms: recentOptActivity.notes || 'Pengamatan visual di petak sawah',
        attackSeverity: 'MEDIUM',
        attackLocation: ['LEAF'],
        createdAt: recentOptActivity.createdAt,
        updatedAt: recentOptActivity.updatedAt,
      },
    ];
  }

  const hasActiveInfestation = recentOptObs.some(
    (o) => o.attackSeverity !== 'LIGHT' || (o.attackPercentage && o.attackPercentage > 5)
  );

  // 7. Pengairan Terakhir
  const waterActivities = sortedActivities.filter((a) => a.category === 'IRRIGATION');
  const recentWaterActivity = waterActivities.length > 0 ? waterActivities[0] : null;

  // 8. Penentuan Weather Context (Prioritas: weatherContext eksplisit -> ekstraksi weatherData -> null)
  const resolvedWeatherContext =
    weatherContext !== null && weatherContext !== undefined
      ? weatherContext
      : extractFieldWeatherContext(weatherData);

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

    allOptObservations: optObservations,
    availableOpts,

    dataQuality: {
      hasPlantingDate,
      hasVariety,
      hasArea,
      isComplete: missingDataNotes.length === 0,
      missingDataNotes,
    },

    weatherContext: resolvedWeatherContext ?? null,
  };
}
