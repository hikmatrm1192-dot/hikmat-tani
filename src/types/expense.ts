/**
 * HIKMAT TANI - Cultivation Expense Domain Model
 * 
 * Prinsip:
 * - Total biaya dihitung dari transaksi biaya nyata yang dicatat petani.
 * - Tidak memasukkan estimasi biaya sebagai biaya aktual.
 * - Mengelompokkan transaksi ke 9 kategori biaya standar budidaya padi.
 */

import { EntityId, ISODateString } from './common.ts';

export type ExpenseCategory =
  | 'SEED_SEEDBED'        // Benih / Persemaian
  | 'LAND_PREPARATION'   // Pengolahan Lahan (Bajak, Singkal, Rotari, Garu)
  | 'PLANTING'           // Tanam (Tenaga Kerja Tanam / Sewa Transplanter)
  | 'FERTILIZER'         // Pupuk (Urea, NPK, Organik, KCL, SP36, dll)
  | 'PEST_CONTROL'       // OPT / Pengendalian Hama / Pestisida / PHT
  | 'IRRIGATION'         // Pengairan / Bahan Bakar Pompa / Iuran P3A
  | 'LABOR'              // Tenaga Kerja Pemeliharaan / Matun / Penyiangan
  | 'HARVEST'            // Panen (Tenaga Sabit / Sewa Combine Harvester)
  | 'OTHER';             // Lainnya

export interface CultivationExpense {
  id: EntityId;
  cropSeasonId: EntityId;
  activityId?: EntityId; // Relasi opsional ke kegiatan tertentu
  expenseDate: ISODateString; // Tanggal transaksi biaya
  category: ExpenseCategory;
  amountRp: number; // Nominal biaya riil (Rupiah)
  description: string; // Keterangan transaksi (misal: "Beli Urea 2 sak", "Sewa traktor bajak")
  notes?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface ExpenseCategorySummary {
  category: ExpenseCategory;
  categoryLabel: string;
  totalAmountRp: number;
  transactionCount: number;
  percentage: number;
}

export interface SeasonExpenseReport {
  cropSeasonId: EntityId;
  totalExpenseRp: number;
  totalTransactions: number;
  categories: ExpenseCategorySummary[];
}
