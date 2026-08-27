/**
 * HIKMAT TANI - Modal Rincian Varietas Padi Unggul
 * 
 * Menampilkan:
 * - Umur tanaman & potensi hasil panen
 * - Profil ketahanan hama/penyakit (HDB, Blas, Wereng Coklat)
 * - Kesesuaian ekosistem sawah
 * - Kontekstual status tanam aktif petani
 * - Rujukan deskripsi varietas resmi (BBPadi / BRIN)
 */

import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Info,
  MapPin,
  Shield,
  ShieldCheck,
  Sprout,
  TrendingUp,
  Wheat,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal.tsx';
import { CropSeason, Land, Reference, RiceVariety } from '../../types/index.ts';
import { ReferenceBadge } from './ReferenceBadge.tsx';

interface VarietyDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  variety: RiceVariety | null;
  activeSeasons?: CropSeason[];
  lands?: Land[];
  allReferences?: Reference[];
}

export function VarietyDetailModal({
  isOpen,
  onClose,
  variety,
  activeSeasons = [],
  lands = [],
  allReferences = [],
}: VarietyDetailModalProps) {
  if (!isOpen || !variety) return null;

  // Cari apakah petani sedang menanam varietas ini di lahan aktif
  const plantedInSeasons = activeSeasons.filter(
    (s) =>
      s.status === 'ACTIVE' &&
      (s.varietyId === variety.id ||
        s.varietyName.toLowerCase() === variety.name.toLowerCase())
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={variety.name}
      subtitle="Deskripsi & Profil Agronomi Varietas"
    >
      <div className="space-y-4">
        {/* Banner Jika Sedang Ditanam di Lahan Petani */}
        {plantedInSeasons.length > 0 && (
          <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-300 space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-950 font-bold text-xs">
              <Sprout className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Sedang Aktif Anda Tanam Saat Ini:</span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-emerald-900 font-semibold">
              {plantedInSeasons.map((season) => {
                const land = lands.find((l) => l.id === season.landId);
                const plantingDate = new Date(season.plantingDate);
                const diffDays = Math.max(
                  0,
                  Math.floor(
                    (Date.now() - plantingDate.getTime()) / (1000 * 60 * 60 * 24)
                  )
                );
                return (
                  <span
                    key={season.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white rounded-lg border border-emerald-200 shadow-2xs"
                  >
                    <MapPin className="w-3 h-3 text-emerald-700" />
                    <strong>{land?.name || 'Petak Sawah'}</strong> ({diffDays} HST)
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Info Cepat: Umur & Potensi Hasil */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase block flex items-center justify-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              Umur Panen Rata-rata
            </span>
            <span className="text-xl font-black text-slate-900">
              ~{variety.growthDurationDays} <span className="text-xs font-bold text-slate-500">Hari</span>
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase block flex items-center justify-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-600" />
              Potensi Hasil
            </span>
            <span className="text-xl font-black text-emerald-900">
              {(variety.potentialYieldKgHa / 1000).toFixed(1)}{' '}
              <span className="text-xs font-bold text-slate-500">ton/ha</span>
            </span>
          </div>
        </div>

        {/* Alias / Nama Pasar */}
        {variety.aliases && variety.aliases.length > 0 && (
          <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-600">Nama Populer / Pasar:</span>
            <div className="flex flex-wrap gap-1">
              {variety.aliases.map((alias) => (
                <span
                  key={alias}
                  className="px-2 py-0.5 bg-slate-100 font-bold text-slate-800 rounded border border-slate-200 text-[11px]"
                >
                  {alias}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Profil Ketahanan Hama & Penyakit */}
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-2 shadow-xs">
          <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            Profil Ketahanan Cekaman (Biotik / Abiotik):
          </span>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
            {variety.resistanceProfile || 'Tahan rebah dan adaptif pada sawah irigasi.'}
          </p>
        </div>

        {/* Rekomendasi Agroekosistem */}
        <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200/80 text-xs text-emerald-950 space-y-1">
          <span className="font-bold block flex items-center gap-1.5 text-emerald-900">
            <Wheat className="w-4 h-4 text-emerald-700" />
            Kesesuaian Agroekosistem & Tipologi Lahan:
          </span>
          <p className="leading-relaxed text-emerald-900">
            Sangat baik ditanam pada sawah irigasi teknis dataran rendah hingga menengah (ketinggian 0-600 mdpl). Gunakan sistem tanam Jajar Legowo untuk memaksimalkan anakan produktif.
          </p>
        </div>

        {/* Rujukan Ilmiah */}
        <div className="pt-2 border-t border-slate-100">
          <ReferenceBadge
            referenceId={variety.referenceId}
            allReferences={allReferences}
          />
        </div>

        {/* Tombol Tutup */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] bg-slate-800 hover:bg-slate-900 active:bg-black text-white font-bold text-xs rounded-xl transition-colors"
          >
            Tutup Informasi
          </button>
        </div>
      </div>
    </Modal>
  );
}
