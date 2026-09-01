/**
 * HIKMAT TANI - Organisme Pengganggu Tanaman (OPT) & Pengamatan Lapangan
 * 
 * Prinsip:
 * - Master OPT adalah Master Data berakar pada referensi ilmiah.
 * - OptObservation adalah Event Data yang fleksibel (bisa dicatat meski petani tidak tahu nama OPT).
 */

import { EntityId, ISODateString, Percentage } from './common.ts';

export type OptCategory =
  | 'INSECT_PEST'      // Hama Serangga
  | 'DISEASE'          // Penyakit (Jamur/Bakteri/Virus)
  | 'WEED'             // Gulma
  | 'RODENT'           // Tikus / Vertebrata
  | 'VERTEBRATE_PEST'  // Hama Vertebrata (Tikus/Burung)
  | 'MOLLUSC_PEST'     // Hama Moluska (Keong Mas)
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

export type IdentificationMethod = 'AI_IMAGE_CAPTURE' | 'MANUAL_LIST' | 'SYMPTOM';
export type AiConfidenceLevel = 'HIGH' | 'MODERATE' | 'UNCERTAIN' | 'UNCLEAR';

/**
 * Event Data: Pengamatan OPT oleh Petani di Lapangan
 * 
 * Privasi & On-Device Rule:
 * Foto hanya diproses secara lokal di memori HP untuk AI Image Capture.
 * File foto, blob, URL, atau base64 TIDAK disimpan ke database atau server.
 * Yang disimpan hanya metadata hasil pengamatan, ciri terdeteksi, dan kandidat analisis.
 */
export interface OptObservation {
  id: EntityId;
  activityId: EntityId;
  optId?: EntityId;
  isUnknown: boolean;           // True jika petani memilih "Tidak tahu nama OPT"
  customOptName?: string;       // Sebutan lokal atau deskripsi bebas dari petani
  attackSeverity?: AttackSeverity;
  attackPercentage?: Percentage;
  attackAreaM2?: number;        // Luas area serangan OPT dalam satuan m² (opsional)
  attackLocation: AttackLocation[];
  observedSymptoms?: string;
  photoLocalUri?: string;       // Deprecated / Undefined: Foto tidak disimpan di database demi privasi
  identificationMethod?: IdentificationMethod; // 'AI_IMAGE_CAPTURE' | 'MANUAL_LIST' | 'SYMPTOM'
  confidenceLevel?: AiConfidenceLevel;         // 'HIGH' | 'MODERATE' | 'UNCERTAIN' | 'UNCLEAR'
  detectedTraits?: string[];    // Ciri visual spesifik yang terdeteksi oleh AI Image Capture On-Device
  visualClues?: string[];       // Petunjuk visual yang terdeteksi dari foto
  candidateOptIds?: EntityId[]; // Kandidat OPT rujukan relevan (opsional)
  photoAnalysisNotes?: string;  // Catatan analisis visual atau kualitas foto (opsional)
  actionTaken?: string;         // Tindakan yang langsung dilakukan petani
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
