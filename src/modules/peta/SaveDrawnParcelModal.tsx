/**
 * HIKMAT TANI - Save Drawn Parcel Modal
 * 
 * Menyimpan petak sawah baru dari hasil gambar polygon pada peta satelit 2D.
 * Standar:
 * - Semua luasan menggunakan m².
 * - Integrasi Spatial Check Batas Desa Resmi BIG secara otomatis terhadap titik centroid petak sawah.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, Building2, CheckCircle2, Layers, MapPin, Shield, Sparkles } from 'lucide-react';
import { Modal } from '../../components/common/Modal.tsx';
import { Land, LandType, WaterSource, VillageSpatialLookupResult } from '../../types/index.ts';
import { calculatePolygonCentroid, formatAreaM2, LatLngPoint } from '../../utils/geoUtils.ts';
import { bigGeospatialService } from '../../services/bigGeospatialService.ts';

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
  const [spatialResult, setSpatialResult] = useState<VillageSpatialLookupResult | null>(null);
  const [isCheckingSpatial, setIsCheckingSpatial] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const centroid = calculatePolygonCentroid(points);

  // Jalankan Spatial Check otomatis saat modal terbuka & titik tersedia
  useEffect(() => {
    if (!isOpen || points.length < 3) return;

    let isMounted = true;
    setIsCheckingSpatial(true);

    bigGeospatialService
      .findVillageByPoint(centroid)
      .then((res) => {
        if (isMounted) {
          setSpatialResult(res);
          // Set default lokasi deskriptif jika teridentifikasi resmi
          if (res.matched && res.feature && !location) {
            setLocation(`${res.feature.villageName}, ${res.feature.districtName}`);
          }
        }
      })
      .catch((err) => {
        console.error('Gagal melakukan spatial lookup batas desa:', err);
      })
      .finally(() => {
        if (isMounted) setIsCheckingSpatial(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, points]);

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

      // Metadata administrasi resmi jika terdeteksi dari BIG
      let administrativeData = undefined;
      let villageShortcut = undefined;
      let districtShortcut = undefined;
      let regencyShortcut = undefined;
      let provinceShortcut = undefined;
      let admCodeShortcut = undefined;

      if (spatialResult && spatialResult.matched && spatialResult.feature) {
        administrativeData = {
          village: spatialResult.feature.villageName,
          district: spatialResult.feature.districtName,
          regency: spatialResult.feature.regencyName,
          province: spatialResult.feature.provinceName,
          code: spatialResult.feature.adminCode,
          source: spatialResult.sourceMetadata.source,
          edition: spatialResult.sourceMetadata.edition,
          status: spatialResult.status,
          verifiedAt: spatialResult.sourceMetadata.verifiedAt,
        };
        villageShortcut = spatialResult.feature.villageName;
        districtShortcut = spatialResult.feature.districtName;
        regencyShortcut = spatialResult.feature.regencyName;
        provinceShortcut = spatialResult.feature.provinceName;
        admCodeShortcut = spatialResult.feature.adminCode;
      }

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
        administrative: administrativeData,
        village: villageShortcut,
        district: districtShortcut,
        regency: regencyShortcut,
        province: provinceShortcut,
        admCode: admCodeShortcut,
        status: 'ACTIVE',
      });

      setName('');
      setLocation('');
      setSpatialResult(null);
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

        {/* Kotak Deteksi Spasial Batas Administrasi Desa Resmi (BIG) */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-emerald-700" />
              Deteksi Batas Administrasi Desa (BIG)
            </span>
            {spatialResult?.status === 'VERIFIED' && (
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full flex items-center gap-1 border border-emerald-300">
                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                Terverifikasi Resmi
              </span>
            )}
            {spatialResult?.status === 'NEEDS_VERIFICATION' && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded-full flex items-center gap-1 border border-amber-300">
                <AlertCircle className="w-3 h-3 text-amber-700" />
                Perlu Verifikasi
              </span>
            )}
          </div>

          {isCheckingSpatial ? (
            <div className="text-xs text-slate-500 italic py-1">
              Memeriksa letak spasial titik centroid terhadap batas wilayah BIG...
            </div>
          ) : spatialResult?.matched && spatialResult.feature ? (
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between font-bold text-slate-900">
                <span>{spatialResult.feature.villageName}</span>
                <span className="font-mono text-[11px] text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  {spatialResult.feature.adminCode}
                </span>
              </div>
              <div className="text-[11px] text-slate-600">
                {spatialResult.feature.districtName}, {spatialResult.feature.regencyName}, {spatialResult.feature.provinceName}
              </div>
              {spatialResult.status === 'NEEDS_VERIFICATION' && (
                <div className="p-2 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 mt-1">
                  ⚠️ {spatialResult.message}
                </div>
              )}
            </div>
          ) : (
            <div className="text-[11px] text-slate-500">
              Lokasi petak di luar batas desa terindeks. Anda dapat melengkapi informasi lokasi secara manual.
            </div>
          )}
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
            placeholder="Contoh: Sawah Blok Krajan / Petak 02"
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
