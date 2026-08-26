/**
 * HIKMAT TANI - Land Card Component (Lahan Saya)
 * 
 * Menampilkan ringkasan petak lahan, status musim tanam aktif,
 * varietas, luas, dan HST.
 */

import { Calendar, ChevronRight, Droplets, Layers, Sparkles, Sprout } from 'lucide-react';
import { determineGrowthPhase } from '../../engine/growthPhase.ts';
import { calculateHST } from '../../engine/hstCalculator.ts';
import { CropSeason, Land } from '../../types/index.ts';

interface LandCardProps {
  land: Land;
  activeSeason?: CropSeason;
  varietyDurationDays?: number | null;
  onViewSeason: (land: Land, season: CropSeason) => void;
  onStartSeason: (land: Land) => void;
}

export function LandCard({
  land,
  activeSeason,
  varietyDurationDays = 120,
  onViewSeason,
  onStartSeason,
}: LandCardProps) {
  const hstResult = activeSeason?.plantingDate
    ? calculateHST(activeSeason.plantingDate, new Date().toISOString())
    : { isValid: false, hst: null };

  const currentHst = hstResult.isValid && hstResult.hst !== null ? hstResult.hst : null;
  const growthPhase = determineGrowthPhase(currentHst, varietyDurationDays);

  const getWaterSourceLabel = (src?: string) => {
    switch (src) {
      case 'IRRIGATION_TECHNICAL':
        return 'Irigasi Teknis';
      case 'IRRIGATION_SEMI_TECHNICAL':
        return 'Irigasi Semi Teknis';
      case 'RAIN_FED':
        return 'Tadah Hujan';
      case 'GROUNDWATER':
        return 'Sumur Pantek';
      default:
        return src || 'Irigasi';
    }
  };

  const getLandTypeLabel = (lt?: string) => {
    switch (lt) {
      case 'LOWLAND_PADDY':
        return 'Sawah Irigasi';
      case 'RAINFED_PADDY':
        return 'Sawah Tadah Hujan';
      case 'TIDAL_SWAMP':
        return 'Rawa Pasang Surut';
      case 'UPLAND':
        return 'Padi Gogo';
      default:
        return lt || 'Sawah';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4 hover:border-emerald-300 transition-colors">
      {/* Land Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              {land.name}
            </h3>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-md">
              {getLandTypeLabel(land.landType)}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Luas: <span className="font-semibold text-slate-700">{land.areaHa} ha</span> (
            {(land.areaHa * 10000).toLocaleString('id-ID')} m²) •{' '}
            {getWaterSourceLabel(land.waterSource)}
          </p>
        </div>

        {activeSeason ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Musim Aktif
          </span>
        ) : (
          <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full shrink-0">
            Istirahat / Kosong
          </span>
        )}
      </div>

      {/* Season Summary */}
      {activeSeason ? (
        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sprout className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-bold text-emerald-950">
                {activeSeason.varietyName || 'Padi Sawah'} ({activeSeason.commodity})
              </span>
            </div>
            <span className="text-xs font-black text-amber-700">
              {currentHst !== null ? `${currentHst} HST` : '-'}
            </span>
          </div>

          <div className="text-[11px] text-slate-600 flex items-center justify-between pt-1 border-t border-emerald-200/60">
            <span>Fase: <strong className="text-emerald-900">{growthPhase.label}</strong></span>
            <span>Sistem: {activeSeason.plantingSystem?.replace(/_/g, ' ') || 'Jajar Legowo'}</span>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => onViewSeason(land, activeSeason)}
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-950 min-h-[44px] py-1.5 px-3 rounded-lg hover:bg-emerald-100/80 transition-colors"
            >
              <span>Rincian Musim Tanam</span>
              <ChevronRight className="w-4 h-4 text-amber-600" />
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4 text-center space-y-2">
          <p className="text-xs text-slate-500">
            Belum ada musim tanam aktif pada petak sawah ini.
          </p>
          <button
            type="button"
            onClick={() => onStartSeason(land)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[48px] bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Mulai Musim Tanam</span>
          </button>
        </div>
      )}
    </div>
  );
}
