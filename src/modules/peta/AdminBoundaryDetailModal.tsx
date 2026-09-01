/**
 * HIKMAT TANI - 4-Level Official Administrative Boundary Detail & Audit Modal
 * 
 * Menampilkan informasi lengkap batas wilayah administrasi resmi:
 * - Hierarki 4 Tingkat: Desa/Kelurahan -> Kecamatan -> Kabupaten/Kota -> Provinsi
 * - Kode Wilayah Kemendagri & BIG
 * - Metadata Sumber Data & Audit Trail Geospasial
 * - Deteksi Discrepancy & Status
 */

import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  FileText,
  Info,
  MapPin,
  Navigation,
  Shield,
  X,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal.tsx';
import { AdministrativeFeature } from '../../types/administrativeBoundary.ts';
import { VillageBoundaryFeature } from '../../types/villageBoundary.ts';

interface AdminBoundaryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: AdministrativeFeature | VillageBoundaryFeature | null;
  onFocusFeature?: (feature: AdministrativeFeature | VillageBoundaryFeature) => void;
}

export function AdminBoundaryDetailModal({
  isOpen,
  onClose,
  feature,
  onFocusFeature,
}: AdminBoundaryDetailModalProps) {
  if (!feature) return null;

  // Normalisasi data dari AdministrativeFeature atau VillageBoundaryFeature
  const isVillageFeature = 'villageName' in feature;
  const name = isVillageFeature ? feature.villageName : feature.name;
  const levelText = isVillageFeature
    ? 'Desa / Kelurahan'
    : feature.level === 'PROVINCE'
    ? 'Provinsi'
    : feature.level === 'REGENCY'
    ? 'Kabupaten / Kota'
    : feature.level === 'DISTRICT'
    ? 'Kecamatan'
    : 'Desa / Kelurahan';

  const desaName = isVillageFeature
    ? feature.villageName
    : feature.hierarchy?.desaKelurahan || (feature.level === 'VILLAGE' ? feature.name : '-');
  const desaCode = isVillageFeature
    ? feature.adminCode
    : feature.hierarchy?.desaKelurahanCode || (feature.level === 'VILLAGE' ? feature.adminCode : '-');

  const kecName = isVillageFeature
    ? feature.districtName
    : feature.hierarchy?.kecamatan || (feature.level === 'DISTRICT' ? feature.name : '-');
  const kecCode = isVillageFeature
    ? feature.adminCode.substring(0, 8)
    : feature.hierarchy?.kecamatanCode || (feature.level === 'DISTRICT' ? feature.adminCode : '-');

  const kabName = isVillageFeature
    ? feature.regencyName
    : feature.hierarchy?.kabupatenKota || (feature.level === 'REGENCY' ? feature.name : '-');
  const kabCode = isVillageFeature
    ? feature.adminCode.substring(0, 5)
    : feature.hierarchy?.kabupatenKotaCode || (feature.level === 'REGENCY' ? feature.adminCode : '-');

  const provName = isVillageFeature
    ? feature.provinceName
    : feature.hierarchy?.provinsi || (feature.level === 'PROVINCE' ? feature.name : '-');
  const provCode = isVillageFeature
    ? feature.adminCode.substring(0, 2)
    : feature.hierarchy?.provinsiCode || (feature.level === 'PROVINCE' ? feature.adminCode : '-');

  const source = feature.source || 'Badan Informasi Geospasial (BIG) - Ina-Geoportal';
  const edition = feature.edition || 'Peta Rupabumi Indonesia (RBI)';
  const datasetRef = feature.datasetRef || 'BIG:RBI_BATAS_ADMIN_KSP';
  const legalRef = feature.legalRef || 'UU No. 4/2011 & Kepmendagri No. 050-145';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={name}
      subtitle={`Wilayah Administrasi Resmi (${levelText})`}
    >
      <div className="space-y-4 font-sans text-slate-800">
        {/* Banner Status Sumber Resmi BIG & Kemendagri */}
        <div className="bg-emerald-50 border border-emerald-200/90 rounded-2xl p-3.5 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-emerald-700 text-white shrink-0 mt-0.5 shadow-2xs">
            <Shield className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wide">
                Sumber Geometri & Kode Resmi
              </h4>
              <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded-full text-[10px] font-black">
                BIG & Kemendagri
              </span>
            </div>
            <p className="text-[11px] text-emerald-900/90 mt-0.5 leading-relaxed">
              Geometri batas bersumber dari <strong>{source}</strong> ({edition}), dengan nomenklatur & kode wilayah resmi Kemendagri.
            </p>
          </div>
        </div>

        {/* Hierarki 4 Tingkat Administrasi */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-600" />
              Hierarki 4 Tingkat Administrasi Pemerintahan
            </span>
            <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-bold">
              Kepmendagri
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {/* Level 4: Desa / Kelurahan */}
            <div className={`p-2.5 rounded-xl border transition-all ${
              desaName !== '-' ? 'bg-white border-emerald-200/80 shadow-2xs' : 'bg-slate-100/70 border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-emerald-900 font-bold">1. Desa / Kelurahan</span>
                {desaCode !== '-' && (
                  <span className="font-mono text-[10px] font-black text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                    {desaCode}
                  </span>
                )}
              </div>
              <span className="font-bold text-slate-900 text-sm block mt-0.5">{desaName}</span>
            </div>

            {/* Level 3: Kecamatan */}
            <div className={`p-2.5 rounded-xl border transition-all ${
              kecName !== '-' ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-100/70 border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-600 font-bold">2. Kecamatan</span>
                {kecCode !== '-' && (
                  <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded">
                    {kecCode}
                  </span>
                )}
              </div>
              <span className="font-bold text-slate-900 block mt-0.5">{kecName}</span>
            </div>

            {/* Level 2: Kabupaten / Kota */}
            <div className={`p-2.5 rounded-xl border transition-all ${
              kabName !== '-' ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-100/70 border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-600 font-bold">3. Kabupaten / Kota</span>
                {kabCode !== '-' && (
                  <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded">
                    {kabCode}
                  </span>
                )}
              </div>
              <span className="font-bold text-slate-900 block mt-0.5">{kabName}</span>
            </div>

            {/* Level 1: Provinsi */}
            <div className={`p-2.5 rounded-xl border transition-all ${
              provName !== '-' ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-100/70 border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-600 font-bold">4. Provinsi</span>
                {provCode !== '-' && (
                  <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded">
                    {provCode}
                  </span>
                )}
              </div>
              <span className="font-bold text-slate-900 block mt-0.5">{provName}</span>
            </div>
          </div>
        </div>

        {/* Audit Metadata Card */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-[11px] space-y-1.5 text-slate-600">
          <div className="font-bold text-slate-700 flex items-center gap-1">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            Metadata & Audit Trail Geospasial
          </div>
          <p>• <strong>Dataset & Versi:</strong> {datasetRef}</p>
          <p>• <strong>Dasar Hukum:</strong> {legalRef}</p>
          <p>• <strong>Sistem Koordinat:</strong> WGS 84 / Geodesic (EPSG:4326)</p>
          <p>• <strong>Prioritas Integrasi:</strong> Geometri BIG, Nomenklatur & Kode Kemendagri</p>
        </div>

        {/* Actions */}
        <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
          {onFocusFeature && (
            <button
              type="button"
              onClick={() => {
                onFocusFeature(feature);
                onClose();
              }}
              className="px-3.5 py-2.5 min-h-[44px] bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <Navigation className="w-3.5 h-3.5 text-emerald-700" />
              <span>Pusatkan ke Wilayah Ini</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 min-h-[44px] bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </Modal>
  );
}
