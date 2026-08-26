/**
 * HIKMAT TANI - Quick Actions Component (Aksi Cepat)
 * 
 * Prinsip:
 * - Tombol besar, ramah sentuhan (tap target >= 48px), kontras tinggi.
 * - Petani dapat langsung mencatat kegiatan lapang dengan mudah.
 */

import { Bug, Droplets, FlaskConical, Plus } from 'lucide-react';

interface QuickActionsProps {
  onAddFertilizer: () => void;
  onAddObservation: () => void;
  onAddIrrigation: () => void;
  disabled?: boolean;
}

export function QuickActions({
  onAddFertilizer,
  onAddObservation,
  onAddIrrigation,
  disabled = false,
}: QuickActionsProps) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm sm:text-base font-bold text-slate-900">Aksi Cepat</h2>
        <span className="text-[11px] text-slate-500 font-medium">Catatan Lapang</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Catat Pemupukan */}
        <button
          type="button"
          onClick={onAddFertilizer}
          disabled={disabled}
          className="flex items-center gap-3.5 p-3.5 sm:p-4 min-h-[56px] bg-white hover:bg-emerald-50/60 active:bg-emerald-100/80 border border-slate-200 hover:border-emerald-300 rounded-2xl transition-all shadow-xs text-left group disabled:opacity-50 disabled:pointer-events-none"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs sm:text-sm font-bold text-slate-900 block truncate">
              Catat Pemupukan
            </span>
            <span className="text-[11px] text-slate-500 block truncate">
              Pupuk & dosis aplikasi
            </span>
          </div>
          <Plus className="w-4 h-4 text-emerald-700 shrink-0" />
        </button>

        {/* Catat Pengamatan OPT */}
        <button
          type="button"
          onClick={onAddObservation}
          disabled={disabled}
          className="flex items-center gap-3.5 p-3.5 sm:p-4 min-h-[56px] bg-white hover:bg-amber-50/60 active:bg-amber-100/80 border border-slate-200 hover:border-amber-300 rounded-2xl transition-all shadow-xs text-left group disabled:opacity-50 disabled:pointer-events-none"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Bug className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs sm:text-sm font-bold text-slate-900 block truncate">
              Catat Pengamatan
            </span>
            <span className="text-[11px] text-slate-500 block truncate">
              Gejala hama / penyakit
            </span>
          </div>
          <Plus className="w-4 h-4 text-amber-700 shrink-0" />
        </button>

        {/* Catat Pengairan */}
        <button
          type="button"
          onClick={onAddIrrigation}
          disabled={disabled}
          className="flex items-center gap-3.5 p-3.5 sm:p-4 min-h-[56px] bg-white hover:bg-sky-50/60 active:bg-sky-100/80 border border-slate-200 hover:border-sky-300 rounded-2xl transition-all shadow-xs text-left group disabled:opacity-50 disabled:pointer-events-none"
        >
          <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Droplets className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs sm:text-sm font-bold text-slate-900 block truncate">
              Catat Pengairan
            </span>
            <span className="text-[11px] text-slate-500 block truncate">
              Genangan / macak-macak
            </span>
          </div>
          <Plus className="w-4 h-4 text-sky-700 shrink-0" />
        </button>
      </div>
    </div>
  );
}
