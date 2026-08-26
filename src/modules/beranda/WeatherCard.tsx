/**
 * HIKMAT TANI - Weather Placeholder Component
 * 
 * Sesuai panduan:
 * - Tampilkan placeholder sederhana & ramah
 * - Jangan membuat API cuaca eksternal pada tahap ini
 */

import { CloudSun, Droplets, Wind } from 'lucide-react';

export function WeatherCard() {
  return (
    <div className="bg-gradient-to-r from-sky-50 to-emerald-50 border border-sky-200/80 rounded-2xl p-4 sm:p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-white text-amber-500 flex items-center justify-center shadow-xs border border-sky-100 shrink-0">
            <CloudSun className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-sky-900 uppercase tracking-wide">
                Perkiraan Cuaca Lapang
              </span>
              <span className="text-[10px] bg-sky-200/60 text-sky-800 px-2 py-0.2 rounded-full font-semibold">
                Estimasi
              </span>
            </div>
            <p className="text-sm font-bold text-slate-800 mt-0.5">
              Cerah Berawan • Suhu ~29°C
            </p>
            <p className="text-[11px] text-slate-500">
              Kondisi kelembapan tanah dan kanopi mendukung aktivitas lapang.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-600 pt-2 sm:pt-0 border-t sm:border-t-0 border-sky-200/50">
          <div className="flex items-center gap-1">
            <Droplets className="w-3.5 h-3.5 text-sky-600" />
            <span>RH: 75%</span>
          </div>
          <div className="flex items-center gap-1">
            <Wind className="w-3.5 h-3.5 text-slate-500" />
            <span>Angin: Tenang</span>
          </div>
        </div>
      </div>
    </div>
  );
}
