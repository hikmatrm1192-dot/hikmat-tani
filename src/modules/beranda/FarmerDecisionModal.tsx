/**
 * HIKMAT TANI - Farmer Decision Modal (Tiga Jalur Keputusan)
 * 
 * Prinsip:
 * 1. REKOMENDASI SISTEM: Saran santun berbasis aturan agronomi & rujukan ilmiah.
 * 2. KEPUTUSAN PETANI: Petani adalah pengambil keputusan tertinggi (Mengikuti / Menyesuaikan / Tidak Mengikuti / Cara Lain).
 * 3. TINDAKAN AKTUAL: Rekaman kegiatan nyata di lapangan yang dicatat secara objektif.
 */

import { useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  ShieldCheck,
  Sliders,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal.tsx';
import { recommendationRepository } from '../../db/repositories/recommendationRepository.ts';
import { EvaluatedRecommendation } from '../../engine/recommendation/types.ts';
import {
  ActivityCategory,
  CropSeason,
  FarmerDecision,
  FarmerDecisionChoice,
  Land,
} from '../../types/index.ts';

interface FarmerDecisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  recommendation: EvaluatedRecommendation | null;
  land: Land | null;
  cropSeason: CropSeason | null;
  onDecisionSaved: (decisionId: string, choice: FarmerDecisionChoice, suggestedCategory?: ActivityCategory) => void;
}

export function FarmerDecisionModal({
  isOpen,
  onClose,
  recommendation,
  land,
  cropSeason,
  onDecisionSaved,
}: FarmerDecisionModalProps) {
  const [selectedChoice, setSelectedChoice] = useState<FarmerDecisionChoice>('ACCEPT');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !recommendation || !cropSeason) return null;

  const getSuggestedCategory = (): ActivityCategory => {
    switch (recommendation.contextType) {
      case 'FERTILIZER':
        return 'FERTILIZER';
      case 'OPT_CONTROL':
        return 'OPT';
      case 'WATER_MANAGEMENT':
        return 'IRRIGATION';
      case 'GROWTH_STAGE':
        return 'MAINTENANCE';
      default:
        return 'MAINTENANCE';
    }
  };

  const handleSaveDecision = async (proceedToActualAction: boolean) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const now = new Date().toISOString();
      const decisionId = `dec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const farmerDecision: FarmerDecision = {
        id: decisionId,
        cropSeasonId: cropSeason.id,
        recommendationId: recommendation.id,
        decision: selectedChoice,
        notes: notes.trim() || undefined,
        createdAt: now,
      };

      await recommendationRepository.recordFarmerDecision(farmerDecision);

      onDecisionSaved(
        decisionId,
        selectedChoice,
        proceedToActualAction ? getSuggestedCategory() : undefined
      );
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Gagal menyimpan keputusan petani');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tiga Jalur Keputusan"
      subtitle={`Saran Sistem • Keputusan Petani • Tindakan Aktual (${land?.name || 'Sawah'})`}
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ============================================================ */}
        {/* JALUR 1: REKOMENDASI SISTEM (SARAN HIKMAT TANI) */}
        {/* ============================================================ */}
        <div className="p-4 bg-amber-50/70 border border-amber-200/90 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                <Lightbulb className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                1. Saran HIKMAT TANI
              </span>
            </div>
            <span className="text-[10px] text-amber-800 font-semibold px-2 py-0.5 bg-amber-100/70 rounded-full">
              Bahan Pertimbangan
            </span>
          </div>

          <h4 className="text-sm font-bold text-amber-950">{recommendation.title}</h4>
          <p className="text-xs sm:text-sm text-slate-800 leading-relaxed">
            {recommendation.message}
          </p>

          <div className="pt-2 border-t border-amber-200/60 text-[11px] text-slate-600 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>
              Dasar: <strong className="text-slate-700">{recommendation.basis}</strong>
            </span>
          </div>
        </div>

        {/* ============================================================ */}
        {/* JALUR 2: KEPUTUSAN PETANI */}
        {/* ============================================================ */}
        <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
              2. Apa Keputusan Anda?
            </span>
            <span className="text-[11px] text-emerald-800 font-bold">
              Hak Penuh Petani
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Opsi 1: Mengikuti Saran */}
            <button
              type="button"
              onClick={() => setSelectedChoice('ACCEPT')}
              className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all min-h-[52px] ${
                selectedChoice === 'ACCEPT'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-1 ring-emerald-500'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center mt-0.5 shrink-0 ${
                  selectedChoice === 'ACCEPT'
                    ? 'bg-emerald-600 text-white'
                    : 'border border-slate-300'
                }`}
              >
                {selectedChoice === 'ACCEPT' && <Check className="w-3 h-3" />}
              </div>
              <div>
                <span className="text-xs font-bold block">Mengikuti Saran</span>
                <span className="text-[10px] text-slate-500">
                  Melaksanakan sesuai anjuran sistem
                </span>
              </div>
            </button>

            {/* Opsi 2: Menyesuaikan */}
            <button
              type="button"
              onClick={() => setSelectedChoice('ADJUST')}
              className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all min-h-[52px] ${
                selectedChoice === 'ADJUST'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-1 ring-emerald-500'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center mt-0.5 shrink-0 ${
                  selectedChoice === 'ADJUST'
                    ? 'bg-emerald-600 text-white'
                    : 'border border-slate-300'
                }`}
              >
                {selectedChoice === 'ADJUST' && <Check className="w-3 h-3" />}
              </div>
              <div>
                <span className="text-xs font-bold block">Menyesuaikan</span>
                <span className="text-[10px] text-slate-500">
                  Mengubah dosis, waktu, atau teknik
                </span>
              </div>
            </button>

            {/* Opsi 3: Tidak Mengikuti */}
            <button
              type="button"
              onClick={() => setSelectedChoice('REJECT')}
              className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all min-h-[52px] ${
                selectedChoice === 'REJECT'
                  ? 'bg-amber-50 border-amber-500 text-amber-950 ring-1 ring-amber-500'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center mt-0.5 shrink-0 ${
                  selectedChoice === 'REJECT'
                    ? 'bg-amber-600 text-white'
                    : 'border border-slate-300'
                }`}
              >
                {selectedChoice === 'REJECT' && <Check className="w-3 h-3" />}
              </div>
              <div>
                <span className="text-xs font-bold block">Tidak Mengikuti</span>
                <span className="text-[10px] text-slate-500">
                  Kondisi lapangan belum membutuhkan
                </span>
              </div>
            </button>

            {/* Opsi 4: Cara Lain */}
            <button
              type="button"
              onClick={() => setSelectedChoice('ALTERNATIVE')}
              className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all min-h-[52px] ${
                selectedChoice === 'ALTERNATIVE'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-1 ring-emerald-500'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center mt-0.5 shrink-0 ${
                  selectedChoice === 'ALTERNATIVE'
                    ? 'bg-emerald-600 text-white'
                    : 'border border-slate-300'
                }`}
              >
                {selectedChoice === 'ALTERNATIVE' && <Check className="w-3 h-3" />}
              </div>
              <div>
                <span className="text-xs font-bold block">Cara / Bahan Lain</span>
                <span className="text-[10px] text-slate-500">
                  Memakai kearifan lokal atau cara lain
                </span>
              </div>
            </button>
          </div>

          {/* Catatan Alasan / Pertimbangan */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Catatan Alasan Pertimbangan Anda (Opsional):
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Disesuaikan karena cuaca hujan deras / pupuk stok terbatas..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[40px]"
            />
          </div>
        </div>

        {/* ============================================================ */}
        {/* JALUR 3: TINDAKAN AKTUAL */}
        {/* ============================================================ */}
        <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-950">
              3. Apa Yang Benar-Benar Dilakukan?
            </span>
            <span className="text-[10px] text-emerald-800 font-semibold">
              Rekaman Riil Lapangan
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Catat tindakan nyata yang Anda lakukan di petak sawah agar tersimpan dalam riwayat budidaya.
          </p>
        </div>

        {/* Tombol Simpan & Navigasi Tindakan */}
        <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() => handleSaveDecision(false)}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors text-center"
          >
            Simpan Keputusan Saja
          </button>

          <button
            type="button"
            onClick={() => handleSaveDecision(true)}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center justify-center gap-1.5"
          >
            <span>Simpan & Catat Tindakan Aktual</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
