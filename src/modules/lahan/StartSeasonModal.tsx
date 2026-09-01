/**
 * HIKMAT TANI - Start Crop Season Modal
 * 
 * Form sederhana untuk memulai musim tanam aktif pada suatu lahan.
 * Menggunakan progressive disclosure tanpa form yang membingungkan.
 */

import { useMemo, useState, type FormEvent } from 'react';
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

  // De-duplicate varieties list safely based on trimmed lowercase name
  const uniqueVarieties = useMemo(() => {
    const seen = new Set<string>();
    const result: RiceVariety[] = [];

    // Prioritize passed varieties
    for (const v of varieties) {
      const key = v.name.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(v);
      }
    }
    return result;
  }, [varieties]);

  const [selectedVarietyOption, setSelectedVarietyOption] = useState<string>(
    uniqueVarieties[0]?.name || 'Inpari 32 HDB'
  );
  const [customVarietyName, setCustomVarietyName] = useState<string>('');
  const [customDurationDays, setCustomDurationDays] = useState<number>(120);

  const [plantingDate, setPlantingDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [plantedAreaM2Str, setPlantedAreaM2Str] = useState<string>(
    land ? String(Math.round(land.areaHa * 10000)) : '10000'
  );
  const [plantingSystem, setPlantingSystem] = useState<PlantingSystem>('JAJAR_LEGOWO_2_1');
  const [customPlantingSystem, setCustomPlantingSystem] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const activeLand = allLands.find((l) => l.id === (land?.id || selectedLandId)) || land;

  const isCustomVarietySelected = selectedVarietyOption === '__CUSTOM__';
  const isCustomPlantingSystemSelected = plantingSystem === 'OTHER';

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
    const numM2 = parseFloat(plantedAreaM2Str.replace(',', '.'));
    if (isNaN(numM2) || numM2 <= 0) {
      setError('Luas tanam harus berupa angka positif yang valid dalam satuan m²');
      return;
    }

    const calculatedAreaHa = Number((numM2 / 10000).toFixed(4));

    let finalVarietyName = selectedVarietyOption;
    let finalVarietyId: string | undefined = undefined;

    if (isCustomVarietySelected) {
      if (!customVarietyName.trim()) {
        setError('Nama varietas lokal/khusus wajib diisi');
        return;
      }
      finalVarietyName = customVarietyName.trim();
    } else {
      const matched = uniqueVarieties.find(
        (v) => v.name.toLowerCase().trim() === selectedVarietyOption.toLowerCase().trim()
      );
      if (matched) {
        finalVarietyName = matched.name;
        finalVarietyId = matched.id;
      }
    }

    if (isCustomPlantingSystemSelected && !customPlantingSystem.trim()) {
      setError('Nama atau keterangan sistem tanam lainnya wajib diisi');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSave({
        landId: targetLandId,
        commodity: commodity.trim() || 'Padi',
        varietyId: finalVarietyId,
        varietyName: finalVarietyName || 'Padi Sawah',
        plantingDate: new Date(plantingDate).toISOString(),
        plantedAreaHa: calculatedAreaHa || activeLand?.areaHa || 1.0,
        plantingSystem,
        notes: isCustomPlantingSystemSelected && customPlantingSystem.trim()
          ? `Sistem Tanam Kustom: ${customPlantingSystem.trim()}`
          : undefined,
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
                if (found) setPlantedAreaM2Str(String(Math.round(found.areaHa * 10000)));
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-[13px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[40px]"
            >
              {allLands.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({Math.round(l.areaHa * 10000).toLocaleString('id-ID')} m²)
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
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-[13px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[40px]"
          />
        </div>

        {/* Varietas Padi */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Varietas Padi <span className="text-rose-600">*</span>
          </label>
          <select
            value={selectedVarietyOption}
            onChange={(e) => setSelectedVarietyOption(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-[13px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium min-h-[40px]"
          >
            {uniqueVarieties.map((v) => (
              <option key={v.id} value={v.name}>
                {v.name} (~{v.growthDurationDays || 120} hari)
              </option>
            ))}
            <option value="__CUSTOM__">+ Varietas Lainnya / Benih Lokal</option>
          </select>

          {/* Form Varietas Lokal / Khusus jika dipilih */}
          {isCustomVarietySelected && (
            <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-2 animate-fadeIn">
              <div className="text-xs font-bold text-emerald-950">
                Data Varietas Lokal / Kustom
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Nama Varietas Lokal <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={customVarietyName}
                    onChange={(e) => setCustomVarietyName(e.target.value)}
                    placeholder="Contoh: Pandan Wangi / Rojolele / Mentik"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none min-h-[38px]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Estimasi Umur (Hari)
                  </label>
                  <input
                    type="number"
                    min="60"
                    max="180"
                    value={customDurationDays}
                    onChange={(e) => setCustomDurationDays(parseInt(e.target.value, 10) || 120)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none min-h-[38px]"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tanggal Tanam & Luas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Tanggal Tanam (Hari H) <span className="text-rose-600">*</span>
            </label>
            <input
              type="date"
              required
              value={plantingDate}
              onChange={(e) => setPlantingDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-[13px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[40px]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Luas Tanam <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                required
                value={plantedAreaM2Str}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^[0-9]*[.,]?[0-9]*$/.test(val)) {
                    setPlantedAreaM2Str(val);
                  }
                }}
                placeholder="Contoh: 5000"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-[13px] font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[40px] pr-12"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 pointer-events-none">
                m²
              </div>
            </div>
          </div>
        </div>

        {/* Sistem Tanam */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700 mb-1">Sistem Tanam</label>
          <select
            value={plantingSystem}
            onChange={(e) => setPlantingSystem(e.target.value as PlantingSystem)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-[13px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[40px]"
          >
            <option value="JAJAR_LEGOWO_2_1">Jajar Legowo 2:1</option>
            <option value="JAJAR_LEGOWO_4_1">Jajar Legowo 4:1</option>
            <option value="TEGEL">Tegel (Bujur Sangkar)</option>
            <option value="TABELA">Tabela (Tanam Benih Langsung)</option>
            <option value="SRI">SRI (System of Rice Intensification)</option>
            <option value="OTHER">Lainnya / Sistem Khusus</option>
          </select>

          {/* Form Sistem Tanam Lainnya */}
          {isCustomPlantingSystemSelected && (
            <div className="p-3.5 bg-slate-100 border border-slate-300 rounded-xl space-y-1.5 animate-fadeIn">
              <label className="block text-[11px] font-bold text-slate-700">
                Nama / Keterangan Sistem Tanam Khusus <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={customPlantingSystem}
                onChange={(e) => setCustomPlantingSystem(e.target.value)}
                placeholder="Contoh: Hazton / Gogo Rancah / Salibu / Jajar Legowo Modifikasi"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none min-h-[40px]"
              />
            </div>
          )}
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
