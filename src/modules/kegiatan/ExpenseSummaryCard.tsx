/**
 * HIKMAT TANI - Expense (Biaya Usaha Tani) Summary Card
 * 
 * Menampilkan ringkasan total pengeluaran semusim, rata-rata per hektar, dan diagram sebaran kategori.
 */

import { BarChart3, Coins, PieChart } from 'lucide-react';
import { Land, SeasonExpenseReport } from '../../types/index.ts';

interface ExpenseSummaryCardProps {
  report: SeasonExpenseReport;
  land?: Land | null;
}

export function ExpenseSummaryCard({ report, land }: ExpenseSummaryCardProps) {
  const formattedTotal = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(report.totalExpenseRp);

  const costPerHa =
    land && land.areaHa > 0
      ? new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          maximumFractionDigits: 0,
        }).format(report.totalExpenseRp / land.areaHa)
      : null;

  const activeCategories = report.categories.filter((c) => c.totalAmountRp > 0);

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-5">
      {/* Header Ringkasan Biaya */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-800 text-white flex items-center justify-center shadow-xs">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Biaya Usaha Tani
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

          {costPerHa && (
            <div className="bg-emerald-50 px-3.5 py-2 rounded-xl border border-emerald-200 text-xs">
              <span className="text-emerald-700 block text-[10px] font-bold">
                Estimasi / Hektar:
              </span>
              <span className="font-extrabold text-emerald-900">
                {costPerHa} / ha
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
    </div>
  );
}
