/**
 * HIKMAT TANI - Agricultural Recommendations based on Weather & Crop Conditions
 * 
 * Prinsip:
 * - Menerjemahkan prakiraan cuaca menjadi tindakan konkret di sawah.
 * - Terpadu dengan data riil tanaman: HST, fase, pemupukan, penyemprotan, OPT, tata air, dan panen.
 * - Membedakan dengan jelas antara data fakta, analisis risiko, dan saran tindakan lapangan.
 */

import { useState } from 'react';
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  ChevronRight,
  Droplets,
  FlaskConical,
  Info,
  Layers,
  Lightbulb,
  ShieldAlert,
  Sprout,
  Wheat,
  Wind,
} from 'lucide-react';
import {
  AgriRecommendationCategory,
  AgriWeatherRecommendation,
} from '../../types/index.ts';

interface AgriRecommendationsProps {
  recommendations: AgriWeatherRecommendation[];
  hst: number;
  growthPhaseName: string;
  stageCategory: string;
  landName?: string;
  daysToHarvest?: number;
}

export function AgriRecommendations({
  recommendations,
  hst,
  growthPhaseName,
  landName,
  daysToHarvest,
}: AgriRecommendationsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const categories: { id: string; label: string; icon: any }[] = [
    { id: 'ALL', label: 'Semua Saran', icon: Layers },
    { id: 'FERTILIZER', label: 'Pemupukan', icon: Sprout },
    { id: 'SPRAYING', label: 'Penyemprotan', icon: FlaskConical },
    { id: 'WATER', label: 'Tata Air', icon: Droplets },
    { id: 'OPT', label: 'Hama & Penyakit', icon: Bug },
    { id: 'HARVEST', label: 'Panen & Jemur', icon: Wheat },
  ];

  const filteredRecs =
    selectedCategory === 'ALL'
      ? recommendations
      : recommendations.filter((r) => r.category === selectedCategory);

  const renderCategoryIcon = (category: AgriRecommendationCategory) => {
    switch (category) {
      case 'FERTILIZER':
        return <Sprout className="w-4 h-4 text-emerald-700" />;
      case 'SPRAYING':
        return <FlaskConical className="w-4 h-4 text-sky-700" />;
      case 'WATER':
        return <Droplets className="w-4 h-4 text-blue-700" />;
      case 'OPT':
        return <Bug className="w-4 h-4 text-rose-700" />;
      case 'HARVEST':
        return <Wheat className="w-4 h-4 text-amber-700" />;
      case 'GENERAL':
      default:
        return <Lightbulb className="w-4 h-4 text-slate-700" />;
    }
  };

  const renderUrgencyBadge = (urgency: 'INFO' | 'WARNING' | 'ALERT') => {
    switch (urgency) {
      case 'ALERT':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-rose-800 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-md">
            <ShieldAlert className="w-3 h-3 text-rose-600" />
            PENTING
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            PERHATIAN
          </span>
        );
      case 'INFO':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            PANDUAN
          </span>
        );
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Kartu Status Konteks Tanaman Saat Ini */}
      <div className="p-3.5 sm:p-4 bg-gradient-to-r from-emerald-900 to-slate-900 text-white rounded-2xl shadow-sm space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
            <Sprout className="w-4 h-4" />
            <span>Kondisi Riil Pertanaman</span>
          </div>
          <span className="text-[10px] font-bold text-emerald-950 bg-emerald-300 px-2 py-0.5 rounded-full">
            {landName || 'Petak Utama'}
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 flex-wrap text-xs pt-1">
          <div className="bg-white/10 px-2.5 py-1 rounded-lg border border-white/10">
            <span className="text-slate-300 text-[10px] block">Umur Tanaman:</span>
            <span className="font-extrabold text-sm text-emerald-200">{hst > 0 ? `${hst} HST` : 'Pratanam / Nol'}</span>
          </div>

          <div className="bg-white/10 px-2.5 py-1 rounded-lg border border-white/10">
            <span className="text-slate-300 text-[10px] block">Fase Pertumbuhan:</span>
            <span className="font-extrabold text-sm text-white">{growthPhaseName}</span>
          </div>

          {daysToHarvest !== undefined && daysToHarvest > 0 && (
            <div className="bg-white/10 px-2.5 py-1 rounded-lg border border-white/10">
              <span className="text-slate-300 text-[10px] block">Estimasi Panen:</span>
              <span className="font-extrabold text-sm text-amber-200">~{daysToHarvest} hari lagi</span>
            </div>
          )}
        </div>
      </div>

      {/* Filter Kategori Saran */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all whitespace-nowrap shrink-0 border ${
                isActive
                  ? 'bg-emerald-800 text-white border-emerald-900 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Daftar Rekomendasi Lapang */}
      {filteredRecs.length === 0 ? (
        <div className="p-5 bg-white border border-slate-200 rounded-2xl text-center text-xs text-slate-500">
          Tidak ada rekomendasi khusus untuk kategori ini pada kondisi cuaca saat ini.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRecs.map((rec) => (
            <div
              key={rec.id}
              className="p-3.5 sm:p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-2.5"
            >
              {/* Header Rekomendasi */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                    {renderCategoryIcon(rec.category)}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      {rec.categoryLabel}
                    </span>
                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-snug">
                      {rec.title}
                    </h4>
                  </div>
                </div>

                <div>
                  {renderUrgencyBadge(rec.urgency)}
                </div>
              </div>

              {/* Alasan Berdasarkan Analisis Cuaca & Tanaman */}
              <div className="text-[11px] sm:text-xs text-slate-600 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 leading-relaxed">
                <span className="font-bold text-slate-800">Dasar Pertimbangan: </span>
                <span>{rec.reason}</span>
              </div>

              {/* Tindakan Konkret di Sawah */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1">
                <div className="text-[10px] font-bold text-emerald-800 flex items-center gap-1 uppercase tracking-wide">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Saran Tindakan Petani:</span>
                </div>
                <p className="text-xs sm:text-[13px] font-bold text-emerald-950 leading-relaxed">
                  {rec.actionItem}
                </p>
              </div>

              {/* Konteks Pendukung */}
              {(rec.cropContext || rec.weatherContext) && (
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium pt-0.5 flex-wrap">
                  {rec.cropContext && (
                    <span className="bg-slate-100 px-2 py-0.5 rounded-md">
                      🌱 {rec.cropContext}
                    </span>
                  )}
                  {rec.weatherContext && (
                    <span className="bg-slate-100 px-2 py-0.5 rounded-md">
                      ⛅ {rec.weatherContext}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
