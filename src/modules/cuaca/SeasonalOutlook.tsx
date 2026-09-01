/**
 * HIKMAT TANI - Seasonal Weather Outlook (1–3 Bulan ke Depan)
 * 
 * Prinsip:
 * - Menampilkan outlook agrometeorologi bulanan hingga 3 bulan ke depan.
 * - Berfokus pada sifat hujan: Atas Normal (Lebih Basah), Normal, Bawah Normal (Lebih Kering).
 * - Menekankan fase monsun, tingkat keyakinan (confidence level), serta arahan pola tanam dan ketersediaan air.
 * - Dilengkapi edukasi keterbatasan kepastian iklim jangka panjang bagi petani.
 */

import {
  AlertCircle,
  Calendar,
  CloudLightning,
  Compass,
  Droplets,
  HelpCircle,
  Layers,
  ShieldCheck,
  SunMedium,
} from 'lucide-react';
import { SeasonalOutlookMonth, SeasonalRainfallTendency } from '../../types/index.ts';

interface SeasonalOutlookProps {
  outlooks?: SeasonalOutlookMonth[];
}

export function SeasonalOutlook({ outlooks = [] }: SeasonalOutlookProps) {
  const renderRainfallBadge = (tendency: SeasonalRainfallTendency) => {
    switch (tendency) {
      case 'ABOVE_NORMAL':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-blue-900 bg-blue-100 border border-blue-200 px-2.5 py-0.5 rounded-full">
            <CloudLightning className="w-3 h-3 text-blue-700" />
            Atas Normal (Lebih Basah)
          </span>
        );
      case 'BELOW_NORMAL':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-amber-900 bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded-full">
            <SunMedium className="w-3 h-3 text-amber-700" />
            Bawah Normal (Lebih Kering)
          </span>
        );
      case 'NORMAL':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-emerald-900 bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-full">
            <Layers className="w-3 h-3 text-emerald-700" />
            Normal Sesuai Musim
          </span>
        );
    }
  };

  if (outlooks.length === 0) {
    return (
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs text-slate-500">
        Data outlook musiman sedang dikalkulasi.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header Edukatif Iklim */}
      <div className="p-3 sm:p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
          <Calendar className="w-4 h-4 text-amber-700 shrink-0" />
          <span>Outlook Agroklimatologi 1–3 Bulan ke Depan</span>
        </div>
        <p className="text-[11px] text-amber-900/90 leading-relaxed">
          Outlook musiman memetakan <strong>kecenderungan sifat hujan bulanan</strong> terhadap rata-rata klimatologis 30 tahun. 
          Semakin jauh bulan yang diprediksi, semakin tinggi tingkat ketidakpastian dinamisnya.
        </p>
      </div>

      {/* Grid Bulan 1-3 */}
      <div className="space-y-3">
        {outlooks.map((month) => (
          <div
            key={month.monthIndex}
            className="p-3.5 sm:p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3"
          >
            {/* Baris Atas: Nama Bulan & Sifat Hujan */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div>
                <div className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                  <span>{month.monthName}</span>
                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    Bulan ke-{month.monthIndex}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Fase Monsun: {month.monsoonPhase}
                </div>
              </div>

              <div>
                {renderRainfallBadge(month.rainfallTendency)}
              </div>
            </div>

            {/* Parameter & Tingkat Keyakinan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                  <Droplets className="w-3 h-3 text-sky-500" />
                  <span>Kecenderungan Curah Hujan</span>
                </div>
                <div className="text-[11px] sm:text-xs font-extrabold text-slate-900 mt-0.5">
                  {month.rainfallTendencyLabel}
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>Tingkat Keyakinan Model</span>
                </div>
                <div className="text-[11px] sm:text-xs font-extrabold text-slate-900 mt-0.5">
                  {month.confidenceLabel}
                </div>
              </div>
            </div>

            {/* Ringkasan Dinamika Cuaca */}
            <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed">
              {month.summary}
            </p>

            {/* Panduan Strategi Air & Pola Tanam */}
            <div className="p-2.5 sm:p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-[11px] text-emerald-950 flex items-start gap-2">
              <Compass className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Arahan Tata Air & Pola Tanam: </span>
                <span className="leading-relaxed">{month.waterGuidance}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Catatan Keterbukaan & Ketidakpastian */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2 text-[10px] sm:text-[11px] text-slate-600">
        <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <span className="font-bold">Prinsip Bijak Petani:</span> Prakiraan iklim jangka panjang bermanfaat untuk 
          perencanaan varietas benih, perbaikan saluran primer/sekunder, dan pengaturan masa semai. Selalu periksa 
          prakiraan jangka pendek (1–10 hari) sebelum eksekusi pemupukan dan penyemprotan harian.
        </p>
      </div>
    </div>
  );
}
