/**
 * HIKMAT TANI - Modul Saya, Backup & Dukung HIKMAT TANI (Langkah 8)
 * 
 * Fitur:
 * - Profil Petani Sederhana (Nama, Kelompok Tani, Lokasi dasar) - Tanpa NIK/KTP
 * - Ringkasan Petak Lahan, Musim Aktif, & Kegiatan
 * - Status Offline / Online & Penyimpanan Data (Bahasa sederhana)
 * - Backup & Restore Data (Cadangkan & Pulihkan berkas JSON)
 * - Ekspor / Cetak Laporan Budidaya (Format siap cetak untuk arsip mandiri atau konsultasi PPL)
 * - "Dukung HIKMAT TANI" (Misi kemandirian petani, bagikan ke WhatsApp, dan dukungan sukarela)
 * - Tentang Aplikasi & Atribusi Ilmiah Resmi
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronRight,
  Database,
  Download,
  Edit3,
  FileCheck,
  FileSpreadsheet,
  FileText,
  HardDrive,
  HeartHandshake,
  HelpCircle,
  Info,
  MapPin,
  Play,
  Printer,
  RefreshCw,
  Share2,
  ShieldCheck,
  Smartphone,
  Upload,
  User,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { backupService } from '../../backup/index.ts';
import { BrandLogo } from '../../components/common/BrandLogo.tsx';
import { PageHeader } from '../../components/common/PageHeader.tsx';
import { outboxRepository } from '../../db/repositories/outboxRepository.ts';
import {
  Activity,
  CropSeason,
  Farmer,
  FertilizerApplication,
  HikmatBackup,
  Land,
  OptObservation,
} from '../../types/index.ts';
import { CultivationReportModal } from './CultivationReportModal.tsx';
import { EditFarmerModal } from './EditFarmerModal.tsx';
import { RestoreConfirmModal } from './RestoreConfirmModal.tsx';

interface SayaViewProps {
  farmer: Farmer | null;
  isOnline: boolean;
  lands: Land[];
  seasons: CropSeason[];
  activities: Activity[];
  fertilizerApps?: FertilizerApplication[];
  optObservations?: OptObservation[];
  onUpdateFarmer: (updates: Partial<Farmer>) => Promise<void>;
  onRefreshData: () => Promise<void>;
  onRunDiagnostics?: () => Promise<void>;
  isTestingRunning?: boolean;
}

export function SayaView({
  farmer,
  isOnline,
  lands,
  seasons,
  activities,
  fertilizerApps = [],
  optObservations = [],
  onUpdateFarmer,
  onRefreshData,
  onRunDiagnostics,
  isTestingRunning = false,
}: SayaViewProps) {
  // Modal states
  const [isEditProfileOpen, setIsEditProfileOpen] = useState<boolean>(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState<boolean>(false);
  const [pendingRestoreBackup, setPendingRestoreBackup] = useState<HikmatBackup | null>(null);
  const [restoreFileName, setRestoreFileName] = useState<string>('');

  // Status & Feedback states
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(() => {
    return localStorage.getItem('hikmat_last_backup_time');
  });
  const [backupSuccessMsg, setBackupSuccessMsg] = useState<string | null>(null);
  const [restoreErrorMsg, setRestoreErrorMsg] = useState<string | null>(null);
  const [restoreSuccessMsg, setRestoreSuccessMsg] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeSeasonsCount = seasons.filter((s) => s.status === 'ACTIVE').length;

  // Tangkap event PWA install jika browser mendukung
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!installPromptEvent) return;
    installPromptEvent.prompt();
    const { outcome } = await installPromptEvent.userChoice;
    if (outcome === 'accepted') {
      setInstallPromptEvent(null);
    }
  };

  // Cek antrean outbox secara berkala
  useEffect(() => {
    async function checkOutbox() {
      try {
        const count = await outboxRepository.countPending();
        setPendingSyncCount(count);
      } catch {
        // Abaikan jika database sedang sibuk
      }
    }
    checkOutbox();
  }, [activities, seasons, lands]);

  // Handler: Cadangkan Data ke JSON
  const handleBackup = async () => {
    setIsBackingUp(true);
    setBackupSuccessMsg(null);
    setRestoreErrorMsg(null);
    try {
      const res = await backupService.downloadBackup();
      if (res.success) {
        const nowIso = new Date().toISOString();
        localStorage.setItem('hikmat_last_backup_time', nowIso);
        setLastBackupAt(nowIso);
        setBackupSuccessMsg(`Berkas cadangan "${res.fileName}" berhasil disimpan di perangkat Anda.`);
        setTimeout(() => setBackupSuccessMsg(null), 6000);
      }
    } catch (err) {
      setRestoreErrorMsg('Gagal membuat berkas cadangan data.');
    } finally {
      setIsBackingUp(false);
    }
  };

  // Handler: Pilih Berkas Pulihkan
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreErrorMsg(null);
    setRestoreSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        if (!backupService.validateBackupData(parsed)) {
          setRestoreErrorMsg('Format berkas cadangan tidak valid atau rusak.');
          return;
        }

        setPendingRestoreBackup(parsed);
        setRestoreFileName(file.name);
        setIsRestoreModalOpen(true);
      } catch (err) {
        setRestoreErrorMsg('Gagal membaca berkas. Pastikan memilih berkas .json yang valid.');
      }
    };
    reader.readAsText(file);

    // Reset input file agar dapat memilih berkas yang sama jika diulang
    e.target.value = '';
  };

  // Handler: Eksekusi Pemulihan
  const handleConfirmRestore = async (backup: HikmatBackup) => {
    try {
      const res = await backupService.restoreBackup(backup);
      if (res.success) {
        await onRefreshData();
        setRestoreSuccessMsg(
          `Pemulihan selesai: ${res.recordCounts.lands} lahan, ${res.recordCounts.cropSeasons} musim, dan ${res.recordCounts.activities} aktivitas berhasil dipulihkan.`
        );
        setTimeout(() => setRestoreSuccessMsg(null), 8000);
      }
    } catch (err: unknown) {
      setRestoreErrorMsg(
        err instanceof Error ? err.message : 'Terjadi kegagalan saat memulihkan data.'
      );
    }
  };

  // Handler: Bagikan ke WhatsApp
  const handleShareApp = () => {
    const text = `Aplikasi HIKMAT TANI: Panduan budidaya padi cerdas, kalkulator pupuk berimbang, dan diagnosis hama PHT 100% offline tanpa kuota. Coba di: ${window.location.origin}`;
    if (navigator.share) {
      navigator.share({
        title: 'HIKMAT TANI - Cerdas Bertani Padi',
        text,
        url: window.location.origin,
      }).catch(() => {});
    } else {
      const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(waUrl, '_blank');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(window.location.origin);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard?.writeText('HIKMAT-TANI-MANDIRI');
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <PageHeader
        title="Saya"
        subtitle="Profil petani, status kemandirian data lokal, backup, dan dukungan aplikasi"
      />

      {/* Pesan Sukses / Error Banner */}
      {backupSuccessMsg && (
        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-300 flex items-center gap-3 text-xs sm:text-sm font-semibold text-emerald-950 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
          <span>{backupSuccessMsg}</span>
        </div>
      )}

      {restoreSuccessMsg && (
        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-300 flex items-center gap-3 text-xs sm:text-sm font-semibold text-emerald-950 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
          <span>{restoreSuccessMsg}</span>
        </div>
      )}

      {restoreErrorMsg && (
        <div className="p-4 bg-rose-50 rounded-2xl border border-rose-300 flex items-center gap-3 text-xs sm:text-sm font-semibold text-rose-950 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0" />
          <span>{restoreErrorMsg}</span>
        </div>
      )}

      {/* 1. Profil Petani Sederhana */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-800 text-amber-300 flex items-center justify-center font-bold text-xl shadow-xs shrink-0">
              {farmer?.name ? farmer.name.charAt(0).toUpperCase() : <User className="w-7 h-7" />}
            </div>

            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                {farmer?.name || 'Petani Padi Indonesia'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {farmer?.farmerGroupName ? `${farmer.farmerGroupName} • ` : ''}
                {farmer?.village ? `Desa ${farmer.village}` : 'Pedesaan Nusantara'}
                {farmer?.regency ? `, ${farmer.regency}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsEditProfileOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors shrink-0 min-h-[38px]"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ubah Profil</span>
            <span className="sm:hidden">Ubah</span>
          </button>
        </div>

        {/* Statistik Ringkas */}
        <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[11px] font-medium text-slate-500 block">Petak Lahan</span>
            <span className="text-lg font-black text-slate-900">{lands.length}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[11px] font-medium text-slate-500 block">Musim Aktif</span>
            <span className="text-lg font-black text-emerald-800">{activeSeasonsCount}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[11px] font-medium text-slate-500 block">Total Kegiatan</span>
            <span className="text-lg font-black text-slate-900">{activities.length}</span>
          </div>
        </div>
      </div>

      {/* 2. Status Offline / Online & Penyimpanan Data */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-bold text-slate-900">
                Penyimpanan & Koneksi
              </h4>
              <p className="text-xs text-slate-500">Status kemandirian data di perangkat Anda</p>
            </div>
          </div>

          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
              isOnline
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                : 'bg-amber-50 text-amber-800 border border-amber-300'
            }`}
          >
            {isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                <span>Terhubung Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                <span>Mode Offline</span>
              </>
            )}
          </div>
        </div>

        {/* Indikator Status Bahasa Sederhana */}
        <div className="space-y-2 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-900 font-bold block">
                ● Data Tersimpan Aman di Perangkat Ini
              </strong>
              <p className="text-slate-600 leading-relaxed mt-0.5">
                Semua catatan lahan, pemupukan, dan pengamatan OPT tersimpan di memori HP/komputer Anda. Aplikasi tetap dapat digunakan sepenuhnya saat berada di tengah sawah tanpa koneksi internet.
              </p>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2.5">
            <HardDrive className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-900 font-bold block">
                ● {pendingSyncCount === 0 ? 'Semua Catatan Telah Tersimpan Lengkap' : `${pendingSyncCount} Catatan Menunggu Internet untuk Sinkronisasi`}
              </strong>
              <p className="text-slate-600 leading-relaxed mt-0.5">
                {pendingSyncCount === 0
                  ? 'Tidak ada antrean catatan yang tertunda. Sistem siap beroperasi kapan saja.'
                  : 'Catatan baru Anda tersimpan aman secara lokal dan akan otomatis disinkronkan saat tersambung internet.'}
              </p>
            </div>
          </div>
        </div>

        {/* Tombol Uji Integritas Engine */}
        {onRunDiagnostics && (
          <div className="pt-2 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={onRunDiagnostics}
              disabled={isTestingRunning}
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[42px] bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors"
            >
              <Play className="w-3.5 h-3.5 text-emerald-700" />
              <span>{isTestingRunning ? 'Sedang Memeriksa...' : 'Uji Integritas Engine Agronomi'}</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Cadangkan & Pulihkan Data (Backup & Restore) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm sm:text-base font-bold text-slate-900">
              Cadangkan & Pulihkan Data
            </h4>
            <p className="text-xs text-slate-500">
              Data Anda tersimpan di perangkat.
            </p>
          </div>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 flex items-center justify-between">
          <span className="font-medium">Cadangan terakhir:</span>
          <span className="font-bold text-slate-800">
            {lastBackupAt
              ? new Date(lastBackupAt).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Belum pernah dicadangkan'}
          </span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Simpan salinan cadangan data lahan, musim tanam, dan kegiatan budidaya ke dalam berkas cadangan (.json) untuk keamanan atau saat berpindah HP.
        </p>

        {/* Tombol Cadangkan & Pulihkan */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Tombol Cadangkan Data */}
          <button
            type="button"
            onClick={handleBackup}
            disabled={isBackingUp}
            className="flex items-center justify-center gap-2 p-3.5 min-h-[48px] bg-emerald-800 hover:bg-emerald-900 active:bg-black text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-xs"
          >
            {isBackingUp ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Membuat Cadangan...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Cadangkan Data</span>
              </>
            )}
          </button>

          {/* Tombol Pulihkan Data */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 p-3.5 min-h-[48px] bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 border border-slate-300 font-bold rounded-xl text-xs sm:text-sm transition-all"
          >
            <Upload className="w-4 h-4 text-slate-700" />
            <span>Pulihkan Data</span>
          </button>

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json,application/json"
            className="hidden"
          />
        </div>
      </div>

      {/* Ajakan Pasang PWA (Jika didukung browser dan belum terpasang) */}
      {installPromptEvent && (
        <div className="bg-linear-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-800 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">
                Pasang HIKMAT TANI di Perangkat
              </h4>
              <p className="text-xs text-slate-600">
                Akses cepat langsung dari layar utama HP tanpa membuka browser
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleInstallApp}
            className="px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 active:bg-black text-white font-bold rounded-xl text-xs transition-colors shrink-0 shadow-xs min-h-[44px]"
          >
            Pasang Aplikasi
          </button>
        </div>
      )}

      {/* 4. Ekspor & Cetak Laporan Budidaya */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-bold text-slate-900">
                Ekspor & Cetak Laporan
              </h4>
              <p className="text-xs text-slate-500">
                Ringkasan catatan lapang untuk arsip mandiri atau konsultasi PPL
              </p>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Buat lembar rekapitulasi data petak lahan, varietas padi, jadwal pemupukan berimbang, dan riwayat serangan OPT dalam format rapi yang siap dicetak atau dibagikan via pesan singkat.
        </p>

        <div className="pt-1">
          <button
            type="button"
            onClick={() => setIsReportModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 p-3.5 min-h-[48px] bg-slate-900 hover:bg-black text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>Buka & Cetak Laporan Budidaya</span>
          </button>
        </div>
      </div>

      {/* 5. Dukung HIKMAT TANI (Branding, Kemandirian & Dukungan Sukarela) */}
      <div className="bg-gradient-to-br from-emerald-900 via-emerald-950 to-slate-950 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-emerald-800/80 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <BrandLogo size="md" showSlogan variant="light" />
        </div>

        <div className="space-y-2 text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
          <p>
            <strong>HIKMAT TANI</strong> adalah inisiatif mandiri untuk mendampingi petani padi Indonesia mengambil keputusan agronomi secara bijaksana, berbasis kaidah riset resmi yang santun dan adaptif.
          </p>
          <p className="text-emerald-200/80 text-xs">
            Aplikasi ini dibangun tanpa iklan komersial yang mengganggu, tidak menjual data pribadi petani ke korporasi manapun, dan sepenuhnya dirancang untuk kemaslahatan petani Nusantara.
          </p>
        </div>

        {/* Opsi Mendukung: Bagikan & Solidaritas */}
        <div className="p-4 bg-emerald-900/60 rounded-xl border border-emerald-700/50 space-y-3">
          <div className="flex items-center gap-2">
            <HeartHandshake className="w-5 h-5 text-amber-400 shrink-0" />
            <h4 className="text-sm font-bold text-white">Dukung & Sebarkan Kemanfaatan</h4>
          </div>

          <p className="text-xs text-emerald-200 leading-relaxed">
            Bantu sesama petani di kelompok tani atau desa Anda untuk bertani lebih hemat pupuk dan bijak mengendalikan hama dengan membagikan aplikasi ini.
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={handleShareApp}
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-emerald-950 font-bold rounded-xl text-xs transition-colors shadow-xs"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Bagikan ke WhatsApp Petani</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] bg-emerald-800/90 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors border border-emerald-600/60"
            >
              <span>{copiedLink ? 'Tautan Tersalin!' : 'Salin Tautan Aplikasi'}</span>
            </button>
          </div>
        </div>

        {/* Footer Versi & Catatan Ilmiah */}
        <div className="pt-2 border-t border-emerald-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-emerald-400">
          <span>Versi 1.0.0 • Offline Agronomy Engine</span>
          <span className="italic">"Cerdas Bertani, Bijak Mengambil Keputusan"</span>
        </div>
      </div>

      {/* 6. Tentang HIKMAT TANI & Atribusi Pustaka */}
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-2">
        <div className="flex items-center gap-2 font-bold text-slate-800">
          <Info className="w-4 h-4 text-emerald-700" />
          <span>Atribusi & Sumber Pengetahuan Ilmiah</span>
        </div>
        <p className="leading-relaxed">
          Algoritma pemupukan berimbang, pedoman pengendalian OPT PHT, dan deskripsi varietas padi dirujuk dari publikasi resmi Balai Besar Penelitian Tanaman Padi (BBPadi Sukamandi), Direktorat Perlindungan Tanaman Pangan (Ditlin TP Kementan), Balai Penelitian Tanah (Balittanah), serta International Rice Research Institute (IRRI).
        </p>
      </div>

      {/* Modal Ubah Profil Singkat */}
      <EditFarmerModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        farmer={farmer}
        onSave={async (updates) => {
          await onUpdateFarmer(updates);
          await onRefreshData();
        }}
      />

      {/* Modal Konfirmasi Pemulihan Data (Restore) */}
      <RestoreConfirmModal
        isOpen={isRestoreModalOpen}
        onClose={() => {
          setIsRestoreModalOpen(false);
          setPendingRestoreBackup(null);
        }}
        backupData={pendingRestoreBackup}
        fileName={restoreFileName}
        onConfirmRestore={handleConfirmRestore}
      />

      {/* Modal Cetak Laporan Budidaya */}
      <CultivationReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        farmer={farmer}
        lands={lands}
        seasons={seasons}
        activities={activities}
        fertilizerApps={fertilizerApps}
        optObservations={optObservations}
      />
    </div>
  );
}
