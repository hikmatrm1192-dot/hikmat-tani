/**
 * HIKMAT TANI - Scientific & Agronomic References
 * 
 * Prinsip: Setiap rekomendasi, formula pupuk, dan data OPT harus dapat
 * ditelusuri sumber ilmiah atau dokumen rujukannya.
 */

import { EntityId, ISODateString } from './common.ts';

export type ValidationStatus = 'DRAFT' | 'REVIEW' | 'VERIFIED' | 'RETIRED';

export interface Reference {
  id: EntityId;
  title: string;                 // Judul buku, jurnal, panduan teknis
  authorInstitution?: string;    // e.g., "Badan Litbang Pertanian / BRIN / IRRI"
  publicationYear?: number;      // Tahun publikasi
  sourceUrlOrBook?: string;      // URL sumber atau nama penerbit/buku cetak
  regionApplicability?: string;  // Wilayah kesesuaian (misal: "Sawah Irigasi Jawa Barat")
  validationStatus: ValidationStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
