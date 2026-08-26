/**
 * HIKMAT TANI - Knowledge Base Articles
 * 
 * Prinsip: Data-driven knowledge base yang dapat diperbarui secara dinamis
 * tanpa harus mengubah kode komponen UI.
 */

import { EntityId, ISODateString } from './common.ts';
import { ValidationStatus } from './reference.ts';

export type KnowledgeCategory =
  | 'CULTIVATION'   // Budidaya Padi
  | 'FERTILIZATION' // Pemupukan & Hara
  | 'PEST_DISEASE'  // OPT & Penyakit
  | 'IRRIGATION'    // Pengairan
  | 'HARVEST'       // Panen & Pasca Panen
  | 'GENERAL'       // Literasi Pertanian
  | string;

export interface KnowledgeArticle {
  id: EntityId;
  category: KnowledgeCategory;
  title: string;
  summary: string;
  content: string;               // Konten terstruktur / markdown sederhana
  tags: string[];
  referenceId?: EntityId;        // Relasi ke tabel Reference
  verifiedDate?: ISODateString;
  status: ValidationStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
