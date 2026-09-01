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
replaceOnce('src/modules/peta/PetaPertanianView.tsx', /import \{ bigGeospatialService \} from '\.\.\/\.\.\/services\/bigGeospatialService\.ts';/, "import { officialAdministrativeBoundaryService } from '../../services/officialAdministrativeBoundaryService.ts';", 'switch map source to official BIG provider');
replaceOnce('src/modules/peta/PetaPertanianView.tsx', /interface PetaPertanianViewProps \{([\s\S]*?)\n\}/, (match) => match.includes('onAdminViewportChange') ? match : match.replace("  onNavigateToTab?: (tab: 'beranda' | 'lahan' | 'kegiatan' | 'informasi' | 'saya' | 'cuaca') => void;", "  onNavigateToTab?: (tab: 'beranda' | 'lahan' | 'kegiatan' | 'informasi' | 'saya' | 'cuaca') => void;\n  onAdminViewportChange?: (bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number }, zoom: number) => void;"), 'add optional admin viewport hook');
replaceOnce('src/modules/peta/PetaPertanianView.tsx', /export function PetaPertanianView\(\{([\s\S]*?)\n\}: PetaPertanianViewProps\) \{/, (match) => match.includes('onAdminViewportChange,') ? match : match.replace('  onNavigateToTab,', '  onNavigateToTab,\n  onAdminViewportChange,'), 'accept admin viewport hook');
replaceOnce('src/modules/peta/PetaPertanianView.tsx', /  \/\/ Inisialisasi batas wilayah 4-level resmi BIG[\s\S]*?\n  \/\/ GPS State/, `  // Inisialisasi batas wilayah resmi BIG: seluruh Jawa Barat.
  // Kabupaten/kota + kecamatan dimuat penuh; desa/kelurahan dimuat berbasis viewport.
  useEffect(() => {
    let cancelled = false;
    const loadAdministrativeData = async () => {
      try {
        const [provinces, regencies, districts] = await Promise.all([
          officialAdministrativeBoundaryService.getJawaBaratProvinces(),
          officialAdministrativeBoundaryService.getJawaBaratRegencies(),
          officialAdministrativeBoundaryService.getJawaBaratDistricts(),
        ]);
        if (cancelled) return;
        setProvinceBoundaries(provinces);
        setRegencyBoundaries(regencies);
        setDistrictBoundaries(districts);
      } catch (error) {
        console.error('Gagal memuat batas administrasi BIG Jawa Barat:', error);
      }
    };
    void loadAdministrativeData();
    return () => { cancelled = true; };
  }, []);

  const handleAdminViewportChange = useCallback(
    async (bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number }, zoom: number) => {
      if (zoom < 12 || !layerVisibility.showVillageBoundaries) {
        setVillageBoundaries([]);
        return;
      }
      try {
        const villages = await officialAdministrativeBoundaryService.getVillageBoundariesInBbox(bbox);
        setVillageBoundaries(villages);
      } catch (error) {
        console.error('Gagal memuat batas desa/kelurahan BIG pada viewport:', error);
      }
    },
    [layerVisibility.showVillageBoundaries]
  );

  // GPS State`, 'load complete Jabar hierarchy and viewport villages');
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
replaceOnce('tests/administrative-boundary-completeness.test.ts', /bigGeospatialService\./g, 'officialAdministrativeBoundaryService.', 'redirect completeness test to official provider');

console.log('Official administrative boundary patch completed.');
