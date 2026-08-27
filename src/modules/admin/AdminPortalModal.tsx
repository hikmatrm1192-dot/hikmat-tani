/**
 * HIKMAT TANI - Modal & Portal Pengelola (Langkah 15)
 * 
 * Fitur:
 * 1. Autentikasi Pengelola (MANAGER & SUPER_ADMIN)
 * 2. Form Konfigurasi Resmi Donasi & Kontak (Bank, Rekening, Penerima, QRIS, Sakelar Aktif/Nonaktif)
 * 3. Manajemen Akun Pengelola (Khusus SUPER_ADMIN: Tambah, Ubah Status, Hapus)
 * 4. Catatan Audit (Audit Log) Transparan
 * 5. 100% Bahasa Indonesia & Responsif
 */

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Building,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Edit2,
  Eye,
  EyeOff,
  History,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Phone,
  Plus,
  QrCode,
  RefreshCw,
  Save,
  Shield,
  ShieldAlert,
  ShieldCheck,
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

type AdminTab = 'config' | 'managers' | 'audit';

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

  // Active Tab
  const [activeTab, setActiveTab] = useState<AdminTab>('config');

  // Config State
  const [config, setConfig] = useState<AdminAppConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState<boolean>(false);
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);
  const [configSuccessMsg, setConfigSuccessMsg] = useState<string | null>(null);
  const [configErrorMsg, setConfigErrorMsg] = useState<string | null>(null);

  // Form Edit Config values
  const [donationActive, setDonationActive] = useState<boolean>(true);
  const [donationRecipientName, setDonationRecipientName] = useState<string>('');
  const [donationBankName, setDonationBankName] = useState<string>('');
  const [donationAccountNumber, setDonationAccountNumber] = useState<string>('');
  const [donationEwalletNumber, setDonationEwalletNumber] = useState<string>('');
  const [donationUrl, setDonationUrl] = useState<string>('');
  const [donationQrisImage, setDonationQrisImage] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [contactEmail, setContactEmail] = useState<string>('');
  const [description, setDescription] = useState<string>('');

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
        setDonationActive(res.data.donationActive);
        setDonationRecipientName(res.data.donationRecipientName || '');
        setDonationBankName(res.data.donationBankName || '');
        setDonationAccountNumber(res.data.donationAccountNumber || '');
        setDonationEwalletNumber(res.data.donationEwalletNumber || '');
        setDonationUrl(res.data.donationUrl || '');
        setDonationQrisImage(res.data.donationQrisImage || '');
        setContactPhone(res.data.contactPhone || '');
        setContactEmail(res.data.contactEmail || '');
        setDescription(res.data.description || '');
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
        setLoginError(res.error || 'Nama pengguna atau kata sandi tidak cocok.');
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
    setActiveTab('config');
  };

  // Handler: Upload QRIS Image (File reader to Base64)
  const handleQrisFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setConfigErrorMsg('Berkas QRIS harus berupa gambar (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setConfigErrorMsg('Ukuran berkas QRIS maksimal 2 MB.');
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
        donationActive,
        donationRecipientName,
        donationBankName,
        donationAccountNumber,
        donationEwalletNumber,
        donationUrl,
        donationQrisImage,
        contactPhone,
        contactEmail,
        description,
      };

      const res = await adminClientService.updateConfig(payload);
      if (res.success && res.data) {
        setConfig(res.data);
        setConfigSuccessMsg('Konfigurasi resmi HIKMAT TANI berhasil diperbarui.');
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
      setManagerErrorMsg(err?.message || 'Terjadi kesalahan saat membuat pengelola.');
    } finally {
      setIsCreatingManager(false);
    }
  };

  // Handler: Toggle Status Aktif Pengelola (SUPER_ADMIN ONLY)
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
      } else {
        setManagerErrorMsg(res.error || 'Gagal mengubah status pengelola.');
      }
    } catch (err: any) {
      setManagerErrorMsg(err?.message || 'Gagal memperbarui status pengelola.');
    }
  };

  // Handler: Hapus Pengelola (SUPER_ADMIN ONLY)
  const handleDeleteManager = async (manager: ManagerAccount) => {
    if (manager.id === currentAdmin?.id) {
      setManagerErrorMsg('Anda tidak dapat menghapus akun Anda sendiri.');
      return;
    }

    if (!confirm(`Hapus akun pengelola '${manager.username}' (${manager.fullName})?`)) {
      return;
    }

    try {
      const res = await adminClientService.deleteManager(manager.id);
      if (res.success) {
        setManagerSuccessMsg(`Akun pengelola '${manager.username}' berhasil dihapus.`);
        loadManagers();
        loadAuditLogs();
        setTimeout(() => setManagerSuccessMsg(null), 5000);
      } else {
        setManagerErrorMsg(res.error || 'Gagal menghapus pengelola.');
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
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-start gap-3">
              <Shield className="w-5 h-5 text-emerald-800 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-950">
                <strong className="block font-bold">Area Khusus Pengelola Resmi</strong>
                <p className="mt-0.5 text-emerald-800/90 leading-relaxed">
                  Portal ini digunakan untuk mengelola konfigurasi donasi, rekening, QRIS, dan informasi resmi. Petani biasa tidak memerlukan login pengelola ini untuk bertani mandiri.
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
                    placeholder="misal: superadmin / pengelola"
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
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-2 p-3.5 min-h-[48px] bg-emerald-800 hover:bg-emerald-900 active:bg-black text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-xs"
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
                  <p className="text-xs text-slate-400 font-mono">@{currentAdmin.username}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[42px] bg-slate-800 hover:bg-rose-900 active:bg-rose-950 text-slate-200 hover:text-white font-bold rounded-xl text-xs transition-colors border border-slate-700"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar Portal</span>
              </button>
            </div>

            {/* Navigasi Tab */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
              <button
                type="button"
                onClick={() => setActiveTab('config')}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'config'
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Konfigurasi Donasi & Kontak</span>
              </button>

              {currentAdmin.role === 'SUPER_ADMIN' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('managers')}
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'managers'
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Kelola Pengelola</span>
                  <span className="text-[10px] bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded-full font-black">
                    {managers.length}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveTab('audit')}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'audit'
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Catatan Audit</span>
              </button>
            </div>

            {/* TAB 1: FORM KONFIGURASI DONASI & KONTAK */}
            {activeTab === 'config' && (
              <form onSubmit={handleSaveConfig} className="space-y-4">
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

                {/* Rincian Rekening & Bank */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Building className="w-4 h-4 text-emerald-700" />
                    <span>Rekening Bank & Pembayaran Resmi</span>
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
                        placeholder="misal: Bank Mandiri / BCA / BSI"
                        className="w-full px-3 py-2 min-h-[44px] bg-white rounded-xl border border-slate-300 text-slate-900 text-xs font-medium focus:ring-2 focus:ring-emerald-700 outline-hidden"
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
                        className="w-full px-3 py-2 min-h-[44px] bg-white rounded-xl border border-slate-300 text-slate-900 text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-700 outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nama Penerima / Pemilik Rekening
                    </label>
                    <input
                      type="text"
                      value={donationRecipientName}
                      onChange={(e) => setDonationRecipientName(e.target.value)}
                      placeholder="misal: Yayasan Inovasi Tani Mandiri / Pengelola HIKMAT TANI"
                      className="w-full px-3 py-2 min-h-[44px] bg-white rounded-xl border border-slate-300 text-slate-900 text-xs font-medium focus:ring-2 focus:ring-emerald-700 outline-hidden"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nomor / Akun E-Wallet (Opsional)
                      </label>
                      <input
                        type="text"
                        value={donationEwalletNumber}
                        onChange={(e) => setDonationEwalletNumber(e.target.value)}
                        placeholder="misal: 0812-3456-7890 (GoPay/OVO/DANA)"
                        className="w-full px-3 py-2 min-h-[44px] bg-white rounded-xl border border-slate-300 text-slate-900 text-xs font-medium focus:ring-2 focus:ring-emerald-700 outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Link Donasi Eksternal (Opsional)
                      </label>
                      <input
                        type="url"
                        value={donationUrl}
                        onChange={(e) => setDonationUrl(e.target.value)}
                        placeholder="https://saweria.co/... atau https://kitabisa.com/..."
                        className="w-full px-3 py-2 min-h-[44px] bg-white rounded-xl border border-slate-300 text-slate-900 text-xs font-medium focus:ring-2 focus:ring-emerald-700 outline-hidden"
                      />
                    </div>
                  </div>
                </div>

                {/* Upload QRIS */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-emerald-700" />
                    <span>Gambar QRIS Pembayaran</span>
                  </h4>

                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    {donationQrisImage ? (
                      <div className="relative w-36 h-36 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center p-2 shrink-0">
                        <img
                          src={donationQrisImage}
                          alt="QRIS Donasi"
                          className="w-full h-full object-contain"
                        />
                        <button
                          type="button"
                          onClick={() => setDonationQrisImage('')}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-rose-600 text-white rounded-full flex items-center justify-center hover:bg-rose-700 shadow-xs"
                          title="Hapus QRIS"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-36 h-36 bg-slate-100 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 text-xs p-2 text-center shrink-0">
                        <QrCode className="w-8 h-8 mb-1" />
                        <span>Belum ada gambar QRIS</span>
                      </div>
                    )}

                    <div className="space-y-2 text-xs flex-1">
                      <p className="text-slate-600">
                        Unggah gambar barcode QRIS resmi (format JPG/PNG/WebP, maksimal 2 MB) untuk memudahkan donasi langsung melalui mobile banking atau aplikasi dompet digital.
                      </p>
                      <label className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs cursor-pointer border border-slate-300 transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{donationQrisImage ? 'Ganti Gambar QRIS' : 'Pilih Gambar QRIS'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleQrisFileChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Kontak Resmi & Deskripsi */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-emerald-700" />
                    <span>Kontak Resmi & Deskripsi Singkat</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nomor Telepon / WhatsApp Resmi
                      </label>
                      <input
                        type="text"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="+62 812-3456-7890"
                        className="w-full px-3 py-2 min-h-[44px] bg-white rounded-xl border border-slate-300 text-slate-900 text-xs font-medium focus:ring-2 focus:ring-emerald-700 outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Email Resmi Pengelola
                      </label>
                      <input
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="kontak@hikmattani.id"
                        className="w-full px-3 py-2 min-h-[44px] bg-white rounded-xl border border-slate-300 text-slate-900 text-xs font-medium focus:ring-2 focus:ring-emerald-700 outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Deskripsi Singkat / Misi Aplikasi
                    </label>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Deskripsi misi kemandirian petani..."
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-slate-900 text-xs font-medium focus:ring-2 focus:ring-emerald-700 outline-hidden"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSavingConfig}
                    className="w-full flex items-center justify-center gap-2 p-3.5 min-h-[48px] bg-emerald-800 hover:bg-emerald-900 active:bg-black text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-xs"
                  >
                    {isSavingConfig ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Menyimpan Konfigurasi...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Simpan Perubahan Konfigurasi Resmi</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: KELOLA PENGELOLA (SUPER_ADMIN ONLY) */}
            {activeTab === 'managers' && currentAdmin.role === 'SUPER_ADMIN' && (
              <div className="space-y-4">
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

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Daftar Akun Pengelola</h4>
                    <p className="text-xs text-slate-500">
                      Kelola hak akses pengelola dan admin utama
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsAddManagerOpen(!isAddManagerOpen)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-xl text-xs transition-colors shadow-xs"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{isAddManagerOpen ? 'Tutup Form' : 'Tambah Pengelola'}</span>
                  </button>
                </div>

                {/* Form Tambah Pengelola Baru */}
                {isAddManagerOpen && (
                  <form
                    onSubmit={handleCreateManager}
                    className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3"
                  >
                    <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Buat Akun Pengelola Baru
                    </h5>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Nama Pengguna (Username) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value)}
                          placeholder="misal: manager_subang"
                          className="w-full px-3 py-2 min-h-[44px] bg-white rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-emerald-700 outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Nama Lengkap <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={newFullName}
                          onChange={(e) => setNewFullName(e.target.value)}
                          placeholder="misal: Ahmad Subang"
                          className="w-full px-3 py-2 min-h-[44px] bg-white rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-emerald-700 outline-hidden"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Email (Opsional)
                        </label>
                        <input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="ahmad@hikmattani.id"
                          className="w-full px-3 py-2 min-h-[44px] bg-white rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-emerald-700 outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Kata Sandi Awal <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="password"
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Minimal 6 karakter..."
                          className="w-full px-3 py-2 min-h-[44px] bg-white rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-emerald-700 outline-hidden"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Peran (Role)
                      </label>
                      <select
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value as 'MANAGER' | 'SUPER_ADMIN')}
                        className="w-full px-3 py-2 min-h-[44px] bg-white rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-emerald-700 outline-hidden"
                      >
                        <option value="MANAGER">MANAGER (Pengelola Resmi)</option>
                        <option value="SUPER_ADMIN">SUPER_ADMIN (Admin Utama)</option>
                      </select>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsAddManagerOpen(false)}
                        className="px-3 py-2 min-h-[42px] bg-white text-slate-700 border border-slate-300 font-bold rounded-xl text-xs"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={isCreatingManager}
                        className="px-4 py-2 min-h-[42px] bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-xs"
                      >
                        {isCreatingManager ? 'Menyimpan...' : 'Simpan Akun Pengelola'}
                      </button>
                    </div>
                  </form>
                )}

                {/* List Akun Pengelola */}
                <div className="space-y-2">
                  {managers.map((m) => (
                    <div
                      key={m.id}
                      className="p-3.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                          {m.fullName.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900">{m.fullName}</span>
                            <span
                              className={`text-[9px] font-black px-1.5 py-0.2 rounded-full ${
                                m.role === 'SUPER_ADMIN'
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              }`}
                            >
                              {m.role}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                                m.isActive
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {m.isActive ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 font-mono">@{m.username}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {m.id !== currentAdmin.id && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleToggleManagerActive(m)}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                                m.isActive
                                  ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                  : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              }`}
                            >
                              {m.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteManager(m)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                              title="Hapus Pengelola"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: CATATAN AUDIT (AUDIT LOGS) */}
            {activeTab === 'audit' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Riwayat Catatan Audit</h4>
                    <p className="text-xs text-slate-500">
                      Pencatatan transparan seluruh perubahan konfigurasi & aksi manajerial
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={loadAuditLogs}
                    className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                    title="Segarkan Log"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoadingAudit ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {auditLogs.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      Belum ada catatan audit tercatat.
                    </div>
                  ) : (
                    auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900">{log.actorName}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded">
                              {log.actorRole}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(log.createdAt).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <div className="text-slate-700 font-medium">
                          Aksi: <strong className="font-mono text-emerald-800">{log.action}</strong>
                        </div>
                        {log.details && (
                          <div className="text-[11px] text-slate-500 font-mono bg-white p-2 rounded border border-slate-200">
                            {JSON.stringify(log.details)}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 italic">
            "Bijak Bertani, Cerdas Bertani"
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 min-h-[48px] bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </Modal>
  );
}
