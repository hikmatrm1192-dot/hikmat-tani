/**
 * HIKMAT TANI - Seedbed (Persemaian) Form Modal
 * 
 * Prinsip Desain:
 * - Bahasa Indonesia, ramah dan mudah dipahami petani
 * - Target sentuh minimal 48px pada elemen interaktif
 * - Tanggal semai sebagai HSS (Hari Setelah Semai)
 */

import { FormEvent, useState } from 'react';
import { AlertCircle, Calendar, Check, Leaf, MapPin, Scale, X } from 'lucide-react';
import { seedbedRepository } from '../../db/repositories/seedbedRepository.ts';
import { CropSeason, Land, NurseryMethod, RiceVariety, Seedbed } from '../../types/index.ts';

interface SeedbedFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  land: Land;
  activeSeason: CropSeason;
  varieties?: RiceVariety[];
  onSuccess: () => Promise<void>;
  editSeedbed?: Seedbed | null;
}

const NURSERY_METHODS: { id: NurseryMethod; label: string; desc: string }[] = [
  {
    id: 'WET_BED',
    label: 'Persemaian Basah Tradisional',
    desc: 'Bedengan basah di sudut petak sawah (rekomendasi umum)',
  },
  {
    id: 'DRY_BED',
    label: 'Persemaian Kering',
    desc: 'Bedengan darat / pekarangan untuk efisiensi air',
  },
  {
    id: 'DAPOG',
    label: 'Dapog Nampan (Mesin Transplanter)',
    desc: 'Semai di nampan plastik khusus mesin tanam transplanter',
  },
  {
    id: 'TRAY',
    label: 'Tray Semai Moderen',
    desc: 'Wadah tray bibit teratur dengan media tanam khusus',
  },
  {
    id: 'OTHER',
    label: 'Metode Lainnya',
    desc: 'Metode persemaian lokal atau modifikasi spesifik',
  },
];

export function SeedbedFormModal({
  isOpen,
  onClose,
  land,
  activeSeason,
  varieties = [],
  onSuccess,
  editSeedbed,
}: SeedbedFormModalProps) {
  const todayStr = new Date().toISOString().split('T')[0];

  const [startDate, setStartDate] = useState<string>(
    editSeedbed?.startDate
      ? editSeedbed.startDate.split('T')[0]
      : todayStr
  );
  const [varietyName, setVarietyName] = useState<string>(
    editSeedbed?.varietyName || activeSeason.varietyName || 'Inpari 32'
  );
  const [nurseryMethod, setNurseryMethod] = useState<NurseryMethod>(
    editSeedbed?.nurseryMethod || 'WET_BED'
  );
  const [customMethodName, setCustomMethodName] = useState<string>('');
  const [seedAmountKg, setSeedAmountKg] = useState<string>(
    editSeedbed?.seedAmountKg ? String(editSeedbed.seedAmountKg) : '25'
  );
  const [nurseryAreaM2, setNurseryAreaM2] = useState<string>(
    editSeedbed?.nurseryAreaM2 ? String(editSeedbed.nurseryAreaM2) : '400'
  );
  const [transplantDateExpected, setTransplantDateExpected] = useState<string>(
    editSeedbed?.transplantDateExpected
      ? editSeedbed.transplantDateExpected.split('T')[0]
      : ''
  );
  const [nurseryLocation, setNurseryLocation] = useState<string>(
    editSeedbed?.nurseryLocation || ''
  );
  const [notes, setNotes] = useState<string>(editSeedbed?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const amountNum = parseFloat(seedAmountKg);
    if (isNaN(amountNum) || amountNum <= 0) {
      setErrorMessage('Masukkan jumlah kebutuhan benih (kg) yang valid.');
      return;
    }

    if (!varietyName.trim()) {
      setErrorMessage('Nama varietas benih tidak boleh kosong.');
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();
      const finalMethod: NurseryMethod =
        nurseryMethod === 'OTHER' && customMethodName.trim()
          ? customMethodName.trim()
          : nurseryMethod;

      const seedbedData: Seedbed = {
        id: editSeedbed?.id || crypto.randomUUID(),
        cropSeasonId: activeSeason.id,
        startDate: new Date(startDate).toISOString(),
        varietyName: varietyName.trim(),
        nurseryMethod: finalMethod,
        seedAmountKg: amountNum,
        nurseryAreaM2: nurseryAreaM2 ? parseFloat(nurseryAreaM2) : undefined,
        transplantDateExpected: transplantDateExpected
          ? new Date(transplantDateExpected).toISOString()
          : undefined,
        nurseryLocation: nurseryLocation.trim() || undefined,
        notes: notes.trim() || undefined,
        createdAt: editSeedbed?.createdAt || now,
        updatedAt: now,
      };

      if (editSeedbed) {
        await seedbedRepository.update(editSeedbed.id, seedbedData);
      } else {
        await seedbedRepository.create(seedbedData);
      }

      await onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving seedbed:', err);
      setErrorMessage('Gagal menyimpan data persemaian. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="seedbed-form-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header Modal */}
        <div className="px-6 py-5 bg-emerald-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-900/60 border border-emerald-600 flex items-center justify-center">
              <Leaf className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                {editSeedbed ? 'Edit Data Persemaian' : 'Catat Persemaian Benih'}
              </h3>
              <p className="text-xs text-emerald-200 font-medium">
                {land.name} • {activeSeason.varietyName || 'Padi Sawah'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-emerald-900/40 hover:bg-emerald-900/80 text-emerald-200 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Tanggal Mulai Semai */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-700" />
              <span>Tanggal Mulai Sebar Benih (HSS 0) *</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 min-h-[48px] bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Hari Setelah Semai (HSS) dihitung otomatis mulai dari tanggal ini.
            </p>
          </div>

          {/* Varietas Benih */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Varietas Benih Padi *
            </label>
            <div className="space-y-2">
              <input
                type="text"
                value={varietyName}
                onChange={(e) => setVarietyName(e.target.value)}
                placeholder="Contoh: Inpari 32, Ciherang, Varietas Lokal"
                required
                className="w-full px-3.5 py-2.5 min-h-[48px] bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
              {varieties.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[11px] font-bold text-slate-500 self-center mr-1">
                    Saran:
                  </span>
                  {varieties.slice(0, 5).map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVarietyName(v.name)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border font-semibold transition-colors ${
                        varietyName === v.name
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Metode Persemaian */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Metode / Sistem Persemaian *
            </label>
            <div className="space-y-1.5">
              {NURSERY_METHODS.map((m) => (
                <label
                  key={m.id}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                    nurseryMethod === m.id
                      ? 'bg-emerald-50/80 border-emerald-600 ring-1 ring-emerald-600 shadow-2xs'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="nurseryMethod"
                    value={m.id}
                    checked={nurseryMethod === m.id}
                    onChange={() => setNurseryMethod(m.id)}
                    className="mt-0.5 text-emerald-700 focus:ring-emerald-600 w-3.5 h-3.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight">{m.label}</div>
                    <div className="text-[10px] sm:text-[11px] text-slate-500 leading-tight mt-0.5">{m.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            {nurseryMethod === 'OTHER' && (
              <div className="mt-2 pl-6">
                <input
                  type="text"
                  value={customMethodName}
                  onChange={(e) => setCustomMethodName(e.target.value)}
                  placeholder="Ketik metode persemaian yang digunakan..."
                  className="w-full px-3 py-2 min-h-[40px] bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-[13px] font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-700"
                />
              </div>
            )}
          </div>

          {/* Jumlah Benih & Luas Bedengan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                <Scale className="w-3.5 h-3.5 text-emerald-700" />
                <span>Jumlah Benih (kg) *</span>
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={seedAmountKg}
                onChange={(e) => setSeedAmountKg(e.target.value)}
                placeholder="25"
                required
                className="w-full px-3.5 py-2.5 min-h-[48px] bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-700"
              />
              <p className="text-[10px] text-slate-500 mt-1">Standar: 20-25 kg/ha</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Luas Bedengan Semai (m²)
              </label>
              <input
                type="number"
                step="1"
                min="1"
                value={nurseryAreaM2}
                onChange={(e) => setNurseryAreaM2(e.target.value)}
                placeholder="400"
                className="w-full px-3.5 py-2.5 min-h-[48px] bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-700"
              />
              <p className="text-[10px] text-slate-500 mt-1">Standar: ~400 m² (4% luas sawah)</p>
            </div>
          </div>

          {/* Rencana Pindah Tanam & Lokasi */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Rencana Pindah Tanam
              </label>
              <input
                type="date"
                value={transplantDateExpected}
                onChange={(e) => setTransplantDateExpected(e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-[48px] bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-700"
              />
              <p className="text-[10px] text-slate-500 mt-1">Ideal umur 15-21 HSS</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                <span>Lokasi Bedengan</span>
              </label>
              <input
                type="text"
                value={nurseryLocation}
                onChange={(e) => setNurseryLocation(e.target.value)}
                placeholder="Misal: Petak barat dekat pintu air"
                className="w-full px-3.5 py-2.5 min-h-[48px] bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-700"
              />
            </div>
          </div>

          {/* Catatan Tambahan */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Catatan Khusus Persemaian
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Benih sudah direndam larutan garam & Paenibacillus, daya kecambah 95%..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          {/* Tombol Aksi */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 min-h-[48px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs sm:text-sm transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 min-h-[48px] bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 disabled:opacity-50 text-white font-bold rounded-xl text-xs sm:text-sm transition-colors shadow-xs"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Data Persemaian'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
