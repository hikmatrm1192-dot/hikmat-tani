/**
 * HIKMAT TANI - Organisme Pengganggu Tanaman (OPT) & Pengamatan Lapangan
 * 
 * Prinsip:
 * - Master OPT adalah Master Data berakar pada referensi ilmiah.
 * - OptObservation adalah Event Data yang fleksibel (bisa dicatat meski petani tidak tahu nama OPT).
 */

import { EntityId, ISODateString, Percentage } from './common.ts';

export type OptCategory =
  | 'INSECT_PEST' // Hama Serangga
  | 'DISEASE'     // Penyakit (Jamur/Bakteri/Virus)
  | 'WEED'        // Gulma
  | 'RODENT'      // Tikus / Vertebrata
  | 'OTHER';

export type AttackSeverity = 'UNKNOWN' | 'LIGHT' | 'MEDIUM' | 'HEAVY';

export type AttackLocation =
  | 'LEAF'    // Daun
  | 'STEM'    // Batang
  | 'PANICLE' // Malai / Bunga
  | 'ROOT'    // Akar
  | 'GRAIN'   // Bulir Padi
  | 'OTHER'
  | string;

/**
 * Master Data Organisme Pengganggu Tanaman (OPT)
 */
export interface Opt {
  id: EntityId;
  commonName: string;         // Contoh: "Penggerek Batang Padi Kuning"
  scientificName?: string;    // Contoh: "Scirpophaga incertulas"
  category: OptCategory;
  aliases: string[];          // Contoh: ["Sundep", "Beluk"]
  symptoms: string;           // Gejala serangan umum
  lifeCycle?: string;         // Siklus hidup (hari / fase)
  hostPlants: string[];       // Tanaman inang
  vulnerableStage?: string;   // Fase tanaman yang paling rentan (e.g., "Vegetatif - Pembentukan Anakan")
  triggerFactors: string[];   // Faktor pemicu ledakan populasi
  monitoringMethod?: string;  // Cara pengamatan di lapangan
  economicThreshold?: string; // Ambang batas ekonomi / pengendalian
  culturalControl?: string;   // Pengendalian budidaya (kultur teknis)
  mechanicalControl?: string; // Pengendalian fisik / mekanis
  biologicalControl?: string; // Pengendalian hayati / musuh alami
  chemicalControl?: string;   // Pengendalian kimiawi
  activeIngredients: string[];// Bahan aktif yang terdaftar/relevan
  resistanceNotes?: string;   // Catatan risiko resistensi
  referenceId?: EntityId;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/**
 * Event Data: Pengamatan OPT oleh Petani di Lapangan
 */
export interface OptObservation {
  id: EntityId;
  activityId: EntityId;
  optId?: EntityId;
  isUnknown: boolean;           // True jika petani memilih "Tidak tahu nama OPT"
  customOptName?: string;       // Sebutan lokal atau deskripsi bebas dari petani
  attackSeverity?: AttackSeverity;
  attackPercentage?: Percentage;
  attackLocation: AttackLocation[];
  observedSymptoms?: string;
  photoLocalUri?: string;       // Path lokal foto terkompresi (opsional)
  actionTaken?: string;         // Tindakan yang langsung dilakukan petani
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
