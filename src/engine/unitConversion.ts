/**
 * HIKMAT TANI - Unit Conversion Utilities
 * 
 * Utilitas konversi satuan pertanian:
 * - Massa: kg, gram
 * - Luas: hektar (ha), meter persegi (m²) -> 1 ha = 10.000 m²
 * - Dosis / Laju: kg/ha, gram/ha
 * 
 * Prinsip:
 * - Tidak pernah memutasi atau mengganti nilai asli yang diinput petani.
 * - Nilai asli dan nilai konversi dihitung secara terpisah dan murni.
 * - Pure logic tanpa ketergantungan UI.
 */

export const SQUARE_METERS_PER_HECTARE = 10000;
export const GRAMS_PER_KILOGRAM = 1000;

/**
 * Mengubah meter persegi (m²) menjadi hektar (ha).
 */
export function squareMetersToHectares(squareMeters: number): number {
  if (isNaN(squareMeters) || squareMeters <= 0) return 0;
  return Number((squareMeters / SQUARE_METERS_PER_HECTARE).toFixed(4));
}

/**
 * Mengubah hektar (ha) menjadi meter persegi (m²).
 */
export function hectaresToSquareMeters(hectares: number): number {
  if (isNaN(hectares) || hectares <= 0) return 0;
  return Math.round(hectares * SQUARE_METERS_PER_HECTARE);
}

/**
 * Mengubah kilogram (kg) menjadi gram.
 */
export function kgToGrams(kg: number): number {
  if (isNaN(kg) || kg <= 0) return 0;
  return Math.round(kg * GRAMS_PER_KILOGRAM);
}

/**
 * Mengubah gram menjadi kilogram (kg).
 */
export function gramsToKg(grams: number): number {
  if (isNaN(grams) || grams <= 0) return 0;
  return Number((grams / GRAMS_PER_KILOGRAM).toFixed(3));
}

/**
 * Menghitung dosis per hektar (kg/ha) dari jumlah aktual kg dan luas petak sawah (ha).
 */
export function calculateDosePerHa(amountKg: number, areaHa: number): number {
  if (isNaN(amountKg) || isNaN(areaHa) || areaHa <= 0 || amountKg < 0) return 0;
  return Number((amountKg / areaHa).toFixed(2));
}

/**
 * Menghitung estimasi kebutuhan jumlah pupuk (kg) berdasarkan rekomendasi kg/ha dan luas petak (ha).
 */
export function calculateRequiredKgForArea(dosePerHa: number, areaHa: number): number {
  if (isNaN(dosePerHa) || isNaN(areaHa) || areaHa <= 0 || dosePerHa <= 0) return 0;
  return Number((dosePerHa * areaHa).toFixed(2));
}
