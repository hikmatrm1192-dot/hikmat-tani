/**
 * HIKMAT TANI - Expense (Biaya Usaha Tani) Form Modal
 * 
 * Prinsip:
 * - Pencatatan transaksi riil biaya budidaya
 * - Format mata uang Rupiah Indonesia (Rp)
 * - Target sentuh minimal 48px
 * - Kategori standar budidaya padi
 */

import { FormEvent, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  DollarSign,
  FileText,
  Tag,
  X,
} from 'lucide-react';
import { expenseRepository } from '../../db/repositories/expenseRepository.ts';
import {
  CropSeason,
  CultivationExpense,
  ExpenseCategory,
  Land,
} from '../../types/index.ts';

interface ExpenseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  land: Land;
  activeSeason: CropSeason;
  onSuccess: () => Promise<void>;
  editExpense?: CultivationExpense | null;
}

const EXPENSE_CATEGORIES: { id: ExpenseCategory; label: string; desc: string }[] = [
  {
    id: 'SEED_SEEDBED',
    label: 'Benih & Persemaian',
    desc: 'Pembelian benih bersertifikat, kantong, plastik semai, upah sebar benih',
  },
  {
    id: 'LAND_PREPARATION',
    label: 'Pengolahan Lahan',
    desc: 'Sewa traktor bajak, rotary, perataan lumpur, perbaikan pematang',
  },
  {
    id: 'PLANTING',
    label: 'Tanam',
    desc: 'Upah tenaga kerja tanam / sewa mesin transplanter',
  },
  {
    id: 'FERTILIZER',
    label: 'Pupuk & Nutrisi',
    desc: 'Pembelian pupuk anorganik (Urea, NPK, SP36, KCl) & pupuk kandang/organik',
  },
  {
    id: 'PEST_CONTROL',
    label: 'OPT & Perlindungan Tanaman',
    desc: 'Bahan agens hayati, perangkap tikus, pestisida terdaftar, alat semprot',
  },
  {
    id: 'IRRIGATION',
    label: 'Pengairan & Pompa',
    desc: 'Bahan bakar minyak (BBM) pompa, sewa mesin pompa air, iuran P3A/saluran',
  },
  {
    id: 'LABOR',
    label: 'Tenaga Kerja Pemeliharaan',
    desc: 'Upah matun, penyiangan gulma/gasrok, aplikasi pupuk susulan',
  },
  {
    id: 'HARVEST',
    label: 'Panen & Pasca Panen',
    desc: 'Upah sabit panen, sewa perontok power thresher / Combine Harvester, karung',
  },
  {
    id: 'OTHER',
    label: 'Biaya Lainnya',
    desc: 'Transportasi angkut gabah, konsumsi kerja lapang, atau biaya tak terduga',
  },
];

export function ExpenseFormModal({
  isOpen,
  onClose,
  land,
  activeSeason,
  onSuccess,
  editExpense,
}: ExpenseFormModalProps) {
  const todayStr = new Date().toISOString().split('T')[0];

  const [expenseDate, setExpenseDate] = useState<string>(
    editExpense?.expenseDate
      ? editExpense.expenseDate.split('T')[0]
      : todayStr
  );
  const [category, setCategory] = useState<ExpenseCategory>(
    editExpense?.category || 'FERTILIZER'
  );
  const [amountRp, setAmountRp] = useState<string>(
    editExpense?.amountRp ? String(editExpense.amountRp) : ''
  );
  const [description, setDescription] = useState<string>(
    editExpense?.description || ''
  );
  const [notes, setNotes] = useState<string>(editExpense?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const nominal = parseFloat(amountRp);
    if (isNaN(nominal) || nominal <= 0) {
      setErrorMessage('Masukkan nominal biaya riil (Rp) yang lebih dari 0.');
      return;
    }

    if (!description.trim()) {
      setErrorMessage('Keterangan / rincian biaya tidak boleh kosong.');
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();
      const expenseData: CultivationExpense = {
        id: editExpense?.id || crypto.randomUUID(),
        cropSeasonId: activeSeason.id,
        expenseDate: new Date(expenseDate).toISOString(),
        category,
        amountRp: nominal,
        description: description.trim(),
        notes: notes.trim() || undefined,
        createdAt: editExpense?.createdAt || now,
        updatedAt: now,
      };

      if (editExpense) {
        await expenseRepository.update(editExpense.id, expenseData);
      } else {
        await expenseRepository.create(expenseData);
      }

      await onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving expense:', err);
      setErrorMessage('Gagal menyimpan catatan biaya. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedPreview = amountRp && !isNaN(parseFloat(amountRp))
    ? new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
      }).format(parseFloat(amountRp))
    : null;

  return (
    <div
      id="expense-form-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header Modal */}
        <div className="px-6 py-5 bg-emerald-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-900/60 border border-emerald-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                {editExpense ? 'Edit Catatan Biaya' : 'Catat Biaya Usaha Tani'}
              </h3>
              <p className="text-xs text-emerald-200 font-medium">
                {land.name} • {activeSeason.varietyName || 'Padi Sawah'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-emerald-900/40 hover:bg-emerald-900/80 text-emerald-200 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Tanggal Pengeluaran */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-700" />
              <span>Tanggal Pengeluaran Biaya *</span>
            </label>
            <input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 min-h-[48px] bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          {/* Kategori Pengeluaran */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-emerald-700" />
              <span>Kategori Biaya *</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="w-full px-3.5 py-2.5 min-h-[48px] bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              {EXPENSE_CATEGORIES.find((c) => c.id === category)?.desc}
            </p>
          </div>

          {/* Nominal Biaya */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-700" />
              <span>Nominal Biaya Nyata (Rp) *</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">
                Rp
              </span>
              <input
                type="number"
                step="1000"
                min="500"
                value={amountRp}
                onChange={(e) => setAmountRp(e.target.value)}
                placeholder="Contoh: 350000"
                required
                className="w-full pl-12 pr-3.5 py-2.5 min-h-[48px] bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>
            {formattedPreview && (
              <p className="text-xs font-extrabold text-emerald-700 mt-1 pl-1">
                Terbaca: {formattedPreview}
              </p>
            )}
          </div>

          {/* Keterangan / Uraian Biaya */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-emerald-700" />
              <span>Keterangan Transaksi / Rincian *</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: Beli Pupuk Urea 2 sak @ Rp 120.000 + NPK 1 sak"
              required
              className="w-full px-3.5 py-2.5 min-h-[48px] bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          {/* Catatan Tambahan */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Catatan Tambahan (Opsional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Misal: Nota disimpan di lemari, dibayar tunai via toko tani..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          {/* Tombol Aksi */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 min-h-[48px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs sm:text-sm transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 min-h-[48px] bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 disabled:opacity-50 text-white font-bold rounded-xl text-xs sm:text-sm transition-colors shadow-xs"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Biaya Usaha Tani'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
