/**
 * HIKMAT TANI - Support & Donation Modal ("Dukung HIKMAT TANI")
 * 
 * Prinsip:
 * - Dukungan murni sukarela dari hati petani / komunitas peduli pangan.
 * - Tidak ada fitur yang dikunci atau disembunyikan di balik paywall.
 * - Menggunakan VITE_DONATION_URL jika tersedia, atau panduan donasi sukarela.
 * - Identitas & Tagline Resmi: "CERDAS BERTANI, BIJAK MENGAMBIL KEPUTUSAN."
 */

import { useEffect, useState } from 'react';
import {
  Building,
  Check,
  Copy,
  ExternalLink,
  Heart,
  HeartHandshake,
  QrCode,
  Share2,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { BrandLogo } from '../../components/common/BrandLogo.tsx';
import { Modal } from '../../components/common/Modal.tsx';
import {
  publicConfigService,
  useBrandConfig,
  PublicAppConfig,
} from '../../services/publicConfigService.ts';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SupportModal({ isOpen, onClose }: SupportModalProps) {
  const [copiedRekening, setCopiedRekening] = useState<boolean>(false);
  const [copiedEwallet, setCopiedEwallet] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const brandConfig = useBrandConfig();
  const config = brandConfig;

  useEffect(() => {
    if (!isOpen) return;
    publicConfigService.getPublicConfig();
  }, [isOpen]);

  const appName = brandConfig.appName || 'HIKMAT TANI';
  const slogan = brandConfig.slogan || 'CERDAS BERTANI, BIJAK MENGAMBIL KEPUTUSAN.';

  const handleShareWa = () => {
    const text = `Aplikasi ${appName} — ${slogan}\nKalkulator pupuk berimbang, rekomendasi OPT PHT, dan catatan budidaya 100% offline gratis tanpa iklan.\nKunjungi: ${window.location.origin}`;
    if (navigator.share) {
      navigator.share({
        title: `${appName} — ${slogan}`,
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
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyRekening = () => {
    if (brandConfig.donationAccountNumber) {
      navigator.clipboard?.writeText(brandConfig.donationAccountNumber.replace(/[^0-9]/g, ''));
    }
    setCopiedRekening(true);
    setTimeout(() => setCopiedRekening(false), 2500);
  };

  const handleCopyEwallet = () => {
    if (brandConfig.donationEwalletNumber) {
      navigator.clipboard?.writeText(brandConfig.donationEwalletNumber);
    }
    setCopiedEwallet(true);
    setTimeout(() => setCopiedEwallet(false), 2500);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={brandConfig.supportTitle || `Dukung ${appName}`}
      subtitle={brandConfig.supportDescription || 'Inisiatif Mandiri Teknologi Pertanian Padi Nusantara'}
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* Banner Identitas & Misi */}
        <div className="bg-gradient-to-br from-emerald-900 via-emerald-950 to-slate-950 text-white rounded-2xl p-5 sm:p-6 border border-emerald-800 shadow-xs space-y-3">
          <BrandLogo size="md" showSlogan variant="light" />
          <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed pt-1">
            <strong>{appName}</strong> didedikasikan untuk kemandirian petani padi Indonesia. Aplikasi ini bebas dari iklan komersial, tidak mengunci fitur apapun, dan bekerja 100% offline di pelosok sawah.
          </p>
        </div>

        {/* Jaminan Bebas Paywall */}
        <div className="flex items-start gap-3 p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-950">
          <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">100% Gratis & Terbuka Selamanya</p>
            <p className="text-emerald-800/90 mt-0.5">
              Seluruh algoritma agronomi, kalkulator pupuk, pustaka hama, dan catatan lapang dapat Anda gunakan sepuasnya tanpa biaya langganan apapun.
            </p>
          </div>
        </div>

        {/* Pilihan Dukungan */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Bentuk Dukungan Sukarela
          </h4>

          {/* 1. Bagikan ke Kelompok Tani */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Share2 className="w-4 h-4 text-emerald-700" />
              <span>1. Bagikan ke Sesama Petani</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bantu rekan petani atau anggota kelompok tani Anda untuk mengetahui dosis pupuk berimbang dan cara pengendalian hama yang ramah lingkungan.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={handleShareWa}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold rounded-xl text-xs transition-colors shadow-xs"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Bagikan ke WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition-colors border border-slate-300"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Tautan Tersalin!' : 'Salin Tautan Web'}</span>
              </button>
            </div>
          </div>

          {/* 2. Donasi Operasional Sukarela */}
          {config.donationActive ? (
            <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-amber-950">
                  <Heart className="w-4 h-4 text-amber-700 fill-amber-700" />
                  <span>2. Donasi Sukarela Pengembangan</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-200/80 text-amber-900 rounded-full">
                  Sukarela Murni
                </span>
              </div>

              <p className="text-xs text-amber-900/90 leading-relaxed">
                Dukungan dana sukarela digunakan untuk pemeliharaan server proxy cuaca, pembaruan pustaka ilmiah berkala, dan riset agronomi lapangan.
              </p>

              {/* Tautan Donasi Eksternal Jika Disediakan */}
              {config.donationUrl && (
                <a
                  href={config.donationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 w-full p-3 min-h-[48px] bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-xs"
                >
                  <HeartHandshake className="w-4 h-4" />
                  <span>Buka Halaman Donasi Online ({config.donationUrl.replace(/^https?:\/\//, '').split('/')[0]})</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}

              {/* Rincian Rekening Bank & QRIS Resmi */}
              <div className="bg-white p-3.5 rounded-lg border border-amber-200 space-y-3 text-xs">
                {config.donationBankName && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Infaq / Rekening Dukungan Mandiri:</span>
                      <span className="font-bold text-slate-800">{config.donationBankName}</span>
                    </div>
                    <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <span className="font-mono font-bold text-slate-900 text-sm tracking-wider">
                        {config.donationAccountNumber}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyRekening}
                        className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 min-h-[36px] px-2 py-1 rounded bg-white border border-slate-200"
                      >
                        {copiedRekening ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedRekening ? 'Tersalin' : 'Salin No. Rek'}</span>
                      </button>
                    </div>
                    {config.donationRecipientName && (
                      <p className="text-[11px] text-slate-500 italic">
                        Atas Nama: <strong>{config.donationRecipientName}</strong>
                      </p>
                    )}
                  </div>
                )}

                {/* E-Wallet Jika Ada */}
                {config.donationEwalletNumber && (
                  <div className="pt-2 border-t border-slate-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">E-Wallet / Dompet Digital:</span>
                      <button
                        type="button"
                        onClick={handleCopyEwallet}
                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
                      >
                        {copiedEwallet ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedEwallet ? 'Tersalin' : 'Salin'}</span>
                      </button>
                    </div>
                    <div className="font-mono font-bold text-slate-800 bg-slate-50 p-2 rounded border border-slate-200">
                      {config.donationEwalletNumber}
                    </div>
                  </div>
                )}

                {/* QRIS Image Jika Diunggah */}
                {config.donationQrisImage && (
                  <div className="pt-2 border-t border-slate-100 flex flex-col items-center text-center space-y-2">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                      <QrCode className="w-3.5 h-3.5 text-emerald-700" />
                      <span>QRIS Donasi Resmi</span>
                    </span>
                    <div className="w-44 h-44 p-2 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center">
                      <img
                        src={config.donationQrisImage}
                        alt="QRIS Donasi Resmi HIKMAT TANI"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Dapat dipindai dengan BCA, Mandiri, BRI, BSI, GoPay, OVO, DANA, LinkAja, & ShopeePay
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
              <span className="font-bold text-slate-800 block">Penerimaan Donasi Sedang Ditutup</span>
              <p>
                Saat ini pengelola sedang memfokuskan dukungan pada pendistribusian aplikasi ke kelompok tani. Terima kasih atas niat baik dan partisipasi Anda.
              </p>
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 italic">
            "CERDAS BERTANI, BIJAK MENGAMBIL KEPUTUSAN."
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
