/**
 * HIKMAT TANI - Three-Layer Decision Architecture
 * 
 * PRINSIP UTAMA:
 * 1. PETANI TETAP MENJADI PENGAMBIL KEPUTUSAN.
 * 2. Rekomendasi sistem, Keputusan petani, dan Tindakan aktual disimpan TERPISAH.
 * 3. Tindakan aktual adalah rekaman sejarah riil yang tidak boleh ditimpa oleh pembaruan rekomendasi.
 */

import { EntityId, ISODateString } from './common.ts';

export type ContextType =
  | 'GROWTH_STAGE'     // Informasi Fase Pertumbuhan / Fenologi
  | 'FERTILIZER'       // Pemupukan
  | 'OPT_CONTROL'      // Pengendalian Hama & Penyakit (OPT)
  | 'WATER_MANAGEMENT' // Manajemen Pengairan
  | 'OTHER';

export type RecommendationPriority = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type FarmerDecisionChoice =
  | 'ACCEPT'      // Menerima rekomendasi sepenuhnya
  | 'ADJUST'      // Menyesuaikan (misal dosis/waktu diubah)
  | 'REJECT'      // Menolak / Tidak melakukan
  | 'ALTERNATIVE';// Menggunakan cara atau bahan alternatif

/**
 * Lapisan 1: Saran Sistem (Deterministic / Rule-Based)
 */
export interface Recommendation {
  id: EntityId;
  cropSeasonId: EntityId;
  contextType: ContextType;
  title: string;
  message: string;                      // Bahasa saran santun & membantu
  reason?: string;                       // Penjelasan logis mengapa saran muncul
  priority?: RecommendationPriority;
  ruleId?: string;                       // Identifikasi aturan agronomi yang memicu saran
  knowledgeReferenceIds: EntityId[];    // Rujukan ilmiah/artikel terkait
  createdAt: ISODateString;
}

/**
 * Lapisan 2: Keputusan Petani
 */
export interface FarmerDecision {
  id: EntityId;
  recommendationId?: EntityId;
  cropSeasonId: EntityId;
  decision: FarmerDecisionChoice;
  notes?: string;                        // Catatan alasan pertimbangan petani
  createdAt: ISODateString;
}

/**
 * Lapisan 3: Tindakan Aktual Petani (Bagian Sejarah Budidaya Riil)
 */
export interface ActualAction {
  id: EntityId;
  cropSeasonId: EntityId;
  activityId?: EntityId;                 // Terhubung ke Activity terkait
  decisionId?: EntityId;                 // Terhubung ke Keputusan
  actionType: string;                    // e.g., "APPLIED_UREA_50KG"
  description: string;                   // Deskripsi konkret tindakan nyata
  data?: Record<string, unknown>;        // Snapshot data terstruktur
  performedAt: ISODateString;
  createdAt: ISODateString;
}

/**
 * Record Komposit untuk kemudahan query relasional
 */
export interface DecisionRecord {
  id: EntityId;
  cropSeasonId: EntityId;
  activityId?: EntityId;
  contextType: ContextType;
  recommendation?: Recommendation;
  farmerDecision?: FarmerDecision;
  actualAction: ActualAction;
  createdAt: ISODateString;
}
