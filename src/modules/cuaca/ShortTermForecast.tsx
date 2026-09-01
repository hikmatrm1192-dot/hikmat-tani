/**
 * HIKMAT TANI - Short-Term Weather Forecast (1–10 Hari)
 * 
 * Prinsip:
 * - Menampilkan prakiraan 1–10 hari secara terstruktur dan mudah dibaca di layar HP (320-360px).
 * - Menampilkan metrik krusial: peluang hujan (%), curah hujan (mm), suhu min/maks, kelembapan (%), kecepatan & arah angin.
 * - Indikator risiko kegiatan tani: Rendah (Hijau), Sedang (Kuning), Tinggi (Merah).
 */

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Compass,
  Droplets,
  Info,
  Sun,
  Thermometer,
  Wind,
} from 'lucide-react';
import { WeatherConditionType, WeatherDailyForecast, WeatherRiskLevel } from '../../types/index.ts';

interface ShortTermForecastProps {
  dailyForecasts: WeatherDailyForecast[];
}

export function ShortTermForecast({ dailyForecasts }: ShortTermForecastProps) {
  const [expandedDate, setExpandedDate] = useState<string | null>(
    dailyForecasts.length > 0 ? dailyForecasts[0].date : null
  );

  const renderWeatherIcon = (type: WeatherConditionType, className = 'w-6 h-6') => {
    switch (type) {
      case 'CLEAR':
        return <Sun className={`${className} text-amber-500`} />;
      case 'PARTLY_CLOUDY':
        return <CloudSun className={`${className} text-amber-500`} />;
      case 'CLOUDY':
        return <Cloud className={`${className} text-slate-500`} />;
      case 'FOG':
        return <CloudFog className={`${className} text-slate-400`} />;
      case 'DRIZZLE':
        return <CloudDrizzle className={`${className} text-sky-500`} />;
      case 'LIGHT_RAIN':
      case 'MODERATE_RAIN':
        return <CloudRain className={`${className} text-blue-500`} />;
      case 'HEAVY_RAIN':
        return <CloudRain className={`${className} text-indigo-600`} />;
      case 'THUNDERSTORM':
        return <CloudLightning className={`${className} text-purple-600`} />;
      default:
        return <CloudSun className={`${className} text-amber-500`} />;
    }
  };

  const renderRiskBadge = (level?: WeatherRiskLevel) => {
    switch (level) {
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-rose-800 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            Risiko Tinggi
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
            <Info className="w-3 h-3 text-amber-600" />
            Risiko Sedang
          </span>
        );
      case 'LOW':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Kondisi Baik
          </span>
        );
    }
  };

  if (dailyForecasts.length === 0) {
    return (
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs text-slate-500">
        Data prakiraan harian belum tersedia.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
          <CalendarIcon className="w-4 h-4 text-emerald-700" />
          <span>Prakiraan 1–10 Hari ke Depan</span>
        </div>
        <span className="text-[11px] text-slate-500 font-medium">
          {dailyForecasts.length} Hari Teranalisis
        </span>
      </div>

      {/* Daftar Kartu Harian */}
      <div className="space-y-2">
        {dailyForecasts.map((day, idx) => {
          const isExpanded = expandedDate === day.date;
          const isToday = idx === 0;

          return (
            <div
              key={day.date}
              className={`rounded-2xl border transition-all overflow-hidden ${
                isToday
                  ? 'bg-gradient-to-r from-emerald-50/70 via-white to-sky-50/50 border-emerald-300 shadow-2xs'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
              }`}
            >
              {/* Header Kartu Harian (Click to Toggle) */}
              <button
                type="button"
                onClick={() => setExpandedDate(isExpanded ? null : day.date)}
                className="w-full p-3 sm:p-3.5 flex items-center justify-between gap-2.5 text-left focus:outline-hidden"
              >
                {/* Kolom Kiri: Hari, Tanggal & Ikon Cuaca */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-100/90 border border-slate-200 flex items-center justify-center shrink-0">
                    {renderWeatherIcon(day.conditionType, 'w-6 h-6')}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs sm:text-sm font-black text-slate-900">
                        {day.dayLabel}
                      </span>
                      {isToday && (
                        <span className="text-[9px] font-bold text-white bg-emerald-700 px-1.5 py-0.2 rounded-md">
                          Hari Ini
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate">
                      {formatIndonesianDate(day.date)} • {day.condition}
                    </div>
                  </div>
                </div>

                {/* Kolom Kanan: Peluang Hujan, Suhu & Badge Risiko */}
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1 text-xs sm:text-sm font-extrabold text-slate-900">
                      <span>{day.tempMax}°</span>
                      <span className="text-slate-400 font-normal">/</span>
                      <span className="text-slate-500 font-semibold">{day.tempMin}°C</span>
                    </div>

                    <div className="flex items-center justify-end gap-1 text-[10px] sm:text-[11px] font-bold text-blue-700 mt-0.5">
                      <CloudRain className="w-3 h-3 shrink-0" />
                      <span>{day.rainProbability}%</span>
                    </div>
                  </div>

                  <div className="hidden sm:block">
                    {renderRiskBadge(day.riskLevel)}
                  </div>

                  <div className="text-slate-400">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </div>
              </button>

              {/* Panel Detail Terbuka */}
              {isExpanded && (
                <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-100 bg-slate-50/60 space-y-2.5">
                  <div className="sm:hidden pt-1">
                    {renderRiskBadge(day.riskLevel)}
                  </div>

                  {/* Grid Metrik Lengkap */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {/* Peluang & Curah Hujan */}
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold">
                        <CloudRain className="w-3.5 h-3.5 text-blue-600" />
                        <span>Peluang & Curah</span>
                      </div>
                      <div className="text-xs sm:text-[13px] font-extrabold text-slate-900 mt-0.5">
                        {day.rainProbability}%
                        <span className="text-[11px] font-medium text-slate-500 ml-1">
                          ({day.rainMm !== undefined ? `${day.rainMm} mm` : '0 mm'})
                        </span>
                      </div>
                    </div>

                    {/* Rentang Suhu */}
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold">
                        <Thermometer className="w-3.5 h-3.5 text-amber-600" />
                        <span>Rentang Suhu</span>
                      </div>
                      <div className="text-xs sm:text-[13px] font-extrabold text-slate-900 mt-0.5">
                        {day.tempMin}°C - {day.tempMax}°C
                      </div>
                    </div>

                    {/* Kelembapan Relatif */}
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold">
                        <Droplets className="w-3.5 h-3.5 text-sky-600" />
                        <span>Kelembapan Udara</span>
                      </div>
                      <div className="text-xs sm:text-[13px] font-extrabold text-slate-900 mt-0.5">
                        ~{day.humidity || 75}%
                      </div>
                    </div>

                    {/* Kecepatan & Arah Angin */}
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold">
                        <Wind className="w-3.5 h-3.5 text-slate-600" />
                        <span>Angin Lapang</span>
                      </div>
                      <div className="text-xs sm:text-[13px] font-extrabold text-slate-900 mt-0.5 truncate">
                        {day.windSpeed || 8} km/j
                        <span className="text-[11px] font-medium text-slate-500 ml-1">
                          ({day.windDirection || 'Timur'})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Keterangan Risiko & Rekomendasi Hari Tersebut */}
                  {day.riskReason && (
                    <div className="p-2.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-[11px] text-emerald-950 flex items-start gap-2">
                      <Info className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Pertimbangan Lapang: </span>
                        <span>{day.riskReason}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}

function formatIndonesianDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const day = parts[2];
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
  ];
  const month = monthNames[parseInt(parts[1], 10) - 1] || parts[1];
  return `${day} ${month}`;
}
