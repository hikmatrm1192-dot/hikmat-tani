/**
 * HIKMAT TANI - Modal & Portal Pengelola (Langkah 15)
 * 
 * Fitur Menu:
 * 1. Identitas & Branding: Nama aplikasi, slogan resmi, preview logo resmi 1024 & horizontal, deskripsi.
 * 2. Pengaturan Akun: Profil SUPER_ADMIN (pappizee / hikmat.rm1192@gmail.com), Ganti Password Aman, Kelola Pengelola Staf.
 * 3. Donasi & QRIS: Sakelar status donasi, rekening bank, e-wallet, unggah & kelola berkas QRIS resmi.
 * 4. Pustaka Informasi: Ringkasan database varietas padi, hama & penyakit (OPT), pemupukan, status offline.
 * 5. Konfigurasi Aplikasi: Kontak bantuan & email resmi, status sistem, riwayat audit log.
 */

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Building,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Database,
  Edit2,
  Eye,
  EyeOff,
  History,
  Info,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Palette,
  Phone,
  Plus,
  QrCode,
  RefreshCw,
  Save,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sprout,
  Trash2,
  Upload,
  User,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal.tsx';
import {
  adminClientService,
  AdminProfile,
  AdminAppConfig,
  ManagerAccount,
  AuditLogItem,
} from '../../services/adminClientService.ts';

interface AdminPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigUpdated?: () => void;
}

export type AdminMenuTab = 'identitas' | 'akun' | 'donasi' | 'pustaka' | 'konfigurasi';

export function AdminPortalModal({ isOpen, onClose, onConfigUpdated }: AdminPortalModalProps) {
  // Auth state
  const [currentAdmin, setCurrentAdmin] = useState<AdminProfile | null>(() =>
    adminClientService.getStoredAdmin()
  );
  const [usernameInput, setUsernameInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Active Menu Tab
  const [activeTab, setActiveTab] = useState<AdminMenuTab>('identitas');

  // Config State
  const [config, setConfig] = useState<AdminAppConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState<boolean>(false);
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);
  const [configSuccessMsg, setConfigSuccessMsg] = useState<string | null>(null);
  const [configErrorMsg, setConfigErrorMsg] = useState<string | null>(null);

  // Form Edit Config values
  const [appName, setAppName] = useState<string>('HIKMAT TANI');
  const [slogan, setSlogan] = useState<string>('CERDAS BERTANI, BIJAK MENGAMBIL KEPUTUSAN.');
  const [description, setDescription] = useState<string>('');
  const [supportTitle, setSupportTitle] = useState<string>('Dukung HIKMAT TANI');
  const [supportDescription, setSupportDescription] = useState<string>('Inisiatif Mandiri Teknologi Pertanian Padi Nusantara');
  const [donationActive, setDonationActive] = useState<boolean>(true);
  const [donationRecipientName, setDonationRecipientName] = useState<string>('');
  const [donationBankName, setDonationBankName] = useState<string>('');
  const [donationAccountNumber, setDonationAccountNumber] = useState<string>('');
  const [donationEwalletNumber, setDonationEwalletNumber] = useState<string>('');
  const [donationUrl, setDonationUrl] = useState<string>('');
  const [donationQrisImage, setDonationQrisImage] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [contactEmail, setContactEmail] = useState<string>('');

  // Password Change State
  const [currentPasswordInput, setCurrentPasswordInput] = useState<string>('');
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState<string>('');
  const [showChangePassword, setShowChangePassword] = useState<boolean>(false);
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState<string | null>(null);
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);

  // Managers State (SUPER_ADMIN ONLY)
  const [managers, setManagers] = useState<ManagerAccount[]>([]);
  const [isLoadingManagers, setIsLoadingManagers] = useState<boolean>(false);
  const [isAddManagerOpen, setIsAddManagerOpen] = useState<boolean>(false);
  const [newUsername, setNewUsername] = useState<string>('');
  const [newFullName, setNewFullName] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newRole, setNewRole] = useState<'MANAGER' | 'SUPER_ADMIN'>('MANAGER');
  const [isCreatingManager, setIsCreatingManager] = useState<boolean>(false);
  const [managerErrorMsg, setManagerErrorMsg] = useState<string | null>(null);
  const [managerSuccessMsg, setManagerSuccessMsg] = useState<string | null>(null);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState<boolean>(false);

  // Load data when opened or logged in
  useEffect(() => {
    if (!isOpen) return;

    const stored = adminClientService.getStoredAdmin();
    setCurrentAdmin(stored);

    if (stored) {
      loadConfig();
      if (stored.role === 'SUPER_ADMIN') {
        loadManagers();
      }
      loadAuditLogs();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    setIsLoadingConfig(true);
    setConfigErrorMsg(null);
    try {
      const res = await adminClientService.getConfig();
      if (res.success && res.data) {
        setConfig(res.data);
        setAppName(res.data.appName || 'HIKMAT TANI');
        setSlogan(res.data.slogan || 'CERDAS BERTANI, BIJAK MENGAMBIL KEPUTUSAN.');
        setDescription(res.data.description || '');
        setSupportTitle(res.data.supportTitle || 'Dukung HIKMAT TANI');
        setSupportDescription(res.data.supportDescription || 'Inisiatif Mandiri Teknologi Pertanian Padi Nusantara');
        setDonationActive(res.data.donationActive);
        setDonationRecipientName(res.data.donationRecipientName || '');
        setDonationBankName(res.data.donationBankName || '');
        setDonationAccountNumber(res.data.donationAccountNumber || '');
        setDonationEwalletNumber(res.data.donationEwalletNumber || '');
        setDonationUrl(res.data.donationUrl || '');
        setDonationQrisImage(res.data.donationQrisImage || '');
        setContactPhone(res.data.contactPhone || '');
        setContactEmail(res.data.contactEmail || '');
      } else {
        setConfigErrorMsg(res.error || 'Gagal memuat konfigurasi');
      }
    } finally {
      setIsLoadingConfig(false);
    }
  };

  const loadManagers = async () => {
    setIsLoadingManagers(true);
    try {
      const res = await adminClientService.listManagers();
      if (res.success && res.data) {
        setManagers(res.data);
      }
    } finally {
      setIsLoadingManagers(false);
    }
  };

  const loadAuditLogs = async () => {
    setIsLoadingAudit(true);
    try {
      const res = await adminClientService.getAuditLogs(30);
      if (res.success && res.data) {
        setAuditLogs(res.data);
      }
    } finally {
      setIsLoadingAudit(false);
    }
  };

  // Handler: Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const res = await adminClientService.login(usernameInput, passwordInput, true);
      if (res.success && res.admin) {
        setCurrentAdmin(res.admin);
        setUsernameInput('');
        setPasswordInput('');
        loadConfig();
        if (res.admin.role === 'SUPER_ADMIN') {
          loadManagers();
        }
        loadAuditLogs();
      } else {
        setLoginError(res.error || 'Nama pengguna/email atau kata sandi tidak cocok.');
      }
    } catch (err: any) {
      setLoginError(err?.message || 'Gagal menghubungi server pengelola.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handler: Logout
  const handleLogout = () => {
    adminClientService.logout();
    setCurrentAdmin(null);
    setActiveTab('identitas');
  };

  // Handler: Upload QRIS Image (File reader to Base64)
  const handleQrisFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setConfigErrorMsg('Berkas QRIS harus berupa gambar raster (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 2.5 * 1024 * 1024) {
      setConfigErrorMsg('Ukuran berkas QRIS maksimal 2.5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setDonationQrisImage(base64);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Handler: Simpan Konfigurasi
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    setConfigSuccessMsg(null);
    setConfigErrorMsg(null);

    try {
      const payload: Partial<AdminAppConfig> = {
        appName,
        slogan,
        description,
        supportTitle,
        supportDescription,
        donationActive,
        donationRecipientName,
        donationBankName,
        donationAccountNumber,
        donationEwalletNumber,
        donationUrl,
        donationQrisImage,
        contactPhone,
        contactEmail,
      };

      const res = await adminClientService.updateConfig(payload);
      if (res.success && res.data) {
        setConfig(res.data);
        setConfigSuccessMsg('Konfigurasi berhasil disimpan dan diperbarui.');
        onConfigUpdated?.();
        loadAuditLogs();
        setTimeout(() => setConfigSuccessMsg(null), 5000);
      } else {
        setConfigErrorMsg(res.error || 'Gagal menyimpan konfigurasi.');
      }
    } catch (err: any) {
      setConfigErrorMsg(err?.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Handler: Ganti Kata Sandi
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeSuccess(null);
    setPasswordChangeError(null);

    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordChangeError('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }

    if (newPasswordInput.length < 6) {
      setPasswordChangeError('Kata sandi baru minimal harus 6 karakter.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await adminClientService.changePassword(currentPasswordInput, newPasswordInput);
      if (res.success) {
        setPasswordChangeSuccess(res.message || 'Kata sandi berhasil diperbarui.');
        setCurrentPasswordInput('');
        setNewPasswordInput('');
        setConfirmPasswordInput('');
        loadAuditLogs();
        setTimeout(() => setPasswordChangeSuccess(null), 6000);
      } else {
        setPasswordChangeError(res.error || 'Gagal mengubah kata sandi.');
      }
    } catch (err: any) {
      setPasswordChangeError(err?.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Handler: Tambah Pengelola Baru (SUPER_ADMIN ONLY)
  const handleCreateManager = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingManager(true);
    setManagerErrorMsg(null);
    setManagerSuccessMsg(null);

    try {
      const res = await adminClientService.createManager({
        username: newUsername,
        fullName: newFullName,
        email: newEmail || undefined,
        passwordPlain: newPassword,
        role: newRole,
      });

      if (res.success && res.data) {
        setManagerSuccessMsg(`Akun pengelola '${res.data.username}' berhasil dibuat.`);
        setNewUsername('');
        setNewFullName('');
        setNewEmail('');
        setNewPassword('');
        setIsAddManagerOpen(false);
        loadManagers();
        loadAuditLogs();
        setTimeout(() => setManagerSuccessMsg(null), 5000);
      } else {
        setManagerErrorMsg(res.error || 'Gagal membuat akun pengelola.');
      }
    } catch (err: any) {
      setManagerErrorMsg(err?.message || 'Gagal membuat akun pengelola.');
    } finally {
      setIsCreatingManager(false);
    }
  };

  // Handler: Toggle Aktif/Nonaktif Pengelola
  const handleToggleManagerActive = async (manager: ManagerAccount) => {
    if (manager.id === currentAdmin?.id) {
      setManagerErrorMsg('Anda tidak dapat menonaktifkan akun Anda sendiri.');
      return;
    }

    try {
      const res = await adminClientService.updateManager(manager.id, {
        isActive: !manager.isActive,
      });

      if (res.success) {
        loadManagers();
        loadAuditLogs();
      }
    } catch (err: any) {
      setManagerErrorMsg(err?.message || 'Gagal memperbarui status pengelola.');
    }
  };

  // Handler: Hapus Pengelola
  const handleDeleteManager = async (manager: ManagerAccount) => {
    if (manager.id === currentAdmin?.id) {
      setManagerErrorMsg('Anda tidak dapat menghapus akun Anda sendiri.');
      return;
    }

    if (!window.confirm(`Apakah Anda yakin ingin menghapus akun pengelola '${manager.username}'?`)) {
      return;
    }

    try {
      const res = await adminClientService.deleteManager(manager.id);
      if (res.success) {
        loadManagers();
        loadAuditLogs();
      }
    } catch (err: any) {
      setManagerErrorMsg(err?.message || 'Gagal menghapus pengelola.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Portal Pengelola HIKMAT TANI"
      subtitle={
        currentAdmin
          ? `Masuk sebagai: ${currentAdmin.fullName} (${currentAdmin.role === 'SUPER_ADMIN' ? 'Super Admin Utama' : 'Pengelola'})`
          : 'Akses resmi pengelolaan konfigurasi aplikasi HIKMAT TANI'
      }
      maxWidth={currentAdmin ? 'xl' : 'md'}
    >
      <div className="space-y-5">
        {/* JIKA BELUM LOGIN: FORM LOGIN PENGELOLA */}
        {!currentAdmin ? (
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Official Logo Banner */}
            <div className="bg-gradient-to-br from-emerald-900 via-emerald-950 to-slate-950 text-white rounded-2xl p-5 border border-emerald-800/80 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-950/60 border border-emerald-500/40 p-1 flex items-center justify-center overflow-hidden shrink-0">
                  <img
                    src="/logo-hikmat-tani-1024.png"
                    alt="Logo HIKMAT TANI"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (!target.src.includes('/icon-192.png')) {
                        target.src = '/icon-192.png';
                      }
                    }}
                  />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight text-white">
                    HIKMAT <span className="text-emerald-400">TANI</span>
                  </h3>
                  <p className="text-xs text-emerald-200/90 font-medium">
                    CERDAS BERTANI, BIJAK MENGAMBIL KEPUTUSAN.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-800/80 text-emerald-200 rounded-full border border-emerald-600/50">
                Portal Resmi
              </span>
            </div>

            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-start gap-3">
              <Shield className="w-5 h-5 text-emerald-800 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-950">
                <strong className="block font-bold">Area Khusus Pengelola Resmi</strong>
                <p className="mt-0.5 text-emerald-800/90 leading-relaxed">
                  Portal ini digunakan untuk mengelola konfigurasi donasi, rekening, QRIS, identitas, dan informasi resmi. Petani biasa tidak memerlukan login pengelola ini untuk bertani mandiri 100% offline.
                </p>
              </div>
            </div>

            {loginError && (
              <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 flex items-center gap-2 text-xs font-semibold text-rose-900">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Pengguna / Email Pengelola <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="misal: pappizee / hikmat.rm1192@gmail.com"
                    className="w-full pl-10 pr-3.5 py-2.5 min-h-[48px] bg-white rounded-xl border border-slate-300 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700 transition-all outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kata Sandi Pengelola <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Masukkan kata sandi..."
                    className="w-full pl-10 pr-10 py-2.5 min-h-[48px] bg-white rounded-xl border border-slate-300 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700 transition-all outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full mt-2 py-3 px-4 min-h-[48px] bg-emerald-800 hover:bg-emerald-700 active:bg-emerald-900 text-white font-bold rounded-xl text-sm transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoggingIn ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Memverifikasi Hak Akses...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Masuk Portal Pengelola</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* JIKA SUDAH LOGIN: DASHBOARD PENGELOLA & SUPER ADMIN */
          <div className="space-y-5">
            {/* Header Profil Pengelola & Tombol Logout */}
            <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-700 text-amber-300 flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
                  {currentAdmin.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-white">{currentAdmin.fullName}</h4>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                        currentAdmin.role === 'SUPER_ADMIN'
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-emerald-700 text-emerald-100'
                      }`}
                    >
                      {currentAdmin.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Pengelola'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono">
                    @{currentAdmin.username} {currentAdmin.email ? `• ${currentAdmin.email}` : ''}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[42px] bg-slate-800 hover:bg-rose-900 active:bg-rose-950 text-slate-200 hover:text-white font-bold rounded-xl text-xs transition-colors border border-slate-700 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar Portal</span>
              </button>
            </div>

            {/* Navigasi 5 Menu Wajib */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setActiveTab('identitas')}
                className={`flex items-center justify-center gap-1.5 px-2.5 py-2.5 min-h-[44px] rounded-xl text-xs font-bold transition-all text-center ${
                  activeTab === 'identitas'
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Palette className="w-3.5 h-3.5 shrink-0" />
                <span>Identitas & Branding</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('akun')}
                className={`flex items-center justify-center gap-1.5 px-2.5 py-2.5 min-h-[44px] rounded-xl text-xs font-bold transition-all text-center ${
                  activeTab === 'akun'
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 shrink-0" />
                <span>Pengaturan Akun</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('donasi')}
                className={`flex items-center justify-center gap-1.5 px-2.5 py-2.5 min-h-[44px] rounded-xl text-xs font-bold transition-all text-center ${
                  activeTab === 'donasi'
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5 shrink-0" />
                <span>Donasi & QRIS</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('pustaka')}
                className={`flex items-center justify-center gap-1.5 px-2.5 py-2.5 min-h-[44px] rounded-xl text-xs font-bold transition-all text-center ${
                  activeTab === 'pustaka'
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                <span>Pustaka Informasi</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('konfigurasi')}
                className={`flex items-center justify-center gap-1.5 px-2.5 py-2.5 min-h-[44px] rounded-xl text-xs font-bold transition-all text-center ${
                  activeTab === 'konfigurasi'
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Settings className="w-3.5 h-3.5 shrink-0" />
                <span>Konfigurasi Aplikasi</span>
              </button>
            </div>

            {/* Alert Pesan Sukses / Error Umum */}
            {configSuccessMsg && (
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-300 flex items-center gap-2 text-xs font-semibold text-emerald-950">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{configSuccessMsg}</span>
              </div>
            )}

            {configErrorMsg && (
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 flex items-center gap-2 text-xs font-semibold text-rose-900">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{configErrorMsg}</span>
              </div>
            )}

            {/* ========================================================================= */}
            {/* MENU 1: IDENTITAS & BRANDING */}
            {/* ========================================================================= */}
            {activeTab === 'identitas' && (
              <form onSubmit={handleSaveConfig} className="space-y-4">
                {/* Visual Identity Showcase */}
                <div className="p-5 bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900 text-white rounded-2xl border border-emerald-800/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      Identitas Visual Resmi
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-800/80 text-emerald-200 rounded-full border border-emerald-600/50">
                      Terverifikasi
                    </span>
                  </div>

                  <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap bg-emerald-950/60 p-4 rounded-xl border border-emerald-700/40">
                    <div className="w-16 h-16 rounded-xl bg-emerald-950 border border-emerald-400/40 p-1 flex items-center justify-center shrink-0">
                      <img
                        src="/logo-hikmat-tani-1024.png"
                        alt="Emblem Resmi HIKMAT TANI"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div>
                      <h4 className="text-base font-black tracking-tight text-white">
                        HIKMAT <span className="text-emerald-400">TANI</span>
                      </h4>
                      <p className="text-xs text-emerald-200 font-bold mt-0.5">
                        CERDAS BERTANI, BIJAK MENGAMBIL KEPUTUSAN.
                      </p>
                      <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                        Sistem Rekomendasi Budidaya Padi & Catatan Lapang Mandiri 100% Offline Petani Indonesia.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Pengaturan Nama & Tagline Aplikasi
                  </h4>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nama Aplikasi
                    </label>
                    <input
                      type="text"
                      required
                      value={appName}
                      onChange={(e) => setAppName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-300 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-emerald-700 outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Slogan / Tagline Resmi
                    </label>
                    <input
                      type="text"
                      required
                      value={slogan}
                      onChange={(e) => setSlogan(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-300 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-emerald-700 outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Deskripsi Aplikasi Resmi
                    </label>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-300 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-emerald-700 outline-hidden"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSavingConfig}
                    className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] bg-emerald-800 hover:bg-emerald-700 active:bg-emerald-900 text-white font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isSavingConfig ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>Simpan Identitas & Branding</span>
                  </button>
                </div>
              </form>
            )}

            {/* ========================================================================= */}
            {/* MENU 2: PENGATURAN AKUN (SUPER_ADMIN & GANTI PASSWORD & STAF) */}
            {/* ========================================================================= */}
            {activeTab === 'akun' && (
              <div className="space-y-6">
                {/* Informasi Akun Utama Saat Ini */}
                <div className="p-5 bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl border border-slate-800 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" />
                      Kredensial Akun Pengelola Utama
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 bg-amber-400 text-slate-950 rounded-full uppercase">
                      {currentAdmin.role}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
                      <span className="text-slate-400 block text-[11px]">Nama Pengguna (Username):</span>
                      <strong className="text-sm font-mono text-white mt-0.5 block">
                        {currentAdmin.username}
                      </strong>
                    </div>

                    <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
                      <span className="text-slate-400 block text-[11px]">Email Resmi Pengelola:</span>
                      <strong className="text-sm font-mono text-emerald-300 mt-0.5 block truncate">
                        {currentAdmin.email || 'hikmat.rm1192@gmail.com'}
                      </strong>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Akun ini memiliki hak akses penuh sebagai <strong>Super Admin Utama</strong> untuk mengelola identitas, donasi, konfigurasi, dan staf pengelola.
                  </p>
                </div>

                {/* Form Ganti Kata Sandi */}
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                        <KeyRound className="w-4 h-4 text-emerald-700" />
                        Ganti Kata Sandi Akun Pengelola
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Perbarui kata sandi Anda secara berkala untuk menjaga keamanan portal resmi.
                      </p>
                    </div>
                  </div>

                  {passwordChangeSuccess && (
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-300 flex items-center gap-2 text-xs font-semibold text-emerald-950">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{passwordChangeSuccess}</span>
                    </div>
                  )}

                  {passwordChangeError && (
                    <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 flex items-center gap-2 text-xs font-semibold text-rose-900">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{passwordChangeError}</span>
                    </div>
                  )}

                  <form onSubmit={handleChangePassword} className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Kata Sandi Saat Ini <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="password"
                        required
                        value={currentPasswordInput}
                        onChange={(e) => setCurrentPasswordInput(e.target.value)}
                        placeholder="Masukkan kata sandi saat ini..."
                        className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-300 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-emerald-700 outline-hidden"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Kata Sandi Baru (Minimal 6 Karakter) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="password"
                          required
                          value={newPasswordInput}
                          onChange={(e) => setNewPasswordInput(e.target.value)}
                          placeholder="Masukkan kata sandi baru..."
                          className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-300 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-emerald-700 outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Konfirmasi Kata Sandi Baru <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="password"
                          required
                          value={confirmPasswordInput}
                          onChange={(e) => setConfirmPasswordInput(e.target.value)}
                          placeholder="Ulangi kata sandi baru..."
                          className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-300 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-emerald-700 outline-hidden"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={isChangingPassword}
                        className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] bg-slate-900 hover:bg-emerald-800 active:bg-emerald-950 text-white font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        {isChangingPassword ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Lock className="w-4 h-4" />
                        )}
                        <span>Perbarui Kata Sandi</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* Manajemen Pengelola Staf (Khusus SUPER_ADMIN) */}
                {currentAdmin.role === 'SUPER_ADMIN' && (
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-emerald-700" />
                          Daftar Akun Pengelola Staf
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Kelola staf pengelola lapangan pendukung yang memiliki akses portal.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsAddManagerOpen(!isAddManagerOpen)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] bg-emerald-800 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Tambah Pengelola Staf</span>
                      </button>
                    </div>

                    {managerSuccessMsg && (
                      <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-300 flex items-center gap-2 text-xs font-semibold text-emerald-950">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{managerSuccessMsg}</span>
                      </div>
                    )}

                    {managerErrorMsg && (
                      <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 flex items-center gap-2 text-xs font-semibold text-rose-900">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{managerErrorMsg}</span>
                      </div>
                    )}

                    {/* Form Tambah Pengelola Staf */}
                    {isAddManagerOpen && (
                      <form onSubmit={handleCreateManager} className="p-4 bg-white rounded-xl border border-emerald-200 space-y-3">
                        <h5 className="text-xs font-bold text-emerald-950">Form Tambah Akun Pengelola Staf</h5>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Nama Pengguna (Username) <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              value={newUsername}
                              onChange={(e) => setNewUsername(e.target.value)}
                              placeholder="misal: pengelola_lapang"
                              className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-300 text-slate-900 text-xs font-medium focus:ring-2 focus:ring-emerald-700 outline-hidden"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Nama Lengkap <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              value={newFullName}
                              onChange={(e) => setNewFullName(e.target.value)}
                              placeholder="misal: Budi Santoso"
                              className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-300 text-slate-900 text-xs font-medium focus:ring-2 focus:ring-emerald-700 outline-hidden"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Email Resmi (Opsional)
                            </label>
                            <input
                              type="email"
                              value={newEmail}
                              onChange={(e) => setNewEmail(e.target.value)}
                              placeholder="misal: budi@hikmattani.id"
                              className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-300 text-slate-900 text-xs font-medium focus:ring-2 focus:ring-emerald-700 outline-hidden"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Kata Sandi <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="password"
                              required
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="Minimal 6 karakter..."
                              className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-300 text-slate-900 text-xs font-medium focus:ring-2 focus:ring-emerald-700 outline-hidden"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setIsAddManagerOpen(false)}
                            className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
                          >
                            Batal
                          </button>
                          <button
                            type="submit"
                            disabled={isCreatingManager}
                            className="px-4 py-1.5 text-xs font-bold bg-emerald-800 text-white hover:bg-emerald-700 rounded-lg cursor-pointer disabled:opacity-50"
                          >
                            {isCreatingManager ? 'Menyimpan...' : 'Simpan Akun'}
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Tabel Daftar Pengelola */}
                    <div className="divide-y divide-slate-200 bg-white rounded-xl border border-slate-200 overflow-hidden">
                      {managers.map((m) => (
                        <div key={m.id} className="p-3.5 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                              {m.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h6 className="text-xs font-bold text-slate-900">{m.fullName}</h6>
                                <span
                                  className={`text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase ${
                                    m.role === 'SUPER_ADMIN'
                                      ? 'bg-amber-400 text-slate-950'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {m.role}
                                </span>
                                {!m.isActive && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 bg-rose-100 text-rose-800 rounded-full">
                                    Nonaktif
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 font-mono">
                                @{m.username} {m.email ? `• ${m.email}` : ''}
                              </p>
                            </div>
                          </div>

                          {m.id !== currentAdmin.id && (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleToggleManagerActive(m)}
                                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                                  m.isActive
                                    ? 'bg-amber-50 text-amber-900 hover:bg-amber-100'
                                    : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                                }`}
                              >
                                {m.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteManager(m)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Hapus Pengelola"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* MENU 3: DONASI & QRIS */}
            {/* ========================================================================= */}
            {activeTab === 'donasi' && (
              <form onSubmit={handleSaveConfig} className="space-y-4">
                {/* Sakelar Status Donasi */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      Status Penerimaan Dukungan / Donasi
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {donationActive
                        ? 'Aktif: Informasi rekening & QRIS ditampilkan di halaman Dukung HIKMAT TANI'
                        : 'Nonaktif: Penerimaan donasi ditutup sementara'}
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={donationActive}
                      onChange={(e) => setDonationActive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-700"></div>
                  </label>
                </div>

                {/* Form Rekening Bank */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                    <Building className="w-4 h-4 text-emerald-700" />
                    Rekening Bank Resmi
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nama Bank
                      </label>
                      <input
                        type="text"
                        value={donationBankName}
                        onChange={(e) => setDonationBankName(e.target.value)}
                        placeholder="misal: Bank Mandiri / BRI / BCA / BSI"
                        className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-300 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-emerald-700 outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nomor Rekening
                      </label>
                      <input
                        type="text"
                        value={donationAccountNumber}
                        onChange={(e) => setDonationAccountNumber(e.target.value)}
                        placeholder="misal: 132-00-9876543-2"
                        className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-300 text-slate-900 text-sm font-mono font-medium focus:ring-2 focus:ring-emerald-700 outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nama Pemilik Rekening / Penerima
                    </label>
                    <input
                      type="text"
                      value={donationRecipientName}
                      onChange={(e) => setDonationRecipientName(e.target.value)}
                      placeholder="misal: Pengelola HIKMAT TANI"
                      className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-300 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-emerald-700 outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      E-Wallet / Kontak Transfer Alternatif
                    </label>
                    <input
                      type="text"
                      value={donationEwalletNumber}
                      onChange={(e) => setDonationEwalletNumber(e.target.value)}
                      placeholder="misal: 0812-3456-7890 (GoPay/OVO/DANA/ShopeePay)"
                      className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-300 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-emerald-700 outline-hidden"
                    />
                  </div>
                </div>

                {/* Pengaturan QRIS Resmi */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-emerald-700" />
                    Kode QRIS Donasi Resmi
                  </h4>

                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    {donationQrisImage ? (
                      <div className="w-36 h-36 bg-white p-2 rounded-2xl border-2 border-emerald-600 shadow-sm flex items-center justify-center shrink-0">
                        <img
                          src={donationQrisImage}
                          alt="QRIS Donasi HIKMAT TANI"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-36 h-36 bg-slate-200 rounded-2xl border border-slate-300 flex flex-col items-center justify-center text-slate-500 text-center p-2 shrink-0">
                        <QrCode className="w-8 h-8 mb-1 text-slate-400" />
                        <span className="text-[10px] font-bold">Belum Ada QRIS</span>
                      </div>
                    )}

                    <div className="space-y-2 flex-1 w-full">
                      <label className="block text-xs font-bold text-slate-700">
                        Unggah Berkas Gambar QRIS Baru
                      </label>
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/webp"
                        onChange={handleQrisFileChange}
                        className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-800 file:text-white hover:file:bg-emerald-700 cursor-pointer"
                      />
                      <p className="text-[11px] text-slate-500">
                        Format yang didukung: PNG, JPG, WebP. Ukuran maks 2.5 MB.
                      </p>
                      {donationQrisImage && (
                        <button
                          type="button"
                          onClick={() => setDonationQrisImage('')}
                          className="text-xs text-rose-600 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus Gambar QRIS</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tautan Donasi Eksternal (Kitabisa / Saweria / KaryaKarsa - Opsional)
                    </label>
                    <input
                      type="url"
                      value={donationUrl}
                      onChange={(e) => setDonationUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-300 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-emerald-700 outline-hidden"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSavingConfig}
                    className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] bg-emerald-800 hover:bg-emerald-700 active:bg-emerald-900 text-white font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isSavingConfig ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>Simpan Pengaturan Donasi & QRIS</span>
                  </button>
                </div>
              </form>
            )}

            {/* ========================================================================= */}
            {/* MENU 4: PUSTAKA INFORMASI */}
            {/* ========================================================================= */}
            {activeTab === 'pustaka' && (
              <div className="space-y-4">
                <div className="p-5 bg-gradient-to-br from-emerald-950 to-slate-900 text-white rounded-2xl border border-emerald-800/80 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4" />
                      Status Basis Pengetahuan Agronomi Padi
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-700 text-white rounded-full">
                      100% Offline Ready
                    </span>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed">
                    Database pustaka agronomi telah diindeks dan disimpan secara lokal pada peramban/perangkat petani sehingga dapat diakses tanpa koneksi internet sama sekali di tengah sawah.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span>Database Varietas Padi</span>
                      <span className="text-emerald-700">15+ Varietas</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Varietas Inpari, Ciherang, Mekongga, IR64, Sintanur, Sigupai, dll lengkap dengan potensi hasil, umur panen, dan ketahanan wereng/hawar.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span>Diagnosis Hama & Penyakit (OPT)</span>
                      <span className="text-emerald-700">12+ OPT Utama</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Penggerek batang (sundep/beluk), wereng batang coklat (WBC), blast, kresek, tikus, walang sangit, dll disertai ambang kendali & pestisida nabati.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span>Kalkulator Pemupukan Berimbang</span>
                      <span className="text-emerald-700">5 Dosis Unsur</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Rekomendasi takaran pupuk dasar & susulan (Organik, Urea, SP-36, KCl, NPK Ponska) disesuaikan luas lahan dan fase umur tanaman (HST).
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span>Rujukan Ilmiah Terstandar</span>
                      <span className="text-emerald-700">BBPadi & Ditlin</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Disusun mengacu pada standar Balai Besar Penelitian Tanaman Padi (BBPadi) Sukamandi dan Ditlin Kementan RI.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* MENU 5: KONFIGURASI APLIKASI */}
            {/* ========================================================================= */}
            {activeTab === 'konfigurasi' && (
              <div className="space-y-5">
                <form onSubmit={handleSaveConfig} className="space-y-4">
                  {/* Kontak Bantuan & Dukungan */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                      <Phone className="w-4 h-4 text-emerald-700" />
                      Kontak Layanan & Bantuan Resmi
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Nomor Telepon / WhatsApp
                        </label>
                        <input
                          type="text"
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          placeholder="+62 812-3456-7890"
                          className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-300 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-emerald-700 outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Email Kontak Bantuan
                        </label>
                        <input
                          type="email"
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          placeholder="kontak@hikmattani.id"
                          className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-300 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-emerald-700 outline-hidden"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Banner Dukungan Petani */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                      <Building className="w-4 h-4 text-emerald-700" />
                      Pengaturan Banner Dukung HIKMAT TANI
                    </h4>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Judul Banner
                      </label>
                      <input
                        type="text"
                        value={supportTitle}
                        onChange={(e) => setSupportTitle(e.target.value)}
                        placeholder="Dukung HIKMAT TANI"
                        className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-300 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-emerald-700 outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Subjudul / Keterangan Banner
                      </label>
                      <input
                        type="text"
                        value={supportDescription}
                        onChange={(e) => setSupportDescription(e.target.value)}
                        placeholder="Inisiatif Mandiri Teknologi Pertanian Padi Nusantara"
                        className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-300 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-emerald-700 outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isSavingConfig}
                      className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] bg-emerald-800 hover:bg-emerald-700 active:bg-emerald-900 text-white font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {isSavingConfig ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      <span>Simpan Konfigurasi Aplikasi</span>
                    </button>
                  </div>
                </form>

                {/* Ringkasan Catatan Audit (Audit Log) */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                      <History className="w-4 h-4 text-emerald-700" />
                      Riwayat Catatan Audit (Audit Log)
                    </h4>
                    <button
                      type="button"
                      onClick={loadAuditLogs}
                      className="text-xs text-emerald-800 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingAudit ? 'animate-spin' : ''}`} />
                      <span>Muat Ulang</span>
                    </button>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {auditLogs.length === 0 ? (
                      <p className="text-xs text-slate-500 italic py-2">Belum ada catatan aktivitas.</p>
                    ) : (
                      auditLogs.map((log) => (
                        <div
                          key={log.id}
                          className="p-2.5 bg-white rounded-xl border border-slate-200 text-xs flex items-center justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center gap-1.5 font-bold text-slate-900">
                              <span className="font-mono text-emerald-800">{log.action}</span>
                              <span className="text-slate-400">•</span>
                              <span className="text-slate-700">{log.actorName}</span>
                            </div>
                            <span className="text-[10px] text-slate-500">
                              {new Date(log.createdAt).toLocaleString('id-ID', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </span>
                          </div>
                          {log.ipAddress && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {log.ipAddress}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
