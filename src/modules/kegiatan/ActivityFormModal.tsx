/**
 * HIKMAT TANI - Activity Form Modal (Pusat Pencatatan Kegiatan)
 * 
 * Prinsip:
 * - "Catat sedikit, sistem yang mengolah lebih banyak."
 * - Progressive disclosure: Form sederhana, tidak membebani petani.
 * - 6 Kategori Kegiatan Utama:
 *   1. Tanam (PLANTING)
 *   2. Pupuk (FERTILIZER) -> hitung hara via nutrientEngine
 *   3. Pengairan (IRRIGATION)
 *   4. OPT (OPT) -> ramah pemula, opsi "Belum tahu nama OPT"
 *   5. Perawatan (MAINTENANCE)
 *   6. Panen (HARVEST)
 * - Terintegrasi dengan Tiga Jalur Keputusan (opsional decisionId untuk mencatat ActualAction).
 */

import { useState, type FormEvent, useEffect, type ChangeEvent } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Bug,
  Calendar,
  Camera,
  CheckCircle2,
  Droplets,
  FlaskConical,
  HelpCircle,
  Image as ImageIcon,
  Leaf,
  Plus,
  Scissors,
  Search,
  Sparkles,
  Sprout,
  Trash2,
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

  // --- State Khusus OPT (Ramah Pemula) ---
  const [isUnknownOpt, setIsUnknownOpt] = useState<boolean>(true);
  const [selectedOptId, setSelectedOptId] = useState<string>('');
  const [customOptName, setCustomOptName] = useState<string>('');
  const [severity, setSeverity] = useState<AttackSeverity>('LIGHT');
  const [optLocation, setOptLocation] = useState<AttackLocation>('LEAF');
  const [symptomPreset, setSymptomPreset] = useState<string>('');
  const [optPhoto, setOptPhoto] = useState<string | null>(null);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState<boolean>(false);

  // --- State Sukses Pengamatan OPT ---
  const [submittedOptSummary, setSubmittedOptSummary] = useState<{
    optName: string;
    locationLabel: string;
    severityLabel: string;
    severity: AttackSeverity;
    symptoms: string;
    optId?: string;
    isUnknown: boolean;
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
      setIsCompressingPhoto(false);
      setSubmittedOptSummary(null);
      if (fertilizers.length > 0) {
        setSelectedFertId(fertilizers[0].id);
      }
      if (opts.length > 0) {
        setSelectedOptId(opts[0].id);
      }
    }
  }, [isOpen, initialCategory, fertilizers, opts]);

  if (!isOpen || !land || !activeSeason) return null;

  // Hitung snapshot HST berdasarkan tanggal aktivitas
  const hstResult = activeSeason.plantingDate
    ? calculateHST(activeSeason.plantingDate, activityDate)
    : { isValid: true, hst: 0 };
  const hstSnapshot = hstResult.isValid && hstResult.hst !== null ? hstResult.hst : 0;

  // Kalkulasi Preview Hara Pupuk (Realtime)
  const selectedFert = fertilizers.find((f) => f.id === selectedFertId);
  const currentKg = parseFloat(amountKg) || 0;
  const nutrientPreview = selectedFert
    ? calculateNutrients(currentKg, selectedFert.nutrientComposition)
    : calculateNutrients(currentKg, null);

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

        setSubmittedOptSummary({
          optName: finalOptName,
          locationLabel: locationLabels[optLocation] || optLocation,
          severityLabel: severityLabels[severity] || severity,
          severity,
          symptoms: finalSymptom,
          optId: isUnknownOpt ? undefined : selectedOptId,
          isUnknown: isUnknownOpt,
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

        // Jika dicentang selesaikan musim tanam
        if (completeSeason) {
          await cropSeasonRepository.update(activeSeason.id, {
            status: 'COMPLETED',
            harvestDate: activityDate,
            yieldKg: yieldKg > 0 ? yieldKg : undefined,
          });
        }
      } else if (category === 'PLANTING') {
        const ageNum = parseInt(seedlingAgeDays, 10);
        if (isNaN(ageNum) || ageNum < 0) {
          throw new Error('Umur bibit harus berupa angka positif atau nol');
        }
        baseActivity.notes = `Tanam Padi: Sistem ${plantingSystem} • Umur bibit ${seedlingAgeDays} HSS${notes ? ` • ${notes}` : ''}`;
        actionDescription = `Penanaman padi sistem ${plantingSystem}`;
        await activityRepository.create(baseActivity);
      } else {
        await activityRepository.create(baseActivity);
      }

      // Jika kegiatan ini merupakan Tindakan Aktual dari Tiga Jalur Keputusan:
      if (decisionId) {
        const actualAction: ActualAction = {
          id: `act-action-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          cropSeasonId: activeSeason.id,
          activityId: baseActivity.id,
          decisionId,
          actionType: `${category}_ACTION`,
          description: actionDescription || baseActivity.notes || 'Tindakan aktual lapangan',
          performedAt: activityDate,
          createdAt: now,
        };
        await recommendationRepository.recordActualAction(actualAction);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Gagal menyimpan catatan kegiatan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={submittedOptSummary ? 'Pengamatan Dicatat' : getTitle()}
      subtitle={`Lahan: ${land.name} • Varietas: ${activeSeason.varietyName || 'Padi'} (~${hstSnapshot} HST)`}
    >
      {/* Jika Pengamatan OPT Baru Saja Disimpan: Tampilkan Ringkasan Visual Kontekstual */}
      {submittedOptSummary ? (
        <div className="space-y-4 py-1 animate-in fade-in duration-200">
          {/* Header Sukses Ramah */}
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="w-6 h-6 text-emerald-700" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-sm sm:text-base font-bold text-emerald-950">
                Pengamatan Anda Sudah Dicatat
              </h3>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Data pengamatan lapang telah tersimpan aman di perangkat dan terhubung dengan saran budidaya Beranda.
              </p>
            </div>
          </div>

          {/* Ringkasan Visual: Pengamatan Anda */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Bug className="w-4 h-4 text-amber-700" />
                Pengamatan Anda
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {activityDate} • {hstSnapshot} HST
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-500 shrink-0">OPT / Sasaran:</span>
                <span className="font-bold text-slate-900 text-right">
                  {submittedOptSummary.optName}
                  {submittedOptSummary.isUnknown && (
                    <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-normal">
                      Belum teridentifikasi
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

              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-500 block mb-1">Gejala yang Diamati:</span>
                <p className="text-slate-700 bg-slate-50 p-2.5 rounded-xl text-xs leading-relaxed font-medium">
                  {submittedOptSummary.symptoms}
                </p>
              </div>
            </div>
          </div>

          {/* Jembatan Visual: Berdasarkan Pengamatan Anda */}
          <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200/90 space-y-1.5">
            <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-700" />
              Berdasarkan pengamatan Anda...
            </span>
            <p className="text-xs text-amber-900 leading-relaxed">
              {submittedOptSummary.isUnknown
                ? 'Karena nama OPT belum teridentifikasi pasti, Anda dapat membuka rujukan pembanding gejala lapang dan melihat musuh alami yang relevan untuk membantu pengamatan lebih lanjut.'
                : `Saran pertimbangan lapang berbasis 4 Pilar PHT telah diperbarui. Anda dapat membuka panduan pengendalian terpadu dan daftar musuh alami untuk ${submittedOptSummary.optName}.`}
            </p>
          </div>

          {/* Tombol Aksi Langsung ke Rujukan PHT */}
          <div className="pt-2 space-y-2">
            <button
              type="button"
              onClick={() => {
                const queryOrId = submittedOptSummary.optId;
                const queryText = submittedOptSummary.isUnknown
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
                <span className="text-[11px] text-slate-500">Pengamatan gejala lapangan</span>
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
                <span className="text-[11px] text-slate-500">Penyiangan & penyulaman</span>
              </div>
            </button>

            {/* 6. Panen */}
            <button
              type="button"
              onClick={() => setCategory('HARVEST')}
              className="p-4 bg-white hover:bg-yellow-50/80 active:bg-yellow-100 border border-slate-200 hover:border-yellow-300 rounded-2xl text-left transition-all group flex flex-col justify-between min-h-[96px] shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-yellow-100 text-yellow-900 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Wheat className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-bold text-slate-900 block">Panen</span>
                <span className="text-[11px] text-slate-500">Hasil gabah & akhir musim</span>
              </div>
            </button>
          </div>
        </div>
      ) : (
        /* 2. Form Progressive Sesuai Kategori */
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Tombol ganti kategori */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <button
              type="button"
              onClick={() => setCategory(null)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Ganti Jenis Kegiatan</span>
            </button>
            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 text-[11px] font-bold rounded-full border border-emerald-200">
              Kategori: {getTitle().replace('Catat ', '')}
            </span>
          </div>

          {/* Tanggal & Estimasi HST */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tanggal Kegiatan <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={activityDate}
                onChange={(e) => setActivityDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Umur Tanaman (Snapshot)
              </label>
              <div className="px-3 py-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-sm font-bold text-emerald-900 min-h-[44px] flex items-center justify-between">
                <span>{hstSnapshot} Hari Setelah Tanam</span>
                <span className="text-[10px] font-semibold text-emerald-700 font-mono">HST</span>
              </div>
            </div>
          </div>

          {/* --- FORM 1: PEMUPUKAN (FERTILIZER) --- */}
          {category === 'FERTILIZER' && (
            <div className="space-y-3 p-3.5 bg-emerald-50/50 rounded-2xl border border-emerald-200/80">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  1. Pilih Jenis Pupuk <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedFertId}
                  onChange={(e) => setSelectedFertId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px]"
                >
                  {fertilizers.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} {f.formula ? `(${f.formula})` : ''}
                    </option>
                  ))}
                  <option value="">Lainnya / Pupuk Organik / Racikan Sendiri</option>
                </select>
              </div>

              {!selectedFertId && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Pupuk Khusus / Racikan
                  </label>
                  <input
                    type="text"
                    value={customFertName}
                    onChange={(e) => setCustomFertName(e.target.value)}
                    placeholder="Contoh: Kompos Kandang Matang / Pupuk Organik Cair"
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px]"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    2. Jumlah Pupuk (Kg) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.1"
                    value={amountKg}
                    onChange={(e) => setAmountKg(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    3. Cara Aplikasi
                  </label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px]"
                  >
                    <option value="BROADCAST">Tabur Merata (Broadcast)</option>
                    <option value="BAND">Larik / Alur di Sela Legowo</option>
                    <option value="DRENCH">Kocor / Larutan</option>
                    <option value="FOLIAR">Semprot Daun</option>
                  </select>
                </div>
              </div>

              {/* Realtime Nutrient Engine Preview */}
              {selectedFert && (
                <div className="p-2.5 bg-white rounded-xl border border-emerald-200 text-xs space-y-1">
                  <span className="text-[11px] font-bold text-emerald-900 block">
                    Kandungan Hara Terhitung Otomatis (nutrientEngine):
                  </span>
                  <div className="flex flex-wrap gap-2 text-slate-700 font-medium">
                    <span className="px-2 py-0.5 bg-emerald-50 rounded border border-emerald-200">
                      N: <strong>{nutrientPreview.primarySummary.N_kg.toFixed(1)} kg</strong>
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-50 rounded border border-emerald-200">
                      P₂O₅: <strong>{nutrientPreview.primarySummary.P2O5_kg.toFixed(1)} kg</strong>
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-50 rounded border border-emerald-200">
                      K₂O: <strong>{nutrientPreview.primarySummary.K2O_kg.toFixed(1)} kg</strong>
                    </span>
                    {nutrientPreview.primarySummary.S_kg > 0 && (
                      <span className="px-2 py-0.5 bg-emerald-50 rounded border border-emerald-200">
                        S: <strong>{nutrientPreview.primarySummary.S_kg.toFixed(1)} kg</strong>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* --- FORM 2: PENGAMATAN OPT (RAMAH PEMULA) --- */}
          {category === 'OPT' && (
            <div className="space-y-4 p-4 bg-amber-50/50 rounded-2xl border border-amber-200/80">
              {/* Mode Identifikasi: Terdaftar vs Belum Tahu */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Cara Pencatatan OPT / Hama
                </label>
                <div className="grid grid-cols-2 gap-2">
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
                    Nama Sementara / Deskripsi Singkat (Opsional)
                  </label>
                  <input
                    type="text"
                    value={customOptName}
                    onChange={(e) => setCustomOptName(e.target.value)}
                    placeholder="Contoh: Daun menguning bercak coklat / Ulat penggerek"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 min-h-[44px]"
                  />
                  <p className="text-[11px] text-amber-800 mt-1">
                    Anda tidak perlu menebak nama pasti; sistem akan menyelaraskan panduan berdasarkan gejala dan bagian tanaman.
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
                          ? 'bg-amber-100 text-amber-950 border-amber-400 font-extrabold shadow-2xs'
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
                      onClick={() => setSymptomPreset(sym)}
                      className={`px-3 py-2 text-xs rounded-xl font-medium transition-colors border min-h-[38px] ${
                        symptomPreset === sym
                          ? 'bg-amber-700 text-white border-amber-700 font-bold'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50'
                      }`}
                    >
                      {sym}
                    </button>
                  ))}
                </div>
              </div>

              {/* Foto Lapangan (Opsional) */}
              <div className="pt-1">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Camera className="w-3.5 h-3.5 text-amber-700" />
                    <span>Foto Gejala di Sawah (Opsional)</span>
                  </span>
                  <span className="text-[11px] font-normal text-slate-500">
                    Otomatis dikompresi di perangkat
                  </span>
                </label>

                {optPhoto ? (
                  <div className="relative inline-block border-2 border-amber-300 rounded-2xl overflow-hidden shadow-xs bg-slate-900">
                    <img
                      src={optPhoto}
                      alt="Foto Gejala OPT"
                      className="w-36 h-28 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setOptPhoto(null)}
                      className="absolute top-1.5 right-1.5 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors shadow-xs min-h-[32px] min-w-[32px] flex items-center justify-center"
                      title="Hapus foto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <label
                      htmlFor="opt-photo-input"
                      className={`inline-flex items-center gap-2 px-3.5 py-2.5 bg-white border border-dashed border-amber-300 hover:border-amber-500 rounded-xl text-xs font-bold text-slate-700 hover:bg-amber-50/60 cursor-pointer transition-colors min-h-[44px] ${
                        isCompressingPhoto ? 'opacity-60 pointer-events-none' : ''
                      }`}
                    >
                      <ImageIcon className="w-4 h-4 text-amber-700" />
                      <span>
                        {isCompressingPhoto ? 'Mengompres Foto...' : 'Ambil Foto / Pilih Gambar'}
                      </span>
                    </label>
                    <input
                      id="opt-photo-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e: ChangeEvent<HTMLInputElement>) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setIsCompressingPhoto(true);
                        try {
                          const compressed = await compressImage(file, {
                            maxWidth: 800,
                            maxHeight: 800,
                            quality: 0.7,
                          });
                          setOptPhoto(compressed);
                        } catch (err) {
                          console.warn('Gagal memproses foto:', err);
                          setError('Gagal memproses foto. Silakan coba lagi atau lanjutkan tanpa foto.');
                        } finally {
                          setIsCompressingPhoto(false);
                          e.target.value = '';
                        }
                      }}
                    />
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
