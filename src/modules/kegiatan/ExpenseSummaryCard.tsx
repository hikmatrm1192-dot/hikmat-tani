/**
 * HIKMAT TANI - Expense (Biaya Usaha Tani) Summary Card
 * 
 * Menampilkan ringkasan total pengeluaran semusim, rata-rata per hektar, diagram sebaran kategori,
 * serta Analisis Ekonomi Usaha Tani (Biaya Produksi, Pendapatan, Keuntungan/Rugi, R/C Ratio, dan BEP).
 * 
 * Prinsip:
 * - 100% Menggunakan nilai input pengguna.
 * - Rekomendasi harga gabah dan estimasi panen dapat diubah bebas oleh pengguna.
 */

import { useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  DollarSign,
  HelpCircle,
  PieChart,
  Scale,
  Sparkles,
  TrendingUp,
  Wheat,
} from 'lucide-react';
import { CropSeason, Land, SeasonExpenseReport } from '../../types/index.ts';
import {
  calculateFarmEconomics,
  RECOMMENDED_GRAIN_PRICE_PER_KG,
} from '../../engine/costCalculator.ts';

interface ExpenseSummaryCardProps {
  report: SeasonExpenseReport;
  land?: Land | null;
  season?: CropSeason | null;
}

export function ExpenseSummaryCard({ report, land, season }: ExpenseSummaryCardProps) {
  const [showEconomics, setShowEconomics] = useState<boolean>(true);

  // Estimasi panen: Ambil dari hasil panen aktual musim jika ada, atau estimasi 5.5 ton/ha (5500 kg/ha)
  const defaultEstimatedYield = season?.yieldKg
    ? season.yieldKg
    : land && land.areaHa > 0
    ? Math.round(land.areaHa * 5500)
    : 3500;

  const [customYieldKg, setCustomYieldKg] = useState<string>(String(defaultEstimatedYield));
  const [customGrainPrice, setCustomGrainPrice] = useState<string>(
    String(RECOMMENDED_GRAIN_PRICE_PER_KG)
  );

  const formattedTotal = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(report.totalExpenseRp);

  const areaM2 = land && land.areaHa > 0 ? Math.round(land.areaHa * 10000) : 0;
  const costPerM2 =
    areaM2 > 0
      ? new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          maximumFractionDigits: 0,
        }).format(report.totalExpenseRp / areaM2)
      : null;

  const activeCategories = report.categories.filter((c) => c.totalAmountRp > 0);

  // Hitung Analisis Finansial Usaha Tani secara Realtime
  const economics = calculateFarmEconomics({
    totalExpensesRp: report.totalExpenseRp,
    yieldKg: parseFloat(customYieldKg) || 0,
    grainPricePerKgRp: parseFloat(customGrainPrice) || 0,
    areaHa: land?.areaHa || null,
  });

  const formattedGrossRevenue = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(economics.grossRevenueRp);

  const formattedNetProfit = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Math.abs(economics.netProfitRp));

  const formattedCostPerKg = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(economics.costPerKgYieldRp);

  const formattedBepPrice = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(economics.breakEvenPricePerKgRp);

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-6">
      {/* Header Ringkasan Biaya */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-800 text-white flex items-center justify-center shadow-xs">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Biaya Usaha Tani (Modal Keluar)
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
              {formattedTotal}
            </h3>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 text-xs">
            <span className="text-slate-500 block text-[10px] font-bold">Transaksi:</span>
            <span className="font-extrabold text-slate-800">
              {report.totalTransactions} Catatan
            </span>
          </div>

          {costPerM2 && (
            <div className="bg-emerald-50 px-3.5 py-2 rounded-xl border border-emerald-200 text-xs">
              <span className="text-emerald-700 block text-[10px] font-bold">
                Estimasi Biaya / m²:
              </span>
              <span className="font-extrabold text-emerald-900">
                {costPerM2} / m²
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Rincian Proporsi Biaya per Kategori */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
          <span className="flex items-center gap-1.5">
            <PieChart className="w-4 h-4 text-emerald-700" />
            <span>Rincian Pengeluaran per Kategori</span>
          </span>
          <span className="text-slate-400 font-medium">
            {activeCategories.length} Kategori Aktif
          </span>
        </div>

        {activeCategories.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-3 italic bg-slate-50 rounded-xl">
            Belum ada data pengeluaran yang dicatat.
          </p>
        ) : (
          <div className="space-y-2.5">
            {activeCategories.map((cat) => {
              const formattedCatAmount = new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                maximumFractionDigits: 0,
              }).format(cat.totalAmountRp);

              return (
                <div key={cat.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{cat.categoryLabel}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900">
                        {formattedCatAmount}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400 w-12 text-right">
                        ({cat.percentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>

                  {/* Progress bar persentase */}
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(2, cat.percentage))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Analisis Ekonomi Usaha Tani & Proyeksi Laba/Rugi */}
      <div className="border-t border-slate-100 pt-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-800" />
            <h4 className="text-xs sm:text-sm font-bold text-slate-900">
              Analisis Finansial, Pendapatan & Laba Rugi
            </h4>
          </div>
          <button
            type="button"
            onClick={() => setShowEconomics(!showEconomics)}
            className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1"
          >
            <span>{showEconomics ? 'Sembunyikan' : 'Tampilkan Analisis'}</span>
            {showEconomics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {showEconomics && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
            {/* Input Parameter Interaktif Pengguna */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <Wheat className="w-3.5 h-3.5 text-amber-600" />
                    <span>Hasil Panen (kg Gabah)</span>
                  </label>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                    Dapat Diubah
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={customYieldKg}
                    onChange={(e) => setCustomYieldKg(e.target.value)}
                    placeholder="Contoh: 3500"
                    className="w-full px-3 py-2 text-xs font-bold text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">
                    kg
                  </span>
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Harga Jual Gabah (Rp/kg)</span>
                  </label>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                    Rekomendasi Acuan
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">
                    Rp
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={customGrainPrice}
                    onChange={(e) => setCustomGrainPrice(e.target.value)}
                    placeholder="Contoh: 6500"
                    className="w-full pl-9 pr-3 py-2 text-xs font-bold text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
                <p className="text-[10px] text-slate-500">
                  Nilai rekomendasi acuan HAP/GKP (Rp {RECOMMENDED_GRAIN_PRICE_PER_KG.toLocaleString('id-ID')}/kg). Dapat diubah pengguna.
                </p>
              </div>
            </div>

            {/* Hasil Analisis Finansial */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">
                  Total Pendapatan
                </span>
                <span className="text-xs sm:text-sm font-black text-emerald-800 mt-1 block">
                  {formattedGrossRevenue}
                </span>
                <span className="text-[10px] text-slate-400">
                  {economics.yieldKg.toLocaleString('id-ID')} kg × Rp {economics.grainPricePerKgRp.toLocaleString('id-ID')}
                </span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">
                  Laba / Rugi Bersih
                </span>
                <span
                  className={`text-xs sm:text-sm font-black mt-1 block ${
                    economics.isProfitable ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {economics.isProfitable ? '+' : '-'}{formattedNetProfit}
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-block mt-0.5 ${
                    economics.isProfitable
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {economics.isProfitable ? 'Untung' : 'Rugi'}
                </span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">
                  R/C Ratio (Kelayakan)
                </span>
                <span className="text-xs sm:text-sm font-black text-slate-900 mt-1 block">
                  {economics.revenueCostRatio.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-500">
                  {economics.revenueCostRatio >= 1.0 ? 'Usaha Tani Layak (R/C > 1)' : 'R/C < 1 (Belum Impas)'}
                </span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">
                  BEP Harga (Biaya/kg)
                </span>
                <span className="text-xs sm:text-sm font-black text-slate-900 mt-1 block">
                  {formattedBepPrice} / kg
                </span>
                <span className="text-[10px] text-slate-500">
                  Titik Impas: {Math.round(economics.breakEvenYieldKg).toLocaleString('id-ID')} kg
                </span>
              </div>
            </div>

            {/* Catatan Transparan Pengguna */}
            <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>
                <strong>Prinsip HIKMAT TANI:</strong> Seluruh perhitungan ekonomi di atas menggunakan data biaya riil yang Anda catat dan harga jual yang Anda tentukan sendiri secara bebas.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
