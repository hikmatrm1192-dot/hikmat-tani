/**
 * HIKMAT TANI - Activity Domain Model
 * 
 * Catatan: HST pada Activity adalah snapshot kondisi tanaman saat kegiatan dicatat.
 * Tanggal acuan utama tetap activityDate.
 */

import { EntityId, ISODateString } from './common.ts';

export type ActivityCategory =
  | 'PLANTING'
  | 'FERTILIZER'
  | 'IRRIGATION'
  | 'OPT'
  | 'MAINTENANCE'
  | 'HARVEST'
  | 'OTHER';

export interface Activity {
  id: EntityId;
  cropSeasonId: EntityId;
  category: ActivityCategory;
  activityDate: ISODateString;
  hst: number; // Snapshot Hari Setelah Tanam saat kegiatan dilakukan
  notes?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
