/**
 * HIKMAT TANI - Save Drawn Parcel Modal
 * 
 * Menyimpan petak sawah baru dari hasil gambar polygon pada peta satelit 2D.
 * Standar:
 * - Semua luasan menggunakan m².
 * - Integrasi 4-Level Spatial Hierarchy Check Batas Resmi BIG & Kemendagri secara otomatis terhadap centroid.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, Building2, CheckCircle2, Layers, MapPin, Shield, Sparkles } from 'lucide-react';
import { Modal } from '../../components/common/Modal.tsx';
import { Land, LandType, WaterSource } from '../../types/index.ts';
import { AdministrativeHierarchyLookupResult } from '../../types/administrativeBoundary.ts';
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
  const [spatialResult, setSpatialResult] = useState<AdministrativeHierarchyLookupResult | null>(null);
  const [isCheckingSpatial, setIsCheckingSpatial] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const centroid = calculatePolygonCentroid(points);

  // Jalankan 4-level spatial lookup otomatis saat modal terbuka & titik tersedia
  useEffect(() => {
    if (!isOpen || points.length < 3) return;

    let isMounted = true;
    setIsCheckingSpatial(true);

    bigGeospatialService
      .lookupAdministrativeByPoint(centroid)
      .then((res) => {
        if (isMounted) {
          setSpatialResult(res);
          // Set default lokasi deskriptif jika teridentifikasi
          if (res.hierarchy.desaKelurahan && !location) {
            setLocation(`${res.hierarchy.desaKelurahan}, ${res.hierarchy.kecamatan || ''}`);
          }
        }
      })
      .catch((err) => {
        console.error('Gagal melakukan spatial lookup batas administrasi 4-level:', err);
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

      // Metadata administrasi resmi 4-tingkat
      let administrativeData = undefined;
      let prov = undefined;
      let provCode = undefined;
      let kab = undefined;
      let kabCode = undefined;
      let kec = undefined;
      let kecCode = undefined;
      let des = undefined;
      let desCode = undefined;

      if (spatialResult && spatialResult.hierarchy) {
        const h = spatialResult.hierarchy;
        prov = h.provinsi;
        provCode = h.provinsiCode;
        kab = h.kabupatenKota;
        kabCode = h.kabupatenKotaCode;
        kec = h.kecamatan;
        kecCode = h.kecamatanCode;
        des = h.desaKelurahan;
        desCode = h.desaKelurahanCode;

        administrativeData = {
          village: des,
          district: kec,
          regency: kab,
          province: prov,
          code: desCode || kecCode || kabCode || provCode,
          source: spatialResult.sourceMetadata.source,
          edition: spatialResult.sourceMetadata.edition,
          status: spatialResult.status,
          verifiedAt: spatialResult.sourceMetadata.verifiedAt,
        };
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
        // Backward-compatible shortcut fields
        village: des,
        district: kec,
        regency: kab,
        province: prov,
        admCode: desCode || kecCode || kabCode || provCode,
        // 4-level formal hierarchy fields
        provinsi: prov,
        provinsiCode: provCode,
        kabupatenKota: kab,
        kabupatenKotaCode: kabCode,
        kecamatan: kec,
        kecamatanCode: kecCode,
        desaKelurahan: des,
        desaKelurahanCode: desCode,
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

        {/* Kotak Deteksi Spasial Batas Administrasi Resmi BIG & Kemendagri */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-emerald-700" />
              Deteksi Batas Wilayah 4 Tingkat (BIG & Kemendagri)
            </span>
            {spatialResult?.status === 'VERIFIED' && (
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full flex items-center gap-1 border border-emerald-300">
                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                Terverifikasi
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
              Memeriksa letak spasial titik centroid terhadap hierarki batas wilayah BIG...
            </div>
          ) : spatialResult && spatialResult.hierarchy.desaKelurahan ? (
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between font-bold text-slate-900">
                <span>🌾 Desa {spatialResult.hierarchy.desaKelurahan}</span>
                {spatialResult.hierarchy.desaKelurahanCode && (
                  <span className="font-mono text-[11px] text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    {spatialResult.hierarchy.desaKelurahanCode}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-600">
                Kec. {spatialResult.hierarchy.kecamatan || '-'}, {spatialResult.hierarchy.kabupatenKota || '-'}, {spatialResult.hierarchy.provinsi || '-'}
              </div>
              {spatialResult.status === 'NEEDS_VERIFICATION' && (
                <div className="p-2 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 mt-1">
                  ⚠️ {spatialResult.message}
                </div>
              )}
            </div>
          ) : spatialResult && spatialResult.hierarchy.provinsi ? (
            <div className="space-y-1 text-xs">
              <div className="font-bold text-slate-900">
                Wilayah: {spatialResult.hierarchy.kecamatan || spatialResult.hierarchy.kabupatenKota || spatialResult.hierarchy.provinsi}
              </div>
              <div className="text-[11px] text-slate-500">
                Hierarki: {spatialResult.hierarchy.provinsi}
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-slate-500">
              Lokasi petak di luar batas terindeks. Anda dapat melengkapi informasi lokasi secara manual.
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
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px]"
          >
            <option value="IRRIGATION_TECHNICAL">Irigasi Teknis (Bendung / Saluran Primer)</option>
            <option value="IRRIGATION_SEMI">Irigasi Semi Teknis</option>
            <option value="IRRIGATION_SIMPLE">Irigasi Sederhana / Desa</option>
            <option value="RAIN_FED">Tadah Hujan (Bergantung Musim Basah)</option>
            <option value="RIVER">Pompanisasi Sungai / Saluran</option>
            <option value="GROUNDWATER">Sumur Bor / Airtanah Dalam</option>
            <option value="OTHER">Lainnya</option>
          </select>
        </div>

        {/* Tipe Lahan */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Tipe Lahan
          </label>
          <select
            value={landType}
            onChange={(e) => setLandType(e.target.value as LandType)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px]"
          >
            <option value="LOWLAND_PADDY">Sawah Irigasi Dataran Rendah</option>
            <option value="HIGHLAND_PADDY">Sawah Dataran Tinggi</option>
            <option value="TIDAL_LOWLAND">Lahan Pasang Surut / Rawa</option>
            <option value="DRY_LAND">Lahan Kering / Gogo Rancah</option>
          </select>
        </div>

        {/* Lokasi / Alamat Deskriptif */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Catatan Lokasi / Blok
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Contoh: Dusun Krajan 1, RT 02 / RW 01"
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px]"
          />
        </div>

        {/* Tombol Simpan & Batal */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors min-h-[44px]"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-1.5 min-h-[44px]"
          >
            {isSubmitting ? (
              <span>Menyimpan...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>Simpan Petak Sawah (m²)</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
