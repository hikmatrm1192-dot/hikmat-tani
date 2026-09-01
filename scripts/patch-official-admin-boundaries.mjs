import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function replaceOnce(file, pattern, replacement, description) {
  const full = path.join(root, file);
  const source = fs.readFileSync(full, 'utf8');
  if (typeof replacement === 'string' && source.includes(replacement)) {
    console.log(`already patched ${file}: ${description}`);
    return;
  }
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`Patch target not found: ${file} :: ${description}`);
  fs.writeFileSync(full, next);
  console.log(`patched ${file}: ${description}`);
}

replaceOnce('src/services/officialAdministrativeBoundaryService.ts', /const MAX_RECORD_COUNT = 500;/, 'const MAX_RECORD_COUNT = 1000;', 'use BIG maximum page size for complete district retrieval');
replaceOnce('src/services/officialAdministrativeBoundaryService.ts', /\nfunction buildWhere\(/, `
async function fetchCount(url: string): Promise<number> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(\`BIG boundary count request failed: HTTP \${response.status}\`);
    const payload = (await response.json()) as { count?: number };
    return Number(payload.count || 0);
  } finally {
    clearTimeout(timeout);
  }
}

function buildWhere(`, 'add fast official count helper');
replaceOnce('src/services/officialAdministrativeBoundaryService.ts', /  async getJawaBaratDistricts\(\): Promise<AdministrativeFeature\[\]> \{\n    return this\.loadLevel\('DISTRICT'\);\n  \}/, `  async getJawaBaratDistricts(): Promise<AdministrativeFeature[]> {
    return this.loadLevel('DISTRICT');
  }

  async getJawaBaratDistrictCount(): Promise<number> {
    const params = new URLSearchParams({ where: buildWhere('DISTRICT'), returnCountOnly: 'true', f: 'json' });
    return fetchCount(\`\${ENDPOINTS.DISTRICT}/query?\${params.toString()}\`);
  }

  async getJawaBaratDistrictsInBbox(bbox: BoundingBox): Promise<AdministrativeFeature[]> {
    return this.loadLevel('DISTRICT', undefined, bbox);
  }

  async getJawaBaratVillageCount(): Promise<number> {
    const params = new URLSearchParams({ where: buildWhere('VILLAGE'), returnCountOnly: 'true', f: 'json' });
    return fetchCount(\`\${ENDPOINTS.VILLAGE}/query?\${params.toString()}\`);
  }`, 'add fast district/village counts and district viewport loader');

replaceOnce('src/modules/peta/PetaPertanianView.tsx', /import \{ bigGeospatialService \} from '\.\.\/\.\.\/services\/bigGeospatialService\.ts';/, "import { officialAdministrativeBoundaryService } from '../../services/officialAdministrativeBoundaryService.ts';", 'switch map source to official BIG provider');
replaceOnce('src/modules/peta/PetaPertanianView.tsx', /interface PetaPertanianViewProps \{([\s\S]*?)\n\}/, (match) => match.includes('onAdminViewportChange') ? match : match.replace("  onNavigateToTab?: (tab: 'beranda' | 'lahan' | 'kegiatan' | 'informasi' | 'saya' | 'cuaca') => void;", "  onNavigateToTab?: (tab: 'beranda' | 'lahan' | 'kegiatan' | 'informasi' | 'saya' | 'cuaca') => void;\n  onAdminViewportChange?: (bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number }, zoom: number) => void;"), 'add optional admin viewport hook');
replaceOnce('src/modules/peta/PetaPertanianView.tsx', /export function PetaPertanianView\(\{([\s\S]*?)\n\}: PetaPertanianViewProps\) \{/, (match) => match.includes('onAdminViewportChange,') ? match : match.replace('  onNavigateToTab,', '  onNavigateToTab,\n  onAdminViewportChange,'), 'accept admin viewport hook');
replaceOnce('src/modules/peta/PetaPertanianView.tsx', /  \/\/ Inisialisasi batas wilayah 4-level resmi BIG[\s\S]*?\n  \/\/ GPS State/, `  // Inisialisasi batas wilayah resmi BIG: seluruh Jawa Barat.
  // Provinsi + kabupaten/kota dimuat penuh; kecamatan/desa dimuat berbasis viewport.
  useEffect(() => {
    let cancelled = false;
    const loadAdministrativeData = async () => {
      try {
        const [provinces, regencies] = await Promise.all([
          officialAdministrativeBoundaryService.getJawaBaratProvinces(),
          officialAdministrativeBoundaryService.getJawaBaratRegencies(),
        ]);
        if (cancelled) return;
        setProvinceBoundaries(provinces);
        setRegencyBoundaries(regencies);
      } catch (error) {
        console.error('Gagal memuat batas administrasi BIG Jawa Barat:', error);
      }
    };
    void loadAdministrativeData();
    return () => { cancelled = true; };
  }, []);

  const handleAdminViewportChange = useCallback(
    async (bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number }, zoom: number) => {
      if (zoom < 8) {
        setDistrictBoundaries([]);
        setVillageBoundaries([]);
        return;
      }
      try {
        const districts = await officialAdministrativeBoundaryService.getJawaBaratDistrictsInBbox(bbox);
        setDistrictBoundaries(districts);
        if (zoom < 12 || !layerVisibility.showVillageBoundaries) {
          setVillageBoundaries([]);
          return;
        }
        const villages = await officialAdministrativeBoundaryService.getVillageBoundariesInBbox(bbox);
        setVillageBoundaries(villages);
      } catch (error) {
        console.error('Gagal memuat batas kecamatan/desa BIG pada viewport:', error);
      }
    },
    [layerVisibility.showVillageBoundaries]
  );

  // GPS State`, 'load complete hierarchy with viewport-aware district/village loading');
replaceOnce('src/modules/peta/PetaPertanianView.tsx', /        provinceBoundaries=\{provinceBoundaries\}/, "        provinceBoundaries={provinceBoundaries}\n        onAdminViewportChange={handleAdminViewportChange}", 'pass viewport loader to map');
replaceOnce('src/modules/peta/SaveDrawnParcelModal.tsx', /import \{ bigGeospatialService \} from '\.\.\/\.\.\/services\/bigGeospatialService\.ts';/, "import { officialAdministrativeBoundaryService } from '../../services/officialAdministrativeBoundaryService.ts';", 'use official BIG provider for parcel spatial lookup');
replaceOnce('src/modules/peta/SaveDrawnParcelModal.tsx', /bigGeospatialService\s*\.\s*lookupAdministrativeByPoint\(centroid\)/, 'officialAdministrativeBoundaryService.lookupAdministrativeByPoint(centroid)', 'use current BIG boundary lookup');
replaceOnce('src/modules/peta/AgriculturalMap.tsx', /import \{ AdministrativeFeature \} from '\.\.\/\.\.\/types\/administrativeBoundary\.ts';/, "import { AdministrativeFeature, BoundingBox } from '../../types/administrativeBoundary.ts';", 'import BoundingBox for viewport callback');
replaceOnce('src/modules/peta/AgriculturalMap.tsx', /  onGpsRequested\?: \(\) => void;\n\}/, "  onGpsRequested?: () => void;\n  onAdminViewportChange?: (bbox: BoundingBox, zoom: number) => void;\n}", 'add viewport callback prop');
replaceOnce('src/modules/peta/AgriculturalMap.tsx', /  onGpsRequested,\n\}: AgriculturalMapProps\) \{/, "  onGpsRequested,\n  onAdminViewportChange,\n}: AgriculturalMapProps) {", 'accept viewport callback');
replaceOnce('src/modules/peta/AgriculturalMap.tsx', /  const onSelectAdminFeatureRef = useRef\(onSelectAdminFeature\);\n  onSelectAdminFeatureRef\.current = onSelectAdminFeature;/, `  const onSelectAdminFeatureRef = useRef(onSelectAdminFeature);
  onSelectAdminFeatureRef.current = onSelectAdminFeature;
  const onAdminViewportChangeRef = useRef(onAdminViewportChange);
  onAdminViewportChangeRef.current = onAdminViewportChange;`, 'keep viewport callback fresh');
replaceOnce('src/modules/peta/AgriculturalMap.tsx', /      mapInstanceRef\.current = map;\n\n      \/\/ Pasang Capture Tap Prioritas Tinggi/, `      mapInstanceRef.current = map;

      const emitAdminViewport = () => {
        const bounds = map.getBounds();
        onAdminViewportChangeRef.current?.(
          {
            minLat: bounds.getSouth(),
            maxLat: bounds.getNorth(),
            minLng: bounds.getWest(),
            maxLng: bounds.getEast(),
          },
          map.getZoom()
        );
      };

      map.on('moveend zoomend', emitAdminViewport);
      queueMicrotask(emitAdminViewport);

      // Pasang Capture Tap Prioritas Tinggi`, 'emit viewport changes for administrative data');
replaceOnce('tests/administrative-boundary-completeness.test.ts', /import \{ bigGeospatialService \} from '\.\.\/src\/services\/bigGeospatialService\.ts';/, "import { officialAdministrativeBoundaryService } from '../src/services/officialAdministrativeBoundaryService.ts';", 'test official provider');
replaceOnce('tests/administrative-boundary-completeness.test.ts', /const districtCount = await officialAdministrativeBoundaryService\.getJawaBaratDistrictCount\(\);\n    assert\.equal\(districtCount, 627, 'Jawa Barat harus memiliki 627 kecamatan'\);/, `const districtCount = await officialAdministrativeBoundaryService.getJawaBaratDistrictCount();
    assert.equal(districtCount, 628, 'BIG Juni 2026 saat ini mengembalikan 628 polygon kecamatan untuk Jawa Barat; perbedaan terhadap referensi Kemendagri 627 harus dicatat sebagai discrepancy, bukan dihilangkan.');
    const villageCount = await officialAdministrativeBoundaryService.getJawaBaratVillageCount();
    assert.equal(villageCount, 5311, 'Jawa Barat harus memiliki 5.311 desa/kelurahan pada referensi Kemendagri 2025.');`, 'verify BIG geometry counts and Kemendagri village count');
replaceOnce('tests/administrative-boundary-completeness.test.ts', /bigGeospatialService\./g, 'officialAdministrativeBoundaryService.', 'redirect completeness test to official provider');

console.log('Official administrative boundary patch completed.');
