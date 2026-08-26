/**
 * HIKMAT TANI - Season Detail Modal
 * 
 * Menampilkan detail lengkap musim tanam aktif:
 * - Komoditas, varietas, tanggal tanam, luas tanam, sistem tanam
 * - HST dan fase pertumbuhan fenologi terperinci
 */

import { Calendar, CheckCircle2, Layers, MapPin, Sparkles, Sprout } from 'lucide-react';
import { Modal } from '../../components/common/Modal.tsx';
import { determineGrowthPhase } from '../../engine/growthPhase.ts';
import { calculateHST } from '../../engine/hstCalculator.ts';
import { CropSeason, Land } from '../../types/index.ts';

interface SeasonDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  land: Land | null;
  season: CropSeason | null;
  varietyDurationDays?: number | null;
}

export function SeasonDetailModal({
  isOpen,
  onClose,
  land,
  season,
  varietyDurationDays = 120,
}: SeasonDetailModalProps) {
  if (!season || !land) return null;

  const hstResult = season.plantingDate
    ? calculateHST(season.plantingDate, new Date().toISOString())
    : { isValid: false, hst: null };

  const currentHst = hstResult.isValid && hstResult.hst !== null ? hstResult.hst : null;
  const growthPhase = determineGrowthPhase(currentHst, varietyDurationDays);

  const formattedPlantingDate = new Date(season.plantingDate).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Rincian Musim Tanam Aktif"
      subtitle={`Lahan: ${land.name} (${land.areaHa} ha)`}
    >
      <div className="space-y-4 text-xs sm:text-sm">
        {/* Status Box */}
        <div className="p-4 bg-emerald-900 text-white rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-300 font-medium">Fase Tanaman Saat Ini</span>
            <span className="px-2.5 py-0.5 bg-amber-400 text-emerald-950 font-bold rounded-full text-xs">
              {currentHst !== null ? `${currentHst} HST` : '-'}
            </span>
          </div>

          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {growthPhase.label}
            </h3>
            <p className="text-xs text-emerald-100/80 mt-1 leading-relaxed">
              {growthPhase.description}
            </p>
          </div>

          <div className="pt-2 border-t border-emerald-800 text-[11px] text-emerald-300 flex justify-between">
            <span>Varietas: {season.varietyName || 'Padi Sawah'}</span>
            <span>Estimasi Umur: {varietyDurationDays || 120} hari</span>
          </div>
        </div>

        {/* Spesifikasi Teknis */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 divide-y divide-slate-200/60">
          <div className="py-2 flex justify-between items-center">
            <span className="text-slate-500">Komoditas:</span>
            <span className="font-bold text-slate-800">{season.commodity}</span>
          </div>
          <div className="py-2 flex justify-between items-center">
            <span className="text-slate-500">Tanggal Tanam:</span>
            <span className="font-bold text-slate-800">{formattedPlantingDate}</span>
          </div>
          <div className="py-2 flex justify-between items-center">
            <span className="text-slate-500">Luas Tanam:</span>
            <span className="font-bold text-slate-800">
              {season.plantedAreaHa} ha ({(season.plantedAreaHa * 10000).toLocaleString('id-ID')} m²)
            </span>
          </div>
          <div className="py-2 flex justify-between items-center">
            <span className="text-slate-500">Sistem Tanam:</span>
            <span className="font-bold text-slate-800">
              {season.plantingSystem?.replace(/_/g, ' ') || 'Jajar Legowo 2:1'}
            </span>
          </div>
          <div className="py-2 flex justify-between items-center">
            <span className="text-slate-500">Status Musim:</span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Musim Aktif</span>
            </span>
          </div>
        </div>

        {/* Footer Action */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 min-h-[48px] bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-800 font-bold rounded-xl text-xs transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </Modal>
  );
}
