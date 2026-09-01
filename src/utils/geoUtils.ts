/**
 * HIKMAT TANI - Geodesic & Spatial Utility Functions
 * 
 * Prinsip:
 * - Standar Luasan: Selalu mengembalikan dan memformat dalam satuan meter persegi (m²).
 * - Algoritma Spherical Geodesic: Menghitung luas permukaan bumi kurva elipsoid WGS-84 / Bola R=6.378.137m secara presisi.
 * - Konversi Aman: Mengonversi data warisan (areaHa) ke m² tanpa merusak data lama.
 */

export interface LatLngPoint {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_METERS = 6378137; // Jari-jari bumi rata-rata WGS-84 (meter)

/**
 * Derajat ke Radian
 */
function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Radian ke Derajat
 */
function toDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Menghitung jarak geodesic antara dua titik koordinat (dalam satuan Meter)
 * menggunakan rumus Haversine
 */
export function calculateHaversineDistanceM(p1: LatLngPoint, p2: LatLngPoint): number {
  const dLat = toRad(p2.lat - p1.lat);
  const dLng = toRad(p2.lng - p1.lng);
  const lat1 = toRad(p1.lat);
  const lat2 = toRad(p2.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Menghitung luas permukaan polygon di atas bola bumi (dalam satuan meter persegi / m²)
 * Menggunakan Spherical Excess / Girard-L'Huilier / Trapezoidal Spherical Projection
 */
export function calculateGeodesicPolygonAreaM2(points: LatLngPoint[]): number {
  if (!points || points.length < 3) {
    return 0;
  }

  let totalArea = 0;
  const numPoints = points.length;

  for (let i = 0; i < numPoints; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % numPoints];

    const lambda1 = toRad(p1.lng);
    const lambda2 = toRad(p2.lng);
    const phi1 = toRad(p1.lat);
    const phi2 = toRad(p2.lat);

    totalArea += (lambda2 - lambda1) * (2 + Math.sin(phi1) + Math.sin(phi2));
  }

  totalArea = (totalArea * EARTH_RADIUS_METERS * EARTH_RADIUS_METERS) / 2.0;
  const absArea = Math.abs(totalArea);

  return Math.round(absArea * 100) / 100;
}

/**
 * Menghitung total keliling batas polygon (dalam satuan meter)
 */
export function calculateGeodesicPerimeterM(points: LatLngPoint[]): number {
  if (!points || points.length < 2) return 0;

  let totalPerimeter = 0;
  for (let i = 0; i < points.length; i++) {
    const nextIdx = (i + 1) % points.length;
    // Jangan hubungkan titik terakhir ke awal jika belum tertutup
    if (points.length === 2 && nextIdx === 0) continue;
    totalPerimeter += calculateHaversineDistanceM(points[i], points[nextIdx]);
  }

  return Math.round(totalPerimeter * 10) / 10;
}

/**
 * Menghitung titik tengah (centroid) polygon
 */
export function calculatePolygonCentroid(points: LatLngPoint[]): LatLngPoint {
  if (!points || points.length === 0) {
    return { lat: -6.3039, lng: 107.3009 }; // Default Karawang
  }
  if (points.length === 1) {
    return { lat: points[0].lat, lng: points[0].lng };
  }

  let totalLat = 0;
  let totalLng = 0;

  for (const pt of points) {
    totalLat += pt.lat;
    totalLng += pt.lng;
  }

  return {
    lat: totalLat / points.length,
    lng: totalLng / points.length,
  };
}

/**
 * Menghitung bounding box polygon
 */
export function getPolygonBoundingBox(points: LatLngPoint[]): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
} {
  if (!points || points.length === 0) {
    return { minLat: -6.35, maxLat: -6.25, minLng: 107.25, maxLng: 107.35 };
  }

  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLng = points[0].lng;
  let maxLng = points[0].lng;

  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }

  return { minLat, maxLat, minLng, maxLng };
}

/**
 * Format luasan secara konsisten dalam format Bahasa Indonesia dengan satuan m²
 * Contoh: 2500 -> "2.500 m²"
 * Contoh: 125.75 -> "125,75 m²"
 */
export function formatAreaM2(
  areaM2?: number | null,
  fallbackAreaHa?: number | null
): string {
  let finalM2: number = 0;

  if (typeof areaM2 === 'number' && !isNaN(areaM2) && areaM2 > 0) {
    finalM2 = areaM2;
  } else if (typeof fallbackAreaHa === 'number' && !isNaN(fallbackAreaHa) && fallbackAreaHa > 0) {
    finalM2 = fallbackAreaHa * 10000; // Konversi aman dari ha warisan ke m²
  }

  if (finalM2 <= 0) {
    return '0 m²';
  }

  // Format angka ke format Indonesia
  const parts = finalM2.toFixed(2).split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimalPart = parts[1];

  if (decimalPart === '00') {
    return `${integerPart} m²`;
  }
  // Hapus trailing 0
  const cleanDecimal = decimalPart.endsWith('0') ? decimalPart.slice(0, 1) : decimalPart;
  return `${integerPart},${cleanDecimal} m²`;
}

/**
 * Ambil nilai numerik m² dari Land (mendukung konversi aman dari data lama)
 */
export function getLandAreaM2(land: { areaM2?: number; areaHa?: number }): number {
  if (typeof land.areaM2 === 'number' && !isNaN(land.areaM2) && land.areaM2 > 0) {
    return land.areaM2;
  }
  if (typeof land.areaHa === 'number' && !isNaN(land.areaHa) && land.areaHa > 0) {
    return land.areaHa * 10000;
  }
  return 0;
}

/**
 * Uji apakah sebuah titik koordinat berada di dalam poligon (Ray-Casting Algorithm)
 */
export function isPointInPolygon(point: LatLngPoint, polygon: LatLngPoint[]): boolean {
  if (!polygon || polygon.length < 3) return false;

  let inside = false;
  const x = point.lng;
  const y = point.lat;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Jarak terpendek dari titik ke segmen garis (dalam meter)
 */
function distancePointToSegmentM(p: LatLngPoint, v: LatLngPoint, w: LatLngPoint): number {
  const l2 = (w.lng - v.lng) * (w.lng - v.lng) + (w.lat - v.lat) * (w.lat - v.lat);
  if (l2 === 0) return calculateHaversineDistanceM(p, v);

  let t = ((p.lng - v.lng) * (w.lng - v.lng) + (p.lat - v.lat) * (w.lat - v.lat)) / l2;
  t = Math.max(0, Math.min(1, t));

  const projection: LatLngPoint = {
    lat: v.lat + t * (w.lat - v.lat),
    lng: v.lng + t * (w.lng - v.lng),
  };

  return calculateHaversineDistanceM(p, projection);
}

/**
 * Hitung jarak minimum dari suatu titik ke batas terluar poligon (dalam meter)
 */
export function minDistanceToPolygonBorderM(point: LatLngPoint, polygon: LatLngPoint[]): number {
  if (!polygon || polygon.length < 2) return Infinity;

  let minDistance = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const nextIdx = (i + 1) % polygon.length;
    const dist = distancePointToSegmentM(point, polygon[i], polygon[nextIdx]);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }

  return minDistance;
}

/**
 * Uji perpotongan dua Bounding Box
 */
export function isBBoxIntersecting(
  b1: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  b2: { minLat: number; maxLat: number; minLng: number; maxLng: number }
): boolean {
  return !(
    b1.maxLat < b2.minLat ||
    b1.minLat > b2.maxLat ||
    b1.maxLng < b2.minLng ||
    b1.minLng > b2.maxLng
  );
}

