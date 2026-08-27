/**
 * HIKMAT TANI - Modal Ubah Profil Singkat Petani
 * 
 * Prinsip:
 * - Data ringkas tanpa NIK/KTP atau sandi.
 * - Digunakan untuk mempersonalisasi catatan budidaya dan laporan lapang.
 */

import React, { useState } from 'react';
import { Building2, MapPin, Phone, User } from 'lucide-react';
import { Modal } from '../../components/common/Modal.tsx';
import { Farmer } from '../../types/index.ts';

interface EditFarmerModalProps {
  isOpen: boolean;
  onClose: () => void;
  farmer: Farmer | null;
  onSave: (updatedData: Partial<Farmer>) => Promise<void>;
}

export function EditFarmerModal({
  isOpen,
  onClose,
  farmer,
  onSave,
}: EditFarmerModalProps) {
  const [name, setName] = useState<string>(farmer?.name || '');
  const [farmerGroupName, setFarmerGroupName] = useState<string>(
    farmer?.farmerGroupName || ''
  );
  const [village, setVillage] = useState<string>(farmer?.village || '');
  const [district, setDistrict] = useState<string>(farmer?.district || '');
  const [regency, setRegency] = useState<string>(farmer?.regency || '');
  const [phoneNumber, setPhoneNumber] = useState<string>(
    farmer?.phoneNumber || ''
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Nama petani wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onSave({
        name: name.trim(),
        farmerGroupName: farmerGroupName.trim() || undefined,
        village: village.trim() || undefined,
        district: district.trim() || undefined,
        regency: regency.trim() || undefined,
        phoneNumber: phoneNumber.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setErrorMsg('Gagal menyimpan perubahan profil.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Ubah Profil Petani"
      subtitle="Data identitas budidaya tersimpan lokal di perangkat Anda"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 bg-rose-50 text-rose-800 rounded-xl text-xs font-semibold border border-rose-200">
            {errorMsg}
          </div>
        )}

        {/* Nama Petani */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-800 block">
            Nama Lengkap / Panggilan <span className="text-rose-600">*</span>
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Pak Hikmat / Bu Siti"
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
        </div>

        {/* Kelompok Tani */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-800 block">
            Kelompok Tani / Poktan (Opsional)
          </label>
          <div className="relative">
            <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={farmerGroupName}
              onChange={(e) => setFarmerGroupName(e.target.value)}
              placeholder="Contoh: Poktan Sri Rejeki"
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
        </div>

        {/* Lokasi / Desa */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 block">
              Desa / Kelurahan
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                placeholder="Contoh: Sukamandi"
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 block">
              Kecamatan
            </label>
            <input
              type="text"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="Contoh: Ciasem"
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
        </div>

        {/* Kabupaten & Kontak HP */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 block">
              Kabupaten / Kota
            </label>
            <input
              type="text"
              value={regency}
              onChange={(e) => setRegency(e.target.value)}
              placeholder="Contoh: Subang"
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 block">
              No. Telepon / HP (Opsional)
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="0812xxxxxxxx"
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>
        </div>

        {/* Catatan Privasi */}
        <p className="text-[11px] text-slate-500 italic">
          * HIKMAT TANI menjamin data profil ini tidak dikirimkan ke pihak komersial maupun pengiklan manapun.
        </p>

        {/* Tombol Aksi */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 min-h-[44px] bg-emerald-800 hover:bg-emerald-900 active:bg-black text-white font-bold rounded-xl text-xs transition-colors shadow-xs"
          >
            {isSubmitting ? 'Menyimpan...' : 'Simpan Profil'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
