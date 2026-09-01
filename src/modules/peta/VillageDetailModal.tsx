/**
 * HIKMAT TANI - Village Boundary Detail & Audit Modal
 * 
 * Menampilkan informasi lengkap batas wilayah administrasi desa/kelurahan resmi BIG:
 * - Nama Desa/Kelurahan, Kecamatan, Kabupaten/Kota, Provinsi
 * - Kode Wilayah Kemendagri / BIG
 * - Metadata Sumber Data & Audit Trail
 */

import { Building2, CheckCircle2, FileText, Info, MapPin, Navigation, Shield, X } from 'lucide-react';
import { Modal } from '../../components/common/Modal.tsx';
import { VillageBoundaryFeature } from '../../types/villageBoundary.ts';

interface VillageDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  village: VillageBoundaryFeature | null;
  onFocusVillage?: (village: VillageBoundaryFeature) => void;
}

export function VillageDetailModal({
  isOpen,
  onClose,
  village,
  onFocusVillage,
}: VillageDetailModalProps) {
  if (!village) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={village.villageName}
      subtitle={`Wilayah Administrasi Resmi: ${village.districtName}`}
    >
      <div className="space-y-4 font-sans text-slate-800">
        {/* Banner Status Sumber Resmi BIG */}
        <div className="bg-emerald-50 border border-emerald-200/90 rounded-2xl p-3.5 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-emerald-700 text-white shrink-0 mt-0.5 shadow-2xs">
            <Shield className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wide">
                Sumber Resmi Terverifikasi
              </h4>
              <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded-full text-[10px] font-bold">
                BIG
              </span>
            </div>
            <p className="text-[11px] text-emerald-900/90 mt-0.5 leading-relaxed">
              Batas administrasi mengacu pada {village.source} ({village.edition}).
            </p>
          </div>
        </div>

        {/* Hierarki Wilayah */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-600" />
            Hierarki Administrasi Wilayah
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-2xs">
              <span className="text-[10px] text-slate-600 block">Desa / Kelurahan</span>
              <span className="font-bold text-slate-900 text-sm">{village.villageName}</span>
            </div>

            <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-2xs">
              <span className="text-[10px] text-slate-600 block">Kecamatan</span>
              <span className="font-bold text-slate-900 text-sm">{village.districtName}</span>
            </div>

            <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-2xs">
              <span className="text-[10px] text-slate-600 block">Kabupaten / Kota</span>
              <span className="font-bold text-slate-900">{village.regencyName}</span>
            </div>

            <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-2xs">
              <span className="text-[10px] text-slate-600 block">Provinsi</span>
              <span className="font-bold text-slate-900">{village.provinceName}</span>
            </div>
          </div>

          {/* Kode Wilayah */}
          <div className="bg-white p-2.5 rounded-xl border border-slate-100 flex items-center justify-between shadow-2xs">
            <span className="text-xs text-slate-600 font-medium">Kode Wilayah Kemendagri / BIG</span>
            <span className="font-mono text-xs font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              {village.adminCode}
            </span>
          </div>
        </div>

        {/* Audit Metadata Card */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-[11px] space-y-1 text-slate-600">
          <div className="font-bold text-slate-700 flex items-center gap-1">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            Metadata & Bukti Audit Geospasial
          </div>
          <p>• <strong>Dataset:</strong> {village.datasetRef}</p>
          <p>• <strong>Dasar Hukum:</strong> {village.legalRef}</p>
          <p>• <strong>Sistem Koordinat:</strong> WGS 84 / Geodesic EPSG:4326</p>
        </div>

        {/* Actions */}
        <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
          {onFocusVillage && (
            <button
              type="button"
              onClick={() => {
                onFocusVillage(village);
                onClose();
              }}
              className="px-3.5 py-2.5 min-h-[44px] bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <Navigation className="w-3.5 h-3.5 text-emerald-700" />
              <span>Pusatkan ke Desa Ini</span>
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
