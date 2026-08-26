/**
 * HIKMAT TANI - Nutrient Engine
 * 
 * Mengubah takaran pupuk (kg) menjadi kandungan unsur hara murni (kg hara).
 * Mendukung N, P2O5, K2O, S, Ca, Mg, Zn, dan unsur hara lain yang terdaftar pada master data.
 * 
 * Prinsip:
 * - Tidak hard-code kandungan pupuk di engine.
 * - Membaca komposisi dari objek NutrientComposition pada master fertilizer.
 * - Menolak nilai jumlah pupuk negatif.
 * - Pure logic tanpa ketergantungan UI.
 */

import { NutrientComposition } from '../types/index.ts';

export interface CalculatedNutrientResult {
  isValid: boolean;
  fertilizerAmountKg: number;
  nutrientsKg: Record<string, number>;
  primarySummary: {
    N_kg: number;
    P2O5_kg: number;
    K2O_kg: number;
    S_kg: number;
  };
  error?: string;
}

/**
 * Menghitung kandungan unsur hara dari suatu aplikasi pupuk.
 * 
 * @param amountKg Jumlah pupuk yang diaplikasikan dalam satuan kilogram (harus >= 0)
 * @param composition Objek persentase hara dari master pupuk (misal: { N: 46 })
 */
export function calculateNutrients(
  amountKg: number,
  composition?: NutrientComposition | null
): CalculatedNutrientResult {
  if (isNaN(amountKg) || amountKg < 0) {
    return {
      isValid: false,
      fertilizerAmountKg: amountKg,
      nutrientsKg: {},
      primarySummary: { N_kg: 0, P2O5_kg: 0, K2O_kg: 0, S_kg: 0 },
      error: 'Jumlah pupuk tidak boleh bernilai negatif atau bukan angka.',
    };
  }

  if (amountKg === 0 || !composition) {
    return {
      isValid: true,
      fertilizerAmountKg: amountKg,
      nutrientsKg: {},
      primarySummary: { N_kg: 0, P2O5_kg: 0, K2O_kg: 0, S_kg: 0 },
    };
  }

  const nutrientsKg: Record<string, number> = {};

  for (const [nutrientKey, percentage] of Object.entries(composition)) {
    if (typeof percentage === 'number' && percentage > 0) {
      // Rumus: nutrient_kg = (amount_kg * percentage) / 100
      const calculatedKg = Number(((amountKg * percentage) / 100).toFixed(3));
      nutrientsKg[nutrientKey] = calculatedKg;
    }
  }

  return {
    isValid: true,
    fertilizerAmountKg: amountKg,
    nutrientsKg,
    primarySummary: {
      N_kg: nutrientsKg['N'] || 0,
      P2O5_kg: nutrientsKg['P2O5'] || 0,
      K2O_kg: nutrientsKg['K2O'] || 0,
      S_kg: nutrientsKg['S'] || 0,
    },
  };
}

/**
 * Mengakumulasi total unsur hara dari beberapa aplikasi pupuk dalam satu musim tanam.
 */
export function accumulateNutrients(
  applications: Array<{ amountKg: number; composition?: NutrientComposition | null }>
): Record<string, number> {
  const totals: Record<string, number> = {};

  for (const app of applications) {
    if (app.amountKg > 0 && app.composition) {
      const res = calculateNutrients(app.amountKg, app.composition);
      if (res.isValid) {
        for (const [key, val] of Object.entries(res.nutrientsKg)) {
          totals[key] = Number(((totals[key] || 0) + val).toFixed(3));
        }
      }
    }
  }

  return totals;
}
