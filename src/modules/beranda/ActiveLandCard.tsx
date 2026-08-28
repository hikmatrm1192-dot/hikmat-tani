/**
 * HIKMAT TANI - Active Land Card Component
 * 
 * Menjawab pertanyaan petani: "Bagaimana kondisi lahan saya?"
 * - Nama lahan
 * - Varietas
 * - HST (Dihitung dari plantingDate)
 * - Fase tanaman (Dihitung dari HST & umur varietas)
 * - Tanggal tanam
 */

import { Calendar, ChevronRight, Layers, Sparkles, Sprout } from 'lucide-react';
import { determineGrowthPhase } from '../../engine/growthPhase.ts';
import { calculateHST } from '../../engine/hstCalculator.ts';
import { CropSeason, Land } from '../../types/index.ts';

interface ActiveLandCardProps {
  land: Land;
  activeSeason?: CropSeason;
  varietyDurationDays?: number | null;
  onOpenLandDetail?: (landId: string) => void;
  onStartSeason?: (landId: string) => void;
  allLands?: Land[];
  onSelectLand?: (landId: string) => void;
}

export function ActiveLandCard({
  land,
  activeSeason,
  varietyDurationDays = 120,
  onOpenLandDetail,
  onStartSeason,
  allLands,
  onSelectLand,
}: ActiveLandCardProps) {
  // Hitung HST secara dinamis via Engine
  const hstResult = activeSeason?.plantingDate
    ? calculateHST(activeSeason.plantingDate, new Date().toISOString())
    : { isValid: false, hst: null };

  const currentHst = hstResult.isValid && hstResult.hst !== null ? hstResult.hst : null;

  // Tentukan fase pertumbuhan via Engine
  const growthPhase = determineGrowthPhase(currentHst, varietyDurationDays);

  const formattedPlantingDate = activeSeason?.plantingDate
    ? new Date(activeSeason.plantingDate).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <div className="bg-gradient-to-br from-[#0B3D26] via-[#0F5132] to-[#072417] text-white rounded-3xl p-5 sm:p-6 shadow-lg border border-[#2E7D4F]/40 relative overflow-hidden">
      {/* Background Decorative Accent */}
      <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-[#2E7D4F]/20 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute right-4 top-4 opacity-10 pointer-events-none">
        <Sprout className="w-28 h-28 text-white" />
      </div>

      <div className="relative z-10 space-y-4">
        {/* Top bar: Selector jika punya banyak lahan / Nama Lahan */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#072417]/60 border border-[#2E7D4F]/50 text-emerald-200 text-xs font-bold">
              <Layers className="w-3 h-3 text-[#D4AF37]" />
              <span>Kondisi Lahan Aktif</span>
            </div>

            {allLands && allLands.length > 1 && onSelectLand ? (
              <div className="flex items-center gap-2 pt-1">
                <select
                  value={land.id}
                  onChange={(e) => onSelectLand(e.target.value)}
                  className="bg-[#072417]/90 border border-[#2E7D4F]/70 text-white text-base sm:text-lg font-bold rounded-xl px-3 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-[#D4AF37]"
                  aria-label="Pilih Lahan"
                >
                  {allLands.map((l) => (
                    <option key={l.id} value={l.id} className="bg-[#072417] text-white">
                      {l.name} ({l.areaHa} ha)
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white pt-0.5">
                {land.name}
              </h2>
            )}
            <p className="text-xs text-emerald-200/90 font-medium">
              Luas: <span className="text-white font-bold">{land.areaHa} ha</span> ({(land.areaHa * 10000).toLocaleString('id-ID')} m²)
            </p>
          </div>

          {onOpenLandDetail && (
            <button
              type="button"
              onClick={() => onOpenLandDetail(land.id)}
              className="px-3.5 py-2 min-h-[44px] bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shrink-0 border border-white/20 shadow-xs"
              aria-label={`Buka rincian lahan ${land.name}`}
            >
              <span>Rincian</span>
              <ChevronRight className="w-4 h-4 text-[#D4AF37]" />
            </button>
          )}
        </div>

        {/* Status Musim Tanam Aktif */}
        {activeSeason ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
            {/* Varietas */}
            <div className="bg-[#072417]/70 p-3.5 rounded-2xl border border-[#2E7D4F]/40 shadow-xs">
              <span className="text-[11px] text-emerald-300 block font-semibold">Varietas</span>
              <span className="text-sm sm:text-base font-bold text-white block truncate">
                {activeSeason.varietyName || 'Padi Sawah'}
              </span>
              <span className="text-[10px] text-emerald-400/80 block mt-0.5 font-medium">
                Komoditas: {activeSeason.commodity}
              </span>
            </div>

            {/* Umur HST */}
            <div className="bg-[#072417]/70 p-3.5 rounded-2xl border border-[#2E7D4F]/40 shadow-xs">
              <span className="text-[11px] text-emerald-300 block font-semibold">Umur Tanaman</span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl sm:text-2xl font-black text-[#D4AF37]">
                  {currentHst !== null ? currentHst : '-'}
                </span>
                <span className="text-xs font-bold text-emerald-200">HST</span>
              </div>
              {formattedPlantingDate && (
                <span className="text-[10px] text-emerald-300/80 block truncate mt-0.5 font-medium">
                  Tanam: {formattedPlantingDate}
                </span>
              )}
            </div>

            {/* Fase Tanaman */}
            <div className="bg-[#072417]/70 p-3.5 rounded-2xl border border-[#2E7D4F]/40 col-span-2 sm:col-span-1 shadow-xs">
              <span className="text-[11px] text-emerald-300 block font-semibold">Fase Pertumbuhan</span>
              <span className="text-xs sm:text-sm font-bold text-white block">
                {growthPhase.label}
              </span>
              <span className="text-[10px] text-[#D4AF37] block mt-0.5 line-clamp-1 font-semibold">
                {growthPhase.stageCategory === 'VEGETATIVE'
                  ? 'Fase Vegetatif'
                  : growthPhase.stageCategory === 'GENERATIVE'
                  ? 'Fase Generatif'
                  : 'Fase Pematangan'}
              </span>
            </div>
          </div>
        ) : (
          /* Empty Season State pada Lahan ini */
          <div className="p-4 bg-[#072417]/70 rounded-2xl border border-[#2E7D4F]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div>
              <p className="text-sm font-bold text-white">Belum ada musim tanam aktif</p>
              <p className="text-xs text-emerald-200/80 mt-0.5">
                Mulai catat musim tanam baru untuk mengaktifkan pemantauan HST dan saran agronomi.
              </p>
            </div>
            {onStartSeason && (
              <button
                type="button"
                onClick={() => onStartSeason(land.id)}
                className="px-4 py-2.5 min-h-[48px] bg-[#D4AF37] hover:bg-[#b89327] active:bg-[#9c7b1e] text-slate-900 font-bold rounded-xl text-xs transition-colors shadow-md shrink-0 flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-4 h-4 text-slate-900" />
                <span>Mulai Musim Tanam</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
