/**
 * HIKMAT TANI - CropSeason Domain Model
 * 
 * Catatan: HST (Hari Setelah Tanam) dihitung secara dinamis dari plantingDate
 * dan bukan field statis permanen pada entity ini.
 */

import { AreaHa, EntityId, ISODateString, WeightKg } from './common.ts';

export type CropSeasonStatus = 'ACTIVE' | 'COMPLETED' | 'FAILED';

export type PlantingSystem =
  | 'JAJAR_LEGOWO_2_1'
  | 'JAJAR_LEGOWO_4_1'
  | 'TEGEL'
  | 'TABELA' // Tanam Benih Langsung
  | 'SRI'
  | 'OTHER'
  | string;

export interface CropSeason {
  id: EntityId;
  landId: EntityId;
  commodity: string; // Default: 'Padi'
  varietyId?: EntityId;
  varietyName?: string;
  plantingDate: ISODateString;
  plantedAreaHa: AreaHa;
  plantingSystem?: PlantingSystem;
  status: CropSeasonStatus;
  harvestDate?: ISODateString;
  yieldKg?: WeightKg;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
