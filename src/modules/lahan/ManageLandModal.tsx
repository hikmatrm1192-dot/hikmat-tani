/**
 * HIKMAT TANI - Manage Land Modal (Kelola Lahan: Edit, Arsipkan, Hapus Permanen)
 * 
 * Prinsip:
 * - Arsipkan sebagai tindakan utama untuk melindungi keutuhan data historis.
 * - Hapus permanen memerlukan konfirmasi sadar dan melakukan cascade audit bersih.
 */

import { useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Edit2,
  Layers,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal.tsx';
import { landRepository } from '../../db/repositories/landRepository.ts';
import { Land, LandType, WaterSource } from '../../types/index.ts';

interface ManageLandModalProps {
  isOpen: boolean;
  onClose: () => void;
  land: Land | null;
  onSuccess: () => Promise<void>;
}

export function ManageLandModal({
  isOpen,
  onClose,
  land,
  onSuccess,
}: ManageLandModalProps) {
  const [activeTab, setActiveTab] = useState<'EDIT' | 'ARCHIVE' | 'DELETE'>('EDIT');
  const [name, setName] = useState<string>(land?.name || '');
  const [areaHa, setAreaHa] = useState<number>(land?.areaHa || 0.5);
  const [landType, setLandType] = useState<LandType>(land?.landType || 'LOWLAND_PADDY');
  const [waterSource, setWaterSource] = useState<WaterSource>(
    land?.waterSource || 'IRRIGATION_TECHNICAL'
  );
  const [location, setLocation] = useState<string>(land?.location || '');
  const [notes, setNotes] = useState<string>(land?.notes || '');

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen || !land) return null;

  const isArchived = land.status === 'ARCHIVED';

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Nama petak sawah wajib diisi.');
      return;
    }
    if (areaHa <= 0) {
      setErrorMsg('Luas lahan harus lebih besar dari 0.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');
    try {
      await landRepository.update(land.id, {
        name: name.trim(),
        areaHa: Number(areaHa),
        landType,
        waterSource,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      await onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Gagal memperbarui lahan:', err);
      setErrorMsg('Gagal memperbarui data lahan.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleArchive = async () => {
    setIsProcessing(true);
    setErrorMsg('');
    try {
      if (isArchived) {
        await landRepository.unarchive(land.id);
      } else {
        await landRepository.archive(land.id);
      }
      await onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Gagal mengubah status arsip:', err);
      setErrorMsg('Gagal memproses arsip lahan.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeletePermanent = async () => {
    if (confirmDeleteText.trim() !== land.name.trim()) {
      setErrorMsg(`Ketik "${land.name}" persis untuk mengonfirmasi penghapusan permanen.`);
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');
    try {
      await landRepository.safeDelete(land.id);
      await onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Gagal menghapus lahan permanen:', err);
      setErrorMsg('Gagal menghapus lahan.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Kelola Lahan: ${land.name}`}
      subtitle="Ubah informasi lahan, arsipkan, atau hapus permanen"
    >
      <div className="space-y-4">
        {/* Tab Navigasi Aksi */}
        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab('EDIT');
              setErrorMsg('');
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 min-h-[40px] ${
              activeTab === 'EDIT'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit Lahan</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('ARCHIVE');
              setErrorMsg('');
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 min-h-[40px] ${
              activeTab === 'ARCHIVE'
                ? 'bg-white text-emerald-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {isArchived ? (
              <>
                <ArchiveRestore className="w-3.5 h-3.5 text-emerald-600" />
                <span>Aktifkan</span>
              </>
            ) : (
              <>
                <Archive className="w-3.5 h-3.5 text-amber-600" />
                <span>Arsipkan</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('DELETE');
              setErrorMsg('');
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 min-h-[40px] ${
              activeTab === 'DELETE'
                ? 'bg-white text-red-700 shadow-xs'
                : 'text-slate-600 hover:text-red-700'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5 text-red-600" />
            <span>Hapus Permanen</span>
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tab 1: Edit Lahan */}
        {activeTab === 'EDIT' && (
          <form onSubmit={handleUpdate} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nama Petak Sawah <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Sawah Barat Blok B"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px]"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Luas Lahan (Hektar) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={areaHa || ''}
                  onChange={(e) => setAreaHa(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px]"
                  required
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  = {(areaHa * 10000).toLocaleString('id-ID')} m²
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tipe Ekosistem Sawah
                </label>
                <select
                  value={landType}
                  onChange={(e) => setLandType(e.target.value as LandType)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px]"
                >
                  <option value="LOWLAND_PADDY">Sawah Irigasi Rendah</option>
                  <option value="RAINFED_PADDY">Sawah Tadah Hujan</option>
                  <option value="TIDAL_SWAMP">Rawa Pasang Surut / Lebak</option>
                  <option value="UPLAND">Lahan Kering / Padi Gogo</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Sumber Air Utama
                </label>
                <select
                  value={waterSource}
                  onChange={(e) => setWaterSource(e.target.value as WaterSource)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px]"
                >
                  <option value="IRRIGATION_TECHNICAL">Irigasi Teknis (Bendung/Kanal)</option>
                  <option value="IRRIGATION_SEMI_TECHNICAL">Irigasi Semi Teknis / Desa</option>
                  <option value="RAIN_FED">Tadah Hujan Alami</option>
                  <option value="GROUNDWATER">Sumur Bor / Pompa Air Tanah</option>
                  <option value="OTHER">Lainnya</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Lokasi / Blok
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Contoh: Desa Sukamaju, Blok III"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Catatan Tambahan
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan kondisi tanah, akses jalan, drainase..."
                rows={2}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 min-h-[44px]"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors min-h-[44px]"
              >
                <Save className="w-4 h-4" />
                <span>{isProcessing ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Arsipkan Lahan */}
        {activeTab === 'ARCHIVE' && (
          <div className="space-y-4 p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-slate-800">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center shrink-0">
                <Archive className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-amber-950">
                  {isArchived ? 'Aktifkan Kembali Lahan Ini' : 'Arsipkan Petak Sawah'}
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {isArchived
                    ? 'Lahan ini akan kembali ditampilkan dalam daftar lahan aktif dan dapat dimulai musim tanam baru.'
                    : 'Mengarsipkan lahan menyembunyikan petak ini dari daftar aktif harian tanpa menghapus riwayat musim tanam, pemupukan, dan catatan panen sebelumnya.'}
                </p>
              </div>
            </div>

            <div className="p-3 bg-white rounded-xl border border-amber-200 text-xs space-y-1 text-slate-700">
              <div className="font-bold text-slate-900">Keuntungan Pengarsipan:</div>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                <li>Seluruh data historis tetap aman dan dapat dilihat kapan saja.</li>
                <li>Tidak merusak cadangan data atau sinkronisasi.</li>
                <li>Dapat diaktifkan kembali sewaktu-waktu.</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 min-h-[44px]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleToggleArchive}
                disabled={isProcessing}
                className={`inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-xs transition-colors min-h-[44px] ${
                  isArchived
                    ? 'bg-emerald-700 hover:bg-emerald-800'
                    : 'bg-amber-700 hover:bg-amber-800'
                }`}
              >
                {isArchived ? (
                  <>
                    <ArchiveRestore className="w-4 h-4" />
                    <span>{isProcessing ? 'Memproses...' : 'Aktifkan Lahan Kembali'}</span>
                  </>
                ) : (
                  <>
                    <Archive className="w-4 h-4" />
                    <span>{isProcessing ? 'Mengarsipkan...' : 'Arsipkan Lahan Sekarang'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Hapus Permanen */}
        {activeTab === 'DELETE' && (
          <div className="space-y-4 p-4 rounded-2xl bg-red-50/80 border border-red-200 text-slate-800">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-800 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-red-950">
                  Hapus Permanen Petak Sawah
                </h4>
                <p className="text-xs text-red-800 leading-relaxed">
                  Tindakan ini akan menghapus lahan berserta seluruh musim tanam, riwayat kegiatan, dan catatan terkait secara permanen dari perangkat.
                </p>
              </div>
            </div>

            <div className="p-3 bg-white rounded-xl border border-red-200 text-xs space-y-2">
              <span className="font-bold text-slate-800 block">
                Ketik nama lahan <strong className="text-red-700 underline">{land.name}</strong> di bawah untuk konfirmasi:
              </span>
              <input
                type="text"
                value={confirmDeleteText}
                onChange={(e) => setConfirmDeleteText(e.target.value)}
                placeholder={land.name}
                className="w-full bg-slate-50 border border-red-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600 min-h-[40px]"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 min-h-[44px]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeletePermanent}
                disabled={isProcessing || confirmDeleteText.trim() !== land.name.trim()}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs transition-colors min-h-[44px]"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isProcessing ? 'Menghapus...' : 'Hapus Lahan Permanen'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
