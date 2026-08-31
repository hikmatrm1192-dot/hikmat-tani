/**
 * HIKMAT TANI - Activity Form Modal (Pusat Pencatatan Kegiatan & Pengamatan OPT Terpadu)
 * 
 * Prinsip:
 * - "Catat sedikit, sistem yang mengolah lebih banyak."
 * - Progressive disclosure: Form sederhana, tidak membebani petani.
 * - 6 Kategori Kegiatan Utama:
 *   1. Tanam (PLANTING)
 *   2. Pupuk (FERTILIZER) -> hitung hara via nutrientEngine
 *   3. Pengairan (IRRIGATION)
 *   4. OPT (OPT) -> terintegrasi analisis foto, petunjuk visual, dan relevansi agronomi
 *   5. Perawatan (MAINTENANCE)
 *   6. Panen (HARVEST)
 * - Foto bukan alat diagnosis mutlak, melainkan data tambahan pencarian rujukan.
 * - Petani tetap menjadi pengambil keputusan lapang.
 * - PHT & musuh alami ditampilkan lebih dulu, bahan aktif kimia sebagai opsi lanjutan.
 */

import { useState, type FormEvent, useEffect, type ChangeEvent, useMemo } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Bug,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Droplets,
  Eye,
  FileText,
  FlaskConical,
  HelpCircle,
  Image as ImageIcon,
  Info,
  Leaf,
  Plus,
  Scissors,
  Search,
  ShieldCheck,
  Sparkles,
  Sprout,
  Trash2,
  UploadCloud,
  Wheat,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal.tsx';
import { calculateHST } from '../../engine/hstCalculator.ts';
import { calculateNutrients } from '../../engine/nutrientEngine.ts';
import { activityRepository } from '../../db/repositories/activityRepository.ts';
import { cropSeasonRepository } from '../../db/repositories/cropSeasonRepository.ts';
import { recommendationRepository } from '../../db/repositories/recommendationRepository.ts';
import { compressImage } from '../../utils/photoUtils.ts';
import {
  analyzePlantPhoto,
  type VisualAnalysisResult,
} from '../../engine/visualAnalysisEngine.ts';
import {
  matchOptRelevance,
  type OptRelevanceMatch,
} from '../../engine/optRelevanceEngine.ts';
import {
  Activity,
  ActivityCategory,
  ActualAction,
  AttackLocation,
  AttackSeverity,
  CropSeason,
  Fertilizer,
  FertilizerApplication,
  Land,
  Opt,
  OptObservation,
  RiceVariety,
} from '../../types/index.ts';

interface ActivityFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: ActivityCategory | null;
  land: Land | null;
  activeSeason: CropSeason | null;
  fertilizers: Fertilizer[];
  varieties?: RiceVariety[];
  opts?: Opt[];
  decisionId?: string; // Tautan jika dipicu dari Keputusan Petani
  onNavigateToKnowledge?: (
    category: 'opt' | 'pupuk' | 'musuh_alami' | 'varietas' | 'panduan',
    itemId?: string,
    searchQuery?: string
  ) => void;
  onSuccess: () => void;
}

export function ActivityFormModal({
  isOpen,
  onClose,
  initialCategory = null,
  land,
  activeSeason,
  fertilizers,
  varieties = [],
  opts = [],
  decisionId,
  onNavigateToKnowledge,
  onSuccess,
}: ActivityFormModalProps) {
  const [category, setCategory] = useState<ActivityCategory | null>(initialCategory);
  const [activityDate, setActivityDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // --- State Khusus Pupuk ---
  const [selectedFertId, setSelectedFertId] = useState<string>('');
  const [customFertName, setCustomFertName] = useState<string>('');
  const [amountKg, setAmountKg] = useState<string>('50');
  const [method, setMethod] = useState<string>('BROADCAST');

  // --- State Khusus OPT (Ramah Pemula & Berbasis Bukti Lapang) ---
  const [isUnknownOpt, setIsUnknownOpt] = useState<boolean>(true);
  const [selectedOptId, setSelectedOptId] = useState<string>('');
  const [customOptName, setCustomOptName] = useState<string>('');
  const [severity, setSeverity] = useState<AttackSeverity>('LIGHT');
  const [optLocation, setOptLocation] = useState<AttackLocation>('LEAF');
  const [symptomPreset, setSymptomPreset] = useState<string>('');
  const [optPhoto, setOptPhoto] = useState<string | null>(null);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState<boolean>(false);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState<boolean>(false);
  const [visualAnalysisResult, setVisualAnalysisResult] = useState<VisualAnalysisResult | null>(null);

  // --- Accordion & Toggle State untuk Rujukan Relevan ---
  const [showAllCandidates, setShowAllCandidates] = useState<boolean>(false);
  const [expandedPhtOptId, setExpandedPhtOptId] = useState<string | null>(null);
  const [expandedChemicalOptId, setExpandedChemicalOptId] = useState<string | null>(null);

  // --- State Sukses Pengamatan OPT ---
  const [submittedOptSummary, setSubmittedOptSummary] = useState<{
    optName: string;
    locationLabel: string;
    severityLabel: string;
    severity: AttackSeverity;
    symptoms: string;
    optId?: string;
    isUnknown: boolean;
    photo?: string | null;
    visualClues?: string[];
    topCandidateName?: string;
    topCandidateId?: string;
  } | null>(null);

  // --- State Khusus Pengairan ---
  const [waterCondition, setWaterCondition] = useState<string>('Macak-macak (1-2 cm - Fase Anakan)');

  // --- State Khusus Perawatan ---
  const [maintenanceType, setMaintenanceType] = useState<string>('Penyiangan Gulma (Matun)');
  const [maintenanceTool, setMaintenanceTool] = useState<string>('Manual Tangan & Gasrok');

  // --- State Khusus Panen ---
  const [harvestYieldKg, setHarvestYieldKg] = useState<string>('3500');
  const [grainCondition, setGrainCondition] = useState<string>('Kering Panen (GKP) Bernas');
  const [completeSeason, setCompleteSeason] = useState<boolean>(false);

  // --- State Khusus Tanam ---
  const [plantingSystem, setPlantingSystem] = useState<string>('JAJAR_LEGOWO_2_1');
  const [seedlingAgeDays, setSeedlingAgeDays] = useState<string>('18');

  useEffect(() => {
    if (isOpen) {
      setCategory(initialCategory);
      setActivityDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      setError(null);
      setOptPhoto(null);
      setVisualAnalysisResult(null);
      setIsCompressingPhoto(false);
      setIsAnalyzingPhoto(false);
      setShowAllCandidates(false);
      setExpandedPhtOptId(null);
      setExpandedChemicalOptId(null);
      setSubmittedOptSummary(null);
      if (fertilizers.length > 0) {
        setSelectedFertId(fertilizers[0].id);
      }
      if (opts.length > 0) {
        setSelectedOptId(opts[0].id);
      }
    }
  }, [isOpen, initialCategory, fertilizers, opts]);

  // Hitung snapshot HST berdasarkan tanggal aktivitas
  const hstResult = activeSeason?.plantingDate
    ? calculateHST(activeSeason.plantingDate, activityDate)
    : { isValid: true, hst: 0 };
  const hstSnapshot = hstResult.isValid && hstResult.hst !== null ? hstResult.hst : 0;

  // Kalkulasi Preview Hara Pupuk (Realtime)
  const selectedFert = fertilizers.find((f) => f.id === selectedFertId);
  const currentKg = parseFloat(amountKg) || 0;
  const nutrientPreview = selectedFert
    ? calculateNutrients(currentKg, selectedFert.nutrientComposition)
    : calculateNutrients(currentKg, null);

  // Fungsi kompresi dan analisis foto tanaman
  const handlePhotoUpload = async (file: File) => {
    if (!file) return;
    setIsCompressingPhoto(true);
    setIsAnalyzingPhoto(true);
    setError(null);
    try {
      const compressed = await compressImage(file, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.72,
      });
      setOptPhoto(compressed);
      setIsCompressingPhoto(false);

      // Jalankan visual analysis engine di client-side
      const analysis = await analyzePlantPhoto(compressed, optLocation);
      setVisualAnalysisResult(analysis);
    } catch (err) {
      console.warn('Gagal memproses foto tanaman:', err);
      setError('Gagal memproses foto. Anda tetap dapat melanjutkan pencatatan secara manual.');
    } finally {
      setIsCompressingPhoto(false);
      setIsAnalyzingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    setOptPhoto(null);
    setVisualAnalysisResult(null);
  };

  // Kalkulasi Rujukan Relevan & Kandidat OPT secara real-time
  const relevanceMatches = useMemo<OptRelevanceMatch[]>(() => {
    if (category !== 'OPT' || opts.length === 0) return [];

    let query = '';
    if (isUnknownOpt) {
      query = [customOptName, symptomPreset, notes].filter(Boolean).join(' ');
    } else {
      const target = opts.find((o) => o.id === selectedOptId);
      query = [target?.commonName, customOptName, symptomPreset, notes].filter(Boolean).join(' ');
    }

    const visualTokens = visualAnalysisResult?.detectedKeywords || [];
    const visualClues = visualAnalysisResult?.visualClues || [];

    return matchOptRelevance(opts, query, {
      attackLocations: [optLocation],
      visualTokens,
      visualClues,
      minScoreThreshold: 6,
    });
  }, [category, opts, isUnknownOpt, selectedOptId, customOptName, symptomPreset, notes, optLocation, visualAnalysisResult]);

  if (!isOpen || !land || !activeSeason) return null;

  const getTitle = () => {
    if (submittedOptSummary) return 'Pengamatan Telah Dicatat';
    if (!category) return 'Pilih Jenis Kegiatan Lapang';
    switch (category) {
      case 'PLANTING':
        return 'Catat Tanam Padi';
      case 'FERTILIZER':
        return 'Catat Pemupukan';
      case 'IRRIGATION':
        return 'Catat Pengaturan Air';
      case 'OPT':
        return 'Catat Pengamatan Hama / OPT';
      case 'MAINTENANCE':
        return 'Catat Perawatan & Penyiangan';
      case 'HARVEST':
        return 'Catat Panen Padi';
      default:
        return 'Catat Kegiatan Lapang';
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!category) return;
    if (!activeSeason.id) {
      setError('Musim tanam aktif tidak ditemukan.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const now = new Date().toISOString();
      const activityId = `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const baseActivity: Activity = {
        id: activityId,
        cropSeasonId: activeSeason.id,
        category,
        activityDate,
        hst: hstSnapshot,
        notes: notes.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      };

      let actionDescription = '';

      if (category === 'FERTILIZER') {
        const kg = parseFloat(amountKg) || 0;
        if (kg <= 0) {
          throw new Error('Jumlah pupuk harus lebih dari 0 kg');
        }

        const fertName = selectedFert ? selectedFert.name : customFertName || 'Pupuk Khusus';
        const fertApp: FertilizerApplication = {
          id: `fa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          activityId,
          fertilizerId: selectedFert?.id,
          fertilizerName: fertName,
          amountKg: kg,
          applicationMethod: method as any,
          calculatedNutrients: {
            N_kg: nutrientPreview.primarySummary.N_kg,
            P2O5_kg: nutrientPreview.primarySummary.P2O5_kg,
            K2O_kg: nutrientPreview.primarySummary.K2O_kg,
            S_kg: nutrientPreview.primarySummary.S_kg,
          },
          notes: notes.trim() || undefined,
          createdAt: now,
          updatedAt: now,
        };

        baseActivity.notes = baseActivity.notes || `Aplikasi ${fertName} ${kg} kg (${method})`;
        actionDescription = `Aplikasi pupuk ${fertName} sebanyak ${kg} kg`;
        await activityRepository.createFertilizerActivity(baseActivity, fertApp);
      } else if (category === 'OPT') {
        const targetOpt = opts.find((o) => o.id === selectedOptId);
        const finalOptName = isUnknownOpt
          ? customOptName.trim() || 'Pengamatan Gejala Hama/Penyakit'
          : targetOpt?.commonName || 'OPT Sawah';

        const finalSymptom = [symptomPreset, notes.trim()].filter(Boolean).join(' - ') || 'Gejala terlihat di petak tanaman';

        const candidateIds = relevanceMatches.slice(0, 3).map((m) => m.opt.id);

        const optObs: OptObservation = {
          id: `obs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          activityId,
          optId: isUnknownOpt ? undefined : selectedOptId,
          isUnknown: isUnknownOpt,
          customOptName: finalOptName,
          attackSeverity: severity,
          attackLocation: [optLocation],
          observedSymptoms: finalSymptom,
          photoLocalUri: optPhoto || undefined,
          visualClues: visualAnalysisResult?.visualClues,
          candidateOptIds: candidateIds,
          photoAnalysisNotes: visualAnalysisResult?.clarityMessage,
          createdAt: now,
          updatedAt: now,
        };

        baseActivity.notes = baseActivity.notes || `Pengamatan ${finalOptName} (Tingkat: ${severity})`;
        actionDescription = `Pengamatan OPT ${finalOptName} pada bagian ${optLocation}`;
        await activityRepository.createOptActivity(baseActivity, optObs);

        const locationLabels: Record<string, string> = {
          LEAF: 'Daun / Pelepah',
          STEM: 'Batang / Pangkal Batang',
          ROOT: 'Akar Tanaman',
          PANICLE: 'Malai / Butir Gabah',
          WHOLE_PLANT: 'Seluruh Rumpun Tanaman',
        };
        const severityLabels: Record<string, string> = {
          LIGHT: 'Ringan (Beberapa rumpun acak)',
          MEDIUM: 'Sedang (Mulai menyebar di petak)',
          HEAVY: 'Berat (Populasi meluas)',
        };

        const topCandidate = relevanceMatches[0];

        setSubmittedOptSummary({
          optName: finalOptName,
          locationLabel: locationLabels[optLocation] || optLocation,
          severityLabel: severityLabels[severity] || severity,
          severity,
          symptoms: finalSymptom,
          optId: isUnknownOpt ? undefined : selectedOptId,
          isUnknown: isUnknownOpt,
          photo: optPhoto,
          visualClues: visualAnalysisResult?.visualClues,
          topCandidateName: topCandidate ? topCandidate.opt.commonName : undefined,
          topCandidateId: topCandidate ? topCandidate.opt.id : undefined,
        });

        // Trigger background refresh
        onSuccess();
        return;
      } else if (category === 'IRRIGATION') {
        baseActivity.notes = `Pengairan: ${waterCondition}${notes ? ` • ${notes}` : ''}`;
        actionDescription = `Pengaturan kondisi air sawah: ${waterCondition}`;
        await activityRepository.create(baseActivity);
      } else if (category === 'MAINTENANCE') {
        baseActivity.notes = `${maintenanceType} (${maintenanceTool})${notes ? ` • ${notes}` : ''}`;
        actionDescription = `Kegiatan ${maintenanceType} menggunakan ${maintenanceTool}`;
        await activityRepository.create(baseActivity);
      } else if (category === 'HARVEST') {
        const yieldKg = parseFloat(harvestYieldKg) || 0;
        if (yieldKg < 0) {
          throw new Error('Hasil panen tidak boleh berupa angka negatif');
        }
        baseActivity.notes = `Panen Padi: Hasil ${yieldKg.toLocaleString('id-ID')} kg • Kondisi: ${grainCondition}${notes ? ` • ${notes}` : ''}`;
        actionDescription = `Panen padi dengan hasil ${yieldKg} kg`;
        await activityRepository.create(baseActivity);

        if (completeSeason) {
          await cropSeasonRepository.update(activeSeason.id, {
            status: 'COMPLETED',
            harvestDate: activityDate,
            yieldKg,
          });
        }
      } else if (category === 'PLANTING') {
        baseActivity.notes = `Tanam Padi: Sistem ${plantingSystem} • Umur bibit ${seedlingAgeDays} HSS${notes ? ` • ${notes}` : ''}`;
        actionDescription = `Penanaman padi sistem ${plantingSystem}`;
        await activityRepository.create(baseActivity);
      }

      // Catat ActualAction jika dipicu dari Keputusan Petani
      if (decisionId) {
        const actualAction: ActualAction = {
          id: `act-action-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          cropSeasonId: activeSeason.id,
          decisionId,
          activityId,
          actionType: category as any,
          description: actionDescription,
          performedAt: new Date(activityDate).toISOString(),
          createdAt: now,
        };
        await recommendationRepository.recordActualAction(actualAction);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Gagal mencatat kegiatan:', err);
      setError(err.message || 'Terjadi kesalahan saat menyimpan catatan kegiatan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={getTitle()}
      maxWidth="lg"
    >
      {/* TAMPILAN SUKSES PENGAMATAN OPT */}
      {submittedOptSummary ? (
        <div className="space-y-4 py-1">
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-start gap-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-sm sm:text-base font-bold text-emerald-950">
                Pengamatan Lapang Berhasil Dicatat
              </h3>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Data gejala telah disimpan di perangkat Anda dan siap dihubungkan dengan panduan PHT terpadu.
              </p>
            </div>
          </div>

          {/* Ringkasan Visual: Pengamatan Anda */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Bug className="w-4 h-4 text-amber-700" />
                Data Pengamatan Lapang
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {activityDate} • {hstSnapshot} HST
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-500 shrink-0">Sasaran / Gejala:</span>
                <span className="font-bold text-slate-900 text-right">
                  {submittedOptSummary.optName}
                  {submittedOptSummary.isUnknown && (
                    <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-normal">
                      Belum Teridentifikasi
                    </span>
                  )}
                </span>
              </div>

              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-500">Bagian Tanaman:</span>
                <span className="font-semibold text-slate-800">
                  {submittedOptSummary.locationLabel}
                </span>
              </div>

              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-500">Tingkat Serangan:</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                    submittedOptSummary.severity === 'LIGHT'
                      ? 'bg-emerald-100 text-emerald-900'
                      : submittedOptSummary.severity === 'MEDIUM'
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-orange-100 text-orange-900'
                  }`}
                >
                  {submittedOptSummary.severityLabel}
                </span>
              </div>

              {submittedOptSummary.photo && (
                <div className="pt-2 border-t border-slate-100 flex items-start gap-3">
                  <img
                    src={submittedOptSummary.photo}
                    alt="Foto Pengamatan"
                    className="w-20 h-16 object-cover rounded-xl border border-slate-200 shrink-0"
                  />
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-700 block">
                      Foto Gejala Lapang Disertakan
                    </span>
                    {submittedOptSummary.visualClues && submittedOptSummary.visualClues.length > 0 && (
                      <p className="text-[10px] text-slate-600">
                        Petunjuk visual: {submittedOptSummary.visualClues.slice(0, 2).join('; ')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-500 block mb-1">Catatan Gejala:</span>
                <p className="text-slate-700 bg-slate-50 p-2.5 rounded-xl text-xs leading-relaxed font-medium">
                  {submittedOptSummary.symptoms}
                </p>
              </div>
            </div>
          </div>

          {/* Jembatan Visual ke Pustaka PHT */}
          <div className="p-4 bg-amber-50/80 rounded-2xl border border-amber-200/90 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
              <Sparkles className="w-4 h-4 text-amber-700" />
              <span>Rujukan Agronomi Berdasarkan Pengamatan Ini</span>
            </div>
            <p className="text-xs text-amber-900 leading-relaxed">
              {submittedOptSummary.topCandidateName
                ? `Rujukan pembanding terdekat adalah ${submittedOptSummary.topCandidateName}. Buka panduan PHT terpadu untuk melihat langkah teknis, sanitasi, dan musuh alami pendukung.`
                : 'Sistem telah memperbarui analisis lapang Anda. Buka pustaka PHT untuk mempelajari tindakan kultur teknis dan musuh alami.'}
            </p>
          </div>

          {/* Tombol Aksi Langsung ke Rujukan PHT */}
          <div className="pt-2 space-y-2">
            <button
              type="button"
              onClick={() => {
                const queryOrId = submittedOptSummary.optId || submittedOptSummary.topCandidateId;
                const queryText = submittedOptSummary.isUnknown && !submittedOptSummary.topCandidateId
                  ? submittedOptSummary.symptoms || submittedOptSummary.optName
                  : undefined;

                onClose();
                if (onNavigateToKnowledge) {
                  onNavigateToKnowledge('opt', queryOrId, queryText);
                }
              }}
              className="w-full py-3 px-4 min-h-[48px] bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-bold text-xs sm:text-sm rounded-xl transition-colors flex items-center justify-center gap-2 shadow-xs"
            >
              <BookOpen className="w-4 h-4 text-amber-300" />
              <span>Buka Panduan PHT & Musuh Alami</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-4 min-h-[44px] bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-colors"
            >
              Lihat Saran di Beranda
            </button>
          </div>
        </div>
      ) : !category ? (
        /* MENU PILIHAN KATEGORI KEGIATAN */
        <div className="space-y-3">
          <p className="text-xs text-slate-500 font-medium">
            Pilih jenis kegiatan yang Anda lakukan di petak sawah:
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* 1. Tanam */}
            <button
              type="button"
              onClick={() => setCategory('PLANTING')}
              className="p-4 bg-white hover:bg-emerald-50/80 active:bg-emerald-100 border border-slate-200 hover:border-emerald-300 rounded-2xl text-left transition-all group flex flex-col justify-between min-h-[96px] shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Sprout className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-bold text-slate-900 block">Tanam</span>
                <span className="text-[11px] text-slate-500">Pindah bibit & sistem tanam</span>
              </div>
            </button>

            {/* 2. Pupuk */}
            <button
              type="button"
              onClick={() => setCategory('FERTILIZER')}
              className="p-4 bg-white hover:bg-emerald-50/80 active:bg-emerald-100 border border-slate-200 hover:border-emerald-300 rounded-2xl text-left transition-all group flex flex-col justify-between min-h-[96px] shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                <FlaskConical className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-bold text-slate-900 block">Pupuk</span>
                <span className="text-[11px] text-slate-500">Urea, NPK, Kompos, dll</span>
              </div>
            </button>

            {/* 3. Pengairan */}
            <button
              type="button"
              onClick={() => setCategory('IRRIGATION')}
              className="p-4 bg-white hover:bg-sky-50/80 active:bg-sky-100 border border-slate-200 hover:border-sky-300 rounded-2xl text-left transition-all group flex flex-col justify-between min-h-[96px] shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Droplets className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-bold text-slate-900 block">Pengairan</span>
                <span className="text-[11px] text-slate-500">Macak-macak / genangan</span>
              </div>
            </button>

            {/* 4. OPT */}
            <button
              type="button"
              onClick={() => setCategory('OPT')}
              className="p-4 bg-white hover:bg-amber-50/80 active:bg-amber-100 border border-slate-200 hover:border-amber-300 rounded-2xl text-left transition-all group flex flex-col justify-between min-h-[96px] shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Bug className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-bold text-slate-900 block">OPT / Hama</span>
                <span className="text-[11px] text-slate-500">Pengamatan gejala & foto</span>
              </div>
            </button>

            {/* 5. Perawatan */}
            <button
              type="button"
              onClick={() => setCategory('MAINTENANCE')}
              className="p-4 bg-white hover:bg-teal-50/80 active:bg-teal-100 border border-slate-200 hover:border-teal-300 rounded-2xl text-left transition-all group flex flex-col justify-between min-h-[96px] shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Scissors className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-bold text-slate-900 block">Perawatan</span>
                <span className="text-[11px] text-slate-500">Matun / penyiangan gulma</span>
              </div>
            </button>

            {/* 6. Panen */}
            <button
              type="button"
              onClick={() => setCategory('HARVEST')}
              className="p-4 bg-white hover:bg-yellow-50/80 active:bg-yellow-100 border border-slate-200 hover:border-yellow-300 rounded-2xl text-left transition-all group flex flex-col justify-between min-h-[96px] shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-yellow-100 text-yellow-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Wheat className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-bold text-slate-900 block">Panen</span>
                <span className="text-[11px] text-slate-500">Catat hasil & tutup musim</span>
              </div>
            </button>
          </div>
        </div>
      ) : (
        /* FORM AKTIVITAS UTAMA */
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Header Pemilihan Kategori */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setCategory(null)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 min-h-[36px] px-2 py-1 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Ganti Kategori</span>
            </button>

            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
              {category}
            </span>
          </div>

          {error && (
            <div className="p-3.5 bg-red-50 text-red-800 rounded-xl text-xs flex items-start gap-2 border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {/* Baris Tanggal & Informasi HST */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tanggal Kegiatan <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={activityDate}
                onChange={(e) => setActivityDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px]"
                required
              />
            </div>

            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-emerald-800 block font-medium">Umur Tanaman:</span>
                <span className="text-sm font-extrabold text-emerald-950">
                  {hstSnapshot >= 0 ? `${hstSnapshot} HST` : 'Pra-Tanam'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-emerald-800 block font-medium">Lahan:</span>
                <span className="text-xs font-bold text-slate-800">{land.name}</span>
              </div>
            </div>
          </div>

          {/* --- FORM 1: PEMUPUKAN (FERTILIZER) --- */}
          {category === 'FERTILIZER' && (
            <div className="space-y-3 p-3.5 bg-emerald-50/40 rounded-2xl border border-emerald-200/80">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Jenis Pupuk <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedFertId}
                    onChange={(e) => setSelectedFertId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px]"
                  >
                    {fertilizers.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.formula})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Jumlah Diberikan (Kg) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.1"
                    value={amountKg}
                    onChange={(e) => setAmountKg(e.target.value)}
                    placeholder="Contoh: 50"
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px]"
                    required
                  />
                </div>
              </div>

              {/* Preview Hara Otomatis */}
              <div className="p-3 bg-white rounded-xl border border-emerald-200 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-900 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    Pasokan Hara Bersih Terhitung:
                  </span>
                  <span className="text-[11px] text-slate-500">Otomatis dihitung mesin hara</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-slate-100">
                  <div className="p-1.5 bg-emerald-50 rounded-lg">
                    <span className="text-[10px] text-slate-500 block">Nitrogen (N)</span>
                    <strong className="text-xs text-emerald-950 font-extrabold">
                      {nutrientPreview.primarySummary.N_kg.toFixed(1)} kg
                    </strong>
                  </div>
                  <div className="p-1.5 bg-emerald-50 rounded-lg">
                    <span className="text-[10px] text-slate-500 block">Fosfat (P₂O₅)</span>
                    <strong className="text-xs text-emerald-950 font-extrabold">
                      {nutrientPreview.primarySummary.P2O5_kg.toFixed(1)} kg
                    </strong>
                  </div>
                  <div className="p-1.5 bg-emerald-50 rounded-lg">
                    <span className="text-[10px] text-slate-500 block">Kalium (K₂O)</span>
                    <strong className="text-xs text-emerald-950 font-extrabold">
                      {nutrientPreview.primarySummary.K2O_kg.toFixed(1)} kg
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --- FORM 2: PENGAMATAN OPT TERPADU (TERMASUK ANALISIS FOTO & RUJUKAN AGRONOMI) --- */}
          {category === 'OPT' && (
            <div className="space-y-4 p-3.5 bg-amber-50/50 rounded-2xl border border-amber-200/80">
              {/* Pilihan Metode Input: Terdaftar vs Gejala Bebas */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Pendekatan Identifikasi Hama / Penyakit
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsUnknownOpt(false)}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs border transition-all text-left flex items-center gap-2 min-h-[44px] ${
                      !isUnknownOpt
                        ? 'bg-amber-700 text-white border-amber-700 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50/60'
                    }`}
                  >
                    <Bug className="w-4 h-4 shrink-0" />
                    <span>Pilih dari Daftar Terdaftar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsUnknownOpt(true)}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs border transition-all text-left flex items-center gap-2 min-h-[44px] ${
                      isUnknownOpt
                        ? 'bg-amber-700 text-white border-amber-700 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50/60'
                    }`}
                  >
                    <Search className="w-4 h-4 shrink-0" />
                    <span>Belum Tahu Pasti (Catat Gejala)</span>
                  </button>
                </div>
              </div>

              {!isUnknownOpt ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Pilih Hama / Penyakit Terdaftar <span className="text-amber-800">*</span>
                  </label>
                  <select
                    value={selectedOptId}
                    onChange={(e) => setSelectedOptId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-600 min-h-[44px]"
                  >
                    {opts.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.commonName} ({o.scientificName})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Sementara / Deskripsi Singkat Bebas
                  </label>
                  <input
                    type="text"
                    value={customOptName}
                    onChange={(e) => setCustomOptName(e.target.value)}
                    placeholder="Contoh: Daun menguning dan rumpun kerdil / Ulat pelipat daun"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 min-h-[44px]"
                  />
                  <p className="text-[11px] text-amber-900/80 mt-1">
                    Masukkan apa yang terlihat di petak. Sistem akan mencari rujukan pembanding yang paling relevan.
                  </p>
                </div>
              )}

              {/* Pilihan Bagian Tanaman */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Bagian Tanaman yang Terkena Serangan
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'LEAF' as AttackLocation, label: 'Daun / Pelepah' },
                    { id: 'STEM' as AttackLocation, label: 'Batang / Pangkal' },
                    { id: 'PANICLE' as AttackLocation, label: 'Malai / Gabah' },
                    { id: 'ROOT' as AttackLocation, label: 'Akar Tanaman' },
                    { id: 'WHOLE_PLANT' as AttackLocation, label: 'Seluruh Rumpun' },
                  ].map((loc) => (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => setOptLocation(loc.id)}
                      className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition-all min-h-[44px] flex items-center justify-center ${
                        optLocation === loc.id
                          ? 'bg-amber-100 text-amber-950 border-amber-400 font-extrabold shadow-2xs ring-1 ring-amber-400'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50/50'
                      }`}
                    >
                      {loc.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pilihan Tingkat Serangan */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Tingkat Serangan di Lapang
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    {
                      id: 'LIGHT' as AttackSeverity,
                      title: 'Ringan',
                      desc: 'Terlihat di beberapa rumpun acak',
                      colorActive: 'bg-emerald-100 text-emerald-950 border-emerald-400',
                      badge: 'Aman / Pantau',
                    },
                    {
                      id: 'MEDIUM' as AttackSeverity,
                      title: 'Sedang',
                      desc: 'Mulai menyebar di beberapa petak',
                      colorActive: 'bg-amber-100 text-amber-950 border-amber-400',
                      badge: 'Waspada',
                    },
                    {
                      id: 'HEAVY' as AttackSeverity,
                      title: 'Berat',
                      desc: 'Populasi meluas di sebagian besar petak',
                      colorActive: 'bg-orange-100 text-orange-950 border-orange-400',
                      badge: 'Perlu Tindakan',
                    },
                  ].map((sev) => (
                    <button
                      key={sev.id}
                      type="button"
                      onClick={() => setSeverity(sev.id)}
                      className={`p-3 text-left rounded-xl border transition-all flex flex-col justify-between min-h-[64px] ${
                        severity === sev.id
                          ? `${sev.colorActive} shadow-xs font-bold ring-1 ring-amber-400`
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{sev.title}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/80 border border-black/10">
                          {sev.badge}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-600 mt-1 leading-snug">
                        {sev.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Opsi Cepat Gejala */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Pilihan Cepat Gejala Lapang
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Daun Menguning dari Ujung',
                    'Bercak Belah Ketupat (Blas)',
                    'Garis Kuning Basah (Kresek)',
                    'Pucuk Daun Menggulung',
                    'Batang Terpotong / Sundep',
                    'Malai Putih Hampa (Beluk)',
                    'Rumpun Kerdil Rumput',
                  ].map((sym) => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => setSymptomPreset(symptomPreset === sym ? '' : sym)}
                      className={`px-3 py-2 text-xs rounded-xl font-medium transition-colors border min-h-[38px] ${
                        symptomPreset === sym
                          ? 'bg-amber-700 text-white border-amber-700 font-bold shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50'
                      }`}
                    >
                      {sym}
                    </button>
                  ))}
                </div>
              </div>

              {/* FOTO GEJALA / TANAMAN (OPSIONAL) */}
              <div className="p-3.5 bg-white rounded-2xl border border-amber-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-amber-700" />
                    <span>Foto Gejala / Tanaman (Opsional)</span>
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Otomatis dikompresi di perangkat
                  </span>
                </div>

                {optPhoto ? (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row items-start gap-3 p-3 bg-amber-50/50 rounded-xl border border-amber-200">
                      <div className="relative rounded-xl overflow-hidden border border-amber-300 shrink-0 bg-slate-900">
                        <img
                          src={optPhoto}
                          alt="Foto Gejala Tanaman"
                          className="w-32 h-28 object-cover"
                        />
                      </div>

                      <div className="flex-1 space-y-2 w-full">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-800">
                            Foto Gejala Terlampir
                          </span>
                          <button
                            type="button"
                            onClick={handleRemovePhoto}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus Foto</span>
                          </button>
                        </div>

                        {isAnalyzingPhoto ? (
                          <div className="p-2.5 bg-white rounded-lg border border-amber-200 flex items-center gap-2 text-xs text-amber-900 font-medium">
                            <Sparkles className="w-4 h-4 animate-spin text-amber-600" />
                            <span>Menganalisis petunjuk visual dari foto...</span>
                          </div>
                        ) : visualAnalysisResult ? (
                          <div className="p-2.5 bg-white rounded-xl border border-amber-200 space-y-1.5 text-xs">
                            <span className="font-bold text-slate-800 flex items-center gap-1">
                              <Eye className="w-3.5 h-3.5 text-amber-700" />
                              Petunjuk Visual yang Terlihat:
                            </span>

                            {visualAnalysisResult.visualClues.length > 0 ? (
                              <ul className="space-y-1 mt-1">
                                {visualAnalysisResult.visualClues.map((clue, idx) => (
                                  <li
                                    key={idx}
                                    className="flex items-start gap-1.5 text-[11px] text-slate-700 font-medium leading-relaxed"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 shrink-0" />
                                    <span>{clue}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-[11px] text-slate-600">
                                {visualAnalysisResult.summaryText}
                              </p>
                            )}

                            {visualAnalysisResult.clarityStatus === 'BLURRY_OR_DARK' && (
                              <div className="mt-1 p-2 bg-amber-50 rounded-lg text-[11px] text-amber-900 border border-amber-200">
                                {visualAnalysisResult.clarityMessage}
                              </div>
                            )}

                            <p className="text-[10px] text-slate-500 italic mt-1">
                              Analisis foto digunakan sebagai petunjuk tambahan, bukan diagnosis mutlak. Petani tetap menjadi pengambil keputusan.
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {/* Tombol Ambil Foto Kamera */}
                      <label
                        htmlFor="opt-camera-input"
                        className={`py-3 px-3 bg-white hover:bg-amber-50/80 active:bg-amber-100 border border-slate-200 hover:border-amber-400 rounded-xl text-xs font-bold text-slate-800 transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[44px] shadow-2xs ${
                          isCompressingPhoto ? 'opacity-60 pointer-events-none' : ''
                        }`}
                      >
                        <Camera className="w-4 h-4 text-amber-700" />
                        <span>{isCompressingPhoto ? 'Memproses...' : 'Ambil Foto (Kamera)'}</span>
                      </label>
                      <input
                        id="opt-camera-input"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          const file = e.target.files?.[0];
                          if (file) handlePhotoUpload(file);
                          e.target.value = '';
                        }}
                      />

                      {/* Tombol Pilih dari Galeri */}
                      <label
                        htmlFor="opt-gallery-input"
                        className={`py-3 px-3 bg-white hover:bg-amber-50/80 active:bg-amber-100 border border-slate-200 hover:border-amber-400 rounded-xl text-xs font-bold text-slate-800 transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[44px] shadow-2xs ${
                          isCompressingPhoto ? 'opacity-60 pointer-events-none' : ''
                        }`}
                      >
                        <ImageIcon className="w-4 h-4 text-amber-700" />
                        <span>Pilih dari Galeri</span>
                      </label>
                      <input
                        id="opt-gallery-input"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          const file = e.target.files?.[0];
                          if (file) handlePhotoUpload(file);
                          e.target.value = '';
                        }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Foto membantu mendeteksi indikasi perubahan warna, bercak, atau kondisi fisik tanaman.
                    </p>
                  </div>
                )}
              </div>

              {/* RUJUKAN PALING RELEVAN & KANDIDAT OPT */}
              <div className="space-y-3 pt-1">
                {/* Konteks Pengamatan Saat Ini */}
                <div className="p-3 bg-slate-900 text-white rounded-2xl space-y-1.5 shadow-xs">
                  <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-1.5">
                    <span className="font-bold flex items-center gap-1.5 text-amber-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      Konteks Pengamatan Anda
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {hstSnapshot} HST • {land.name}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-300 pt-0.5">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Bagian Tanaman:</span>
                      <strong className="text-white">
                        {optLocation === 'LEAF'
                          ? 'Daun / Pelepah'
                          : optLocation === 'STEM'
                          ? 'Batang / Pangkal'
                          : optLocation === 'ROOT'
                          ? 'Akar Tanaman'
                          : optLocation === 'PANICLE'
                          ? 'Malai / Gabah'
                          : 'Seluruh Rumpun'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Tingkat Serangan:</span>
                      <strong className="text-white">
                        {severity === 'LIGHT' ? 'Ringan' : severity === 'MEDIUM' ? 'Sedang' : 'Berat'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Bukti Foto:</span>
                      <strong className="text-white">
                        {optPhoto ? 'Terlampir' : 'Tidak Ada'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Hasil Relevansi & Kandidat */}
                {relevanceMatches.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                        <span>Rujukan Paling Relevan ({relevanceMatches.length} Ditemukan)</span>
                      </h4>
                      <span className="text-[10px] text-slate-500">
                        {relevanceMatches[0]?.isExactMatch ? 'Kecocokan Master' : 'Bahan Pembanding'}
                      </span>
                    </div>

                    {/* Kandidat Utama (Top Candidate) */}
                    {relevanceMatches.slice(0, showAllCandidates ? undefined : 1).map((match, idx) => {
                      const isExpandedPht = expandedPhtOptId === match.opt.id || (!showAllCandidates && idx === 0);
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

                            {/* Tombol Terapkan Sebagai Pilihan Ini */}
                            {isUnknownOpt && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedOptId(match.opt.id);
                                  setIsUnknownOpt(false);
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold rounded-xl border border-amber-300 transition-colors self-start sm:self-auto min-h-[36px]"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Pilih OPT Ini</span>
                              </button>
                            )}
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

                          {/* PHT / PENANGANAN NON-KIMIA TERLEBIH DAHULU (7 TAHAPAN) */}
                          <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-2">
                            <div
                              onClick={() => setExpandedPhtOptId(isExpandedPht ? null : match.opt.id)}
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
                                  onClose();
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
                    <p className="text-[11px] text-slate-500 italic pt-1">
                      Anda tetap dapat menyimpan catatan pengamatan ini untuk memantau perkembangan di hari berikutnya.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --- FORM 3: PENGAIRAN (IRRIGATION) --- */}
          {category === 'IRRIGATION' && (
            <div className="space-y-3 p-3.5 bg-sky-50/50 rounded-2xl border border-sky-200/80">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kondisi Air di Petak Sawah
                </label>
                <select
                  value={waterCondition}
                  onChange={(e) => setWaterCondition(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-600 min-h-[44px]"
                >
                  <option value="Macak-macak (1-2 cm - Fase Anakan)">
                    Macak-macak (1-2 cm • Merangsang Anakan Produktif)
                  </option>
                  <option value="Tergenang Dangkal (3-5 cm - Bunting/Berbunga)">
                    Tergenang Dangkal (3-5 cm • Fase Bunting & Pembungaan)
                  </option>
                  <option value="Pengeringan Berkala (Intermittent / Aerasi Tanah)">
                    Pengeringan Berkala (Intermittent • Mencegah Keracunan Fe & Memperkuat Akar)
                  </option>
                  <option value="Pengeringan Menjelang Panen (7-10 Hari Pra Panen)">
                    Pengeringan Pra-Panen (7-10 hari sebelum panen • Mempercepat Pemasakan Gabah)
                  </option>
                  <option value="Pasokan Air Terbatas / Kemarau">
                    Kekurangan Air / Pasokan Terbatas (Kondisi Kering)
                  </option>
                </select>
              </div>
            </div>
          )}

          {/* --- FORM 4: PERAWATAN (MAINTENANCE) --- */}
          {category === 'MAINTENANCE' && (
            <div className="space-y-3 p-3.5 bg-teal-50/50 rounded-2xl border border-teal-200/80">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Jenis Perawatan
                  </label>
                  <select
                    value={maintenanceType}
                    onChange={(e) => setMaintenanceType(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 min-h-[44px]"
                  >
                    <option value="Penyiangan Gulma (Matun ke-1)">Penyiangan Gulma (Matun ke-1 • ~15-21 HST)</option>
                    <option value="Penyiangan Gulma (Matun ke-2)">Penyiangan Gulma (Matun ke-2 • ~35-40 HST)</option>
                    <option value="Penyulaman Bibit Mati">Penyulaman Bibit Mati (~7-10 HST)</option>
                    <option value="Pembersihan Pematang & Saluran">Pembersihan Pematang & Saluran Irigasi</option>
                    <option value="Aplikasi Pupuk Hayati / Mikroba">Aplikasi Pupuk Hayati / Dekomposer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Alat / Cara Perawatan
                  </label>
                  <select
                    value={maintenanceTool}
                    onChange={(e) => setMaintenanceTool(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 min-h-[44px]"
                  >
                    <option value="Manual Tangan & Gasrok">Manual Tangan & Landak / Gasrok</option>
                    <option value="Mesin Penyiang Bermotor">Mesin Penyiang Bermotor (Power Weeder)</option>
                    <option value="Cangkul & Sabit Pematang">Cangkul & Sabit Pembersih</option>
                    <option value="Semprot Sprayer">Semprot Sprayer Punggung</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* --- FORM 5: PANEN (HARVEST) --- */}
          {category === 'HARVEST' && (
            <div className="space-y-3 p-3.5 bg-yellow-50/60 rounded-2xl border border-yellow-300/80">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Perolehan Hasil Panen (Kg GKP) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="10"
                    min="1"
                    value={harvestYieldKg}
                    onChange={(e) => setHarvestYieldKg(e.target.value)}
                    placeholder="Contoh: 4500"
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-yellow-600 min-h-[44px]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kondisi Gabah
                  </label>
                  <select
                    value={grainCondition}
                    onChange={(e) => setGrainCondition(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-600 min-h-[44px]"
                  >
                    <option value="Gabah Kering Panen (GKP) Bernas">Gabah Kering Panen (GKP) Bernas</option>
                    <option value="Gabah Kering Giling (GKG)">Gabah Kering Giling (GKG)</option>
                    <option value="Gabah Agak Lembap (Hujan)">Gabah Agak Lembap (Musim Hujan)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-yellow-300">
                <input
                  type="checkbox"
                  id="complete-season"
                  checked={completeSeason}
                  onChange={(e) => setCompleteSeason(e.target.checked)}
                  className="w-4 h-4 text-yellow-600 rounded focus:ring-yellow-500"
                />
                <label htmlFor="complete-season" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Tandai Musim Tanam Ini Selesai (COMPLETED)
                </label>
              </div>
            </div>
          )}

          {/* --- FORM 6: TANAM (PLANTING) --- */}
          {category === 'PLANTING' && (
            <div className="space-y-3 p-3.5 bg-emerald-50/50 rounded-2xl border border-emerald-200/80">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Sistem Tanam
                  </label>
                  <select
                    value={plantingSystem}
                    onChange={(e) => setPlantingSystem(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px]"
                  >
                    <option value="JAJAR_LEGOWO_2_1">Jajar Legowo 2:1 (Sangat Dianjurkan)</option>
                    <option value="JAJAR_LEGOWO_4_1">Jajar Legowo 4:1</option>
                    <option value="TEGEL">Tegel Tradisional (25 x 25 cm)</option>
                    <option value="SRI">SRI (System of Rice Intensification)</option>
                    <option value="TABELA">Tabela (Tanam Benih Langsung)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Umur Bibit saat Pindah (HSS)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="35"
                    value={seedlingAgeDays}
                    onChange={(e) => setSeedlingAgeDays(e.target.value)}
                    placeholder="Contoh: 15-21"
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Catatan Tambahan (Opsional) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Catatan / Tindakan Nyata di Lapangan
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Catatan kondisi lapangan atau hal khusus yang diperhatikan..."
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {/* Tombol Aksi Simpan */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 min-h-[44px] text-slate-600 hover:text-slate-800 font-semibold text-xs rounded-xl hover:bg-slate-100 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 min-h-[48px] bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-xs rounded-xl transition-colors shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Catatan'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
