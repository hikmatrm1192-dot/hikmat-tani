/**
 * HIKMAT TANI - Cultivation Expense Repository
 * 
 * Prinsip:
 * - Menyimpan pencatatan biaya budidaya nyata.
 * - Menghitung total dan agregasi kategori secara matematis dari data riil.
 * - Mencatat ke syncOutbox.
 */

import { db } from '../database.ts';
import {
  CultivationExpense,
  ExpenseCategory,
  ExpenseCategorySummary,
  SeasonExpenseReport,
} from '../../types/index.ts';
import { outboxRepository } from './outboxRepository.ts';

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  SEED_SEEDBED: 'Benih & Persemaian',
  LAND_PREPARATION: 'Pengolahan Lahan',
  PLANTING: 'Tanam',
  FERTILIZER: 'Pupuk & Nutrisi',
  PEST_CONTROL: 'OPT & Perlindungan Tanaman',
  IRRIGATION: 'Pengairan & Pompa',
  LABOR: 'Tenaga Kerja Pemeliharaan',
  HARVEST: 'Panen & Pasca Panen',
  OTHER: 'Biaya Lainnya',
};

export const expenseRepository = {
  async getById(id: string): Promise<CultivationExpense | undefined> {
    return db.expenses.get(id);
  },

  async getByCropSeasonId(cropSeasonId: string): Promise<CultivationExpense[]> {
    const list = await db.expenses.where('cropSeasonId').equals(cropSeasonId).toArray();
    return list.sort(
      (a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime()
    );
  },

  async getByActivityId(activityId: string): Promise<CultivationExpense[]> {
    return db.expenses.where('activityId').equals(activityId).toArray();
  },

  async create(expense: CultivationExpense): Promise<string> {
    const now = new Date().toISOString();
    const item: CultivationExpense = {
      ...expense,
      createdAt: expense.createdAt || now,
      updatedAt: expense.updatedAt || now,
    };

    await db.expenses.add(item);
    await outboxRepository.recordMutation('EXPENSE', item.id, 'CREATE', item);
    return item.id;
  },

  async update(id: string, updates: Partial<CultivationExpense>): Promise<void> {
    const now = new Date().toISOString();
    const cleanUpdates = {
      ...updates,
      updatedAt: now,
    };
    await db.expenses.update(id, cleanUpdates);
    const updated = await db.expenses.get(id);
    if (updated) {
      await outboxRepository.recordMutation('EXPENSE', id, 'UPDATE', updated);
    }
  },

  async delete(id: string): Promise<void> {
    await db.expenses.delete(id);
    await outboxRepository.recordMutation('EXPENSE', id, 'DELETE', { id });
  },

  /**
   * Menghitung Laporan Biaya Musim Tanam (Riil)
   */
  async getSeasonReport(cropSeasonId: string): Promise<SeasonExpenseReport> {
    const expenses = await this.getByCropSeasonId(cropSeasonId);
    const totalExpenseRp = expenses.reduce((sum, item) => sum + (Number(item.amountRp) || 0), 0);
    const totalTransactions = expenses.length;

    // Grouping by category
    const catMap = new Map<ExpenseCategory, { total: number; count: number }>();
    for (const exp of expenses) {
      const prev = catMap.get(exp.category) || { total: 0, count: 0 };
      catMap.set(exp.category, {
        total: prev.total + (Number(exp.amountRp) || 0),
        count: prev.count + 1,
      });
    }

    const categories: ExpenseCategorySummary[] = Object.keys(CATEGORY_LABELS).map((key) => {
      const cat = key as ExpenseCategory;
      const data = catMap.get(cat) || { total: 0, count: 0 };
      return {
        category: cat,
        categoryLabel: CATEGORY_LABELS[cat],
        totalAmountRp: data.total,
        transactionCount: data.count,
        percentage: totalExpenseRp > 0 ? (data.total / totalExpenseRp) * 100 : 0,
      };
    });

    return {
      cropSeasonId,
      totalExpenseRp,
      totalTransactions,
      categories: categories.sort((a, b) => b.totalAmountRp - a.totalAmountRp),
    };
  },

  getCategoryLabel(category: ExpenseCategory): string {
    return CATEGORY_LABELS[category] || category;
  },
};
