import { readFileSync } from 'node:fs';

const mapSource = readFileSync('src/modules/peta/AgriculturalMap.tsx', 'utf8');
const helperSource = readFileSync('src/modules/peta/drawingMapInteraction.ts', 'utf8');

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`[FAIL] ${message}`);
  console.log(`[PASS] ${message}`);
}

assert(mapSource.includes('attachDrawingMapClickCapture('), 'AgriculturalMap memakai native capture untuk polygon tap');
assert(helperSource.includes("addEventListener('click', handleNativeMapClick, true)"), 'Tap ditangkap pada capture phase');
assert(helperSource.includes('stopImmediatePropagation()'), 'Satu tap tidak digandakan oleh child layer Leaflet');
assert(helperSource.includes('containerPointToLatLng'), 'Koordinat tap dikonversi ke LatLng');
console.log('Polygon tap capture regression: PASS');
