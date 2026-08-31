/**
 * HIKMAT TANI - Fertilizer Domain Model & Application Record
 * 
 * Prinsip:
 * - Master Fertilizer adalah Master Data yang dapat memiliki referensi ilmiah.
 * - FertilizerApplication adalah Event Data yang mencatat aksi nyata dan hasil kalkulasi nutrisi.
 */

import { EntityId, ISODateString, Percentage, WeightKg } from './common.ts';

export type FertilizerType =
  | 'ORGANIC'
  | 'INORGANIC_SINGLE'
  | 'INORGANIC_COMPOUND'
  | 'BIOLOGICAL'
  | 'OTHER';

export type ApplicationMethod =
  | 'BROADCAST' // Tabur
  | 'BAND'      // Larik / Alur
  | 'DRENCH'    // Kocor
  | 'FOLIAR'    // Semprot Daun
  | 'OTHER'
  | string;

/**
 * Komposisi unsur hara (% berat pupuk).
 * Dibuat extensible agar penambahan unsur mikro/makro lain di masa depan
 * tidak merusak struktur database atau tipe data.
 */
export interface NutrientComposition {
  N?: Percentage;    // Nitrogen (%)
  P2O5?: Percentage; // Fosfat (%)
  K2O?: Percentage;  // Kalium (%)
  S?: Percentage;    // Belerang / Sulfur (%)
  Ca?: Percentage;   // Kalsium (%)
  Mg?: Percentage;   // Magnesium (%)
  Zn?: Percentage;   // Seng (%)
  Fe?: Percentage;   // Besi (%)
  B?: Percentage;    // Boron (%)
  [customNutrient: string]: Percentage | undefined;
}

/**
 * Kandungan nutrisi aktual yang dihasilkan (dalam kg).
 */
export interface CalculatedNutrients {
  N_kg?: WeightKg;
  P2O5_kg?: WeightKg;
  K2O_kg?: WeightKg;
  S_kg?: WeightKg;
  Ca_kg?: WeightKg;
  Mg_kg?: WeightKg;
  Zn_kg?: WeightKg;
  Fe_kg?: WeightKg;
  B_kg?: WeightKg;
  [customNutrient: string]: WeightKg | undefined;
}

/**
 * Master Data Pupuk
 */
export interface Fertilizer {
  id: EntityId;
  name: string;
  type: FertilizerType;
  formula?: string; // Contoh: "46-0-0", "15-15-15", "16-16-16"
  nutrientComposition: NutrientComposition;
  aliases: string[];
  isSubsidized?: boolean;
  manufacturer?: string;
  brand?: string;
  category?: string;
  subsidyNote?: string;
  description?: string;
  referenceId?: EntityId;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/**
 * Event Data: Catatan Aplikasi Pemupukan di Lapangan
 */
export interface FertilizerApplication {
  id: EntityId;
  activityId: EntityId;
  fertilizerId?: EntityId;
  fertilizerName: string;
  amountKg: WeightKg;
  applicationMethod: ApplicationMethod;
  calculatedNutrients: CalculatedNutrients;
  isSubsidized?: boolean;
  formula?: string;
  brand?: string;
  category?: string;
  manufacturer?: string;
  notes?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
