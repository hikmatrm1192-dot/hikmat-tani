/**
 * HIKMAT TANI - Start Crop Season Modal
 * 
 * Form sederhana untuk memulai musim tanam aktif pada suatu lahan.
 * Menggunakan progressive disclosure tanpa form yang membingungkan.
 */

import { useState, type FormEvent } from 'react';
import { Modal } from '../../components/common/Modal.tsx';
import { CropSeason, Land, PlantingSystem, RiceVariety } from '../../types/index.ts';

interface StartSeasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  land: Land | null;
  allLands?: Land[];
  varieties?: RiceVariety[];
  onSave: (seasonData: Omit<CropSeason, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

export function StartSeasonModal({
  isOpen,
  onClose,
  land,
  allLands = [],
  varieties = [],
  onSave,
}: StartSeasonModalProps) {
  const [selectedLandId, setSelectedLandId] = useState<string>(land?.id || allLands[0]?.id || '');
  const [commodity, setCommodity] = useState<string>('Padi');
  const [varietyName, setVarietyName] = useState<string>('Inpari 32 HDB');
  const [plantingDate, setPlantingDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [plantedAreaHa, setPlantedAreaHa] = useState<number>(land?.areaHa || 1.0);
  const [plantingSystem, setPlantingSystem] = useState<PlantingSystem>('JAJAR_LEGOWO_2_1');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const activeLand = allLands.find((l) => l.id === (land?.id || selectedLandId)) || land;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const targetLandId = land?.id || selectedLandId;
    if (!targetLandId) {
      setError('Silakan pilih petak lahan untuk musim tanam');
      return;
    }
    if (!plantingDate) {
      setError('Tanggal tanam wajib diisi dengan benar');
      return;
    }
    const numArea = Number(plantedAreaHa);
    if (isNaN(numArea) || numArea <= 0) {
      setError('Luas tanam harus berupa angka positif yang valid');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const selectedVariety = varieties.find(
        (v) => v.name.toLowerCase().trim() === varietyName.toLowerCase().trim()
      );

      await onSave({
        landId: targetLandId,
        commodity: commodity.trim() || 'Padi',
        varietyId: selectedVariety?.id,
        varietyName: varietyName.trim() || 'Padi Sawah',
        plantingDate: new Date(plantingDate).toISOString(),
        plantedAreaHa: numArea || activeLand?.areaHa || 1.0,
        plantingSystem,
        status: 'ACTIVE',
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Gagal memulai musim tanam');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Mulai Musim Tanam Baru"
      subtitle={activeLand ? `Lahan: ${activeLand.name}` : 'Pilih lahan dan data tanam'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium">
            {error}
          </div>
        )}

        {/* Pilih Lahan jika belum spesifik */}
        {!land && allLands.length > 0 && (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Pilih Lahan <span className="text-rose-600">*</span>
            </label>
            <select
              value={selectedLandId}
              onChange={(e) => {
                setSelectedLandId(e.target.value);
                const found = allLands.find((l) => l.id === e.target.value);
                if (found) setPlantedAreaHa(found.areaHa);
              }}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              {allLands.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.areaHa} ha)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Komoditas */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Komoditas</label>
          <input
            type="text"
            value={commodity}
            onChange={(e) => setCommodity(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        {/* Varietas Padi */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Varietas Padi <span className="text-rose-600">*</span>
          </label>
          {varieties.length > 0 ? (
            <select
              value={varietyName}
              onChange={(e) => setVarietyName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
            >
              {varieties.map((v) => (
                <option key={v.id} value={v.name}>
                  {v.name} (~{v.growthDurationDays || 120} hari)
                </option>
              ))}
              <option value="Ciherang">Ciherang (~116 hari)</option>
              <option value="Inpari 32 HDB">Inpari 32 HDB (~120 hari)</option>
              <option value="Mekongga">Mekongga (~118 hari)</option>
              <option value="Lainnya">Lainnya / Varietas Lokal</option>
            </select>
          ) : (
            <input
              type="text"
              required
              value={varietyName}
              onChange={(e) => setVarietyName(e.target.value)}
              placeholder="Contoh: Inpari 32 HDB / Ciherang"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          )}
        </div>

        {/* Tanggal Tanam */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Tanggal Tanam (Hari H Tanam) <span className="text-rose-600">*</span>
          </label>
          <input
            type="date"
            required
            value={plantingDate}
            onChange={(e) => setPlantingDate(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        {/* Sistem Tanam */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Sistem Tanam</label>
          <select
            value={plantingSystem}
            onChange={(e) => setPlantingSystem(e.target.value as PlantingSystem)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            <option value="JAJAR_LEGOWO_2_1">Jajar Legowo 2:1</option>
            <option value="JAJAR_LEGOWO_4_1">Jajar Legowo 4:1</option>
            <option value="TEGEL">Tegel (Bujur Sangkar)</option>
            <option value="TABELA">Tabela (Tanam Benih Langsung)</option>
            <option value="SRI">SRI (System of Rice Intensification)</option>
            <option value="OTHER">Lainnya</option>
          </select>
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
            {isSubmitting ? 'Memproses...' : 'Mulai Musim Tanam'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
