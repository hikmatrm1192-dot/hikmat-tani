/**
 * HIKMAT TANI - Land Domain Model
 */

import { AreaHa, EntityId, ISODateString, Latitude, Longitude } from './common.ts';

export type WaterSource =
  | 'IRRIGATION_TECHNICAL'
  | 'IRRIGATION_SEMI_TECHNICAL'
  | 'RAIN_FED'
  | 'GROUNDWATER'
  | 'OTHER'
  | string;

export type LandType =
  | 'LOWLAND_PADDY'
  | 'RAINFED_PADDY'
  | 'TIDAL_SWAMP'
  | 'UPLAND'
  | 'OTHER'
  | string;

export type LandStatus = 'ACTIVE' | 'ARCHIVED';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface AdministrativeInfo {
  village?: string; // Nama Desa / Kelurahan
  district?: string; // Nama Kecamatan
  regency?: string; // Nama Kabupaten / Kota
  province?: string; // Nama Provinsi
  code?: string; // Kode Wilayah Administrasi (Kemendagri / BIG)
  provinsi?: string;
  provinsiCode?: string;
  kabupatenKota?: string;
  kabupatenKotaCode?: string;
  kecamatan?: string;
  kecamatanCode?: string;
  desaKelurahan?: string;
  desaKelurahanCode?: string;
  source?: string; // "Badan Informasi Geospasial (BIG) - Ina-Geoportal"
  edition?: string; // Edisi / referensi dataset
  status?: 'VERIFIED' | 'NEEDS_VERIFICATION' | 'OUTSIDE_COVERAGE' | 'MANUAL';
  verifiedAt?: string;
}

export interface Land {
  id: EntityId;
  farmerId: EntityId;
  name: string;
  areaHa: AreaHa;
  areaM2?: number; // Luas primer petak sawah dalam m²
  perimeterM?: number; // Keliling batas petak dalam meter
  coordinates?: GeoPoint[]; // Titik-titik batas polygon sawah
  center?: GeoPoint; // Titik tengah (centroid) petak sawah
  location?: string;
  waterSource?: WaterSource;
  landType?: LandType;
  status?: LandStatus; // 'ACTIVE' (default) | 'ARCHIVED'
  latitude?: Latitude;
  longitude?: Longitude;
  administrative?: AdministrativeInfo; // Data administrasi resmi (BIG & Kemendagri)
  village?: string; // Shortcut nama desa
  district?: string; // Shortcut kecamatan
  regency?: string; // Shortcut kabupaten/kota
  province?: string; // Shortcut provinsi
  admCode?: string; // Shortcut kode wilayah
  provinsi?: string;
  provinsiCode?: string;
  kabupatenKota?: string;
  kabupatenKotaCode?: string;
  kecamatan?: string;
  kecamatanCode?: string;
  desaKelurahan?: string;
  desaKelurahanCode?: string;
  droughtCategory?: 'TERANCAM' | 'RINGAN' | 'SEDANG' | 'BERAT' | 'PUSO';
  droughtTrend?: 'WORSENING' | 'IMPROVING' | 'STABLE';
  droughtLastUpdated?: string;
  notes?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
