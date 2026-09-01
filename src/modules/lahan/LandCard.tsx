/**
 * HIKMAT TANI - Land Card Component (Lahan Saya)
 * 
 * Menampilkan ringkasan petak lahan, status musim tanam aktif,
 * varietas, luas, dan HST.
 */

import { Archive, Calendar, CheckCircle2, ChevronRight, Droplets, Home, Layers, MoreVertical, Settings2, Sparkles, Sprout } from 'lucide-react';
import { determineGrowthPhase } from '../../engine/growthPhase.ts';
import { calculateHST } from '../../engine/hstCalculator.ts';
import { CropSeason, Land } from '../../types/index.ts';

interface LandCardProps {
  key?: string | number;
  land: Land;
  activeSeason?: CropSeason;
  varietyDurationDays?: number | null;
  isSelected?: boolean;
  onSelectLand?: (landId: string) => void;
  onViewSeason: (land: Land, season: CropSeason) => void;
  onStartSeason: (land: Land) => void;
  onManageLand?: (land: Land) => void;
  onNavigateToTab?: (tab: 'beranda' | 'lahan' | 'kegiatan' | 'informasi' | 'saya') => void;
}

export function LandCard({
  land,
  activeSeason,
  varietyDurationDays = 120,
  isSelected = false,
  onSelectLand,
  onViewSeason,
  onStartSeason,
  onManageLand,
  onNavigateToTab,
}: LandCardProps) {
  const hstResult = activeSeason?.plantingDate
    ? calculateHST(activeSeason.plantingDate, new Date().toISOString())
    : { isValid: false, hst: null };

  const currentHst = hstResult.isValid && hstResult.hst !== null ? hstResult.hst : null;
  const growthPhase = determineGrowthPhase(currentHst, varietyDurationDays);
  const isArchived = land.status === 'ARCHIVED';

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

  const handleOpenInBeranda = () => {
    if (onSelectLand) {
      onSelectLand(land.id);
    }
    if (onNavigateToTab) {
      onNavigateToTab('beranda');
    }
  };

  return (
    <div
      className={`bg-white rounded-2xl border transition-all shadow-xs p-5 sm:p-6 space-y-4 ${
        isArchived
          ? 'border-slate-300 bg-slate-50/80 opacity-90'
          : isSelected
          ? 'border-[#0F5132] ring-2 ring-[#0F5132]/20'
          : 'border-slate-200 hover:border-[#0F5132]/40'
      }`}
    >
      {/* Land Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">
              {land.name}
            </h3>
            {isArchived ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded-full border border-slate-300">
                <Archive className="w-3 h-3 text-slate-500" />
                Diarsipkan
              </span>
            ) : isSelected ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-[#0F5132] text-[10px] font-black rounded-full border border-[#0F5132]/30">
                <CheckCircle2 className="w-3 h-3" />
                Fokus Utama
              </span>
            ) : null}
            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-full">
              {getLandTypeLabel(land.landType)}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Luas: <span className="font-bold text-slate-800">{Math.round(land.areaHa * 10000).toLocaleString('id-ID')} m²</span> •{' '}
            {getWaterSourceLabel(land.waterSource)}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {activeSeason ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-black text-[#0F5132] bg-emerald-50 px-3 py-1 rounded-full border border-[#0F5132]/30 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-[#0F5132] animate-pulse" />
              Musim Aktif
            </span>
          ) : (
            <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
              {isArchived ? 'Arsip' : 'Istirahat'}
            </span>
          )}

          {onManageLand && (
            <button
              type="button"
              onClick={() => onManageLand(land)}
              title="Kelola Lahan"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center shadow-2xs"
            >
              <Settings2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Season Summary */}
      {activeSeason ? (
        <div className="bg-[#FBF9F2] border border-[#0F5132]/20 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sprout className="w-4 h-4 text-[#0F5132]" />
              <span className="text-xs font-bold text-slate-900">
                {activeSeason.varietyName || 'Padi Sawah'} ({activeSeason.commodity})
              </span>
            </div>
            <span className="text-xs font-black text-[#D4AF37]">
              {currentHst !== null ? `${currentHst} HST` : '-'}
            </span>
          </div>

          <div className="text-[11px] text-slate-600 flex items-center justify-between pt-1 border-t border-slate-200/80">
            <span>Fase: <strong className="text-[#0F5132] font-bold">{growthPhase.label}</strong></span>
            <span>Sistem: {activeSeason.plantingSystem?.replace(/_/g, ' ') || 'Jajar Legowo'}</span>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleOpenInBeranda}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-[#0F5132] min-h-[40px] py-1.5 px-3 rounded-xl bg-white hover:bg-emerald-50 border border-slate-200 transition-colors shadow-2xs"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Buka di Beranda</span>
            </button>

            <button
              type="button"
              onClick={() => onViewSeason(land, activeSeason)}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#0F5132] hover:text-[#0B3D26] min-h-[40px] py-1.5 px-3.5 rounded-xl bg-emerald-100/70 hover:bg-emerald-200/70 transition-colors shadow-2xs"
            >
              <span>Rincian Musim</span>
              <ChevronRight className="w-3.5 h-3.5 text-[#0F5132]" />
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-4 text-center space-y-2">
          <p className="text-xs text-slate-500">
            {isArchived
              ? 'Lahan ini sedang dalam status arsip.'
              : 'Belum ada musim tanam aktif pada petak sawah ini.'}
          </p>
          {!isArchived && (
            <button
              type="button"
              onClick={() => onStartSeason(land)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[48px] bg-[#0F5132] hover:bg-[#0B3D26] active:bg-[#072417] text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
            >
              <Sparkles className="w-4 h-4 text-[#D4AF37]" />
              <span>Mulai Musim Tanam</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
