/**
 * HIKMAT TANI - Activity Timeline Engine
 * 
 * Membangun linimasa kronologis seluruh kegiatan dalam satu musim tanam:
 * - Tanam (Planting)
 * - Pemupukan (Fertilizer)
 * - Pengairan (Water Management)
 * - Pengamatan OPT (Pest/Disease Observation)
 * - Pemeliharaan / Penyiangan (Maintenance / Weeding)
 * - Panen (Harvest)
 * - Lainnya (Other)
 * 
 * Prinsip:
 * - Menghitung HST secara konsisten berdasarkan plantingDate.
 * - Mempertahankan kompatibilitas jika HST sudah tersimpan pada activity snapshot.
 * - Mengurutkan peristiwa secara kronologis (dari awal musim ke akhir).
 * - Pure logic tanpa ketergantungan UI.
 */

import {
  Activity,
  ActivityCategory,
  CropSeason,
  FertilizerApplication,
  OptObservation,
} from '../types/index.ts';
import { calculateHST } from './hstCalculator.ts';

export interface TimelineEvent {
  id: string;
  activityId?: string;
  category: ActivityCategory | 'PLANTING' | 'HARVEST';
  title: string;
  activityDate: string;
  hst: number;
  notes?: string;
  details?: {
    fertilizerApplications?: FertilizerApplication[];
    optObservations?: OptObservation[];
    extra?: Record<string, unknown>;
  };
  createdAt: string;
}

export interface BuildTimelineParams {
  cropSeason: CropSeason;
  activities: Activity[];
  fertilizerApplications?: FertilizerApplication[];
  optObservations?: OptObservation[];
}

/**
 * Menyusun urutan linimasa kegiatan musim tanam.
 */
export function buildActivityTimeline({
  cropSeason,
  activities,
  fertilizerApplications = [],
  optObservations = [],
}: BuildTimelineParams): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // 1. Event Hari Tanam (Basis Permulaan Musim Tanam)
  if (cropSeason.plantingDate) {
    events.push({
      id: `event-planting-${cropSeason.id}`,
      category: 'PLANTING',
      title: `Tanam Padi (${cropSeason.varietyName || 'Varietas belum dicatat'})`,
      activityDate: cropSeason.plantingDate,
      hst: 0,
      notes: `Sistem Tanam: ${cropSeason.plantingSystem || 'Standar'}, Luas: ${Math.round(
        (cropSeason.plantedAreaHa || 0) * 10000
      ).toLocaleString('id-ID')} m²`,
      createdAt: cropSeason.createdAt,
    });
  }

  // 2. Petakan Seluruh Kegiatan Lapangan
  for (const act of activities) {
    // Hitung HST dinamis jika belum ada, atau gunakan hst tersimpan
    let eventHst = act.hst;
    if (eventHst === undefined || eventHst === null) {
      if (cropSeason.plantingDate && act.activityDate) {
        const hstCalc = calculateHST(cropSeason.plantingDate, act.activityDate);
        eventHst = hstCalc.isValid && hstCalc.hst !== null ? hstCalc.hst : 0;
      } else {
        eventHst = 0;
      }
    }

    // Ambil detail terkait pemupukan jika ada
    const relatedFertApps = fertilizerApplications.filter(
      (fa) => fa.activityId === act.id
    );

    // Ambil detail terkait OPT jika ada
    const relatedOptObs = optObservations.filter(
      (obs) => obs.activityId === act.id
    );

    let eventTitle = act.notes || getCategoryLabel(act.category);
    if (act.category === 'FERTILIZER' && relatedFertApps.length > 0) {
      eventTitle = `Pemupukan: ${relatedFertApps
        .map((f) => `${f.fertilizerName} (${f.amountKg} kg)`)
        .join(', ')}`;
    } else if (act.category === 'OPT' && relatedOptObs.length > 0) {
      eventTitle = `Pengamatan OPT: ${relatedOptObs
        .map((o) => (o.isUnknown ? o.customOptName || 'OPT Belum Diketahui' : 'OPT Teridentifikasi'))
        .join(', ')}`;
    }

    events.push({
      id: `event-act-${act.id}`,
      activityId: act.id,
      category: act.category,
      title: eventTitle,
      activityDate: act.activityDate,
      hst: eventHst,
      notes: act.notes,
      details: {
        fertilizerApplications: relatedFertApps.length > 0 ? relatedFertApps : undefined,
        optObservations: relatedOptObs.length > 0 ? relatedOptObs : undefined,
      },
      createdAt: act.createdAt,
    });
  }

  // 3. Event Panen (Jika sudah selesai / ada harvestDate)
  if (cropSeason.harvestDate) {
    let harvestHst = 0;
    if (cropSeason.plantingDate) {
      const hstCalc = calculateHST(cropSeason.plantingDate, cropSeason.harvestDate);
      harvestHst = hstCalc.isValid && hstCalc.hst !== null ? hstCalc.hst : 0;
    }

    events.push({
      id: `event-harvest-${cropSeason.id}`,
      category: 'HARVEST',
      title: 'Panen Padi',
      activityDate: cropSeason.harvestDate,
      hst: harvestHst,
      notes: cropSeason.yieldKg
        ? `Hasil Panen: ${cropSeason.yieldKg.toLocaleString('id-ID')} kg`
        : 'Panen telah selesai dilaksanakan.',
      createdAt: cropSeason.updatedAt,
    });
  }

  // 4. Urutkan secara kronologis berdasarkan activityDate (dan id bila tanggal sama)
  return events.sort((a, b) => {
    const timeA = new Date(a.activityDate).getTime();
    const timeB = new Date(b.activityDate).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return a.id.localeCompare(b.id);
  });
}

function getCategoryLabel(category: ActivityCategory): string {
  switch (category) {
    case 'FERTILIZER':
      return 'Aplikasi Pemupukan';
    case 'IRRIGATION':
      return 'Pengaturan Pengairan';
    case 'OPT':
      return 'Pengamatan OPT / Hama Penyakit';
    case 'MAINTENANCE':
      return 'Pemeliharaan / Penyiangan';
    case 'HARVEST':
      return 'Panen';
    default:
      return 'Aktivitas Lapangan';
  }
}
