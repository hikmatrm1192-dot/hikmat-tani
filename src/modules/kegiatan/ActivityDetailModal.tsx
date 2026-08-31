/**
 * HIKMAT TANI - Activity Detail Modal
 * 
 * Menampilkan rincian lengkap dari suatu catatan kegiatan lapang:
 * - Data waktu (Tanggal & Snapshot HST)
 * - Detail spesifik (Hara pupuk, Gejala OPT, Kondisi Pengairan, Jenis Perawatan, Hasil Panen)
 * - Tautan ke Tiga Jalur Keputusan (jika ada saran & keputusan terkait)
 * - Aksi hapus catatan dengan konfirmasi aman
 */

import { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Bug,
  Calendar,
  CheckCircle2,
  Clock,
  Droplets,
  FlaskConical,
  HelpCircle,
  Lightbulb,
  Scissors,
  Sprout,
  Trash2,
  Wheat,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal.tsx';
import { activityRepository } from '../../db/repositories/activityRepository.ts';
import {
  Activity,
  ActivityCategory,
  CropSeason,
  FertilizerApplication,
  Land,
  OptObservation,
} from '../../types/index.ts';

interface ActivityDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: Activity | null;
  land: Land | null;
  cropSeason: CropSeason | null;
  fertilizerApps?: FertilizerApplication[];
  optObs?: OptObservation[];
  onDeleted?: () => void;
  onNavigateToKnowledge?: (
    category: 'opt' | 'pupuk' | 'musuh_alami' | 'varietas' | 'panduan',
    itemId?: string,
    searchQuery?: string
  ) => void;
}

export function ActivityDetailModal({
  isOpen,
  onClose,
  activity,
  land,
  cropSeason,
  fertilizerApps = [],
  optObs = [],
  onDeleted,
  onNavigateToKnowledge,
}: ActivityDetailModalProps) {
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);

  if (!isOpen || !activity) return null;

  const getCategoryInfo = (cat: ActivityCategory) => {
    switch (cat) {
      case 'PLANTING':
        return {
          label: 'Tanam Padi',
          icon: <Sprout className="w-5 h-5" />,
          color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        };
      case 'FERTILIZER':
        return {
          label: 'Pemupukan',
          icon: <FlaskConical className="w-5 h-5" />,
          color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        };
      case 'IRRIGATION':
        return {
          label: 'Pengairan',
          icon: <Droplets className="w-5 h-5" />,
          color: 'bg-sky-100 text-sky-800 border-sky-200',
        };
      case 'OPT':
        return {
          label: 'Pengamatan OPT / Hama',
          icon: <Bug className="w-5 h-5" />,
          color: 'bg-amber-100 text-amber-800 border-amber-200',
        };
      case 'MAINTENANCE':
        return {
          label: 'Perawatan / Penyiangan',
          icon: <Scissors className="w-5 h-5" />,
          color: 'bg-teal-100 text-teal-800 border-teal-200',
        };
      case 'HARVEST':
        return {
          label: 'Panen Padi',
          icon: <Wheat className="w-5 h-5" />,
          color: 'bg-yellow-100 text-yellow-900 border-yellow-300',
        };
      default:
        return {
          label: 'Kegiatan Lapang',
          icon: <CheckCircle2 className="w-5 h-5" />,
          color: 'bg-slate-100 text-slate-800 border-slate-200',
        };
    }
  };

  const catInfo = getCategoryInfo(activity.category);
  const formattedDate = new Date(activity.activityDate).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setIsDeleting(true);
    try {
      await activityRepository.delete(activity.id);
      if (onDeleted) onDeleted();
      onClose();
    } catch (err) {
      console.error('Gagal menghapus kegiatan:', err);
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Rincian Kegiatan Lapang"
      subtitle={`${land?.name || 'Petak Sawah'} • ${cropSeason?.varietyName || 'Padi'}`}
    >
      <div className="space-y-4">
        {/* Header Kategori & HST */}
        <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${catInfo.color}`}>
              {catInfo.icon}
            </div>
            <div>
              <span className="text-sm font-bold text-slate-900 block">{catInfo.label}</span>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formattedDate}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-900 text-xs font-black rounded-full border border-emerald-300">
              {activity.hst} HST
            </span>
          </div>
        </div>

        {/* Detail Khusus Pemupukan */}
        {activity.category === 'FERTILIZER' && fertilizerApps.length > 0 && (
          <div className="space-y-2.5 p-3.5 bg-emerald-50/50 rounded-2xl border border-emerald-200/80">
            <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
              Rincian Aplikasi Pupuk
            </h4>
            {fertilizerApps.map((fa) => (
              <div key={fa.id} className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-sm">{fa.fertilizerName}</span>
                  <span className="font-black text-emerald-800 text-sm">{fa.amountKg} kg</span>
                </div>
                <div className="text-slate-600">
                  Metode: <strong className="text-slate-800">{fa.applicationMethod || 'Tabur Merata'}</strong>
                </div>

                {fa.calculatedNutrients && (
                  <div className="pt-2 border-t border-emerald-200/60">
                    <span className="text-[11px] font-bold text-emerald-900 block mb-1">
                      Kandungan Hara Terhitung:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="p-2 bg-white rounded-lg border border-emerald-200 text-center">
                        <span className="text-[10px] text-slate-500 block">Nitrogen (N)</span>
                        <span className="font-bold text-slate-900">{fa.calculatedNutrients.N_kg?.toFixed(1) || 0} kg</span>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-emerald-200 text-center">
                        <span className="text-[10px] text-slate-500 block">Fosfat (P₂O₅)</span>
                        <span className="font-bold text-slate-900">{fa.calculatedNutrients.P2O5_kg?.toFixed(1) || 0} kg</span>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-emerald-200 text-center">
                        <span className="text-[10px] text-slate-500 block">Kalium (K₂O)</span>
                        <span className="font-bold text-slate-900">{fa.calculatedNutrients.K2O_kg?.toFixed(1) || 0} kg</span>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-emerald-200 text-center">
                        <span className="text-[10px] text-slate-500 block">Sulfur (S)</span>
                        <span className="font-bold text-slate-900">{fa.calculatedNutrients.S_kg?.toFixed(1) || 0} kg</span>
                      </div>
                    </div>
                  </div>
                )}

                {onNavigateToKnowledge && (
                  <div className="pt-2 border-t border-emerald-200/60 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onNavigateToKnowledge('pupuk', fa.fertilizerId);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:text-emerald-950 hover:underline"
                    >
                      <BookOpen className="w-3 h-3 text-emerald-600" />
                      <span>Lihat Rincian Pupuk {fa.fertilizerName}</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Detail Khusus OPT */}
        {activity.category === 'OPT' && optObs.length > 0 && (
          <div className="space-y-2.5 p-3.5 bg-amber-50/50 rounded-2xl border border-amber-200/80">
            <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
              Rincian Pengamatan OPT
            </h4>
            {optObs.map((obs) => (
              <div key={obs.id} className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">
                    {obs.customOptName || 'Pengamatan Gejala OPT'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      obs.attackSeverity === 'HEAVY'
                        ? 'bg-red-100 text-red-800'
                        : obs.attackSeverity === 'MEDIUM'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    Tingkat: {obs.attackSeverity}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
                  <div>
                    Bagian Terkena:{' '}
                    <strong className="text-slate-800">
                      {obs.attackLocation?.join(', ') || 'Daun'}
                    </strong>
                  </div>
                  {obs.attackPercentage && (
                    <div>
                      Intensitas Serangan:{' '}
                      <strong className="text-slate-800">{obs.attackPercentage}%</strong>
                    </div>
                  )}
                </div>

                {obs.observedSymptoms && (
                  <div className="p-2.5 bg-white rounded-xl border border-amber-200/80">
                    <span className="text-[10px] text-slate-400 block font-bold">Gejala Diamati:</span>
                    <p className="text-slate-700 mt-0.5">{obs.observedSymptoms}</p>
                  </div>
                )}

                {onNavigateToKnowledge && (
                  <div className="pt-2 border-t border-amber-200/60 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        if (obs.optId) {
                          onNavigateToKnowledge('opt', obs.optId);
                        } else {
                          const query = obs.observedSymptoms || obs.customOptName || obs.attackLocation?.[0] || '';
                          onNavigateToKnowledge('opt', undefined, query);
                        }
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 hover:text-amber-950 hover:underline"
                    >
                      <BookOpen className="w-3 h-3 text-amber-700" />
                      <span>
                        {obs.optId ? 'Buka Panduan PHT & Musuh Alami' : 'Cari Rujukan Gejala di Pustaka PHT'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Catatan / Keterangan Umum */}
        {activity.notes && (
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
            <span className="text-xs font-bold text-slate-700 block">Keterangan / Tindakan Lapang:</span>
            <p className="text-xs sm:text-sm text-slate-800 leading-relaxed">{activity.notes}</p>
          </div>
        )}

        {/* Tombol Aksi */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl text-xs font-bold transition-colors ${
              confirmDelete
                ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                : 'text-red-600 hover:bg-red-50'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span>{confirmDelete ? 'Yakin Hapus Catatan Ini?' : 'Hapus Catatan'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 min-h-[44px] bg-slate-800 hover:bg-slate-900 active:bg-black text-white font-bold text-xs rounded-xl transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </Modal>
  );
}
