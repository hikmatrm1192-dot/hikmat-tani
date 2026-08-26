/**
 * HIKMAT TANI - Rice Variety Domain Model
 */

import { EntityId, ISODateString, WeightKg } from './common.ts';

export interface RiceVariety {
  id: EntityId;
  name: string;                   // Contoh: "Inpari 32 HDB", "Ciherang", "Mekongga"
  aliases: string[];
  growthDurationDays?: number;    // Umur tanaman (hari)
  potentialYieldKgHa?: WeightKg;  // Potensi hasil (kg/ha)
  resistanceProfile?: string;     // Ketahanan terhadap HDB, Blas, Wereng Coklat, dll.
  referenceId?: EntityId;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
