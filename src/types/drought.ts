/**
 * HIKMAT TANI - Drought Domain Models & Indonesian Agricultural Standards
 * 
 * Standar Resmi Kategori Kekeringan:
 * 1. TERANCAM (🟡) - kondisi mulai menunjukkan potensi kekeringan dan lahan/tanaman mulai berisiko terdampak.
 * 2. RINGAN (🟠) - indikasi kekeringan sudah terjadi dan mulai memberikan dampak ringan.
 * 3. SEDANG (🔴) - dampak kekeringan mulai nyata dan berpotensi mengganggu pertumbuhan tanaman.
 * 4. BERAT (🟣) - kekeringan memberikan dampak serius terhadap tanaman dan membutuhkan perhatian segera.
 * 5. PUSO (⚫) - kondisi sangat parah hingga menyebabkan gagal tumbuh/produksi atau kehilangan hasil yang sangat berat sesuai kriteria resmi.
 * 
 * DILARANG MENGGUNAKAN KATEGORI: Normal, Waspada, Siaga, Kritis, Sangat Kritis.
 */

export type DroughtCategory =
  | 'TERANCAM'
  | 'RINGAN'
  | 'SEDANG'
  | 'BERAT'
  | 'PUSO';

export type DroughtTrend =
  | 'WORSENING' // ↗ Memburuk
  | 'IMPROVING' // ↘ Membaik
  | 'STABLE';   // ➡️ Stabil

export interface DroughtCategoryInfo {
  category: DroughtCategory;
  label: string;
  badgeClass: string;
  bgHex: string;
  borderHex: string;
  icon: string;
  definition: string;
  officialSource: string;
}

export const DROUGHT_STANDARDS: Record<DroughtCategory, DroughtCategoryInfo> = {
  TERANCAM: {
    category: 'TERANCAM',
    label: 'TERANCAM',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
    bgHex: '#EAB308',
    borderHex: '#CA8A04',
    icon: '🟡',
    definition: 'Kondisi mulai menunjukkan potensi kekeringan dan lahan/tanaman mulai berisiko terdampak.',
    officialSource: 'Kriteria Indikasi Kekeringan Pertanian BMKG & Kementan RI',
  },
  RINGAN: {
    category: 'RINGAN',
    label: 'RINGAN',
    badgeClass: 'bg-orange-100 text-orange-900 border-orange-300 font-bold',
    bgHex: '#F97316',
    borderHex: '#EA580C',
    icon: '🟠',
    definition: 'Indikasi kekeringan sudah terjadi dan mulai memberikan dampak ringan.',
    officialSource: 'Pedoman Penanganan DPI & Kekeringan Ditlin TP Kementan RI',
  },
  SEDANG: {
    category: 'SEDANG',
    label: 'SEDANG',
    badgeClass: 'bg-rose-100 text-rose-900 border-rose-300 font-bold',
    bgHex: '#EF4444',
    borderHex: '#DC2626',
    icon: '🔴',
    definition: 'Dampak kekeringan mulai nyata dan berpotensi mengganggu pertumbuhan tanaman.',
    officialSource: 'Pedoman Penanganan DPI & Kekeringan Ditlin TP Kementan RI',
  },
  BERAT: {
    category: 'BERAT',
    label: 'BERAT',
    badgeClass: 'bg-purple-100 text-purple-900 border-purple-300 font-bold',
    bgHex: '#A855F7',
    borderHex: '#9333EA',
    icon: '🟣',
    definition: 'Kekeringan memberikan dampak serius terhadap tanaman dan membutuhkan perhatian segera.',
    officialSource: 'Pedoman Penanganan DPI & Kekeringan Ditlin TP Kementan RI',
  },
  PUSO: {
    category: 'PUSO',
    label: 'PUSO',
    badgeClass: 'bg-slate-900 text-white border-slate-700 font-bold',
    bgHex: '#1E293B',
    borderHex: '#0F172A',
    icon: '⚫',
    definition: 'Kondisi sangat parah hingga menyebabkan gagal tumbuh/produksi atau kehilangan hasil yang sangat berat sesuai kriteria resmi.',
    officialSource: 'Kriteria Resmi Kerusakan Puso Padi Ditlin Tanaman Pangan',
  },
};

/**
 * 3 Jenis Analisis Kekeringan
 */
export interface DroughtAnalysisBreakdown {
  meteorological: {
    title: 'Kekeringan Meteorologis';
    status: DroughtCategory | 'AMAN';
    label: string;
    description: string;
    consecutiveDryDays: number; // Hari Tanpa Hujan (HTH)
    spiEstimated?: number;      // Standardized Precipitation Index
    rainfall30DaysMm: number;
    source: string;
  };
  vegetation: {
    title: 'Kekeringan Vegetasi';
    status: DroughtCategory | 'AMAN';
    label: string;
    description: string;
    vciValue?: number; // Vegetation Condition Index (0 - 100)
    ndviStatus: string;
    source: string;
  };
  agricultural: {
    title: 'Risiko Kekeringan Pertanian';
    status: DroughtCategory;
    label: string;
    description: string;
    waterDeficitLevel: string;
    soilMoistureStatus: string;
    vulnerableStageNotice?: string;
    source: string;
  };
  overallCategory: DroughtCategory;
  trend: DroughtTrend;
  trendReason: string;
  lastAssessmentDate: string;
  isModelEstimate: boolean;
}

export interface DroughtZoneFeature {
  id: string;
  name: string;
  region: string;
  category: DroughtCategory;
  trend: DroughtTrend;
  coordinates: Array<{ lat: number; lng: number }>;
  center: { lat: number; lng: number };
  rainfallMm: number;
  dryDays: number;
  period: string;
  source: string;
}
