/**
 * HIKMAT TANI - Modal Konfirmasi & Pemulihan Data (Restore)
 * 
 * Prinsip:
 * - Menampilkan rincian isi file cadangan (jumlah petak lahan, musim tanam, aktivitas, dll)
 * - Peringatan jelas sebelum data ditimpa/diperbarui.
 */

import { useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Database,
  FileCheck,
  MapPin,
  RefreshCw,
  Sprout,
  Upload,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal.tsx';
import { HikmatBackup } from '../../types/index.ts';

interface RestoreConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  backupData: HikmatBackup | null;
  fileName: string;
  onConfirmRestore: (backup: HikmatBackup) => Promise<void>;
}

export function RestoreConfirmModal({
  isOpen,
  onClose,
  backupData,
  fileName,
  onConfirmRestore,
}: RestoreConfirmModalProps) {
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !backupData) return null;

  const metadata = backupData.metadata;
  const dataObj = backupData.data || {};
  const counts = metadata?.recordCounts || {
    lands: dataObj.lands?.length || 0,
    cropSeasons: dataObj.cropSeasons?.length || 0,
    activities: dataObj.activities?.length || 0,
    fertilizerApplications: dataObj.fertilizerApplications?.length || 0,
    optObservations: dataObj.optObservations?.length || 0,
    farmerDecisions: dataObj.farmerDecisions?.length || 0,
  };
  const rawDate = backupData.createdAt || metadata?.createdAt;
  const dateFormatted = rawDate
    ? new Date(rawDate).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Tidak diketahui';

  const handleRestore = async () => {
    setIsRestoring(true);
    setErrorMsg(null);
    try {
      await onConfirmRestore(backupData);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat memulihkan data.'
      );
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pulihkan Data Cadangan"
      subtitle="Periksa ringkasan berkas sebelum dipulihkan ke perangkat"
    >
      <div className="space-y-4">
        {errorMsg && (
          <div className="p-3 bg-rose-50 text-rose-800 rounded-xl text-xs font-semibold border border-rose-200">
            {errorMsg}
          </div>
        )}

        {/* Ringkasan Berkas */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
            <FileCheck className="w-4 h-4 text-emerald-700 shrink-0" />
            <span className="truncate">{fileName}</span>
          </div>

          <div className="text-[11px] text-slate-500 space-y-0.5">
            <div>Waktu Pencadangan: <strong className="text-slate-700">{dateFormatted}</strong></div>
            <div>Versi Cadangan: <strong className="text-slate-700">{metadata.backupVersion || '1.0.0'}</strong></div>
          </div>
        </div>

        {/* Rincian Jumlah Catatan */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-800 block">
            Catatan yang Akan Dipulihkan:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-center">
              <span className="text-[10px] text-slate-500 block">Petak Lahan</span>
              <strong className="text-sm text-slate-900">{counts.lands || 0}</strong>
            </div>
            <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-center">
              <span className="text-[10px] text-slate-500 block">Musim Tanam</span>
              <strong className="text-sm text-slate-900">{counts.cropSeasons || 0}</strong>
            </div>
            <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-center">
              <span className="text-[10px] text-slate-500 block">Catatan Kegiatan</span>
              <strong className="text-sm text-slate-900">{counts.activities || 0}</strong>
            </div>
            <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-center">
              <span className="text-[10px] text-slate-500 block">Log Pemupukan</span>
              <strong className="text-sm text-slate-900">{counts.fertilizerApplications || 0}</strong>
            </div>
            <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-center">
              <span className="text-[10px] text-slate-500 block">Pengamatan OPT</span>
              <strong className="text-sm text-slate-900">{counts.optObservations || 0}</strong>
            </div>
            <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-center">
              <span className="text-[10px] text-slate-500 block">Keputusan Petani</span>
              <strong className="text-sm text-slate-900">{counts.farmerDecisions || 0}</strong>
            </div>
          </div>
        </div>

        {/* Peringatan */}
        <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <p className="leading-relaxed font-medium">
            Proses ini akan memperbarui dan menggabungkan data cadangan ke memori perangkat ini. Pastikan Anda mempercayai sumber berkas cadangan ini.
          </p>
        </div>

        {/* Tombol Aksi */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isRestoring}
            className="px-4 py-2.5 min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleRestore}
            disabled={isRestoring}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 min-h-[44px] bg-emerald-800 hover:bg-emerald-900 active:bg-black text-white font-bold rounded-xl text-xs transition-colors shadow-xs"
          >
            {isRestoring ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Memulihkan Data...</span>
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                <span>Pulihkan Sekarang</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
