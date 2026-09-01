/**
 * HIKMAT TANI - Expense (Biaya Usaha Tani) Form Modal
 * 
 * Prinsip:
 * - PENGGUNA MEMEGANG KENDALI PENUH: Semua nilai biaya dan harga ditentukan sepenuhnya oleh pengguna.
 * - REKOMENDASI BUKAN PAKSAAN: Sistem menyediakan nilai default/acuan rekomendasi pasar/Kementan,
 *   namun pengguna bebas menerima, mengubah lebih tinggi, mengubah lebih rendah, atau mengisi Rp 0 (bantuan).
 * - Tidak ada batasan hardcoded harga semena-mena.
 * - Format mata uang Rupiah Indonesia (Rp).
 * - Target sentuh minimal 48px, ramah petani di lapangan.
 */

import { FormEvent, useState, useEffect } from 'react';
import {
  AlertCircle,
  Calculator,
  Calendar,
  Check,
  Coins,
  DollarSign,
  FileText,
  HelpCircle,
  Info,
  Sparkles,
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
import {
  DEFAULT_COST_BENCHMARKS,
  CostBenchmark,
  validateExpenseNominal,
} from '../../engine/costCalculator.ts';

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
    desc: 'Pembelian benih bersertifikat, plastik semai, bambu, upah sebar benih',
  },
  {
    id: 'LAND_PREPARATION',
    label: 'Pengolahan Lahan',
    desc: 'Sewa traktor bajak, singkal, rotary, perataan lumpur, perbaikan pematang',
  },
  {
    id: 'PLANTING',
    label: 'Tanam',
    desc: 'Upah tenaga kerja tanam (tandur/borongan) / sewa mesin transplanter',
  },
  {
    id: 'FERTILIZER',
    label: 'Pupuk & Nutrisi',
    desc: 'Pembelian pupuk anorganik (Urea, NPK, SP-36, KCl) & pupuk organik/kandang',
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
    desc: 'Transportasi angkut gabah, konsumsi kerja lapang, sewa lahan, atau biaya tak terduga',
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
    editExpense?.amountRp !== undefined ? String(editExpense.amountRp) : ''
  );
  const [description, setDescription] = useState<string>(
    editExpense?.description || ''
  );
  const [notes, setNotes] = useState<string>(editExpense?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Mode Kalkulator Satuan (Opsional untuk mempermudah perhitungan: Jumlah x Harga Satuan)
  const [showUnitCalc, setShowUnitCalc] = useState<boolean>(false);
  const [calcQuantity, setCalcQuantity] = useState<string>('50');
  const [calcUnitPrice, setCalcUnitPrice] = useState<string>('2500');
  const [selectedBenchmarkId, setSelectedBenchmarkId] = useState<string | null>(null);

  // Rekomendasi acuan yang relevan dengan kategori aktif
  const relevantBenchmarks = DEFAULT_COST_BENCHMARKS.filter((b) => b.category === category);

  useEffect(() => {
    if (isOpen) {
      if (editExpense) {
        setExpenseDate(editExpense.expenseDate.split('T')[0]);
        setCategory(editExpense.category);
        setAmountRp(String(editExpense.amountRp));
        setDescription(editExpense.description);
        setNotes(editExpense.notes || '');
      } else {
        setExpenseDate(new Date().toISOString().split('T')[0]);
        setCategory('FERTILIZER');
        setAmountRp('');
        setDescription('');
        setNotes('');
        setShowUnitCalc(false);
        setSelectedBenchmarkId(null);
      }
      setErrorMessage(null);
    }
  }, [isOpen, editExpense]);

  if (!isOpen) return null;

  // Handle ketika pengguna memilih rekomendasi acuan
  const handleSelectBenchmark = (bench: CostBenchmark) => {
    setSelectedBenchmarkId(bench.id);
    setCalcUnitPrice(String(bench.recommendedUnitPriceRp));
    setShowUnitCalc(true);

    // Hitung perkiraan awal jika quantity sudah ada
    const q = parseFloat(calcQuantity) || 1;
    const total = q * bench.recommendedUnitPriceRp;
    setAmountRp(String(total));

    if (!description || description.startsWith('Pembelian') || description.startsWith('Biaya') || description.startsWith('Sewa') || description.startsWith('Upah')) {
      setDescription(`${bench.itemLabel} (${q} ${bench.unit} @ Rp ${bench.recommendedUnitPriceRp.toLocaleString('id-ID')})`);
    }
  };

  // Recalculate jika quantity atau unit price diubah pengguna secara bebas
  const handleRecalculateFromUnits = (newQStr: string, newPStr: string) => {
    setCalcQuantity(newQStr);
    setCalcUnitPrice(newPStr);
    const q = parseFloat(newQStr);
    const p = parseFloat(newPStr);
    if (!isNaN(q) && !isNaN(p) && q >= 0 && p >= 0) {
      const calculatedTotal = Number((q * p).toFixed(0));
      setAmountRp(String(calculatedTotal));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validation = validateExpenseNominal(amountRp, true);
    if (!validation.isValid) {
      setErrorMessage(validation.error || 'Masukkan nominal biaya yang valid.');
      return;
    }

    if (!description.trim()) {
      setErrorMessage('Keterangan / rincian transaksi biaya tidak boleh kosong.');
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();
      const expenseData: CultivationExpense = {
        id: editExpense?.id || `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        cropSeasonId: activeSeason.id,
        expenseDate: new Date(expenseDate).toISOString(),
        category,
        amountRp: validation.parsedValue,
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

  const currentAmountNum = parseFloat(amountRp);
  const formattedPreview = !isNaN(currentAmountNum) && currentAmountNum >= 0
    ? new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
      }).format(currentAmountNum)
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
              <Coins className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                {editExpense ? 'Edit Catatan Biaya Usaha Tani' : 'Catat Biaya Usaha Tani'}
              </h3>
              <p className="text-xs text-emerald-200 font-medium">
                {land.name} • {activeSeason.varietyName || 'Padi Sawah'} ({Math.round(land.areaHa * 10000).toLocaleString('id-ID')} m²)
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
              <span>Tanggal Transaksi Biaya *</span>
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
              onChange={(e) => {
                const newCat = e.target.value as ExpenseCategory;
                setCategory(newCat);
                setSelectedBenchmarkId(null);
              }}
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

          {/* Rekomendasi Acuan Nilai (Benchmark Helper) */}
          {relevantBenchmarks.length > 0 && (
            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Nilai Rekomendasi Acuan Standar</span>
                </span>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                  Rekomendasi (Dapat Diubah)
                </span>
              </div>
              <p className="text-[11px] text-emerald-900 leading-relaxed">
                Pilih acuan di bawah untuk mengisi otomatis, atau tentukan harga sendiri secara bebas:
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {relevantBenchmarks.map((bench) => {
                  const isSelected = selectedBenchmarkId === bench.id;
                  return (
                    <button
                      key={bench.id}
                      type="button"
                      onClick={() => handleSelectBenchmark(bench)}
                      className={`text-left px-3 py-1.5 rounded-xl text-xs transition-all border ${
                        isSelected
                          ? 'bg-emerald-700 text-white font-bold border-emerald-800 shadow-xs'
                          : 'bg-white text-emerald-950 font-medium hover:bg-emerald-100/50 border-emerald-200'
                      }`}
                    >
                      <span>{bench.itemLabel}</span>
                      <span className="ml-1.5 font-mono font-bold text-[11px] opacity-90">
                        [Rp {bench.recommendedUnitPriceRp.toLocaleString('id-ID')}/{bench.unit}]
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Toggle Kalkulator Satuan (Jumlah x Harga Satuan) */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowUnitCalc(!showUnitCalc)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 transition-colors"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>{showUnitCalc ? 'Tutup Kalkulator Satuan' : '+ Hitung via Jumlah Satuan x Harga'}</span>
            </button>
          </div>

          {/* Kalkulator Satuan Terbuka */}
          {showUnitCalc && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Jumlah Satuan (kg / sak / HOK / unit)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={calcQuantity}
                    onChange={(e) => handleRecalculateFromUnits(e.target.value, calcUnitPrice)}
                    placeholder="Contoh: 50"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Harga Satuan (Rp / unit)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={calcUnitPrice}
                    onChange={(e) => handleRecalculateFromUnits(calcQuantity, e.target.value)}
                    placeholder="Contoh: 2500"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
              </div>
              <div className="text-[11px] text-slate-500 bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-between">
                <span>Hasil perkalian otomatis:</span>
                <span className="font-bold text-emerald-800">
                  {calcQuantity || '0'} × Rp {Number(calcUnitPrice || 0).toLocaleString('id-ID')} = Rp {(Number(calcQuantity || 0) * Number(calcUnitPrice || 0)).toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          )}

          {/* Nominal Biaya Akhir (Bebas diisi / diubah oleh pengguna) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-700" />
                <span>Nominal Biaya Nyata (Rp) *</span>
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                (Isi 0 jika bantuan/gratis)
              </span>
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">
                Rp
              </span>
              <input
                type="number"
                step="any"
                min="0"
                value={amountRp}
                onChange={(e) => setAmountRp(e.target.value)}
                placeholder="0 atau nominal biaya riil"
                required
                className="w-full pl-12 pr-3.5 py-2.5 min-h-[48px] bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            {formattedPreview && (
              <p className="text-xs font-extrabold text-emerald-700 mt-1 pl-1">
                Terbaca: {formattedPreview} {currentAmountNum === 0 ? '(Bebas Biaya / Bantuan)' : ''}
              </p>
            )}
            <p className="text-[11px] text-slate-500 mt-1 pl-1">
              Keterangan: Pengguna memegang kendali penuh. Anda bebas menentukan harga lebih rendah, lebih tinggi, atau Rp 0.
            </p>
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
              placeholder="Misal: Nota disimpan di lemari, dibayar tunai via kios tani desa..."
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
