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
import { useBrandConfig } from '../../services/publicConfigService.ts';
import { syncEngine, SyncEngineStateInfo } from '../../sync/index.ts';
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
import { AuthSession } from '../../services/authClientService.ts';
import { CultivationReportModal } from './CultivationReportModal.tsx';
import { EditFarmerModal } from './EditFarmerModal.tsx';
import { ProfilePhotoModal } from './ProfilePhotoModal.tsx';
import { RestoreConfirmModal } from './RestoreConfirmModal.tsx';
import { SupportModal } from './SupportModal.tsx';
import { AdminPortalModal } from '../admin/AdminPortalModal.tsx';
import { Camera, KeyRound, LogOut, Shield, UserCheck } from 'lucide-react';

interface SayaViewProps {
  farmer: Farmer | null;
  authSession?: AuthSession | null;
  isOnline: boolean;
  lands: Land[];
  seasons: CropSeason[];
  activities: Activity[];
  fertilizerApps?: FertilizerApplication[];
  optObservations?: OptObservation[];
  onUpdateFarmer: (updates: Partial<Farmer>) => Promise<void>;
  onRefreshData: () => Promise<void>;
  onRunDiagnostics?: () => Promise<void>;
  onLogout?: () => Promise<void>;
  onSwitchAccount?: () => void;
  isTestingRunning?: boolean;
}

export function SayaView({
  farmer,
  authSession,
  isOnline,
  lands,
  seasons,
  activities,
  fertilizerApps = [],
  optObservations = [],
  onUpdateFarmer,
  onRefreshData,
  onRunDiagnostics,
  onLogout,
  onSwitchAccount,
  isTestingRunning = false,
}: SayaViewProps) {
  // Modal states
  const [isProfilePhotoModalOpen, setIsProfilePhotoModalOpen] = useState<boolean>(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState<boolean>(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState<boolean>(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState<boolean>(false);
  const [isPortalAdminOpen, setIsPortalAdminOpen] = useState<boolean>(false);
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
  const [syncInfo, setSyncInfo] = useState<SyncEngineStateInfo>(() => syncEngine.getStateInfo());
  const [isManualSyncing, setIsManualSyncing] = useState<boolean>(false);
  const brandConfig = useBrandConfig();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeSeasonsCount = seasons.filter((s) => s.status === 'ACTIVE').length;

  // Subscribe ke Sync Engine untuk status dua arah (push & pull) real-time
  useEffect(() => {
    syncEngine.init();
    const unsubscribe = syncEngine.subscribe((info) => {
      setSyncInfo(info);
      setPendingSyncCount(info.pendingCount);
    });
    return () => unsubscribe();
  }, []);

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    try {
      const res = await syncEngine.syncNow();
      if (res.success && res.pulledCount > 0) {
        await onRefreshData();
      }
    } finally {
      setIsManualSyncing(false);
    }
  };

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
    const text = `Aplikasi HIKMAT TANI — CERDAS BERTANI, BIJAK MENGAMBIL KEPUTUSAN.\nPanduan budidaya padi cerdas, kalkulator pupuk berimbang, dan diagnosis hama PHT 100% offline tanpa kuota. Coba di: ${window.location.origin}`;
    if (navigator.share) {
      navigator.share({
        title: 'HIKMAT TANI — CERDAS BERTANI, BIJAK MENGAMBIL KEPUTUSAN.',
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
        <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
            {/* Avatar Melingkar dengan Aksi Ubah Foto */}
            <div className="relative group shrink-0">
              <button
                type="button"
                onClick={() => setIsProfilePhotoModalOpen(true)}
                className="w-16 h-16 sm:w-18 sm:h-18 rounded-full overflow-hidden border-2 border-[#D4AF37] shadow-md bg-[#0F5132] flex items-center justify-center transition-transform group-hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#2E7D4F]"
                title="Klik untuk ubah foto profil"
              >
                {farmer?.avatarUrl ? (
                  <img
                    src={farmer.avatarUrl}
                    alt={farmer?.name || 'Foto Profil'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#D4AF37] font-black text-2xl">
                    {farmer?.name ? farmer.name.charAt(0).toUpperCase() : <User className="w-8 h-8 text-[#D4AF37]" />}
                  </div>
                )}
              </button>

              {/* Badge Ikon Kamera di Sudut Bawah Avatar */}
              <button
                type="button"
                onClick={() => setIsProfilePhotoModalOpen(true)}
                className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-[#0F5132] hover:bg-[#0B3D26] active:bg-black text-[#D4AF37] border-2 border-white flex items-center justify-center shadow-xs transition-transform group-hover:scale-110"
                title="Ubah Foto Profil"
                aria-label="Ubah Foto Profil"
              >
                <Camera className="w-3 h-3" />
              </button>
            </div>

            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-slate-900 truncate">
                {farmer?.name || 'Petani Padi Indonesia'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {farmer?.farmerGroupName ? `${farmer.farmerGroupName} • ` : ''}
                {farmer?.village ? `Desa ${farmer.village}` : 'Pedesaan Nusantara'}
                {farmer?.regency ? `, ${farmer.regency}` : ''}
              </p>
              <button
                type="button"
                onClick={() => setIsProfilePhotoModalOpen(true)}
                className="text-[11px] font-semibold text-emerald-800 hover:text-emerald-950 underline mt-0.5 inline-block text-left"
              >
                Ubah Foto Profil
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setIsEditProfileOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors shrink-0 min-h-[38px] border border-slate-200"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ubah Profil</span>
              <span className="sm:hidden">Ubah</span>
            </button>
          </div>
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

        {/* Info Akun & Isolasi Keamanan */}
        <div className="pt-3 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                NIK: <strong>{authSession?.farmer?.nikMasked || '3210********0001'}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Smartphone className="w-4 h-4 text-slate-500 shrink-0" />
              <span>
                HP: <strong>{authSession?.farmer?.phoneNumber || farmer?.phoneNumber || '081234567890'}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            {onSwitchAccount && (
              <button
                type="button"
                onClick={onSwitchAccount}
                className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Ganti Akun</span>
              </button>
            )}

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="py-2 px-4 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-rose-200 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-700" />
                <span>Keluar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Status Offline / Online & Penyimpanan Data */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-bold text-slate-900">
                Penyimpanan & Sinkronisasi
              </h4>
              <p className="text-xs text-slate-500">Status kemandirian data di perangkat Anda</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tag Status Sinkronisasi Sesuai Spesifikasi */}
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                syncInfo.statusLabel === '✓ Tersinkron'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                  : syncInfo.statusLabel === '⟳ Menyinkronkan'
                  ? 'bg-blue-50 text-blue-800 border border-blue-300 animate-pulse'
                  : syncInfo.statusLabel === '! Sinkronisasi tertunda'
                  ? 'bg-rose-50 text-rose-800 border border-rose-300'
                  : 'bg-amber-50 text-amber-800 border border-amber-300'
              }`}
            >
              <span>{syncInfo.statusLabel}</span>
            </div>

            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                isOnline
                  ? 'bg-slate-100 text-slate-700'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              {isOnline ? (
                <>
                  <Wifi className="w-3 h-3 text-emerald-600" />
                  <span>Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-amber-600" />
                  <span>Offline</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Indikator Status Bahasa Sederhana */}
        <div className="space-y-2 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-900 font-bold block">
                ● {syncInfo.statusDetail}
              </strong>
              <p className="text-slate-600 leading-relaxed mt-0.5">
                Semua catatan lahan, pemupukan, dan pengamatan OPT tersimpan aman di memori HP/komputer Anda. Aplikasi tetap dapat digunakan sepenuhnya saat berada di tengah sawah tanpa koneksi internet.
              </p>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start justify-between gap-2.5 flex-wrap sm:flex-nowrap">
            <div className="flex items-start gap-2.5">
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

            {/* Tombol Sinkronkan Manual */}
            {isOnline && (
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isManualSyncing || syncInfo.state === 'SYNCING'}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 active:bg-black text-white font-bold rounded-xl text-xs transition-colors self-end sm:self-center"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isManualSyncing || syncInfo.state === 'SYNCING' ? 'animate-spin' : ''}`} />
                <span>{isManualSyncing || syncInfo.state === 'SYNCING' ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}</span>
              </button>
            )}
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
            className="flex items-center justify-center gap-2 p-3.5 min-h-[48px] bg-[#0F5132] hover:bg-[#0B3D26] active:bg-[#072417] text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-xs"
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
      <div className="bg-gradient-to-br from-[#0B3D26] via-[#0F5132] to-[#072417] text-white rounded-3xl p-5 sm:p-6 shadow-lg border border-[#2E7D4F]/40 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <BrandLogo size="md" showSlogan variant="light" />
        </div>

        <div className="space-y-2 text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
          <p>
            <strong>{brandConfig.appName || 'HIKMAT TANI'}</strong> adalah inisiatif mandiri untuk mendampingi petani padi Indonesia mengambil keputusan agronomi secara bijaksana, berbasis kaidah riset resmi yang santun dan adaptif.
          </p>
          <p className="text-emerald-200/80 text-xs">
            Aplikasi ini dibangun tanpa iklan komersial yang mengganggu, tidak menjual data pribadi petani ke korporasi manapun, dan sepenuhnya dirancang untuk kemaslahatan petani Nusantara.
          </p>
        </div>

        {/* Opsi Mendukung: Donasi Sukarela & Bagikan */}
        <div className="p-4 bg-[#072417]/70 rounded-2xl border border-[#2E7D4F]/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HeartHandshake className="w-5 h-5 text-[#D4AF37] shrink-0" />
              <h4 className="text-sm font-bold text-white">Dukung & Sebarkan Kemanfaatan</h4>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 bg-[#D4AF37]/20 text-[#D4AF37] rounded-full border border-[#D4AF37]/40">
              100% Sukarela
            </span>
          </div>

          <p className="text-xs text-emerald-200 leading-relaxed">
            Bantu sesama petani di kelompok tani atau desa Anda untuk bertani lebih hemat pupuk dan bijak mengendalikan hama dengan membagikan aplikasi ini.
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsSupportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] bg-[#D4AF37] hover:bg-[#b89327] active:bg-[#9c7b1e] text-slate-900 font-bold rounded-xl text-xs transition-colors shadow-md"
            >
              <HeartHandshake className="w-4 h-4 text-slate-900" />
              <span>❤️ Dukung / Donasi Sukarela</span>
            </button>

            <button
              type="button"
              onClick={handleShareApp}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[44px] bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-bold rounded-xl text-xs transition-colors border border-white/20"
            >
              <Share2 className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Bagikan ke WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[44px] bg-white/5 hover:bg-white/10 text-emerald-100 font-bold rounded-xl text-xs transition-colors border border-white/10"
            >
              <span>{copiedLink ? 'Tautan Tersalin!' : 'Salin Tautan Web'}</span>
            </button>
          </div>
        </div>

        {/* Footer Versi & Catatan Ilmiah */}
        <div className="pt-2 border-t border-emerald-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-emerald-300/80">
          <span>Versi 1.0.0 • Offline Agronomy Engine</span>
          <span className="italic font-medium">"{brandConfig.slogan || 'CERDAS BERTANI, BIJAK MENGAMBIL KEPUTUSAN.'}"</span>
        </div>
      </div>

      {/* 6. Tentang HIKMAT TANI & Atribusi Pustaka */}
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <Info className="w-4 h-4 text-emerald-700" />
            <span>Atribusi & Sumber Pengetahuan Ilmiah</span>
          </div>

          <button
            type="button"
            onClick={() => setIsPortalAdminOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-200/80 hover:bg-slate-300 active:bg-slate-400 text-slate-700 font-bold rounded-xl text-[11px] transition-colors min-h-[36px]"
          >
            <Shield className="w-3.5 h-3.5 text-slate-600" />
            <span>Akses Pengelola</span>
          </button>
        </div>
        <p className="leading-relaxed">
          Algoritma pemupukan berimbang, pedoman pengendalian OPT PHT, dan deskripsi varietas padi dirujuk dari publikasi resmi Balai Besar Penelitian Tanaman Padi (BBPadi Sukamandi), Direktorat Perlindungan Tanaman Pangan (Ditlin TP Kementan), Balai Penelitian Tanah (Balittanah), serta International Rice Research Institute (IRRI).
        </p>
      </div>

      {/* Modal Dukung HIKMAT TANI */}
      <SupportModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
      />

      {/* Modal Portal Pengelola (Langkah 15) */}
      <AdminPortalModal
        isOpen={isPortalAdminOpen}
        onClose={() => setIsPortalAdminOpen(false)}
        onConfigUpdated={() => {
          // Callback jika config berhasil diupdate
        }}
      />

      {/* Modal Ubah Foto Profil */}
      <ProfilePhotoModal
        isOpen={isProfilePhotoModalOpen}
        onClose={() => setIsProfilePhotoModalOpen(false)}
        farmer={farmer}
        onSavePhoto={async (avatarUrl) => {
          await onUpdateFarmer({ avatarUrl });
          await onRefreshData();
        }}
      />

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
