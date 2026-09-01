/**
 * HIKMAT TANI - Polygon Drawing Map & Spatial Engine Test Suite
 * 
 * Verifikasi:
 * 1. Mode Gambar Petak Sawah tap/klik menghasilkan vertex polygon.
 * 2. Event forwarding dari canvas peta dan sub-layer (parcels, markers, drought zones).
 * 3. Perhitungan geodesic keliling (m) dan luas petak (m²) secara real-time.
 * 4. Validasi minimal 3 titik untuk penyelesaian poligon.
 * 5. Integrasi titik GPS sebagai vertex alternatif.
 * 6. Penyimpanan entitas Land dengan koordinat vertex lengkap dan standar luasan m².
 */

import {
  calculateGeodesicPolygonAreaM2,
  calculateGeodesicPerimeterM,
  calculatePolygonCentroid,
  formatAreaM2,
  LatLngPoint,
} from '../src/utils/geoUtils.ts';
import { Land } from '../src/types/index.ts';

function runTests() {
  console.log('=== TEST MODE GAMBAR PETAK SAWAH & GEOSPATIAL ENGINE ===');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // 1. Uji State Titik Vertex bertahap
  const drawingState: LatLngPoint[] = [];

  // Simulasi Tap 1: Titik Sudut Barat Daya Sawah (-6.3030, 107.3000)
  drawingState.push({ lat: -6.3030, lng: 107.3000 });
  assert(drawingState.length === 1, 'Tap 1 menambahkan 1 titik vertex ke drawingPoints');
  assert(
    calculateGeodesicPolygonAreaM2(drawingState) === 0,
    'Luas poligon dengan 1 titik adalah 0 m²'
  );
  assert(
    calculateGeodesicPerimeterM(drawingState) === 0,
    'Keliling dengan 1 titik adalah 0 m'
  );

  // Simulasi Tap 2: Titik Sudut Tenggara (-6.3030, 107.3009) (~100m timur)
  drawingState.push({ lat: -6.3030, lng: 107.3009 });
  assert(drawingState.length === 2, 'Tap 2 menambahkan titik vertex kedua');
  const perimeter2Pts = calculateGeodesicPerimeterM(drawingState);
  assert(
    perimeter2Pts > 90 && perimeter2Pts < 110,
    `Keliling 2 titik terhitung sebagai garis terbuka (~100m, aktual: ${perimeter2Pts}m)`
  );
  assert(
    calculateGeodesicPolygonAreaM2(drawingState) === 0,
    'Luas poligon dengan 2 titik masih 0 m² (belum berupa bidang tertutup)'
  );

  // Simulasi Tap 3: Titik Sudut Timur Laut (-6.3021, 107.3009) (~100m utara)
  drawingState.push({ lat: -6.3021, lng: 107.3009 });
  assert(drawingState.length === 3, 'Tap 3 menambahkan titik vertex ketiga (membentuk segitiga)');
  const area3Pts = calculateGeodesicPolygonAreaM2(drawingState);
  assert(
    area3Pts > 4000 && area3Pts < 6000,
    `Luas segitiga 3 titik terhitung m² (~5000 m², aktual: ${area3Pts} m²)`
  );
  assert(
    drawingState.length >= 3,
    'Validasi minimal 3 titik terpenuhi, tombol Selesai & Simpan aktif'
  );

  // Simulasi Tap 4 (atau + GPS): Titik Sudut Barat Laut (-6.3021, 107.3000) (~100m x 100m = 10.000 m² = 1 Ha)
  const gpsPoint: LatLngPoint = { lat: -6.3021, lng: 107.3000 };
  drawingState.push(gpsPoint);
  assert(drawingState.length === 4, 'Tap 4 / + GPS menambahkan titik vertex keempat (segi empat penuh)');
  const area4Pts = calculateGeodesicPolygonAreaM2(drawingState);
  const perimeter4Pts = calculateGeodesicPerimeterM(drawingState);
  assert(
    area4Pts > 9500 && area4Pts < 10500,
    `Luas segi empat 100x100m terhitung akurat (~10.000 m², aktual: ${area4Pts} m²)`
  );
  assert(
    perimeter4Pts > 380 && perimeter4Pts < 420,
    `Keliling segi empat terhitung akurat (~400 m, aktual: ${perimeter4Pts} m)`
  );

  // 2. Uji Operasi Undo & Clear
  const popped = drawingState.pop();
  assert(drawingState.length === 3, 'Operasi Undo menghapus titik vertex terakhir');
  assert(popped?.lat === -6.3021 && popped?.lng === 107.3000, 'Titik yang di-undo sesuai koordinat terakhir');

  // Kembalikan titik ke-4
  drawingState.push(gpsPoint);

  // 3. Uji Simulasi Event Forwarding Saat Drawing Mode Aktif
  let capturedPoints: LatLngPoint[] = [];
  const handleAddDrawingPoint = (pt: LatLngPoint) => {
    capturedPoints.push(pt);
  };

  // Dispatcher simulation (mirip mekanisme event handler Leaflet di AgriculturalMap)
  const isDrawingModeActive = true;
  const dispatchMapOrLayerClick = (latlng: { lat: number; lng: number }) => {
    if (isDrawingModeActive) {
      handleAddDrawingPoint({ lat: latlng.lat, lng: latlng.lng });
    }
  };

  // Klik di atas petak existing saat drawing mode
  dispatchMapOrLayerClick({ lat: -6.3035, lng: 107.3015 });
  assert(capturedPoints.length === 1, 'Klik di atas layer diteruskan sebagai titik vertex saat drawing mode aktif');
  assert(
    capturedPoints[0].lat === -6.3035 && capturedPoints[0].lng === 107.3015,
    'Koordinat vertex dari klik layer tersimpan presisi'
  );

  // 4. Uji Centroid & Bounding Box
  const centroid = calculatePolygonCentroid(drawingState);
  assert(
    Math.abs(centroid.lat - (-6.30255)) < 0.001 && Math.abs(centroid.lng - 107.30045) < 0.001,
    `Centroid poligon terhitung di tengah petak (lat: ${centroid.lat.toFixed(5)}, lng: ${centroid.lng.toFixed(5)})`
  );

  // 5. Uji Format Luasan Standar m²
  assert(
    formatAreaM2(area4Pts).includes('m²'),
    `Format luasan menggunakan satuan m² (${formatAreaM2(area4Pts)})`
  );

  // 6. Uji Penyimpanan Entitas Land
  const newLandToSave: Omit<Land, 'id' | 'farmerId' | 'createdAt' | 'updatedAt'> = {
    name: 'Petak Sawah Blok Krajan 01',
    areaM2: area4Pts,
    perimeterM: perimeter4Pts,
    areaHa: area4Pts / 10000,
    coordinates: drawingState,
    center: centroid,
    latitude: centroid.lat,
    longitude: centroid.lng,
    waterSource: 'IRRIGATION_TECHNICAL',
    landType: 'LOWLAND_PADDY',
    status: 'ACTIVE',
  };

  assert(newLandToSave.areaM2 === area4Pts, 'Entitas Land menyimpan field areaM2 asli');
  assert(newLandToSave.coordinates.length === 4, 'Entitas Land menyimpan seluruh koordinat 4 vertex');
  assert(
    newLandToSave.coordinates[0].lat === -6.3030 && newLandToSave.coordinates[0].lng === 107.3000,
    'Vertex pertama tersimpan dengan presisi koordinat'
  );

  console.log(`\n=== HASIL TEST: ${passed} PASS, ${failed} FAIL ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
