/**
 * HIKMAT TANI - Seedbed (Persemaian) Domain Model
 * 
 * Prinsip:
 * - Persemaian adalah tahap penting dalam siklus budidaya sebelum tanam.
 * - Tanggal persemaian dihitung sebagai HSS (Hari Setelah Semai).
 * - Persemaian BUKAN tanggal tanam / HST 0.
 * - HST tetap dihitung murni dari tanggal pindah tanam ke lahan utama.
 */

import { EntityId, ISODateString } from './common.ts';

export type NurseryMethod =
  | 'WET_BED'     // Persemaian Basah Tradisional di Sawah
  | 'DRY_BED'     // Persemaian Kering (Bedengan Kering)
  | 'DAPOG'       // Persemaian Dapog (Sistem Mesin Transplanter / Nampan)
  | 'TRAY'        // Tray Semai Moderen
  | 'OTHER'       // Metode Lainnya
  | string;

export interface Seedbed {
  id: EntityId;
  cropSeasonId: EntityId;
  activityId?: EntityId;
  startDate: ISODateString; // Tanggal mulai semai
  varietyName: string;
  varietyId?: EntityId;
  nurseryAreaM2?: number; // Luas bedengan semai (m2)
  nurseryLocation?: string; // Lokasi / petak persemaian
  seedAmountKg: number; // Jumlah benih (kg)
  seedUnit?: string; // Satuan: 'kg', 'kantong', 'gram'
  nurseryMethod: NurseryMethod;
  transplantDateExpected?: ISODateString; // Rencana tanggal pindah tanam
  transplantDateActual?: ISODateString; // Tanggal aktual pindah tanam
  notes?: string;
  photoLocalUri?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
