/**
 * HIKMAT TANI - Modal Ubah Foto Profil Petani
 * 
 * Fitur:
 * - Pratinjau foto profil melingkar proporsional.
 * - Unggah foto dari Galeri HP / Komputer.
 * - Ambil foto langsung menggunakan Kamera perangkat.
 * - Center-crop otomatis (persegi 1:1) dan kompresi terukur (Base64 < 50 KB).
 * - Opsi "Ganti Foto" dan "Hapus Foto / Gunakan Avatar Default".
 * - Feedback sukses dan penanganan error yang ramah pengguna.
 */

import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Image as ImageIcon,
  RotateCcw,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal.tsx';
import { Farmer } from '../../types/index.ts';
import { processProfilePhoto } from '../../utils/photoUtils.ts';

interface ProfilePhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  farmer: Farmer | null;
  onSavePhoto: (avatarUrl: string | undefined) => Promise<void>;
}

export function ProfilePhotoModal({
  isOpen,
  onClose,
  farmer,
  onSavePhoto,
}: ProfilePhotoModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(farmer?.avatarUrl || null);
  const [hasNewSelection, setHasNewSelection] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsProcessing(true);

    try {
      // Proses crop persegi 256x256 px dan kompresi JPEG
      const compressedBase64 = await processProfilePhoto(file, 256, 0.85);
      setPreviewUrl(compressedBase64);
      setHasNewSelection(true);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal memproses foto. Pastikan memilih file gambar valid.');
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = () => {
    setPreviewUrl(null);
    setHasNewSelection(true);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await onSavePhoto(previewUrl || undefined);
      setSuccessMsg('Foto profil berhasil diperbarui!');
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal menyimpan foto profil.');
    } finally {
      setIsSaving(false);
    }
  };

  const hasPhoto = Boolean(previewUrl);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Foto Profil Petani"
      subtitle="Sesuaikan foto identitas Anda pada perangkat ini"
      maxWidth="md"
    >
      <div className="space-y-5">
        {/* Pesan Kesalahan / Sukses */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-900">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Lingkaran Pratinjau Avatar */}
        <div className="flex flex-col items-center justify-center pt-2 pb-1">
          <div className="relative group">
            <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full overflow-hidden border-4 border-[#2E7D4F]/40 shadow-lg bg-[#0F5132] flex items-center justify-center transition-transform">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={farmer?.name || 'Foto Profil'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-[#D4AF37] font-black text-4xl flex flex-col items-center justify-center">
                  {farmer?.name ? farmer.name.charAt(0).toUpperCase() : <User className="w-16 h-16 text-[#D4AF37]" />}
                </div>
              )}
            </div>

            {/* Badge Ikon Kamera di Pojok Avatar */}
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="absolute bottom-1 right-1 w-10 h-10 rounded-full bg-[#0F5132] hover:bg-[#0B3D26] active:bg-black text-[#D4AF37] border-2 border-white flex items-center justify-center shadow-md transition-colors"
              title="Pilih foto baru"
              aria-label="Pilih foto baru"
            >
              <Camera className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-3 text-center">
            <h4 className="text-sm font-bold text-slate-900">
              {farmer?.name || 'Petani Padi Indonesia'}
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              {previewUrl ? 'Foto profil aktif' : 'Menggunakan avatar default'}
            </p>
          </div>
        </div>

        {/* Input Tersembunyi untuk Galeri & Kamera */}
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelected}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={handleFileSelected}
        />

        {/* Opsi Pilihan Pengunggahan */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            disabled={isProcessing || isSaving}
            className="p-3 bg-slate-50 hover:bg-emerald-50 active:bg-emerald-100 border border-slate-200 hover:border-emerald-300 rounded-xl text-slate-800 text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-colors"
          >
            <ImageIcon className="w-5 h-5 text-emerald-700" />
            <span>Pilih dari Galeri</span>
          </button>

          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isProcessing || isSaving}
            className="p-3 bg-slate-50 hover:bg-emerald-50 active:bg-emerald-100 border border-slate-200 hover:border-emerald-300 rounded-xl text-slate-800 text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-colors"
          >
            <Camera className="w-5 h-5 text-emerald-700" />
            <span>Ambil Kamera</span>
          </button>
        </div>

        {/* Tombol Hapus Foto / Gunakan Default */}
        {hasPhoto && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleRemovePhoto}
              disabled={isProcessing || isSaving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:text-rose-900 hover:bg-rose-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Foto & Gunakan Avatar Default</span>
            </button>
          </div>
        )}

        {/* Footer Tombol Simpan & Batal */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isProcessing || isSaving || (!hasNewSelection && previewUrl === (farmer?.avatarUrl || null))}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-xs flex items-center gap-2 transition-all ${
              hasNewSelection || previewUrl !== (farmer?.avatarUrl || null)
                ? 'bg-[#0F5132] hover:bg-[#0B3D26] active:bg-black'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isSaving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                <span>Simpan Foto</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
