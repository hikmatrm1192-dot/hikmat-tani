/**
 * HIKMAT TANI - Add Land Modal (Form Tambah Lahan Sederhana)
 * 
 * Prinsip:
 * - Form sederhana, tidak meminta data yang tidak diperlukan.
 * - Field awal: Nama Lahan, Luas, Sumber Air, Jenis Lahan (Lokasi/GPS opsional).
 */

import { useState, type FormEvent } from 'react';
import { Modal } from '../../components/common/Modal.tsx';
import { Land, LandType, WaterSource } from '../../types/index.ts';

interface AddLandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (landData: Omit<Land, 'id' | 'farmerId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

export function AddLandModal({ isOpen, onClose, onSave }: AddLandModalProps) {
  const [name, setName] = useState<string>('');
  const [areaM2Input, setAreaM2Input] = useState<string>('');
  const [waterSource, setWaterSource] = useState<WaterSource>('IRRIGATION_TECHNICAL');
  const [landType, setLandType] = useState<LandType>('LOWLAND_PADDY');
  const [location, setLocation] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nama lahan wajib diisi');
      return;
    }
    const numericM2 = parseFloat(areaM2Input.replace(',', '.'));
    if (isNaN(numericM2) || numericM2 <= 0) {
      setError('Luas lahan harus berupa angka positif yang valid dalam satuan m²');
      return;
    }

    // Konversi ke satuan Hektar untuk kompatibilitas penyimpanan database
    const areaHa = numericM2 / 10000;

    setIsSubmitting(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        areaHa: Number(areaHa.toFixed(4)),
        waterSource,
        landType,
        location: location.trim() || undefined,
      });
      // Reset form
      setName('');
      setAreaM2Input('');
      setLocation('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Gagal menyimpan data lahan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tambah Lahan Baru"
      subtitle="Catat petak sawah yang Anda kelola"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium">
            {error}
          </div>
        )}

        {/* Nama Lahan */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Nama Lahan / Petak Sawah <span className="text-rose-600">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: Sawah Blok Timur / Petak Bawah"
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px]"
          />
        </div>

        {/* Luas Lahan (m²) */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Luas Lahan <span className="text-rose-600">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              required
              value={areaM2Input}
              onChange={(e) => {
                const val = e.target.value;
                if (/^[0-9]*[.,]?[0-9]*$/.test(val)) {
                  setAreaM2Input(val);
                }
              }}
              placeholder="Contoh: 5000 atau 2500"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px] pr-12 font-semibold text-slate-900"
            />
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 pointer-events-none">
              m²
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Masukkan luas lahan dalam satuan meter persegi (m²).
          </p>
        </div>

        {/* Sumber Air */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Sumber Pengairan
          </label>
          <select
            value={waterSource}
            onChange={(e) => setWaterSource(e.target.value as WaterSource)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            <option value="IRRIGATION_TECHNICAL">Irigasi Teknis</option>
            <option value="IRRIGATION_SEMI_TECHNICAL">Irigasi Semi Teknis / Desa</option>
            <option value="RAIN_FED">Tadah Hujan</option>
            <option value="GROUNDWATER">Sumur Pantek / Air Tanah</option>
            <option value="OTHER">Lainnya</option>
          </select>
        </div>

        {/* Jenis Lahan */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Tipologi Sawah
          </label>
          <select
            value={landType}
            onChange={(e) => setLandType(e.target.value as LandType)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            <option value="LOWLAND_PADDY">Sawah Irigasi Dataran Rendah</option>
            <option value="RAINFED_PADDY">Sawah Tadah Hujan</option>
            <option value="TIDAL_SWAMP">Lahan Rawa Pasang Surut / Lebak</option>
            <option value="UPLAND">Padi Gogo / Lahan Kering</option>
          </select>
        </div>

        {/* Lokasi / Keterangan Opsional */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Keterangan / Lokasi (Opsional)
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Contoh: Dekat saluran primer desa"
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        {/* Buttons */}
        <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 min-h-[48px] rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 min-h-[48px] bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-colors shadow-xs disabled:opacity-50"
          >
            {isSubmitting ? 'Menyimpan...' : 'Simpan Lahan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
