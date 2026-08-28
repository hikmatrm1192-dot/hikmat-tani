/**
 * HIKMAT TANI - Farmer Authentication & Registration Gate (Langkah 1 & 7)
 * 
 * Prinsip:
 * 1. Pintu gerbang wajib sebelum mengakses dashboard & data lahan.
 * 2. Desain ramah petani dengan tombol sentuh besar, kontras jelas, dan bahasa Indonesia lugas.
 * 3. Mendukung registrasi baru, login via NIK / No. HP + PIN 6 digit, dan resume akun tersimpan.
 */

import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  MapPin,
  Phone,
  ShieldCheck,
  Smartphone,
  User,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo.tsx';
import { authClientService, AuthSession } from '../../services/authClientService.ts';

interface AuthGateProps {
  onAuthenticated: (session: AuthSession) => void;
}

export function AuthGate({ onAuthenticated }: AuthGateProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State: Login
  const [loginIdentifier, setLoginIdentifier] = useState<string>('');
  const [loginPin, setLoginPin] = useState<string>('');

  // Form State: Register
  const [regName, setRegName] = useState<string>('');
  const [regNik, setRegNik] = useState<string>('');
  const [regPhone, setRegPhone] = useState<string>('');
  const [regPin, setRegPin] = useState<string>('');
  const [regVillage, setRegVillage] = useState<string>('Sukamaju');
  const [regDistrict, setRegDistrict] = useState<string>('Kasokandel');
  const [regRegency, setRegRegency] = useState<string>('Majalengka');
  const [regFarmerGroup, setRegFarmerGroup] = useState<string>('Kelompok Tani Sri Rejeki');

  const savedAccounts = authClientService.getSavedAccounts();

  // Quick autofill for saved account
  const handleSelectSavedAccount = (acc: typeof savedAccounts[0]) => {
    setLoginIdentifier(acc.phoneNumber || '');
    setActiveTab('login');
  };

  // Handler: Eksekusi Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!loginIdentifier.trim()) {
      setErrorMessage('Silakan masukkan NIK atau Nomor HP Anda');
      return;
    }
    if (!loginPin.trim() || loginPin.length !== 6) {
      setErrorMessage('PIN keamanan harus terdiri dari 6 digit angka');
      return;
    }

    setLoading(true);
    try {
      const res = await authClientService.login({
        identifier: loginIdentifier.trim(),
        pin: loginPin.trim(),
      });

      if (res.success && res.session) {
        onAuthenticated(res.session);
      } else {
        setErrorMessage(res.error || 'NIK/Nomor HP atau PIN tidak cocok');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal masuk. Periksa jaringan Anda.');
    } finally {
      setLoading(false);
    }
  };

  // Handler: Eksekusi Registrasi
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!regName.trim() || regName.trim().length < 2) {
      setErrorMessage('Nama lengkap minimal 2 karakter');
      return;
    }
    if (!regNik.trim() || !/^\d{16}$/.test(regNik.trim())) {
      setErrorMessage('NIK KTP harus tepat 16 digit angka');
      return;
    }
    if (!regPhone.trim() || regPhone.replace(/\D/g, '').length < 9) {
      setErrorMessage('Nomor HP tidak valid. Contoh: 081234567890');
      return;
    }
    if (!regPin.trim() || !/^\d{6}$/.test(regPin.trim())) {
      setErrorMessage('PIN keamanan harus tepat 6 digit angka');
      return;
    }

    setLoading(true);
    try {
      const res = await authClientService.register({
        name: regName.trim(),
        nik: regNik.trim(),
        phoneNumber: regPhone.trim(),
        pin: regPin.trim(),
        village: regVillage.trim(),
        district: regDistrict.trim(),
        regency: regRegency.trim(),
        farmerGroupName: regFarmerGroup.trim(),
      });

      if (res.success && res.session) {
        onAuthenticated(res.session);
      } else {
        setErrorMessage(res.error || 'Pendaftaran gagal');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal mendaftar. Periksa jaringan Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#072417] via-[#0B3D26] to-[#05180F] flex flex-col justify-center items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-emerald-900/30 overflow-hidden flex flex-col">
        {/* Header Identitas Brand */}
        <div className="bg-gradient-to-br from-[#0B3D26] via-[#0F5132] to-[#0B3D26] text-white p-6 text-center space-y-2.5 relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-[#2E7D4F]/20 rounded-full blur-xl pointer-events-none" />
          
          <div className="flex justify-center relative z-10">
            <BrandLogo size="lg" variant="light" showSlogan={false} />
          </div>
          <div className="text-[11px] sm:text-xs font-bold tracking-wider text-emerald-100/90 uppercase py-0.5 relative z-10">
            CERDAS BERTANI, BIJAK MENGAMBIL KEPUTUSAN.
          </div>
          <div className="pt-2 border-t border-emerald-700/60 relative z-10">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Identitas Petani
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/90 font-medium mt-0.5">
              Gerbang petani cerdas dan bijak
            </p>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mt-1.5 rounded-full bg-[#072417]/50 border border-emerald-600/40 text-[10px] text-emerald-200 font-bold">
              <ShieldCheck className="w-3 h-3 text-[#D4AF37]" />
              <span>Data Saya Adalah Milik Saya</span>
            </div>
          </div>
        </div>

        {/* Tab Navigasi: Masuk vs Daftar */}
        <div className="flex border-b border-slate-200 bg-[#F7F6F0]">
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              setErrorMessage(null);
            }}
            className={`flex-1 py-3.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTab === 'login'
                ? 'border-[#0F5132] text-[#0F5132] bg-white shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Masuk Petani</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('register');
              setErrorMessage(null);
            }}
            className={`flex-1 py-3.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTab === 'register'
                ? 'border-[#0F5132] text-[#0F5132] bg-white shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Daftar Baru</span>
          </button>
        </div>

        {/* Konten Form */}
        <div className="p-6 space-y-5 flex-1 bg-white">
          {errorMessage && (
            <div className="p-4 bg-rose-50 rounded-2xl border border-rose-300 flex items-start gap-3 text-xs sm:text-sm text-rose-950">
              <AlertCircle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold block">Perhatian:</strong>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Form: Masuk (Login) */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {/* Riwayat Akun Tersimpan di Perangkat ini */}
              {savedAccounts.length > 0 && (
                <div className="space-y-2 pb-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Pilih Akun di HP Ini:
                  </span>
                  <div className="space-y-1.5">
                    {savedAccounts.map((acc) => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => handleSelectSavedAccount(acc)}
                        className="w-full text-left p-3 rounded-xl border border-slate-200 bg-[#F7F6F0] hover:bg-emerald-50 hover:border-[#0F5132]/40 transition-colors flex items-center justify-between group"
                      >
                        <div className="min-w-0 pr-2">
                          <strong className="text-xs sm:text-sm font-bold text-slate-900 block truncate group-hover:text-[#0F5132]">
                            {acc.name}
                          </strong>
                          <span className="text-[11px] text-slate-500 block truncate">
                            {acc.phoneNumber} • NIK: {acc.nikMasked}
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#0F5132] shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs sm:text-sm font-bold text-slate-800 block mb-1.5">
                  Nomor HP atau NIK KTP (16 Digit)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="Contoh: 081234567890 atau 3210..."
                    className="w-full pl-11 pr-4 py-3 bg-[#F7F6F0] border border-slate-300 rounded-xl text-slate-900 font-medium text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0F5132] focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs sm:text-sm font-bold text-slate-800 block mb-1.5">
                  PIN Keamanan (6 Digit Angka)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type={showPin ? 'text' : 'password'}
                    required
                    maxLength={6}
                    inputMode="numeric"
                    value={loginPin}
                    onChange={(e) => setLoginPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Contoh: 123456"
                    className="w-full pl-11 pr-11 py-3 bg-[#F7F6F0] border border-slate-300 rounded-xl text-slate-900 font-bold text-sm tracking-widest focus:outline-hidden focus:ring-2 focus:ring-[#0F5132] focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-[#0F5132] hover:bg-[#0B3D26] active:bg-[#072417] text-white font-bold text-sm sm:text-base rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 mt-2 disabled:opacity-50 min-h-[48px]"
              >
                <KeyRound className="w-5 h-5" />
                <span>{loading ? 'Memverifikasi...' : 'Masuk ke Aplikasi'}</span>
              </button>
            </form>
          )}

          {/* Form: Daftar Baru (Register) */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  Nama Lengkap Petani
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Contoh: Pak Sutrisno"
                    className="w-full pl-9 pr-3 py-2.5 bg-[#F7F6F0] border border-slate-300 rounded-xl text-slate-900 font-medium text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0F5132] focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    NIK KTP (16 Digit)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={16}
                    inputMode="numeric"
                    value={regNik}
                    onChange={(e) => setRegNik(e.target.value.replace(/\D/g, '').slice(0, 16))}
                    placeholder="3210010101750001"
                    className="w-full px-3 py-2.5 bg-[#F7F6F0] border border-slate-300 rounded-xl text-slate-900 font-medium text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0F5132] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    Nomor HP / WhatsApp
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Phone className="w-4 h-4" />
                    </div>
                    <input
                      type="tel"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="081234567890"
                      className="w-full pl-9 pr-3 py-2.5 bg-[#F7F6F0] border border-slate-300 rounded-xl text-slate-900 font-medium text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0F5132] focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  Buat PIN Keamanan (6 Digit Angka)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPin ? 'text' : 'password'}
                    required
                    maxLength={6}
                    inputMode="numeric"
                    value={regPin}
                    onChange={(e) => setRegPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Contoh: 123456"
                    className="w-full pl-9 pr-10 py-2.5 bg-[#F7F6F0] border border-slate-300 rounded-xl text-slate-900 font-bold text-xs sm:text-sm tracking-widest focus:outline-hidden focus:ring-2 focus:ring-[#0F5132] focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-0.5">
                    Desa / Kelurahan
                  </label>
                  <input
                    type="text"
                    value={regVillage}
                    onChange={(e) => setRegVillage(e.target.value)}
                    placeholder="Sukamaju"
                    className="w-full px-2.5 py-2 bg-[#F7F6F0] border border-slate-300 rounded-lg text-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-0.5">
                    Kabupaten
                  </label>
                  <input
                    type="text"
                    value={regRegency}
                    onChange={(e) => setRegRegency(e.target.value)}
                    placeholder="Majalengka"
                    className="w-full px-2.5 py-2 bg-[#F7F6F0] border border-slate-300 rounded-lg text-slate-900 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-0.5">
                  Nama Kelompok Tani (Opsional)
                </label>
                <input
                  type="text"
                  value={regFarmerGroup}
                  onChange={(e) => setRegFarmerGroup(e.target.value)}
                  placeholder="Kelompok Tani Sri Rejeki"
                  className="w-full px-2.5 py-2 bg-[#F7F6F0] border border-slate-300 rounded-lg text-slate-900 text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-[#0F5132] hover:bg-[#0B3D26] active:bg-[#072417] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 mt-2 disabled:opacity-50 min-h-[48px]"
              >
                <UserPlus className="w-4 h-4" />
                <span>{loading ? 'Mendaftarkan...' : 'Daftar Identitas Petani'}</span>
              </button>
            </form>
          )}

          {/* Jaminan Privasi Data Petani */}
          <div className="pt-3 border-t border-slate-100 flex items-start gap-2.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-[#0F5132] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Jaminan Privasi:</strong> Data lahan, catatan budidaya, dan kalkulasi Anda terisolasi secara aman. Petani lain tidak dapat melihat atau mengubah catatan Anda.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
