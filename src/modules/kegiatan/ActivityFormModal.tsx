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

import { useState, useMemo, type FormEvent, useEffect, type ChangeEvent } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Bug,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
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
  getFieldInspectionPoints,
  getMatchConfidenceLabel,
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
  onSuccess: (createdActivity?: Activity, createdOptObs?: OptObservation) => void | Promise<void>;
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

  // --- State Khusus OPT (Ramah Pemula, Berbasis Foto, Fleksibel) ---
  const [optApproach, setOptApproach] = useState<'PHOTO' | 'MANUAL_LIST' | 'SYMPTOM'>('PHOTO');
  const [selectedOptId, setSelectedOptId] = useState<string>('');
  const [selectedCandidateOptId, setSelectedCandidateOptId] = useState<string | null>(null);
  const [customOptName, setCustomOptName] = useState<string>('');
  const [severity, setSeverity] = useState<AttackSeverity>('LIGHT');
  const [optLocation, setOptLocation] = useState<AttackLocation | ''>('');
  const [symptomPreset, setSymptomPreset] = useState<string>('');
  const [optPhoto, setOptPhoto] = useState<string | null>(null);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState<boolean>(false);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState<boolean>(false);
  const [visualAnalysisResult, setVisualAnalysisResult] = useState<VisualAnalysisResult | null>(null);

  // Fungsi reset total seluruh data sementara pengamatan
  const resetAllTemporaryOptState = () => {
    setSelectedOptId('');
    setSelectedCandidateOptId(null);
    setCustomOptName('');
    setSymptomPreset('');
    setOptLocation('');
    setSeverity('LIGHT');
    setOptPhoto(null);
    setVisualAnalysisResult(null);
    setIsCompressingPhoto(false);
    setIsAnalyzingPhoto(false);
  };

  const handleModalClose = () => {
    resetAllTemporaryOptState();
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      setCategory(initialCategory);
      setActivityDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      setError(null);
      setOptApproach('PHOTO');
      resetAllTemporaryOptState();
      if (fertilizers.length > 0) {
        setSelectedFertId(fertilizers[0].id);
      }
    } else {
      resetAllTemporaryOptState();
    }
  }, [isOpen, initialCategory, fertilizers]);

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

  // Kalkulasi Realtime Kandidat OPT berdasarkan foto/gejala untuk mode PHOTO dan SYMPTOM
  const realtimeCandidates = useMemo(() => {
    if (category !== 'OPT') return [];
    const query = [customOptName, symptomPreset, notes].filter(Boolean).join(' ');
    return matchOptRelevance(opts, query, {
      attackLocations: optLocation ? [optLocation] : [],
      visualTokens: visualAnalysisResult?.detectedKeywords,
      visualClues: visualAnalysisResult?.visualClues,
      minScoreThreshold: 5,
    });
  }, [category, customOptName, symptomPreset, notes, optLocation, visualAnalysisResult, opts]);

  const inspectionPoints = useMemo(() => {
    return getFieldInspectionPoints(
      optLocation ? [optLocation] : [],
      visualAnalysisResult?.detectedKeywords || []
    );
  }, [optLocation, visualAnalysisResult]);

  // Fungsi kompresi dan analisis foto tanaman On-Device (HP Local Processing)
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

      // Jalankan visual analysis engine 100% on-device (Canvas API)
      const analysis = await analyzePlantPhoto(compressed, optLocation || undefined);
      setVisualAnalysisResult(analysis);

      // Berikan auto-saran keparahan jika AI mendeteksi petunjuk kuat (tanpa memaksa bagian tanaman)
      if (analysis.suggestedSeverity) {
        setSeverity(analysis.suggestedSeverity);
      }
    } catch (err) {
      console.warn('Gagal memproses foto tanaman on-device:', err);
      setError('Gagal memproses foto di perangkat. Anda tetap dapat melanjutkan pencatatan secara manual.');
    } finally {
      setIsCompressingPhoto(false);
      setIsAnalyzingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    setOptPhoto(null);
    setVisualAnalysisResult(null);
    setSelectedCandidateOptId(null);
  };

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

  if (!isOpen || !land || !activeSeason) return null;

  const getTitle = () => {
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
      let createdOptObsRecord: OptObservation | undefined = undefined;

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
        if (optApproach === 'MANUAL_LIST') {
          if (!selectedOptId) {
            throw new Error('Silakan pilih nama Hama / Penyakit dari daftar terdaftar.');
          }
        }

        const effectiveOptId =
          optApproach === 'MANUAL_LIST'
            ? selectedOptId
            : selectedCandidateOptId || undefined;
        const targetOpt = opts.find((o) => o.id === effectiveOptId);
        const isUnknown = !effectiveOptId;

        let finalOptName = '';
        if (targetOpt) {
          finalOptName = targetOpt.commonName;
        } else if (customOptName.trim()) {
          finalOptName = customOptName.trim();
        } else if (optPhoto) {
          finalOptName = 'Pengamatan Gejala Lapang (Foto)';
        } else {
          finalOptName = 'Pengamatan Gejala Hama/Penyakit';
        }

        const finalSymptom =
          [symptomPreset, notes.trim()].filter(Boolean).join(' - ') ||
          (optPhoto
            ? 'Pengamatan berbasis dokumentasi foto lapang'
            : 'Gejala terlihat di petak tanaman');

        // Pre-compute candidate references to persist with the observation
        let queryForCandidates = '';
        if (isUnknown) {
          queryForCandidates = [finalOptName, customOptName, finalSymptom].filter(Boolean).join(' ');
        } else {
          queryForCandidates = [targetOpt?.commonName, finalOptName, finalSymptom].filter(Boolean).join(' ');
        }
        const attackLocArray: AttackLocation[] = optLocation ? [optLocation] : [];

        const matches = matchOptRelevance(opts, queryForCandidates, {
          attackLocations: attackLocArray,
          visualTokens: visualAnalysisResult?.detectedKeywords,
          visualClues: visualAnalysisResult?.visualClues,
          minScoreThreshold: 6,
        });
        const candidateIds = matches.slice(0, 3).map((m) => m.opt.id);

        const optObs: OptObservation = {
          id: `obs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          activityId,
          optId: effectiveOptId,
          isUnknown,
          customOptName: finalOptName,
          attackSeverity: severity,
          attackLocation: attackLocArray,
          observedSymptoms: finalSymptom,
          identificationMethod:
            optApproach === 'PHOTO'
              ? 'AI_IMAGE_CAPTURE'
              : optApproach === 'MANUAL_LIST'
              ? 'MANUAL_LIST'
              : 'SYMPTOM',
          confidenceLevel:
            visualAnalysisResult?.confidence || (effectiveOptId ? 'HIGH' : 'UNCERTAIN'),
          detectedTraits: visualAnalysisResult?.detectedTraits || [],
          visualClues: visualAnalysisResult?.visualClues || [],
          candidateOptIds: candidateIds,
          photoAnalysisNotes:
            visualAnalysisResult?.summaryText || visualAnalysisResult?.clarityMessage,
          photoLocalUri: undefined, // FOTO TIDAK DISIMPAN KE DATABASE (Zero-storage privacy rule)
          createdAt: now,
          updatedAt: now,
        };

        createdOptObsRecord = optObs;
        baseActivity.notes = baseActivity.notes || `Pengamatan ${finalOptName} (Tingkat: ${severity})`;
        actionDescription = optLocation
          ? `Pengamatan OPT ${finalOptName} pada bagian ${optLocation}`
          : `Pengamatan OPT ${finalOptName}`;
        await activityRepository.createOptActivity(baseActivity, optObs);
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

      await onSuccess(baseActivity, createdOptObsRecord);
      resetAllTemporaryOptState();
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
      onClose={handleModalClose}
      title={getTitle()}
      maxWidth="lg"
    >
      {!category ? (
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
              {/* Pilihan Metode Input: Foto (Utama) vs Daftar Terdaftar vs Catat Gejala */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Pendekatan Identifikasi Hama / Penyakit
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOptApproach('PHOTO');
                    }}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs border transition-all text-left flex flex-col justify-center min-h-[48px] ${
                      optApproach === 'PHOTO'
                        ? 'bg-amber-700 text-white border-amber-700 shadow-xs ring-1 ring-amber-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50/70'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Camera className="w-4 h-4 shrink-0" />
                      <span className="font-extrabold">Identifikasi dari Foto</span>
                    </div>
                    <span
                      className={`text-[10px] mt-0.5 ${
                        optApproach === 'PHOTO' ? 'text-amber-100' : 'text-slate-500'
                      }`}
                    >
                      Utamakan bukti foto lapang
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOptApproach('MANUAL_LIST');
                      setSelectedCandidateOptId(null);
                    }}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs border transition-all text-left flex flex-col justify-center min-h-[48px] ${
                      optApproach === 'MANUAL_LIST'
                        ? 'bg-amber-700 text-white border-amber-700 shadow-xs ring-1 ring-amber-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50/70'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Bug className="w-4 h-4 shrink-0" />
                      <span className="font-extrabold">Pilih dari Daftar</span>
                    </div>
                    <span
                      className={`text-[10px] mt-0.5 ${
                        optApproach === 'MANUAL_LIST' ? 'text-amber-100' : 'text-slate-500'
                      }`}
                    >
                      Pilih dari master resmi
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOptApproach('SYMPTOM');
                      setSelectedCandidateOptId(null);
                    }}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs border transition-all text-left flex flex-col justify-center min-h-[48px] ${
                      optApproach === 'SYMPTOM'
                        ? 'bg-amber-700 text-white border-amber-700 shadow-xs ring-1 ring-amber-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50/70'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Search className="w-4 h-4 shrink-0" />
                      <span className="font-extrabold">Catat Gejala Bebas</span>
                    </div>
                    <span
                      className={`text-[10px] mt-0.5 ${
                        optApproach === 'SYMPTOM' ? 'text-amber-100' : 'text-slate-500'
                      }`}
                    >
                      Ciri visual & deskripsi
                    </span>
                  </button>
                </div>
              </div>

              {/* TAMPILAN KHUSUS BERDASARKAN PENDEKATAN */}

              {/* 1. JIKA PENDEKATAN FOTO (OPSI UTAMA) */}
              {optApproach === 'PHOTO' && (
                <div className="space-y-3">
                  {/* Bagian Unggah / Ambil Foto Utama */}
                  <div className="p-3.5 bg-white rounded-2xl border border-amber-200 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Camera className="w-4 h-4 text-amber-700" />
                        <span>Foto Tanaman / Gejala di Petak</span>
                      </label>
                      <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Sumber Utama Identifikasi
                      </span>
                    </div>

                    {optPhoto ? (
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row items-start gap-3 p-3 bg-amber-50/50 rounded-xl border border-amber-200">
                          <div className="relative rounded-xl overflow-hidden border border-amber-300 shrink-0 bg-slate-900 w-full sm:w-36">
                            <img
                              src={optPhoto}
                              alt="Foto Gejala Tanaman"
                              className="w-full h-32 object-cover"
                            />
                            {visualAnalysisResult && (
                              <div className="absolute bottom-1.5 left-1.5 right-1.5 bg-slate-900/80 backdrop-blur-xs text-[10px] text-white px-1.5 py-0.5 rounded text-center truncate">
                                {visualAnalysisResult.clarityStatus === 'CLEAR'
                                  ? 'Foto Terdeteksi Jelas'
                                  : 'Pencahayaan Minim'}
                              </div>
                            )}
                          </div>

                          <div className="flex-1 space-y-2 w-full">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                                Foto Berhasil Dimuat
                              </span>
                              <button
                                type="button"
                                onClick={handleRemovePhoto}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Hapus / Ganti</span>
                              </button>
                            </div>

                            {isAnalyzingPhoto ? (
                              <div className="p-3 bg-white rounded-xl border border-amber-200 flex items-center gap-2.5 text-xs text-amber-900 font-medium">
                                <Sparkles className="w-4 h-4 animate-spin text-amber-600 shrink-0" />
                                <span>Menganalisis fitur visual on-device di HP...</span>
                              </div>
                            ) : visualAnalysisResult ? (
                              <div className="p-3 bg-white rounded-xl border border-amber-200 space-y-2 text-xs">
                                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                  <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                    Hasil Analisis Foto
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                      visualAnalysisResult.confidence === 'HIGH'
                                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                        : visualAnalysisResult.confidence === 'MODERATE'
                                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                                        : 'bg-slate-100 text-slate-800 border-slate-300'
                                    }`}
                                  >
                                    Keyakinan:{' '}
                                    {visualAnalysisResult.confidence === 'HIGH'
                                      ? 'Tinggi / Sangat Kuat'
                                      : visualAnalysisResult.confidence === 'MODERATE'
                                      ? 'Mendekati'
                                      : 'Belum Pasti'}
                                  </span>
                                </div>

                                {/* Ciri Visual Terdeteksi (Traits Chips) */}
                                {visualAnalysisResult.detectedTraits &&
                                  visualAnalysisResult.detectedTraits.length > 0 && (
                                    <div className="space-y-1">
                                      <span className="text-[11px] font-semibold text-slate-600 block">
                                        Ciri Visual yang Terdeteksi:
                                      </span>
                                      <div className="flex flex-wrap gap-1">
                                        {visualAnalysisResult.detectedTraits.map((trait, idx) => (
                                          <span
                                            key={idx}
                                            className="px-2 py-0.5 bg-amber-50 text-amber-950 border border-amber-200 rounded-md text-[10px] font-medium"
                                          >
                                            {trait}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                {/* Petunjuk Visual Detail */}
                                {visualAnalysisResult.visualClues.length > 0 && (
                                  <ul className="space-y-1 mt-1 pt-1 border-t border-slate-100">
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
                                )}

                                {/* Peringatan jika foto buram / gelap */}
                                {(visualAnalysisResult.clarityStatus === 'BLURRY_OR_DARK' ||
                                  visualAnalysisResult.clarityStatus === 'UNCLEAR') && (
                                  <div className="mt-2 p-2.5 bg-amber-50 rounded-xl text-[11px] text-amber-950 border border-amber-300 space-y-1.5">
                                    <div className="flex items-center gap-1 font-bold text-amber-900">
                                      <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                      <span>Foto belum cukup jelas untuk identifikasi pasti.</span>
                                    </div>
                                    <p className="text-amber-800 leading-snug">
                                      {visualAnalysisResult.clarityMessage}
                                    </p>
                                    <div className="flex gap-2 pt-1">
                                      <label
                                        htmlFor="opt-camera-reinput"
                                        className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-[10px] font-bold cursor-pointer inline-flex items-center gap-1"
                                      >
                                        <Camera className="w-3 h-3" />
                                        <span>Ambil Foto Lagi</span>
                                      </label>
                                      <input
                                        id="opt-camera-reinput"
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

                                      <label
                                        htmlFor="opt-gallery-reinput"
                                        className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-[10px] font-bold cursor-pointer inline-flex items-center gap-1"
                                      >
                                        <ImageIcon className="w-3 h-3" />
                                        <span>Pilih Foto Lain</span>
                                      </label>
                                      <input
                                        id="opt-gallery-reinput"
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
                                  </div>
                                )}

                                <div className="pt-1 text-[10px] text-slate-500 flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span>Diproses on-device di HP • Foto tidak diunggah ke server</span>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {/* HASIL KANDIDAT & RUJUKAN PEMBANDING DARI FOTO */}
                        <div className="p-3 bg-white rounded-xl border border-amber-200 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                              <Sparkles className="w-4 h-4 text-amber-600" />
                              Kandidat Hama / Penyakit Relevan
                            </span>
                            <span className="text-[10px] text-slate-500">
                              (Pilihan bersifat opsional)
                            </span>
                          </div>

                          {realtimeCandidates.length > 0 ? (
                            <div className="space-y-2">
                              {realtimeCandidates.slice(0, 3).map((candidate) => {
                                const confidence = getMatchConfidenceLabel(
                                  candidate.score,
                                  candidate.isExactMatch
                                );
                                const isSelected =
                                  selectedCandidateOptId === candidate.opt.id;

                                return (
                                  <div
                                    key={candidate.opt.id}
                                    className={`p-2.5 rounded-xl border transition-all ${
                                      isSelected
                                        ? 'bg-emerald-50/80 border-emerald-400 ring-1 ring-emerald-400'
                                        : 'bg-slate-50/70 border-slate-200 hover:bg-amber-50/40'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <strong className="text-xs text-slate-900 font-bold">
                                            {candidate.opt.commonName}
                                          </strong>
                                          <span className="text-[11px] text-slate-500 italic">
                                            ({candidate.opt.scientificName})
                                          </span>
                                          <span
                                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${confidence.badgeColor}`}
                                          >
                                            {confidence.badgeText}
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                                          {candidate.similarityReason}
                                        </p>
                                        <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                                          <span className="font-semibold text-slate-700">Gejala khas:</span> {candidate.opt.symptoms}
                                        </p>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (isSelected) {
                                            setSelectedCandidateOptId(null);
                                            setCustomOptName('');
                                          } else {
                                            setSelectedCandidateOptId(candidate.opt.id);
                                            setCustomOptName(candidate.opt.commonName);
                                          }
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 min-h-[36px] flex items-center gap-1 ${
                                          isSelected
                                            ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                                            : 'bg-amber-700 text-white hover:bg-amber-800'
                                        }`}
                                      >
                                        {isSelected ? (
                                          <>
                                            <Check className="w-3.5 h-3.5" />
                                            <span>Terpilih</span>
                                          </>
                                        ) : (
                                          <span>Gunakan Nama Ini</span>
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}

                              {selectedCandidateOptId && (
                                <p className="text-[11px] text-emerald-800 font-semibold bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                                  ✓ Nama pengamatan ditetapkan sebagai "
                                  {opts.find((o) => o.id === selectedCandidateOptId)?.commonName}". Anda dapat membatalkannya kapan saja untuk menyimpan tanpa nama pasti.
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
                              <span className="font-bold text-slate-800 block">
                                Status: Belum Pasti (Perlu Verifikasi Lapang)
                              </span>
                              <p className="text-[11px] text-slate-600 leading-relaxed">
                                Foto belum cukup spesifik untuk menentukan jenis OPT secara tunggal. Pengamatan Anda tetap dapat disimpan sebagai catatan gejala lapang.
                              </p>
                            </div>
                          )}

                          {/* POIN PEMERIKSAAN LAPANGAN TAMBAHAN */}
                          <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/80 space-y-1.5">
                            <span className="text-xs font-bold text-amber-950 flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                              Poin Pemeriksaan Lapangan Tambahan:
                            </span>
                            <ul className="space-y-1 mt-1">
                              {inspectionPoints.map((point, idx) => (
                                <li
                                  key={idx}
                                  className="text-[11px] text-amber-900 leading-snug flex items-start gap-1.5"
                                >
                                  <span className="text-amber-700 font-bold">•</span>
                                  <span>{point}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {/* Tombol Ambil Foto Kamera */}
                          <label
                            htmlFor="opt-camera-input"
                            className={`py-3.5 px-3 bg-white hover:bg-amber-50/80 active:bg-amber-100 border-2 border-dashed border-amber-300 hover:border-amber-500 rounded-xl text-xs font-bold text-slate-800 transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[48px] shadow-2xs ${
                              isCompressingPhoto ? 'opacity-60 pointer-events-none' : ''
                            }`}
                          >
                            <Camera className="w-5 h-5 text-amber-700 shrink-0" />
                            <span>
                              {isCompressingPhoto
                                ? 'Memproses...'
                                : 'Ambil Foto Langsung (Kamera)'}
                            </span>
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
                            className={`py-3.5 px-3 bg-white hover:bg-amber-50/80 active:bg-amber-100 border-2 border-dashed border-amber-300 hover:border-amber-500 rounded-xl text-xs font-bold text-slate-800 transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[48px] shadow-2xs ${
                              isCompressingPhoto ? 'opacity-60 pointer-events-none' : ''
                            }`}
                          >
                            <ImageIcon className="w-5 h-5 text-amber-700 shrink-0" />
                            <span>Pilih Foto dari Galeri</span>
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

                        <div className="p-2.5 bg-amber-50/70 rounded-xl border border-amber-200 text-[11px] text-amber-900 space-y-1">
                          <p className="font-semibold">
                            💡 Pengamatan BISA disimpan hanya dengan foto dan informasi lapangan.
                          </p>
                          <p className="text-amber-800">
                            Anda tidak wajib memilih nama Hama/OPT dari daftar. Sistem akan menganalisis foto dan mencarikan rujukan pembanding yang relevan.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Input Catatan / Nama Sementara Opsional */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nama Sementara / Catatan Lapang Tambahan (Opsional)
                    </label>
                    <input
                      type="text"
                      value={customOptName}
                      onChange={(e) => setCustomOptName(e.target.value)}
                      placeholder="Contoh: Daun menguning di ujung, terlihat beberapa ulat kecil..."
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 min-h-[44px]"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Boleh dikosongkan. Pengamatan akan tetap tersimpan aman di riwayat aktivitas.
                    </p>
                  </div>
                </div>
              )}

              {/* 2. JIKA PENDEKATAN DAFTAR TERDAFTAR (MANUAL RESMI) */}
              {optApproach === 'MANUAL_LIST' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Pilih Hama / Penyakit Terdaftar <span className="text-amber-800">*</span>
                    </label>
                    <select
                      value={selectedOptId}
                      onChange={(e) => setSelectedOptId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-600 min-h-[44px]"
                    >
                      <option value="">-- Pilih Hama / Penyakit Terdaftar --</option>
                      {opts.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.commonName} ({o.scientificName})
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Pilih nama OPT resmi dari katalog Kementan RI & BBPadi jika sudah teridentifikasi pasti.
                    </p>
                  </div>

                  {/* Unggah Foto Tambahan (Opsional di mode Manual) */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Lampirkan Foto Pengamatan (Opsional)</span>
                    </div>
                    {optPhoto ? (
                      <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                        <img
                          src={optPhoto}
                          alt="Foto"
                          className="w-16 h-14 object-cover rounded-lg border border-slate-200"
                        />
                        <div className="flex-1">
                          <span className="text-xs text-slate-800 font-semibold block">
                            Foto terlampir
                          </span>
                          <button
                            type="button"
                            onClick={handleRemovePhoto}
                            className="text-[11px] text-red-700 font-bold hover:underline"
                          >
                            Hapus Foto
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <label
                          htmlFor="manual-opt-camera"
                          className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-700 text-center cursor-pointer min-h-[40px] flex items-center justify-center gap-1"
                        >
                          <Camera className="w-4 h-4 text-slate-600" />
                          <span>Kamera</span>
                        </label>
                        <input
                          id="manual-opt-camera"
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

                        <label
                          htmlFor="manual-opt-gallery"
                          className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-700 text-center cursor-pointer min-h-[40px] flex items-center justify-center gap-1"
                        >
                          <ImageIcon className="w-4 h-4 text-slate-600" />
                          <span>Galeri</span>
                        </label>
                        <input
                          id="manual-opt-gallery"
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
                    )}
                  </div>
                </div>
              )}

              {/* 3. JIKA PENDEKATAN GEJALA BEBAS */}
              {optApproach === 'SYMPTOM' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nama Sementara / Deskripsi Singkat Gejala Bebas
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

                  {/* Unggah Foto Tambahan (Opsional di mode Gejala) */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Lampirkan Foto Pengamatan (Opsional)</span>
                    </div>
                    {optPhoto ? (
                      <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                        <img
                          src={optPhoto}
                          alt="Foto"
                          className="w-16 h-14 object-cover rounded-lg border border-slate-200"
                        />
                        <div className="flex-1">
                          <span className="text-xs text-slate-800 font-semibold block">
                            Foto terlampir
                          </span>
                          <button
                            type="button"
                            onClick={handleRemovePhoto}
                            className="text-[11px] text-red-700 font-bold hover:underline"
                          >
                            Hapus Foto
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <label
                          htmlFor="symptom-opt-camera"
                          className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-700 text-center cursor-pointer min-h-[40px] flex items-center justify-center gap-1"
                        >
                          <Camera className="w-4 h-4 text-slate-600" />
                          <span>Kamera</span>
                        </label>
                        <input
                          id="symptom-opt-camera"
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

                        <label
                          htmlFor="symptom-opt-gallery"
                          className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-700 text-center cursor-pointer min-h-[40px] flex items-center justify-center gap-1"
                        >
                          <ImageIcon className="w-4 h-4 text-slate-600" />
                          <span>Galeri</span>
                        </label>
                        <input
                          id="symptom-opt-gallery"
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
                    )}
                  </div>
                </div>
              )}

              {/* Pilihan Bagian Tanaman */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Bagian Tanaman yang Terkena Serangan <span className="text-slate-500 font-normal">(Opsional • Klik lagi untuk membatalkan)</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'LEAF' as AttackLocation, label: 'Daun / Pelepah' },
                    { id: 'STEM' as AttackLocation, label: 'Batang / Pangkal' },
                    { id: 'PANICLE' as AttackLocation, label: 'Malai / Gabah' },
                    { id: 'ROOT' as AttackLocation, label: 'Akar Tanaman' },
                    { id: 'WHOLE_PLANT' as AttackLocation, label: 'Seluruh Rumpun' },
                  ].map((loc) => {
                    const isSelected = optLocation === loc.id;
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => setOptLocation((prev) => (prev === loc.id ? '' : loc.id))}
                        className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition-all min-h-[44px] flex items-center justify-center ${
                          isSelected
                            ? 'bg-amber-100 text-amber-950 border-amber-400 font-extrabold shadow-2xs ring-1 ring-amber-400'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50/50'
                        }`}
                      >
                        {loc.label}
                      </button>
                    );
                  })}
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
              onClick={handleModalClose}
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
