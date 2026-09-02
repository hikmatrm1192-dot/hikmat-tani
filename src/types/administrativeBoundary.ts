/**
 * HIKMAT TANI - 4-Level Official Administrative Boundary Types
 *
 * Standard hierarchy: BIG geometry with Kemendagri administrative nomenclature/codes.
 */

import { LatLngPoint } from '../utils/geoUtils.ts';

export type AdminLevel = 'PROVINCE' | 'REGENCY' | 'DISTRICT' | 'VILLAGE';

export interface BoundingBox { minLat: number; maxLat: number; minLng: number; maxLng: number; }

export interface AdministrativeHierarchy {
  provinsi: string; provinsiCode: string;
  kabupatenKota: string; kabupatenKotaCode: string;
  kecamatan: string; kecamatanCode: string;
  desaKelurahan: string; desaKelurahanCode: string;
}

export interface AdministrativeFeature {
  id: string; level: AdminLevel; name: string; adminCode: string; parentCode?: string;
  hierarchy: Partial<AdministrativeHierarchy>; source: string; edition: string;
  datasetRef: string; legalRef: string; coordinates: LatLngPoint[]; center: LatLngPoint; bbox: BoundingBox;
  isDiscrepancy?: boolean; discrepancyNote?: string; fallbackSource?: string;
}

export interface AdministrativeSpatialLookupResult {
  matched: boolean; hierarchy: Partial<AdministrativeHierarchy>;
  villageFeature?: AdministrativeFeature; districtFeature?: AdministrativeFeature;
  regencyFeature?: AdministrativeFeature; provinceFeature?: AdministrativeFeature;
  status: 'VERIFIED' | 'NEEDS_VERIFICATION' | 'OUTSIDE_COVERAGE' | 'MANUAL';
  distanceToBorderM?: number; message?: string;
  sourceMetadata: { source: string; edition: string; datasetRef: string; legalRef: string; verifiedAt: string };
}

export type AdministrativeHierarchyLookupResult = AdministrativeSpatialLookupResult;

export interface OfficialGeospatialMetadata {
  sourceName: string; provider: string; portalUrl: string; datasetName: string;
  edition: string; legalReference: string; scale: string; coordinateSystem: string;
  lastUpdated: string; fallbackReference?: string;
}

export interface AdministrativeZoomConfig {
  zoomLevels: { provinceMinZoom: number; regencyMinZoom: number; districtMinZoom: number; villageMinZoom: number };
  labelZoom: { provinceMaxZoom: number; regencyMinZoom: number; regencyMaxZoom: number; districtMinZoom: number; districtMaxZoom: number; villageMinZoom: number };
  viewportDebounceMs: number;
  simplifyTolerances: { lowZoom: number; mediumZoom: number; highZoom: number; rawZoom: number };
  datasetVersion: string;
}

export const ADMIN_MAP_CONFIG: AdministrativeZoomConfig = {
  zoomLevels: { provinceMinZoom: 1, regencyMinZoom: 5, districtMinZoom: 10, villageMinZoom: 13 },
  labelZoom: { provinceMaxZoom: 9, regencyMinZoom: 6, regencyMaxZoom: 12, districtMinZoom: 10, districtMaxZoom: 14, villageMinZoom: 14 },
  viewportDebounceMs: 350,
  simplifyTolerances: { lowZoom: 0.015, mediumZoom: 0.003, highZoom: 0.0006, rawZoom: 15 },
  datasetVersion: 'BIG-RBI-2026-06',
};

export interface AdministrativeCacheStats {
  datasetVersion: string; totalFeaturesIndexed: number; cachedEntriesCount: number;
  cacheHits: number; cacheMisses: number; lastPreloadedArea?: string; lastQueryDurationMs: number;
}
