/**
 * HIKMAT TANI - Season Detail Modal
 * 
 * Menampilkan detail lengkap musim tanam aktif:
 * - Komoditas, varietas, tanggal tanam, luas tanam, sistem tanam
 * - HST dan fase pertumbuhan fenologi terperinci
 */

import React, { useState } from 'react';
import { Calendar, CheckCircle2, CheckSquare, Layers, MapPin, Sparkles, Sprout, Wheat } from 'lucide-react';
import { Modal } from '../../components/common/Modal.tsx';
import { cropSeasonRepository } from '../../db/repositories/cropSeasonRepository.ts';
import { determineGrowthPhase } from '../../engine/growthPhase.ts';
import { calculateHST } from '../../engine/hstCalculator.ts';
import { CropSeason, Land } from '../../types/index.ts';

interface SeasonDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  land: Land | null;
  season: CropSeason | null;
  varietyDurationDays?: number | null;
  onSeasonUpdated?: () => Promise<void>;
}

export function SeasonDetailModal({
  isOpen,
  onClose,
  land,
  season,
  varietyDurationDays = 120,
  onSeasonUpdated,
}: SeasonDetailModalProps) {
  const [isCompleting, setIsCompleting] = useState<boolean>(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState<boolean>(false);
  const [yieldInput, setYieldInput] = useState<string>('');

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

  const handleCompleteSeason = async () => {
    setIsCompleting(true);
    try {
      const numYield = parseFloat(yieldInput) || undefined;
      await cropSeasonRepository.update(season.id, {
        status: 'COMPLETED',
        harvestDate: new Date().toISOString(),
        yieldKg: numYield && numYield > 0 ? numYield : undefined,
      });
      if (onSeasonUpdated) {
        await onSeasonUpdated();
      }
      setShowCompleteConfirm(false);
      onClose();
    } catch (err) {
      console.error('Gagal menyelesaikan musim tanam:', err);
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Rincian Musim Tanam"
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
              <span>{season.status === 'ACTIVE' ? 'Musim Aktif' : 'Selesai / Riwayat'}</span>
            </span>
          </div>
        </div>

        {/* Konfirmasi Selesaikan Musim Tanam */}
        {showCompleteConfirm ? (
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-3">
            <div className="flex items-center gap-2">
              <Wheat className="w-5 h-5 text-amber-700 shrink-0" />
              <div>
                <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                  Selesaikan Musim Tanam Ini (Panen)?
                </h4>
                <p className="text-[11px] text-slate-600">
                  Status musim akan diubah menjadi selesai dan diarsipkan ke riwayat.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Perkiraan Hasil Panen Gabah (kg, opsional):
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={yieldInput}
                onChange={(e) => setYieldInput(e.target.value)}
                placeholder="Contoh: 3200"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCompleteConfirm(false)}
                disabled={isCompleting}
                className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors min-h-[40px]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCompleteSeason}
                disabled={isCompleting}
                className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold transition-colors min-h-[40px] shadow-xs"
              >
                {isCompleting ? 'Menyimpan...' : 'Ya, Selesaikan Musim'}
              </button>
            </div>
          </div>
        ) : null}

        {/* Footer Action */}
        <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
          {season.status === 'ACTIVE' && !showCompleteConfirm ? (
            <button
              type="button"
              onClick={() => setShowCompleteConfirm(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[44px] text-amber-900 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 border border-amber-300 font-bold rounded-xl text-xs transition-colors"
            >
              <Wheat className="w-4 h-4 text-amber-700" />
              <span>Selesaikan Musim (Panen)</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 min-h-[44px] bg-slate-800 hover:bg-slate-900 active:bg-black text-white font-bold rounded-xl text-xs transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </Modal>
  );
}
