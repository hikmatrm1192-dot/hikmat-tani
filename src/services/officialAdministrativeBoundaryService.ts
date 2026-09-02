import {
  AdminLevel,
  AdministrativeFeature,
  AdministrativeHierarchy,
  AdministrativeSpatialLookupResult,
  BoundingBox,
  OfficialGeospatialMetadata,
} from '../types/administrativeBoundary.ts';
import { VillageBoundaryFeature } from '../types/villageBoundary.ts';
import {
  calculatePolygonCentroid,
  getPolygonBoundingBox,
  isBBoxIntersecting,
  isPointInPolygon,
  LatLngPoint,
  minDistanceToPolygonBorderM,
} from '../utils/geoUtils.ts';

/** Official BIG administrative boundary provider for HIKMAT TANI. */
const BIG_BASE = 'https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH';
const ENDPOINTS: Record<AdminLevel, string> = {
  PROVINCE: `${BIG_BASE}/BATAS_WILAYAH/MapServer/12`,
  REGENCY: `${BIG_BASE}/BATAS_KABKOTA_AR/MapServer/0`,
  DISTRICT: `${BIG_BASE}/BATAS_KECAMATAN_AR/MapServer/0`,
  VILLAGE: `${BIG_BASE}/BATAS_DESAKEL_AR/MapServer/0`,
};
const JAWA_BARAT_CODE = '32';
const MAX_RECORD_COUNT = 200;
const REQUEST_TIMEOUT_MS = 60000;
const BIG_RETRY_ATTEMPTS = 4;
const BIG_RETRY_BASE_DELAY_MS = 1000;
const CACHE_PREFIX = 'hikmat-tani:big-admin:2026-06:';
const REQUIRED_FIELDS = 'KDPPUM,KDPKAB,KDCPUM,KDEPUM,WADMPR,WADMKK,WADMKC,WADMKD';

export const OFFICIAL_ADMIN_METADATA: OfficialGeospatialMetadata = {
  sourceName: 'Badan Informasi Geospasial (BIG) - Geoservices / Ina-Geoportal',
  provider: 'Badan Informasi Geospasial (BIG)',
  portalUrl: 'https://tanahair.indonesia.go.id/portal-web/',
  datasetName: 'Basis Data Batas Wilayah Administrasi Nasional',
  edition: 'Edisi Juni 2026',
  legalReference: 'Kepmendagri 300.2.2-2430 Tahun 2025',
  scale: 'BIG administrative boundary geodatabase',
  coordinateSystem: 'WGS 84 (EPSG:4326)',
  lastUpdated: '2026-06-01T00:00:00.000Z',
  fallbackReference: 'HIKMAT TANI embedded seed hanya sebagai fallback offline, bukan sumber utama.',
};

interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  exceededTransferLimit?: boolean;
  features: Array<{
    type: 'Feature';
    geometry: { type: string; coordinates: unknown } | null;
    properties?: Record<string, unknown>;
  }>;
}

function normalizeCode(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}
function cleanName(value: unknown): string { return normalizeCode(value); }

function ringToPoints(ring: unknown): LatLngPoint[] {
  if (!Array.isArray(ring)) return [];
  return ring
    .filter((p) => Array.isArray(p) && p.length >= 2)
    .map((p) => ({ lat: Number(p[1]), lng: Number(p[0]) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
}

function geometryToPoints(geometry: { type: string; coordinates: unknown } | null): LatLngPoint[] {
  if (!geometry) return [];
  const coords = geometry.coordinates;
  if (geometry.type === 'Polygon' && Array.isArray(coords)) return ringToPoints(coords[0]);
  if (geometry.type === 'MultiPolygon' && Array.isArray(coords)) {
    const largest = (coords as unknown[])
      .map((polygon) => (Array.isArray(polygon) ? ringToPoints(polygon[0]) : []))
      .sort((a, b) => b.length - a.length)[0];
    return largest || [];
  }
  return [];
}

function toAdministrativeFeature(level: AdminLevel, feature: GeoJsonFeatureCollection['features'][number]): AdministrativeFeature | null {
  const p = feature.properties || {};
  const coordinates = geometryToPoints(feature.geometry);
  if (coordinates.length < 3) return null;

  const provinceCode = normalizeCode(p.KDPPUM ?? p.kdppum);
  const regencyCode = normalizeCode(p.KDPKAB ?? p.kdpkab);
  const districtCode = normalizeCode(p.KDCPUM ?? p.kdcpum);
  const villageCode = normalizeCode(p.KDEPUM ?? p.kdepum);
  const provinceName = cleanName(p.WADMPR ?? p.wadmpr);
  const regencyName = cleanName(p.WADMKK ?? p.wadmkk);
  const districtName = cleanName(p.WADMKC ?? p.wadmkc);
  const villageName = cleanName(p.WADMKD ?? p.wadmkd);
  const adminCode = level === 'PROVINCE' ? provinceCode : level === 'REGENCY' ? regencyCode : level === 'DISTRICT' ? districtCode : villageCode;
  if (!adminCode) return null;

  const name = level === 'PROVINCE' ? provinceName : level === 'REGENCY' ? regencyName : level === 'DISTRICT' ? districtName : villageName;
  const parentCode = level === 'REGENCY' ? provinceCode : level === 'DISTRICT' ? regencyCode : level === 'VILLAGE' ? districtCode : undefined;
  const hierarchy: Partial<AdministrativeHierarchy> = {
    provinsi: provinceName,
    provinsiCode: provinceCode,
    kabupatenKota: regencyName,
    kabupatenKotaCode: regencyCode,
    kecamatan: districtName,
    kecamatanCode: districtCode,
    desaKelurahan: villageName,
    desaKelurahanCode: villageCode,
  };
  return {
    id: `big-${level.toLowerCase()}-${adminCode}`,
    level,
    name,
    adminCode,
    parentCode,
    hierarchy,
    source: OFFICIAL_ADMIN_METADATA.sourceName,
    edition: OFFICIAL_ADMIN_METADATA.edition,
    datasetRef: `BIG:${level}:JAWA_BARAT_2026_06`,
    legalRef: OFFICIAL_ADMIN_METADATA.legalReference,
    coordinates,
    center: calculatePolygonCentroid(coordinates),
    bbox: getPolygonBoundingBox(coordinates),
  };
}

function cacheKey(level: AdminLevel, where: string, bbox?: BoundingBox | null): string {
  const bboxKey = bbox ? `${bbox.minLat.toFixed(4)},${bbox.minLng.toFixed(4)},${bbox.maxLat.toFixed(4)},${bbox.maxLng.toFixed(4)}` : 'all';
  return `${CACHE_PREFIX}${level}:${where}:${bboxKey}`;
}

function isRetryableBigStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(url: string): Promise<T> {
  let lastStatus = 0;
  let lastError: unknown;
  for (let attempt = 1; attempt <= BIG_RETRY_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/geo+json, application/json' } });
      if (response.ok) return (await response.json()) as T;
      lastStatus = response.status;
      if (!isRetryableBigStatus(response.status) || attempt === BIG_RETRY_ATTEMPTS) {
        throw new Error(`BIG boundary request failed: HTTP ${response.status}`);
      }
    } catch (error) {
      lastError = error;
      if (error instanceof Error && error.name === 'AbortError' && attempt === BIG_RETRY_ATTEMPTS) throw error;
      if (attempt === BIG_RETRY_ATTEMPTS) throw error;
    } finally {
      clearTimeout(timeout);
    }
    await wait(BIG_RETRY_BASE_DELAY_MS * attempt);
  }
  throw new Error(`BIG boundary request failed${lastStatus ? `: HTTP ${lastStatus}` : ''}${lastError instanceof Error ? `: ${lastError.message}` : ''}`);
}

async function fetchCount(url: string): Promise<number> {
  const payload = await fetchJson<{ count?: number }>(url);
  return Number(payload.count || 0);
}

function buildWhere(level: AdminLevel, parentCode?: string): string {
  if (level === 'PROVINCE' || level === 'REGENCY') return `KDPPUM='${JAWA_BARAT_CODE}'`;
  if (level === 'DISTRICT') return parentCode ? `KDPKAB='${parentCode}'` : `KDPPUM='${JAWA_BARAT_CODE}'`;
  return parentCode ? `KDCPUM='${parentCode}'` : `KDPPUM='${JAWA_BARAT_CODE}'`;
}

function geometrySimplification(level: AdminLevel, bbox?: BoundingBox | null): number {
  if (bbox) {
    const span = Math.max(bbox.maxLat - bbox.minLat, bbox.maxLng - bbox.minLng);
    return Math.max(0.000005, Math.min(0.00015, span / 5000));
  }
  if (level === 'PROVINCE') return 0.01;
  if (level === 'REGENCY') return 0.001;
  if (level === 'DISTRICT') return 0.00025;
  return 0.00008;
}

function buildQueryUrl(level: AdminLevel, where: string, offset: number, bbox?: BoundingBox | null): string {
  const params = new URLSearchParams({
    where,
    outFields: REQUIRED_FIELDS,
    returnGeometry: 'true',
    outSR: '4326',
    f: 'geojson',
    resultOffset: String(offset),
    resultRecordCount: String(MAX_RECORD_COUNT),
    maxAllowableOffset: String(geometrySimplification(level, bbox)),
  });
  if (bbox) {
    params.set('geometry', JSON.stringify({ xmin: bbox.minLng, ymin: bbox.minLat, xmax: bbox.maxLng, ymax: bbox.maxLat, spatialReference: { wkid: 4326 } }));
    params.set('geometryType', 'esriGeometryEnvelope');
    params.set('inSR', '4326');
    params.set('spatialRel', 'esriSpatialRelIntersects');
  }
  return `${ENDPOINTS[level]}/query?${params.toString()}`;
}

class OfficialAdministrativeBoundaryService {
  private memoryCache = new Map<string, AdministrativeFeature[]>();

  getOfficialMetadata(): OfficialGeospatialMetadata { return { ...OFFICIAL_ADMIN_METADATA }; }

  private async loadLevel(level: AdminLevel, parentCode?: string, bbox?: BoundingBox | null): Promise<AdministrativeFeature[]> {
    const where = buildWhere(level, parentCode);
    const key = cacheKey(level, where, bbox);
    const cached = this.memoryCache.get(key);
    if (cached) return cached;

    const all: AdministrativeFeature[] = [];
    for (let offset = 0; ; offset += MAX_RECORD_COUNT) {
      const json = await fetchJson<GeoJsonFeatureCollection>(buildQueryUrl(level, where, offset, bbox));
      const page = json.features.map((feature) => toAdministrativeFeature(level, feature)).filter((feature): feature is AdministrativeFeature => Boolean(feature));
      all.push(...page);
      if (json.exceededTransferLimit !== true) break;
    }
    const unique = Array.from(new Map(all.map((f) => [f.adminCode, f])).values());
    this.memoryCache.set(key, unique);
    return unique;
  }

  async getJawaBaratProvinces(): Promise<AdministrativeFeature[]> { return this.loadLevel('PROVINCE'); }
  async getJawaBaratRegencies(): Promise<AdministrativeFeature[]> { return this.loadLevel('REGENCY'); }
  async getJawaBaratDistricts(): Promise<AdministrativeFeature[]> { return this.loadLevel('DISTRICT'); }
  async getJawaBaratDistrictsInBbox(bbox: BoundingBox): Promise<AdministrativeFeature[]> { return this.loadLevel('DISTRICT', undefined, bbox); }
  async getJawaBaratVillages(bbox?: BoundingBox | null): Promise<AdministrativeFeature[]> { return this.loadLevel('VILLAGE', undefined, bbox); }
  async getDistrictsByRegencyCode(regencyCode: string): Promise<AdministrativeFeature[]> { return this.loadLevel('DISTRICT', regencyCode); }
  async getVillagesByDistrictCode(districtCode: string): Promise<AdministrativeFeature[]> { return this.loadLevel('VILLAGE', districtCode); }

  async getJawaBaratDistrictCount(): Promise<number> {
    const params = new URLSearchParams({ where: buildWhere('DISTRICT'), returnCountOnly: 'true', f: 'json' });
    return fetchCount(`${ENDPOINTS.DISTRICT}/query?${params.toString()}`);
  }

  async getJawaBaratVillageCount(): Promise<number> {
    const params = new URLSearchParams({ where: buildWhere('VILLAGE'), returnCountOnly: 'true', f: 'json' });
    return fetchCount(`${ENDPOINTS.VILLAGE}/query?${params.toString()}`);
  }

  async lookupAdministrativeByPoint(point: LatLngPoint): Promise<AdministrativeSpatialLookupResult> {
    const sourceMetadata = { source: OFFICIAL_ADMIN_METADATA.sourceName, edition: OFFICIAL_ADMIN_METADATA.edition, datasetRef: 'BIG:JAWA_BARAT_ADMIN_2026_06', legalRef: OFFICIAL_ADMIN_METADATA.legalReference, verifiedAt: new Date().toISOString() };
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return { matched: false, hierarchy: {}, status: 'OUTSIDE_COVERAGE', message: 'Koordinat tidak valid', sourceMetadata };

    const probe = 0.02;
    const bbox: BoundingBox = { minLat: point.lat - probe, maxLat: point.lat + probe, minLng: point.lng - probe, maxLng: point.lng + probe };
    const villages = await this.getJawaBaratVillages(bbox);
    const village = villages.find((feature) => isPointInPolygon(point, feature.coordinates));
    if (!village) return { matched: false, hierarchy: {}, status: 'NEEDS_VERIFICATION', message: 'Tidak ditemukan polygon desa/kelurahan BIG pada titik centroid. Periksa posisi polygon dan koneksi data resmi.', sourceMetadata };

    const districtCode = village.hierarchy.kecamatanCode || '';
    const regencyCode = village.hierarchy.kabupatenKotaCode || '';
    const provinceCode = village.hierarchy.provinsiCode || JAWA_BARAT_CODE;
    const [districts, regencies, provinces] = await Promise.all([
      districtCode ? this.getDistrictsByRegencyCode(regencyCode) : Promise.resolve([]),
      this.getJawaBaratRegencies(),
      this.getJawaBaratProvinces(),
    ]);
    const district = districts.find((f) => f.adminCode === districtCode);
    const regency = regencies.find((f) => f.adminCode === regencyCode);
    const province = provinces.find((f) => f.adminCode === provinceCode);
    const distance = minDistanceToPolygonBorderM(point, village.coordinates);
    return {
      matched: true,
      hierarchy: { ...village.hierarchy },
      villageFeature: village,
      districtFeature: district,
      regencyFeature: regency,
      provinceFeature: province,
      status: distance < 15 ? 'NEEDS_VERIFICATION' : 'VERIFIED',
      distanceToBorderM: distance,
      message: distance < 15 ? `Centroid berada sekitar ${Math.round(distance)}m dari batas desa; verifikasi lapangan disarankan.` : `Teridentifikasi resmi di ${village.name}, ${village.hierarchy.kecamatan || '-'}, ${village.hierarchy.kabupatenKota || '-'}, ${village.hierarchy.provinsi || '-'}.`,
      sourceMetadata,
    };
  }

  async getVillageBoundariesInBbox(bbox: BoundingBox): Promise<VillageBoundaryFeature[]> {
    const features = await this.getJawaBaratVillages(bbox);
    return features.filter((feature) => isBBoxIntersecting(feature.bbox, bbox)).map((feature) => ({
      id: feature.id,
      villageName: feature.name,
      districtName: feature.hierarchy.kecamatan || '',
      regencyName: feature.hierarchy.kabupatenKota || '',
      provinceName: feature.hierarchy.provinsi || '',
      adminCode: feature.adminCode,
      source: feature.source,
      edition: feature.edition,
      datasetRef: feature.datasetRef,
      legalRef: feature.legalRef,
      coordinates: feature.coordinates,
      center: feature.center,
      bbox: feature.bbox,
    }));
  }
}

export const officialAdministrativeBoundaryService = new OfficialAdministrativeBoundaryService();
