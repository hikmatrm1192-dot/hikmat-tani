/**
 * HIKMAT TANI - Official Village Administrative Boundary Types
 * 
 * Standar Sumber:
 * - Badan Informasi Geospasial (BIG) - Ina-Geoportal / Peta Rupabumi Indonesia (RBI) Batas Wilayah Administrasi Desa/Kelurahan
 * - Kepmendagri No. 050-145 / Permendagri No. 72 (Kode & Data Wilayah Administrasi Pemerintahan)
 */

import { LatLngPoint } from '../utils/geoUtils.ts';

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface VillageBoundaryFeature {
  id: string; // e.g. "big-adm-3215012001"
  villageName: string; // e.g. "Desa Karangpawitan"
  districtName: string; // e.g. "Kecamatan Karawang Barat"
  regencyName: string; // e.g. "Kabupaten Karawang"
  provinceName: string; // e.g. "Jawa Barat"
  adminCode: string; // Kode Kemendagri / BIG, e.g. "32.15.01.2001"
  source: string; // "Badan Informasi Geospasial (BIG) - Ina-Geoportal"
  edition: string; // "Peta Rupabumi Indonesia (RBI) Skala 1:25.000 / Edisi Pemutakhiran"
  datasetRef: string; // "BIG:RBI_25K_BATAS_DESA_KSP"
  legalRef: string; // "Kepmendagri No. 050-145 / Permendagri No. 72"
  coordinates: LatLngPoint[]; // Titik poligon batas luar desa
  center: LatLngPoint; // Centroid label desa
  bbox: BoundingBox;
}

export interface VillageSpatialLookupResult {
  matched: boolean;
  feature?: VillageBoundaryFeature;
  status: 'VERIFIED' | 'NEEDS_VERIFICATION' | 'OUTSIDE_COVERAGE';
  distanceToBorderM?: number;
  message?: string;
  sourceMetadata: {
    source: string;
    edition: string;
    datasetRef: string;
    legalRef: string;
    verifiedAt: string;
  };
}

export interface OfficialGeospatialMetadata {
  sourceName: string;
  provider: string;
  portalUrl: string;
  datasetName: string;
  edition: string;
  legalReference: string;
  scale: string;
  coordinateSystem: string;
  lastUpdated: string;
}
