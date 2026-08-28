/**
 * HIKMAT TANI - Farm Economics & Cost Calculation Engine
 * 
 * Prinsip:
 * 1. PENGGUNA MEMEGANG KENDALI PENUH:
 *    Semua nilai biaya dan harga dapat ditentukan secara bebas oleh pengguna.
 * 2. REKOMENDASI BUKAN PEMAKSAAN:
 *    Sistem menyediakan nilai acuan/default sebagai rekomendasi ilmiah/pasar,
 *    namun pengguna bebas menerima, menaikkan, menurunkan, atau mengisi 0.
 * 3. TRANSPARAN & BEBAS HARDCODE:
 *    Perhitungan selalu menggunakan nilai aktual yang dimasukkan pengguna.
 *    Tidak ada batasan minimum/maksimum harga tanpa dasar teknis.
 * 4. PENGELOMPOKAN BIAYA LENGKAP:
 *    Mendukung benih, pupuk, pestisida/obat, tenaga kerja, pengolahan lahan,
 *    sewa lahan, irigasi, transportasi, panen, pascapanen, dan biaya lainnya.
 */

import { ExpenseCategory } from '../types/expense.ts';

export interface CostBenchmark {
  id: string;
  category: ExpenseCategory;
  itemLabel: string;
  recommendedUnitPriceRp: number;
  unit: string; // misal: 'kg', 'ha', 'HOK', 'liter', 'musim', 'transaksi'
  description: string;
  isOptional?: boolean;
}

/**
 * Daftar Nilai Rekomendasi Acuan Standar Budidaya Padi Sawah di Indonesia.
 * Keterangan: Nilai rekomendasi acuan, dapat diubah sepenuhnya oleh pengguna.
 */
export const DEFAULT_COST_BENCHMARKS: CostBenchmark[] = [
  // --- 1. Pupuk & Nutrisi ---
  {
    id: 'bench-urea',
    category: 'FERTILIZER',
    itemLabel: 'Pupuk Urea (Nitrogen)',
    recommendedUnitPriceRp: 2500,
    unit: 'kg',
    description: 'Nilai rekomendasi (HET subsidi ~Rp 2.250 - 2.500/kg). Dapat diubah pengguna.',
  },
  {
    id: 'bench-npk',
    category: 'FERTILIZER',
    itemLabel: 'Pupuk NPK Phonska (Majemuk 15-15-15)',
    recommendedUnitPriceRp: 2300,
    unit: 'kg',
    description: 'Nilai rekomendasi (HET subsidi ~Rp 2.300/kg). Dapat diubah pengguna.',
  },
  {
    id: 'bench-sp36',
    category: 'FERTILIZER',
    itemLabel: 'Pupuk SP-36 (Fosfat)',
    recommendedUnitPriceRp: 2400,
    unit: 'kg',
    description: 'Nilai rekomendasi (Acuan HET ~Rp 2.400/kg). Dapat diubah pengguna.',
  },
  {
    id: 'bench-kcl',
    category: 'FERTILIZER',
    itemLabel: 'Pupuk KCl / MOP (Kalium)',
    recommendedUnitPriceRp: 6000,
    unit: 'kg',
    description: 'Nilai rekomendasi (Acuan pasar non-subsidi ~Rp 6.000/kg). Dapat diubah pengguna.',
  },
  {
    id: 'bench-organic',
    category: 'FERTILIZER',
    itemLabel: 'Pupuk Organik / Kompos / Kandang',
    recommendedUnitPriceRp: 1000,
    unit: 'kg',
    description: 'Nilai rekomendasi (Acuan ~Rp 800 - 1.200/kg). Dapat diubah pengguna.',
  },

  // --- 2. Benih & Persemaian ---
  {
    id: 'bench-seed',
    category: 'SEED_SEEDBED',
    itemLabel: 'Benih Padi Bersertifikat (Label Biru)',
    recommendedUnitPriceRp: 15000,
    unit: 'kg',
    description: 'Nilai rekomendasi benih bersertifikat (~Rp 14.000 - 16.000/kg). Dapat diubah pengguna.',
  },

  // --- 3. Pengolahan Lahan ---
  {
    id: 'bench-tillage',
    category: 'LAND_PREPARATION',
    itemLabel: 'Sewa Traktor Bajak / Singkal & Rotary',
    recommendedUnitPriceRp: 1200000,
    unit: 'ha',
    description: 'Nilai rekomendasi sewa traktor & operator (~Rp 1.000.000 - 1.500.000/ha). Dapat diubah pengguna.',
  },

  // --- 4. Tanam ---
  {
    id: 'bench-planting',
    category: 'PLANTING',
    itemLabel: 'Upah Tenaga Kerja Tanam (Tandur / Borongan)',
    recommendedUnitPriceRp: 1500000,
    unit: 'ha',
    description: 'Nilai rekomendasi upah tanam (~Rp 1.200.000 - 1.800.000/ha). Dapat diubah pengguna.',
  },

  // --- 5. OPT & Perlindungan Tanaman ---
  {
    id: 'bench-pest-control',
    category: 'PEST_CONTROL',
    itemLabel: 'Agens Hayati / Pestisida / Perlindungan Tanaman',
    recommendedUnitPriceRp: 350000,
    unit: 'aplikasi/ha',
    description: 'Nilai rekomendasi bahan pengendali OPT ramah lingkungan. Dapat diubah pengguna.',
    isOptional: true,
  },

  // --- 6. Tenaga Kerja Pemeliharaan ---
  {
    id: 'bench-labor',
    category: 'LABOR',
    itemLabel: 'Upah Harian Penyiangan / Matun / Pemeliharaan',
    recommendedUnitPriceRp: 90000,
    unit: 'HOK',
    description: 'Nilai rekomendasi upah Hari Orang Kerja (~Rp 80.000 - 120.000/HOK). Dapat diubah pengguna.',
    isOptional: true,
  },

  // --- 7. Pengairan & Pompa ---
  {
    id: 'bench-irrigation',
    category: 'IRRIGATION',
    itemLabel: 'BBM Pompa Air / Iuran P3A Saluran',
    recommendedUnitPriceRp: 150000,
    unit: 'pengairan',
    description: 'Nilai rekomendasi biaya operasional air irigasi. Dapat diubah pengguna.',
    isOptional: true,
  },

  // --- 8. Panen & Pasca Panen ---
  {
    id: 'bench-harvest',
    category: 'HARVEST',
    itemLabel: 'Upah Panen / Sewa Combine Harvester / Power Thresher',
    recommendedUnitPriceRp: 1800000,
    unit: 'ha',
    description: 'Nilai rekomendasi panen (~Rp 1.500.000 - 2.000.000/ha atau sistem bagi hasil). Dapat diubah pengguna.',
  },

  // --- 9. Biaya Lainnya ---
  {
    id: 'bench-other',
    category: 'OTHER',
    itemLabel: 'Transportasi Angkut Gabah / Konsumsi / Biaya Lainnya',
    recommendedUnitPriceRp: 250000,
    unit: 'musim',
    description: 'Nilai rekomendasi biaya operasional pendukung. Dapat diubah pengguna.',
    isOptional: true,
  },
];

/**
 * Nilai Rekomendasi Acuan Harga Jual Gabah Kering Panen (GKP)
 */
export const RECOMMENDED_GRAIN_PRICE_PER_KG = 6500; // Rp 6.500/kg GKP (Dapat disesuaikan pengguna)

/**
 * Validasi input nominal biaya oleh pengguna.
 * Nilai 0 diperbolehkan jika biaya bersifat opsional atau bebas biaya/bantuan.
 */
export function validateExpenseNominal(
  amountRp: number | string,
  isOptional = true
): { isValid: boolean; parsedValue: number; error?: string } {
  const parsed = typeof amountRp === 'number' ? amountRp : parseFloat(String(amountRp));

  if (isNaN(parsed)) {
    return {
      isValid: false,
      parsedValue: 0,
      error: 'Nominal biaya harus berupa angka yang valid.',
    };
  }

  if (parsed < 0) {
    return {
      isValid: false,
      parsedValue: parsed,
      error: 'Nominal biaya tidak boleh bernilai negatif.',
    };
  }

  if (!isOptional && parsed === 0) {
    return {
      isValid: false,
      parsedValue: 0,
      error: 'Nominal biaya untuk komponen ini wajib diisi lebih dari 0.',
    };
  }

  return {
    isValid: true,
    parsedValue: parsed,
  };
}

/**
 * Menghitung biaya per item berdasarkan jumlah dan harga satuan yang ditentukan pengguna.
 */
export function calculateItemCost(quantity: number, unitPriceRp: number): number {
  if (isNaN(quantity) || isNaN(unitPriceRp) || quantity < 0 || unitPriceRp < 0) {
    return 0;
  }
  return Number((quantity * unitPriceRp).toFixed(0));
}

export interface FarmEconomicsInput {
  totalExpensesRp: number;
  yieldKg?: number | null;
  grainPricePerKgRp?: number | null;
  areaHa?: number | null;
}

export interface FarmEconomicsResult {
  totalProductionCostRp: number;
  yieldKg: number;
  grainPricePerKgRp: number;
  grossRevenueRp: number;
  netProfitRp: number;
  isProfitable: boolean;
  costPerKgYieldRp: number;
  revenueCostRatio: number; // R/C Ratio
  breakEvenPricePerKgRp: number; // BEP Harga
  breakEvenYieldKg: number; // BEP Produksi
  costPerHaRp?: number;
  revenuePerHaRp?: number;
  profitPerHaRp?: number;
}

/**
 * Menghitung Analisis Ekonomi Usaha Tani (Biaya Produksi, Pendapatan, dan Keuntungan/Rugi).
 * Menggunakan 100% data riil dan harga aktual yang dimasukkan pengguna.
 */
export function calculateFarmEconomics(input: FarmEconomicsInput): FarmEconomicsResult {
  const totalCost = Math.max(0, Number(input.totalExpensesRp) || 0);
  const harvestYield = Math.max(0, Number(input.yieldKg) || 0);
  
  // Jika harga jual gabah tidak disediakan, gunakan nilai rekomendasi acuan
  const grainPrice =
    input.grainPricePerKgRp !== undefined && input.grainPricePerKgRp !== null
      ? Math.max(0, Number(input.grainPricePerKgRp))
      : RECOMMENDED_GRAIN_PRICE_PER_KG;

  const grossRevenue = harvestYield * grainPrice;
  const netProfit = grossRevenue - totalCost;
  const isProfitable = netProfit >= 0;

  const costPerKg = harvestYield > 0 ? Number((totalCost / harvestYield).toFixed(0)) : 0;
  const rcRatio = totalCost > 0 ? Number((grossRevenue / totalCost).toFixed(2)) : grossRevenue > 0 ? 99 : 0;
  const bepPrice = harvestYield > 0 ? Number((totalCost / harvestYield).toFixed(0)) : 0;
  const bepYield = grainPrice > 0 ? Number((totalCost / grainPrice).toFixed(1)) : 0;

  const area = input.areaHa && input.areaHa > 0 ? input.areaHa : undefined;
  const costPerHa = area ? Number((totalCost / area).toFixed(0)) : undefined;
  const revenuePerHa = area ? Number((grossRevenue / area).toFixed(0)) : undefined;
  const profitPerHa = area ? Number((netProfit / area).toFixed(0)) : undefined;

  return {
    totalProductionCostRp: totalCost,
    yieldKg: harvestYield,
    grainPricePerKgRp: grainPrice,
    grossRevenueRp: grossRevenue,
    netProfitRp: netProfit,
    isProfitable,
    costPerKgYieldRp: costPerKg,
    revenueCostRatio: rcRatio,
    breakEvenPricePerKgRp: bepPrice,
    breakEvenYieldKg: bepYield,
    costPerHaRp: costPerHa,
    revenuePerHaRp: revenuePerHa,
    profitPerHaRp: profitPerHa,
  };
}
