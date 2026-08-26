/**
 * HIKMAT TANI - HST (Hari Setelah Tanam) Calculator Engine
 * 
 * Prinsip:
 * - HST dihitung berdasarkan selisih hari kalender murni.
 * - Hari tanam (plantingDate) = 0 HST.
 * - Jam dan timezone dinormalisasi ke format UTC date (YYYY-MM-DD) agar tidak bergeser.
 * - Pure logic tanpa ketergantungan UI/DOM/React.
 */

export interface HSTCalculationResult {
  isValid: boolean;
  hst: number | null;
  plantingDate: string;
  targetDate: string;
  error?: string;
}

/**
 * Normalisasi string tanggal ISO / format YYYY-MM-DD ke timestamp awal hari (00:00:00.000 UTC).
 */
export function normalizeDateToUTC(dateInput: string | Date): Date | null {
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return null;

    // Ekstrak tahun, bulan, hari dalam representasi kalender UTC murni
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const date = d.getUTCDate();

    return new Date(Date.UTC(year, month, date, 0, 0, 0, 0));
  } catch {
    return null;
  }
}

/**
 * Menghitung HST (Hari Setelah Tanam) antara tanggal tanam dan tanggal target.
 * 
 * @param plantingDateInput Tanggal saat bibit ditanam ke sawah
 * @param targetDateInput Tanggal acuan / pengamatan (default: hari ini)
 */
export function calculateHST(
  plantingDateInput: string | Date,
  targetDateInput: string | Date = new Date()
): HSTCalculationResult {
  const plantingUTC = normalizeDateToUTC(plantingDateInput);
  const targetUTC = normalizeDateToUTC(targetDateInput);

  const plantingStr = typeof plantingDateInput === 'string' ? plantingDateInput : plantingDateInput.toISOString();
  const targetStr = typeof targetDateInput === 'string' ? targetDateInput : targetDateInput.toISOString();

  if (!plantingUTC) {
    return {
      isValid: false,
      hst: null,
      plantingDate: plantingStr,
      targetDate: targetStr,
      error: 'Tanggal tanam tidak valid atau belum dicatat.',
    };
  }

  if (!targetUTC) {
    return {
      isValid: false,
      hst: null,
      plantingDate: plantingStr,
      targetDate: targetStr,
      error: 'Tanggal target tidak valid.',
    };
  }

  const diffMs = targetUTC.getTime() - plantingUTC.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  return {
    isValid: true,
    hst: diffDays,
    plantingDate: plantingUTC.toISOString().split('T')[0],
    targetDate: targetUTC.toISOString().split('T')[0],
  };
}

/**
 * Mendapatkan HST per hari ini secara instan.
 */
export function getTodayHST(plantingDateInput: string | Date): HSTCalculationResult {
  return calculateHST(plantingDateInput, new Date());
}
