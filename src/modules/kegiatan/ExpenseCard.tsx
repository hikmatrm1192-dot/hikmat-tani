/**
 * HIKMAT TANI - Expense (Biaya Usaha Tani) Card
 * 
 * Menampilkan item transaksi biaya riil dengan format rupiah dan label kategori.
 */

import { Calendar, DollarSign, Edit, Tag, Trash2 } from 'lucide-react';
import { CultivationExpense, ExpenseCategory } from '../../types/index.ts';

interface ExpenseCardProps {
  key?: string | number;
  expense: CultivationExpense;
  onEdit?: (expense: CultivationExpense) => void;
  onDelete?: (expense: CultivationExpense) => void;
}

const CATEGORY_STYLES: Record<
  ExpenseCategory,
  { label: string; bg: string; text: string; border: string }
> = {
  SEED_SEEDBED: {
    label: 'Benih & Semai',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
  },
  LAND_PREPARATION: {
    label: 'Olah Lahan',
    bg: 'bg-amber-50',
    text: 'text-amber-900',
    border: 'border-amber-200',
  },
  PLANTING: {
    label: 'Tanam',
    bg: 'bg-teal-50',
    text: 'text-teal-800',
    border: 'border-teal-200',
  },
  FERTILIZER: {
    label: 'Pupuk & Nutrisi',
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
  },
  PEST_CONTROL: {
    label: 'OPT & Obat',
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200',
  },
  IRRIGATION: {
    label: 'Pengairan & Pompa',
    bg: 'bg-sky-50',
    text: 'text-sky-800',
    border: 'border-sky-200',
  },
  LABOR: {
    label: 'Tenaga Kerja',
    bg: 'bg-orange-50',
    text: 'text-orange-800',
    border: 'border-orange-200',
  },
  HARVEST: {
    label: 'Panen',
    bg: 'bg-yellow-50',
    text: 'text-yellow-900',
    border: 'border-yellow-200',
  },
  OTHER: {
    label: 'Lainnya',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
  },
};

export function ExpenseCard({ expense, onEdit, onDelete }: ExpenseCardProps) {
  const catStyle = CATEGORY_STYLES[expense.category] || CATEGORY_STYLES.OTHER;

  const formattedAmount = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(expense.amountRp);

  const formattedDate = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(expense.expenseDate));

  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs hover:border-emerald-200 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-100 mt-0.5">
          <DollarSign className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
            >
              <Tag className="w-2.5 h-2.5" />
              <span>{catStyle.label}</span>
            </span>
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{formattedDate}</span>
            </span>
          </div>

          <h4 className="text-sm font-bold text-slate-900 leading-snug">
            {expense.description}
          </h4>

          {expense.notes && (
            <p className="text-xs text-slate-500 italic">"{expense.notes}"</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
        <div className="text-left sm:text-right">
          <span className="text-[11px] text-slate-400 font-medium block">Nominal:</span>
          <span className="text-base font-black text-slate-900 text-emerald-900">
            {formattedAmount}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(expense)}
              aria-label="Edit Biaya"
              className="p-2 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <Edit className="w-4 h-4" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(expense)}
              aria-label="Hapus Biaya"
              className="p-2 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
