import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function patch(file, pattern, replacement, description) {
  const full = path.join(root, file);
  const source = fs.readFileSync(full, 'utf8');
  if (typeof replacement === 'string' && source.includes(replacement)) {
    console.log(`already applied: ${description}`);
    return;
  }
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`Patch target not found: ${file} :: ${description}`);
  fs.writeFileSync(full, next);
  console.log(`applied: ${description}`);
}

// Service: use official BIG with complete pagination and count/viewport helpers.
patch(
  'src/services/officialAdministrativeBoundaryService.ts',
  /const MAX_RECORD_COUNT = 500;/,
  'const MAX_RECORD_COUNT = 1000;',
  'BIG pagination page size'
);
patch(
  'src/services/officialAdministrativeBoundaryService.ts',
  /\nfunction buildWhere\(/,
  `
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

function buildWhere(`,
  'official BIG count helper'
);
patch(
  'src/services/officialAdministrativeBoundaryService.ts',
  /  async getJawaBaratDistricts\(\): Promise<AdministrativeFeature\[\]> \{\n    return this\.loadLevel\('DISTRICT'\);\n  \}/,
  `  async getJawaBaratDistricts(): Promise<AdministrativeFeature[]> {
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
  }`,
  'district/village count and viewport helpers'
);

// Map page: official BIG source and viewport-aware district/village loading.
patch(
  'src/modules/peta/PetaPertanianView.tsx',
  /import \{ bigGeospatialService \} from '\.\.\/\.\.\/services\/bigGeospatialService\.ts';/,
  "import { officialAdministrativeBoundaryService } from '../../services/officialAdministrativeBoundaryService.ts';",
  'switch PetaPertanianView to official BIG provider'
);
patch(
  'src/modules/peta/PetaPertanianView.tsx',
  /interface PetaPertanianViewProps \{([\s\S]*?)\n\}/,
  (match) => match.includes('onAdminViewportChange')
    ? match
    : match.replace(
        "  onNavigateToTab?: (tab: 'beranda' | 'lahan' | 'kegiatan' | 'informasi' | 'saya' | 'cuaca') => void;",
        "  onNavigateToTab?: (tab: 'beranda' | 'lahan' | 'kegiatan' | 'informasi' | 'saya' | 'cuaca') => void;\n  onAdminViewportChange?: (bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number }, zoom: number) => void;"
      ),
  'add administrative viewport prop'
);
patch(
  'src/modules/peta/PetaPertanianView.tsx',
  /export function PetaPertanianView\(\{([\s\S]*?)\n\}: PetaPertanianViewProps\) \{/,
  (match) => match.includes('onAdminViewportChange,')
    ? match
    : match.replace('  onNavigateToTab,', '  onNavigateToTab,\n  onAdminViewportChange,'),
  'accept administrative viewport callback'
);
patch(
  'src/modules/peta/PetaPertanianView.tsx',
  /  \/\/ Inisialisasi batas wilayah 4-level resmi BIG[\s\S]*?\n  \/\/ GPS State/,
  `  // Inisialisasi batas wilayah resmi BIG: provinsi + kabupaten/kota penuh,
  // kecamatan + desa/kelurahan berbasis viewport agar tetap ringan di HP.
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

  // GPS State`,
  'viewport-aware official boundary loading'
);
patch(
  'src/modules/peta/PetaPertanianView.tsx',
  /        provinceBoundaries=\{provinceBoundaries\}/,
  "        provinceBoundaries={provinceBoundaries}\n        onAdminViewportChange={handleAdminViewportChange}",
  'connect viewport loader to map'
);

// Save-drawn parcel: resolve hierarchy from the same official provider.
patch(
  'src/modules/peta/SaveDrawnParcelModal.tsx',
  /import \{ bigGeospatialService \} from '\.\.\/\.\.\/services\/bigGeospatialService\.ts';/,
  "import { officialAdministrativeBoundaryService } from '../../services/officialAdministrativeBoundaryService.ts';",
  'switch parcel spatial lookup to official BIG provider'
);
patch(
  'src/modules/peta/SaveDrawnParcelModal.tsx',
  /bigGeospatialService\s*\.\s*lookupAdministrativeByPoint\(centroid\)/,
  'officialAdministrativeBoundaryService.lookupAdministrativeByPoint(centroid)',
  'use official BIG hierarchy lookup when saving parcel'
);

// Map component: emit current viewport without breaking tap-to-draw priority.
patch(
  'src/modules/peta/AgriculturalMap.tsx',
  /import \{ AdministrativeFeature \} from '\.\.\/\.\.\/types\/administrativeBoundary\.ts';/,
  "import { AdministrativeFeature, BoundingBox } from '../../types/administrativeBoundary.ts';",
  'import BoundingBox for viewport callback'
);
patch(
  'src/modules/peta/AgriculturalMap.tsx',
  /  onGpsRequested\?: \(\) => void;\n\}/,
  "  onGpsRequested?: () => void;\n  onAdminViewportChange?: (bbox: BoundingBox, zoom: number) => void;\n}",
  'add map viewport callback prop'
);
patch(
  'src/modules/peta/AgriculturalMap.tsx',
  /  onGpsRequested,\n\}: AgriculturalMapProps\) \{/,
  "  onGpsRequested,\n  onAdminViewportChange,\n}: AgriculturalMapProps) {",
  'accept map viewport callback'
);
patch(
  'src/modules/peta/AgriculturalMap.tsx',
  /  const onSelectAdminFeatureRef = useRef\(onSelectAdminFeature\);\n  onSelectAdminFeatureRef\.current = onSelectAdminFeature;/,
  `  const onSelectAdminFeatureRef = useRef(onSelectAdminFeature);
  onSelectAdminFeatureRef.current = onSelectAdminFeature;
  const onAdminViewportChangeRef = useRef(onAdminViewportChange);
  onAdminViewportChangeRef.current = onAdminViewportChange;`,
  'keep viewport callback fresh'
);
patch(
  'src/modules/peta/AgriculturalMap.tsx',
  /      mapInstanceRef\.current = map;\n\n      \/\/ Pasang Capture Tap Prioritas Tinggi/,
  `      mapInstanceRef.current = map;

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

      // Pasang Capture Tap Prioritas Tinggi`,
  'emit viewport changes while preserving tap capture'
);

console.log('Official Jawa Barat administrative boundary integration applied.');
