/**
 * HIKMAT TANI - Test Suite: Sistem Penentuan Biaya Fleksibel & Kalkulasi Usaha Tani
 * 
 * Pengujian komprehensif untuk memvalidasi:
 * 1. Pengguna menerima nilai default/rekomendasi.
 * 2. Pengguna mengubah harga secara bebas.
 * 3. Pengguna memasukkan harga lebih rendah dari acuan.
 * 4. Pengguna memasukkan harga lebih tinggi dari acuan.
 * 5. Biaya opsional bernilai 0 diperbolehkan (misal bantuan pemerintah / swadaya).
 * 6. Hasil perhitungan ekonomi (pendapatan, laba/rugi, BEP, R/C ratio) 100% mengikuti input pengguna.
 * 7. Tidak ada hardcoded cost atau batas semena-mena yang memaksakan nilai.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  DEFAULT_COST_BENCHMARKS,
  RECOMMENDED_GRAIN_PRICE_PER_KG,
  validateExpenseNominal,
  calculateItemCost,
  calculateFarmEconomics,
} from '../src/engine/costCalculator.ts';

describe('Sistem Penentuan Biaya Fleksibel HIKMAT TANI', () => {
  // 1. Pengguna menerima nilai default/rekomendasi
  it('1. Pengguna menerima nilai rekomendasi acuan default', () => {
    const ureaBenchmark = DEFAULT_COST_BENCHMARKS.find((b) => b.id === 'bench-urea');
    assert.ok(ureaBenchmark, 'Benchmark Urea harus tersedia sebagai rekomendasi');
    assert.strictEqual(ureaBenchmark.recommendedUnitPriceRp, 2500);

    // Pengguna menerima rekomendasi default Rp 2.500/kg untuk 100 kg Urea
    const quantity = 100;
    const totalCost = calculateItemCost(quantity, ureaBenchmark.recommendedUnitPriceRp);
    assert.strictEqual(totalCost, 250000);
  });

  // 2. Pengguna mengubah harga secara bebas
  it('2. Pengguna mengubah harga secara bebas (contoh: Urea diubah menjadi Rp 3.200/kg)', () => {
    const customPrice = 3200;
    const quantity = 100;

    const validation = validateExpenseNominal(customPrice, true);
    assert.strictEqual(validation.isValid, true, 'Harga custom harus valid');
    assert.strictEqual(validation.parsedValue, 3200);

    const totalCost = calculateItemCost(quantity, customPrice);
    assert.strictEqual(totalCost, 320000, 'Perhitungan harus menggunakan Rp 3.200/kg');
  });

  // 3. Pengguna memasukkan harga lebih rendah dari acuan
  it('3. Pengguna memasukkan harga lebih rendah dari acuan (contoh: Urea subsidi khusus Rp 1.800/kg)', () => {
    const lowerPrice = 1800;
    const quantity = 100;

    const validation = validateExpenseNominal(lowerPrice, true);
    assert.strictEqual(validation.isValid, true);
    assert.strictEqual(validation.parsedValue, 1800);

    const totalCost = calculateItemCost(quantity, lowerPrice);
    assert.strictEqual(totalCost, 180000, 'Perhitungan harus menggunakan harga lebih rendah Rp 1.800/kg');
  });

  // 4. Pengguna memasukkan harga lebih tinggi dari acuan
  it('4. Pengguna memasukkan harga lebih tinggi dari acuan (contoh: NPK non-subsidi impor Rp 12.000/kg)', () => {
    const higherPrice = 12000;
    const quantity = 50;

    const validation = validateExpenseNominal(higherPrice, true);
    assert.strictEqual(validation.isValid, true);
    assert.strictEqual(validation.parsedValue, 12000);

    const totalCost = calculateItemCost(quantity, higherPrice);
    assert.strictEqual(totalCost, 600000, 'Perhitungan harus menggunakan harga lebih tinggi Rp 12.000/kg');
  });

  // 5. Biaya opsional = 0 diperbolehkan (bantuan/swadaya)
  it('5. Biaya opsional bernilai 0 harus diperbolehkan dan valid (bantuan bibit / pupuk kompos sendiri / traktor milik sendiri)', () => {
    const zeroCost = 0;

    const validation = validateExpenseNominal(zeroCost, true);
    assert.strictEqual(validation.isValid, true, 'Biaya opsional 0 harus diterima tanpa error');
    assert.strictEqual(validation.parsedValue, 0);

    const calculated = calculateItemCost(25, zeroCost);
    assert.strictEqual(calculated, 0, 'Total biaya untuk input gratis/0 harus 0');
  });

  // 6. Hasil perhitungan berubah dinamis sesuai input pengguna
  it('6. Analisis Usaha Tani (pendapatan, laba/rugi, BEP, R/C) berubah dinamis sesuai input pengguna', () => {
    // Skenario A: Menggunakan Rekomendasi Default
    const defaultEconomics = calculateFarmEconomics({
      totalExpensesRp: 8000000,
      yieldKg: 3000,
      grainPricePerKgRp: RECOMMENDED_GRAIN_PRICE_PER_KG, // Rp 6.500
      areaHa: 0.5,
    });

    assert.strictEqual(defaultEconomics.grossRevenueRp, 19500000);
    assert.strictEqual(defaultEconomics.netProfitRp, 11500000);
    assert.strictEqual(defaultEconomics.isProfitable, true);
    assert.strictEqual(defaultEconomics.revenueCostRatio, 2.44);
    assert.strictEqual(defaultEconomics.costPerKgYieldRp, 2667);

    // Skenario B: Pengguna mengubah harga jual gabah menjadi Rp 7.500/kg
    const customHigherPriceEconomics = calculateFarmEconomics({
      totalExpensesRp: 8000000,
      yieldKg: 3000,
      grainPricePerKgRp: 7500,
      areaHa: 0.5,
    });

    assert.strictEqual(customHigherPriceEconomics.grossRevenueRp, 22500000);
    assert.strictEqual(customHigherPriceEconomics.netProfitRp, 14500000);
    assert.strictEqual(customHigherPriceEconomics.revenueCostRatio, 2.81);

    // Skenario C: Kondisi rugi jika harga anjlok ke Rp 2.000/kg
    const lossEconomics = calculateFarmEconomics({
      totalExpensesRp: 8000000,
      yieldKg: 3000,
      grainPricePerKgRp: 2000,
      areaHa: 0.5,
    });

    assert.strictEqual(lossEconomics.grossRevenueRp, 6000000);
    assert.strictEqual(lossEconomics.netProfitRp, -2000000);
    assert.strictEqual(lossEconomics.isProfitable, false);
  });

  // 7. Tidak ada hardcoded cost yang kembali memaksakan nilai
  it('7. Tidak ada hardcoded cost yang membatasi nilai minimum semena-mena', () => {
    // Masukkan angka sangat kecil seperti Rp 100
    const tinyVal = validateExpenseNominal(100, true);
    assert.strictEqual(tinyVal.isValid, true);
    assert.strictEqual(tinyVal.parsedValue, 100);

    // Masukkan angka sangat besar seperti Rp 50.000.000 (sewa lahan multi-tahun)
    const largeVal = validateExpenseNominal(50000000, true);
    assert.strictEqual(largeVal.isValid, true);
    assert.strictEqual(largeVal.parsedValue, 50000000);

    // Pastikan angka negatif tetap ditolak secara matematis logis
    const negVal = validateExpenseNominal(-500, true);
    assert.strictEqual(negVal.isValid, false);
  });
});
