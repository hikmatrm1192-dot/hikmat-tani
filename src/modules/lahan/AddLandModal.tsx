/**
 * HIKMAT TANI - Add Land Modal (Form Tambah Lahan Sederhana)
 * 
 * Prinsip:
 * - Form sederhana, tidak meminta data yang tidak diperlukan.
 * - Field awal: Nama Lahan, Luas, Sumber Air, Jenis Lahan (Lokasi/GPS opsional).
 */

import { useState } from 'react';
import { Modal } from '../../components/common/Modal.tsx';
import { Land, LandType, WaterSource } from '../../types/index.ts';

interface AddLandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (landData: Omit<Land, 'id' | 'farmerId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

export function AddLandModal({ isOpen, onClose, onSave }: AddLandModalProps) {
  const [name, setName] = useState<string>('');
  const [areaInput, setAreaInput] = useState<string>('');
  const [unit, setUnit] = useState<'HA' | 'M2'>('HA');
  const [waterSource, setWaterSource] = useState<WaterSource>('IRRIGATION_TECHNICAL');
  const [landType, setLandType] = useState<LandType>('LOWLAND_PADDY');
  const [location, setLocation] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nama lahan wajib diisi');
      return;
    }
    const numericArea = parseFloat(areaInput.replace(',', '.'));
    if (isNaN(numericArea) || numericArea <= 0) {
      setError('Luas lahan harus berupa angka positif yang valid');
      return;
    }

    // Konversi ke satuan Hektar jika diinput dalam m2
    const areaHa = unit === 'M2' ? numericArea / 10000 : numericArea;

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
      setAreaInput('');
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
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        {/* Luas Lahan + Satuan */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Luas Lahan <span className="text-rose-600">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              step="any"
              min="0.001"
              required
              value={areaInput}
              onChange={(e) => setAreaInput(e.target.value)}
              placeholder={unit === 'HA' ? '0.75' : '7500'}
              className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
            <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setUnit('HA')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  unit === 'HA' ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600'
                }`}
              >
                Hektar (ha)
              </button>
              <button
                type="button"
                onClick={() => setUnit('M2')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  unit === 'M2' ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600'
                }`}
              >
                m²
              </button>
            </div>
          </div>
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
