/**
 * HIKMAT TANI - Medium-Term Weather Outlook (2–4 Minggu ke Depan)
 * 
 * Prinsip:
 * - Menampilkan kecenderungan cuaca 2–4 minggu ke depan secara probabilistik.
 * - Tidak menampilkan kepastian harian semu, melainkan tren agroklimat:
 *   "Kecenderungan lebih basah", "Kecenderungan lebih kering", "Sekitar normal", "Peluang hujan meningkat/menurun".
 * - Menyajikan implikasi pengerjaan sawah dan strategi tata air secara praktis.
 */

import {
  CalendarRange,
  CloudRain,
  Droplets,
  HelpCircle,
  Info,
  Layers,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { MediumTermTrend, MediumTermTrendType, RainProbabilityTrend } from '../../types/index.ts';

interface MediumTermForecastProps {
  trends?: MediumTermTrend[];
}

export function MediumTermForecast({ trends = [] }: MediumTermForecastProps) {
  const renderTrendBadge = (type: MediumTermTrendType) => {
    switch (type) {
      case 'WETTER':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-blue-900 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full">
            <CloudRain className="w-3 h-3 text-blue-700" />
            Lebih Basah
          </span>
        );
      case 'DRIER':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-amber-900 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
            <Droplets className="w-3 h-3 text-amber-700" />
            Lebih Kering
          </span>
        );
      case 'NORMAL':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-emerald-900 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full">
            <Sparkles className="w-3 h-3 text-emerald-700" />
            Sekitar Normal
          </span>
        );
    }
  };

  const renderRainTrendIcon = (rainTrend: RainProbabilityTrend) => {
    switch (rainTrend) {
      case 'INCREASING':
        return <TrendingUp className="w-3.5 h-3.5 text-blue-600" />;
      case 'DECREASING':
        return <TrendingDown className="w-3.5 h-3.5 text-amber-600" />;
      case 'NORMAL':
      default:
        return <Layers className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  if (trends.length === 0) {
    return (
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs text-slate-500">
        Data tren jangka menengah sedang diproses.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header Penjelasan Probabilistik */}
      <div className="p-3 sm:p-3.5 bg-sky-50/70 border border-sky-200/80 rounded-2xl space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-bold text-sky-950">
          <CalendarRange className="w-4 h-4 text-sky-700 shrink-0" />
          <span>Kecenderungan Agroklimat 2–4 Minggu</span>
        </div>
        <p className="text-[11px] text-sky-900/90 leading-relaxed">
          Prakiraan jangka menengah merupakan <strong>analisis kecenderungan umum</strong> (probabilitas), 
          bukan kepastian cuaca hari per hari. Gunakan data ini untuk menyusun strategi pengairan dan jadwal kerja sawah.
        </p>
      </div>

      {/* Grid Kartu Mingguan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {trends.map((item) => (
          <div
            key={item.weekNumber}
            className="p-3.5 sm:p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-2.5 flex flex-col justify-between"
          >
            <div>
              {/* Header Minggu & Badge */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div>
                  <div className="text-xs sm:text-sm font-black text-slate-900">
                    {item.label}
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-slate-500 font-semibold">
                    Rentang: {item.dateRange}
                  </div>
                </div>

                <div>
                  {renderTrendBadge(item.trendType)}
                </div>
              </div>

              {/* Parameter Pokok Mingguan */}
              <div className="grid grid-cols-2 gap-2 mt-2.5">
                <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl">
                  <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                    {renderRainTrendIcon(item.rainTrend)}
                    <span>Peluang Hujan</span>
                  </div>
                  <div className="text-[11px] sm:text-xs font-extrabold text-slate-900 mt-0.5">
                    {item.rainTrendLabel}
                  </div>
                </div>

                <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl">
                  <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                    <CloudRain className="w-3.5 h-3.5 text-blue-500" />
                    <span>Est. Akumulasi</span>
                  </div>
                  <div className="text-[11px] sm:text-xs font-extrabold text-slate-900 mt-0.5">
                    {item.estimatedRainMmRange}
                  </div>
                </div>
              </div>

              {/* Deskripsi Karakter Cuaca */}
              <p className="text-[11px] sm:text-xs text-slate-600 mt-2.5 leading-relaxed">
                {item.desc}
              </p>
            </div>

            {/* Implikasi Tindakan Lapang */}
            <div className="p-2.5 bg-emerald-50/60 border border-emerald-200/70 rounded-xl text-[11px] text-emerald-950 flex items-start gap-2 mt-1">
              <Info className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Implikasi Sawah: </span>
                <span>{item.agronomicImpact}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Catatan Ketidakpastian Bijak */}
      <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-500 px-1">
        <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span>
          Model diperbarui otomatis mengikuti dinamika pergerakan massa udara regional BMKG & GFS/ECMWF.
        </span>
      </div>
    </div>
  );
}
