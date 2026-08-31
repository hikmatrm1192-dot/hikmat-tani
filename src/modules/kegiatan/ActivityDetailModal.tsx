/**
 * HIKMAT TANI - Activity Detail Modal
 * 
 * Menampilkan rincian lengkap dari suatu catatan kegiatan lapang:
 * - Data waktu (Tanggal & Snapshot HST)
 * - Detail spesifik (Hara pupuk, Gejala OPT, Kondisi Pengairan, Jenis Perawatan, Hasil Panen)
 * - Tautan ke Tiga Jalur Keputusan (jika ada saran & keputusan terkait)
 * - Aksi hapus catatan dengan konfirmasi aman
 */

import { useState, useMemo } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Bug,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Droplets,
  FlaskConical,
  HelpCircle,
  Lightbulb,
  Scissors,
  ShieldCheck,
  Sparkles,
  Sprout,
  Trash2,
  Wheat,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal.tsx';
import { activityRepository } from '../../db/repositories/activityRepository.ts';
import { SEED_OPTS } from '../../db/seedData.ts';
import {
  matchOptRelevance,
  type OptRelevanceMatch,
} from '../../engine/optRelevanceEngine.ts';
import {
  Activity,
  ActivityCategory,
  AttackLocation,
  CropSeason,
  FertilizerApplication,
  Land,
  Opt,
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
  opts?: Opt[];
  onDeleted?: () => void;
  onNavigateToKnowledge?: (
    category: 'opt' | 'pupuk' | 'musuh_alami' | 'varietas' | 'panduan',
    itemId?: string,
    searchQuery?: string
  ) => void;
}

interface OptDetailCardProps {
  obs: OptObservation;
  activityHst: number;
  opts: Opt[];
  onCloseModal: () => void;
  onNavigateToKnowledge?: (
    category: 'opt' | 'pupuk' | 'musuh_alami' | 'varietas' | 'panduan',
    itemId?: string,
    searchQuery?: string
  ) => void;
}

function OptObservationDetailCard({
  obs,
  activityHst,
  opts,
  onCloseModal,
  onNavigateToKnowledge,
}: OptDetailCardProps) {
  const [expandedPhtOptId, setExpandedPhtOptId] = useState<string | null>(null);
  const [expandedChemicalOptId, setExpandedChemicalOptId] = useState<string | null>(null);
  const [showAllCandidates, setShowAllCandidates] = useState<boolean>(false);

  const relevanceMatches = useMemo(() => {
    const availableOpts = opts && opts.length > 0 ? opts : SEED_OPTS;
    const isUnknown = !obs.optId || obs.optId === 'UNKNOWN_OPT';
    let query = '';
    if (!isUnknown) {
      const selected = availableOpts.find((o) => o.id === obs.optId);
      query = selected ? selected.commonName : (obs.customOptName || '');
    } else {
      query = `${obs.customOptName || ''} ${obs.observedSymptoms || ''}`.trim();
    }

    return matchOptRelevance(availableOpts, query, {
      attackLocations: obs.attackLocation || [],
      visualTokens: obs.visualClues || [],
    });
  }, [obs, opts]);

  return (
    <div className="space-y-3 text-xs">
      {/* 1. Ringkasan Pengamatan Aktual */}
      <div className="p-3.5 bg-white rounded-2xl border border-amber-200/80 space-y-3 shadow-2xs">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <span className="font-bold text-slate-900 text-sm block">
              {obs.customOptName || 'Pengamatan Gejala OPT'}
            </span>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                {obs.identificationMethod === 'AI_IMAGE_CAPTURE'
                  ? '📷 AI Image Capture (On-Device)'
                  : obs.identificationMethod === 'MANUAL_LIST'
                  ? '📋 Master Terdaftar'
                  : '🔍 Catatan Gejala Lapang'}
              </span>

              {obs.confidenceLevel && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    obs.confidenceLevel === 'HIGH'
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      : obs.confidenceLevel === 'MODERATE'
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-slate-100 text-slate-800 border-slate-300'
                  }`}
                >
                  Keyakinan: {obs.confidenceLevel === 'HIGH' ? 'Tinggi' : obs.confidenceLevel === 'MODERATE' ? 'Mendekati' : 'Belum Pasti'}
                </span>
              )}
            </div>
          </div>

          <span
            className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase shrink-0 ${
              obs.attackSeverity === 'HEAVY'
                ? 'bg-red-100 text-red-800 border border-red-200'
                : obs.attackSeverity === 'MEDIUM'
                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
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
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-400 block font-bold">Gejala Diamati:</span>
            <p className="text-slate-700 mt-0.5 leading-relaxed">{obs.observedSymptoms}</p>
          </div>
        )}

        {/* Hasil Analisis AI Image Capture & Ciri Visual */}
        {((obs.detectedTraits && obs.detectedTraits.length > 0) ||
          (obs.visualClues && obs.visualClues.length > 0) ||
          obs.photoAnalysisNotes) && (
          <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                <span>Hasil Analisis Foto (On-Device):</span>
              </span>
            </div>

            {obs.detectedTraits && obs.detectedTraits.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-amber-900 block">Ciri Visual Terdeteksi:</span>
                <div className="flex flex-wrap gap-1">
                  {obs.detectedTraits.map((trait, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 bg-white text-amber-950 border border-amber-300 rounded-md text-[10px] font-medium shadow-2xs"
                    >
                      {trait}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {obs.visualClues && obs.visualClues.length > 0 && (
              <ul className="space-y-1 pt-1 border-t border-amber-200/60">
                {obs.visualClues.map((clue, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-1.5 text-[11px] text-slate-700 font-medium leading-relaxed"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 shrink-0" />
                    <span>{clue}</span>
                  </li>
                ))}
              </ul>
            )}

            {obs.photoAnalysisNotes && (
              <p className="text-[11px] text-amber-900/80 italic pt-1 border-t border-amber-200/60">
                {obs.photoAnalysisNotes}
              </p>
            )}

            <div className="pt-1 text-[10px] text-slate-500 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
              <span>Privasi Terjaga: Foto hanya dianalisis sementara di HP dan tidak disimpan ke server/database.</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. RUJUKAN PALING RELEVAN BERDASARKAN PENGAMATAN INI */}
      <div className="space-y-3 pt-1">
        {relevanceMatches.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                <span>Rujukan Paling Relevan ({relevanceMatches.length} Ditemukan)</span>
              </h4>
              <span className="text-[10px] text-slate-500">
                {relevanceMatches[0]?.isExactMatch ? 'Kecocokan Master' : 'Bahan Pembanding'}
              </span>
            </div>

            {/* Kandidat Utama (Top Candidate) & Tambahan */}
            {relevanceMatches.slice(0, showAllCandidates ? undefined : 1).map((match, idx) => {
              const isExpandedPht = expandedPhtOptId === match.opt.id || (!showAllCandidates && idx === 0 && expandedPhtOptId === null);
              const isExpandedChem = expandedChemicalOptId === match.opt.id;

              return (
                <div
                  key={match.opt.id}
                  className={`p-4 rounded-2xl border transition-all space-y-3 shadow-xs ${
                    idx === 0
                      ? 'bg-white border-amber-400 ring-1 ring-amber-300'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h5 className="text-sm font-bold text-slate-900">
                          {match.opt.commonName}
                        </h5>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            match.isExactMatch
                              ? 'bg-emerald-100 text-emerald-950'
                              : 'bg-amber-100 text-amber-950'
                          }`}
                        >
                          {match.relevanceLabel}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 italic block mt-0.5">
                        {match.opt.scientificName}
                      </span>
                    </div>
                  </div>

                  {/* Alasan Kemiripan & Detail Gejala Cocok */}
                  <div className="p-2.5 bg-amber-50/60 rounded-xl text-xs space-y-1.5 border border-amber-200/70">
                    <div className="text-amber-950 font-semibold leading-relaxed">
                      {match.similarityReason}
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {match.matchedSymptoms.map((sym, i) => (
                        <span
                          key={i}
                          className="text-[10px] bg-white text-slate-700 px-2 py-0.5 rounded-md border border-amber-200 font-medium"
                        >
                          Gejala: {sym}
                        </span>
                      ))}
                      {match.matchedLocations.map((loc, i) => (
                        <span
                          key={i}
                          className="text-[10px] bg-white text-slate-700 px-2 py-0.5 rounded-md border border-amber-200 font-medium"
                        >
                          Bagian: {loc}
                        </span>
                      ))}
                      {match.matchedVisualClues.map((vClue, i) => (
                        <span
                          key={i}
                          className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md border border-amber-300 font-medium"
                        >
                          Visual: {vClue}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* PHT / PENANGANAN NON-KIMIA TERLEBIH DAHULU (4 PILAR PHT) */}
                  <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-2">
                    <div
                      onClick={() => setExpandedPhtOptId(isExpandedPht ? 'NONE' : match.opt.id)}
                      className="flex items-center justify-between cursor-pointer"
                    >
                      <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-700" />
                        <span>Panduan PHT & Penanganan Non-Kimia (4 Pilar PHT)</span>
                      </span>
                      <button type="button" className="text-emerald-800 p-1">
                        {isExpandedPht ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>

                    {isExpandedPht && (
                      <div className="space-y-2 pt-2 border-t border-emerald-200 text-xs">
                        {match.phtSteps.map((step) => (
                          <div
                            key={step.stepNumber}
                            className="p-2 bg-white rounded-lg border border-emerald-100 space-y-0.5"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-4 h-4 rounded-full bg-emerald-700 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                {step.stepNumber}
                              </span>
                              <span className="text-[11px] font-bold text-slate-800">
                                {step.actionTitle}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 pl-6 leading-relaxed">
                              {step.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* PILIHAN PENGENDALIAN KIMIA (OPSI LANJUTAN) */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div
                      onClick={() => setExpandedChemicalOptId(isExpandedChem ? null : match.opt.id)}
                      className="flex items-center justify-between cursor-pointer"
                    >
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <FlaskConical className="w-4 h-4 text-slate-500" />
                        <span>Pilihan Pengendalian Kimia (Opsi Lanjutan)</span>
                      </span>
                      <button type="button" className="text-slate-600 p-1">
                        {isExpandedChem ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>

                    {isExpandedChem && (
                      <div className="space-y-2 pt-2 border-t border-slate-200 text-xs">
                        {match.chemicalOptions.hasChemicalData ? (
                          <div className="space-y-2">
                            <div>
                              <span className="text-[11px] font-bold text-slate-700 block mb-1">
                                Bahan Aktif Terdaftar di Pustaka:
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {match.chemicalOptions.activeIngredients.map((ing, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-semibold text-slate-800"
                                  >
                                    {ing}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {match.chemicalOptions.resistanceNotes && (
                              <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 text-[11px] text-amber-900">
                                <strong>Catatan Resistensi:</strong> {match.chemicalOptions.resistanceNotes}
                              </div>
                            )}

                            <p className="text-[10px] text-slate-500 leading-relaxed italic">
                              {match.chemicalOptions.cautionaryNotice}
                            </p>
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-500">
                            Belum ada catatan bahan aktif khusus. Utamakan penanganan budidaya non-kimia dan konsultasikan dengan petugas POPT setempat.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Tombol Lihat Panduan Lengkap PHT */}
                  {onNavigateToKnowledge && (
                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          onCloseModal();
                          onNavigateToKnowledge('opt', match.opt.id);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 hover:underline min-h-[36px]"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Buka Panduan Lengkap di Pustaka PHT</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Tombol Bandingkan dengan Rujukan Lain */}
            {relevanceMatches.length > 1 && (
              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => setShowAllCandidates(!showAllCandidates)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-amber-900 bg-amber-100/80 hover:bg-amber-200 px-4 py-2 rounded-xl transition-colors min-h-[40px]"
                >
                  <span>
                    {showAllCandidates
                      ? 'Tampilkan Rujukan Teratas Saja'
                      : `Bandingkan dengan ${relevanceMatches.length - 1} Rujukan Lain`}
                  </span>
                  {showAllCandidates ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-2 text-xs text-slate-600 shadow-2xs">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-slate-500" />
              <span>Belum ditemukan rujukan yang cukup dekat</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Saran pengamatan tambahan:
            </p>
            <ul className="list-disc list-inside text-[11px] space-y-0.5 text-slate-600 pl-1">
              <li>Periksa bagian pangkal batang di dekat permukaan air sawah.</li>
              <li>Periksa apakah ada kelompok telur atau keberadaan serangga kecil di bawah daun.</li>
              <li>Sertakan foto tanaman yang lebih jelas atau perbarui catatan gejala bebas.</li>
            </ul>
            {onNavigateToKnowledge && (
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    onCloseModal();
                    const query = obs.observedSymptoms || obs.customOptName || obs.attackLocation?.[0] || '';
                    onNavigateToKnowledge('opt', undefined, query);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 hover:text-amber-950 hover:underline"
                >
                  <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                  <span>Cari Gejala di Pustaka PHT</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ActivityDetailModal({
  isOpen,
  onClose,
  activity,
  land,
  cropSeason,
  fertilizerApps = [],
  optObs = [],
  opts = [],
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
          <div className="space-y-3 p-3.5 bg-amber-50/50 rounded-2xl border border-amber-200/80">
            <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
              Rincian Pengamatan OPT
            </h4>
            {optObs.map((obs) => (
              <OptObservationDetailCard
                key={obs.id}
                obs={obs}
                activityHst={activity.hst || 0}
                opts={opts}
                onCloseModal={onClose}
                onNavigateToKnowledge={onNavigateToKnowledge}
              />
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
