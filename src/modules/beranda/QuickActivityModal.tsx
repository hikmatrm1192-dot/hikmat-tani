/**
 * HIKMAT TANI - Quick Activity Modal
 * 
 * Memfasilitasi aksi cepat pencatatan kegiatan lapang dari Beranda:
 * - Pemupukan (Nama pupuk, jumlah kg, metode aplikasi)
 * - Pengamatan OPT (Jenis OPT / Hama, tingkat keparahan, gejala)
 * - Pengairan (Kondisi air: macak-macak, tergenang, pengeringan berkala)
 */

import { useState, type FormEvent, useEffect } from 'react';
import { Modal } from '../../components/common/Modal.tsx';
import { calculateHST } from '../../engine/hstCalculator.ts';
import { calculateNutrients } from '../../engine/nutrientEngine.ts';
import { activityRepository } from '../../db/repositories/activityRepository.ts';
import {
  Activity,
  ActivityCategory,
  AttackLocation,
  AttackSeverity,
  CropSeason,
  Fertilizer,
  FertilizerApplication,
  Land,
  OptObservation,
} from '../../types/index.ts';

interface QuickActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: ActivityCategory | null;
  land: Land | null;
  activeSeason: CropSeason | null;
  fertilizers: Fertilizer[];
  onSuccess: () => void;
}

export function QuickActivityModal({
  isOpen,
  onClose,
  category,
  land,
  activeSeason,
  fertilizers,
  onSuccess,
}: QuickActivityModalProps) {
  const [activityDate, setActivityDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fertilizer specific state
  const [selectedFertId, setSelectedFertId] = useState<string>('');
  const [customFertName, setCustomFertName] = useState<string>('');
  const [amountKg, setAmountKg] = useState<string>('50');
  const [method, setMethod] = useState<string>('BROADCAST');

  // OPT specific state
  const [optName, setOptName] = useState<string>('');
  const [severity, setSeverity] = useState<AttackSeverity>('LIGHT');
  const [optLocation, setOptLocation] = useState<string>('LEAF');

  // Irrigation specific state
  const [waterCondition, setWaterCondition] = useState<string>('Macak-macak (1-2 cm)');

  useEffect(() => {
    if (isOpen) {
      setActivityDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      setError(null);
      if (fertilizers.length > 0) {
        setSelectedFertId(fertilizers[0].id);
      }
    }
  }, [isOpen, fertilizers]);

  if (!isOpen || !category || !activeSeason || !land) return null;

  // Hitung snapshot HST
  const hstResult = activeSeason.plantingDate
    ? calculateHST(activeSeason.plantingDate, activityDate)
    : { isValid: true, hst: 0 };
  const hstSnapshot = hstResult.isValid && hstResult.hst !== null ? hstResult.hst : 0;

  const getTitle = () => {
    switch (category) {
      case 'FERTILIZER':
        return 'Catat Pemupukan Lapang';
      case 'OPT':
        return 'Catat Pengamatan OPT / Hama';
      case 'IRRIGATION':
        return 'Catat Pengaturan Pengairan';
      default:
        return 'Catat Kegiatan Lapang';
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
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

      if (category === 'FERTILIZER') {
        const kg = parseFloat(amountKg) || 0;
        if (kg <= 0) {
          throw new Error('Jumlah pupuk harus lebih dari 0 kg');
        }

        const selectedFert = fertilizers.find((f) => f.id === selectedFertId);
        const fertName = selectedFert ? selectedFert.name : customFertName || 'Pupuk Campuran';

        // Hitung kandungan hara
        const nutrientCalc = selectedFert
          ? calculateNutrients(kg, selectedFert.nutrientComposition)
          : calculateNutrients(kg, null);

        const fertApp: FertilizerApplication = {
          id: `fa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          activityId,
          fertilizerId: selectedFert?.id,
          fertilizerName: fertName,
          amountKg: kg,
          applicationMethod: method as any,
          calculatedNutrients: {
            N_kg: nutrientCalc.primarySummary.N_kg,
            P2O5_kg: nutrientCalc.primarySummary.P2O5_kg,
            K2O_kg: nutrientCalc.primarySummary.K2O_kg,
            S_kg: nutrientCalc.primarySummary.S_kg,
          },
          notes: notes.trim() || undefined,
          createdAt: now,
          updatedAt: now,
        };

        baseActivity.notes = baseActivity.notes || `Aplikasi ${fertName} ${kg} kg`;
        await activityRepository.createFertilizerActivity(baseActivity, fertApp);
      } else if (category === 'OPT') {
        const targetOptName = optName.trim() || 'Pengamatan Gejala Hama/Penyakit';
        const optObs: OptObservation = {
          id: `obs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          activityId,
          isUnknown: true,
          customOptName: targetOptName,
          attackSeverity: severity,
          attackLocation: [optLocation as any],
          observedSymptoms: notes.trim() || 'Terlihat gejala di petak tanaman',
          createdAt: now,
          updatedAt: now,
        };

        baseActivity.notes = baseActivity.notes || `Pengamatan ${targetOptName} (${severity})`;
        await activityRepository.createOptActivity(baseActivity, optObs);
      } else if (category === 'IRRIGATION') {
        baseActivity.notes = `Pengairan: ${waterCondition}${notes ? ` - ${notes}` : ''}`;
        await activityRepository.create(baseActivity);
      } else {
        await activityRepository.create(baseActivity);
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
      title={getTitle()}
      subtitle={`Lahan: ${land.name} • Musim: ${activeSeason.varietyName || 'Padi'} (~${hstSnapshot} HST)`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

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
            <div className="px-3 py-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-sm font-bold text-emerald-900 min-h-[44px] flex items-center">
              {hstSnapshot} Hari Setelah Tanam (HST)
            </div>
          </div>
        </div>

        {/* Dynamic Fields Berdasarkan Kategori */}
        {category === 'FERTILIZER' && (
          <div className="space-y-3 p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-200/80">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Pilih Jenis Pupuk <span className="text-red-500">*</span>
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
                <option value="">Lainnya / Pupuk Racikan</option>
              </select>
            </div>

            {!selectedFertId && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Pupuk Khusus
                </label>
                <input
                  type="text"
                  value={customFertName}
                  onChange={(e) => setCustomFertName(e.target.value)}
                  placeholder="Contoh: Kompos Kandang Matang"
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px]"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Jumlah (Kg) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.1"
                  value={amountKg}
                  onChange={(e) => setAmountKg(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Metode Aplikasi
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
          </div>
        )}

        {category === 'OPT' && (
          <div className="space-y-3 p-3.5 bg-amber-50/50 rounded-xl border border-amber-200/80">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Hama / Penyakit yang Diamati <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={optName}
                onChange={(e) => setOptName(e.target.value)}
                placeholder="Contoh: Wereng Coklat, Penggerek Batang, atau Gejala Daun Kuning"
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px]"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tingkat Serangan
                </label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as AttackSeverity)}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px]"
                >
                  <option value="LIGHT">Ringan (Terlihat di beberapa rumpun)</option>
                  <option value="MEDIUM">Sedang (Mulai menyebar)</option>
                  <option value="HEAVY">Berat (Mengancam pertanaman)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Bagian Tanaman
                </label>
                <select
                  value={optLocation}
                  onChange={(e) => setOptLocation(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px]"
                >
                  <option value="LEAF">Daun / Pelepah</option>
                  <option value="STEM">Batang / Pangkal Batang</option>
                  <option value="ROOT">Akar</option>
                  <option value="PANICLE">Malai / Gabah</option>
                  <option value="WHOLE_PLANT">Seluruh Tanaman</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {category === 'IRRIGATION' && (
          <div className="space-y-3 p-3.5 bg-sky-50/50 rounded-xl border border-sky-200/80">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Kondisi Air di Petak Sawah
              </label>
              <select
                value={waterCondition}
                onChange={(e) => setWaterCondition(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px]"
              >
                <option value="Macak-macak (1-2 cm)">Macak-macak (1-2 cm - Fase Anakan)</option>
                <option value="Tergenang Dangkal (3-5 cm)">Tergenang Dangkal (3-5 cm - Bunting/Berbunga)</option>
                <option value="Pengeringan Berkala (Intermittent)">Pengeringan Berkala (Intermittent / Aerasi Tanah)</option>
                <option value="Pengeringan Pra-Panen">Pengeringan Menjelang Panen (7-10 hari pra panen)</option>
                <option value="Kekurangan Air / Kemarau">Kekurangan Air (Pasokan Terbatas)</option>
              </select>
            </div>
          </div>
        )}

        {/* Catatan Tambahan */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Catatan Tambahan (Opsional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Catatan kondisi lapangan atau tindakan yang dilakukan..."
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        {/* Tombol Aksi */}
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
    </Modal>
  );
}
