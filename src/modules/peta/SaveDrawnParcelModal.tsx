/**
 * HIKMAT TANI - Save Drawn Parcel Modal
 * 
 * Menyimpan petak sawah baru dari hasil gambar polygon pada peta satelit 2D.
 * Standar: Semua luasan menggunakan m².
 */

import { useState, type FormEvent } from 'react';
import { Layers, MapPin, Sparkles } from 'lucide-react';
import { Modal } from '../../components/common/Modal.tsx';
import { Land, LandType, WaterSource } from '../../types/index.ts';
import { calculatePolygonCentroid, formatAreaM2, LatLngPoint } from '../../utils/geoUtils.ts';

interface SaveDrawnParcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  points: LatLngPoint[];
  areaM2: number;
  perimeterM: number;
  onSave: (landData: Omit<Land, 'id' | 'farmerId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

export function SaveDrawnParcelModal({
  isOpen,
  onClose,
  points,
  areaM2,
  perimeterM,
  onSave,
}: SaveDrawnParcelModalProps) {
  const [name, setName] = useState<string>('');
  const [waterSource, setWaterSource] = useState<WaterSource>('IRRIGATION_TECHNICAL');
  const [landType, setLandType] = useState<LandType>('LOWLAND_PADDY');
  const [location, setLocation] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const centroid = calculatePolygonCentroid(points);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nama lahan / petak sawah wajib diisi');
      return;
    }
    if (areaM2 <= 0) {
      setError('Luas lahan belum valid');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Konversi aman ke areaHa untuk backward-compat
      const areaHa = areaM2 / 10000;

      await onSave({
        name: name.trim(),
        areaM2: Number(areaM2.toFixed(2)),
        perimeterM: Number(perimeterM.toFixed(1)),
        areaHa: Number(areaHa.toFixed(4)),
        coordinates: points,
        center: centroid,
        latitude: centroid.lat,
        longitude: centroid.lng,
        waterSource,
        landType,
        location: location.trim() || undefined,
        status: 'ACTIVE',
      });

      setName('');
      setLocation('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Gagal menyimpan petak sawah');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Simpan Petak Sawah Baru"
      subtitle="Batas lahan berhasil dibuat dari peta satelit"
    >
      <form onSubmit={handleSubmit} className="space-y-4 font-sans text-slate-800">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium">
            {error}
          </div>
        )}

        {/* Info Hasil Gambar Geodesic */}
        <div className="grid grid-cols-3 gap-2 bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-center">
          <div>
            <div className="text-[10px] text-slate-500 font-bold uppercase">Luas Petak</div>
            <div className="text-sm font-black text-emerald-950">{formatAreaM2(areaM2)}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 font-bold uppercase">Keliling</div>
            <div className="text-sm font-black text-slate-900">{perimeterM.toLocaleString('id-ID')} m</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 font-bold uppercase">Titik Sudut</div>
            <div className="text-sm font-black text-slate-900">{points.length} Titik</div>
          </div>
        </div>

        {/* Nama Lahan */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Nama Petak Sawah <span className="text-rose-600">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: Sawah Blok Tengah / Petak 02"
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px]"
          />
        </div>

        {/* Sumber Pengairan */}
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

        {/* Tipologi Sawah */}
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

        {/* Lokasi / Blok Keterangan */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Keterangan Blok / Lokasi (Opsional)
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Contoh: Dekat pintu air primer desa"
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        {/* Buttons */}
        <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 min-h-[44px] bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white rounded-xl text-xs font-bold transition-colors shadow-xs disabled:opacity-50"
          >
            {isSubmitting ? 'Menyimpan...' : 'Simpan Petak Sawah'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
