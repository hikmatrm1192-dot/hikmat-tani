/**
 * HIKMAT TANI - Musuh Alami (Biological Control Agents)
 */

import { EntityId, ISODateString } from './common.ts';

export type NaturalEnemyType =
  | 'PREDATOR'        // Predator (Pemangsa)
  | 'PARASITOID'     // Parasitoid
  | 'ENTOMOPATHOGEN' // Patogen Serangga (Jamur/Bakteri/Virus pengendali)
  | 'OTHER';

export interface NaturalEnemy {
  id: EntityId;
  name: string;               // Contoh: "Laba-laba Serigala", "Kumbang Kubah"
  scientificName?: string;    // Contoh: "Pardosa pseudoannulata", "Micraspis crocea"
  type: NaturalEnemyType;
  targetOptIds: EntityId[];   // Relasi ke Master OPT yang menjadi mangsa/inang
  attackedStages: string[];   // Telur, Larva/Ulat, Nimfa, Imago/Dewasa
  habitat?: string;           // Habitat berkembang biak (galengan, pangkal batang, dll)
  conservationNotes?: string; // Cara pelestarian di sawah (e.g., refugia, kurangi insektisida spektrum luas)
  referenceId?: EntityId;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
