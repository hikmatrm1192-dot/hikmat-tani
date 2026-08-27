/**
 * HIKMAT TANI - Modal Cetak & Ekspor Laporan Budidaya
 * 
 * Prinsip:
 * - Menghasilkan laporan agronomi yang rapi dan siap cetak (window.print())
 * - Menyajikan rekapitulasi petak sawah, musim tanam, pemupukan, dan pengamatan OPT.
 */

import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Copy,
  FileText,
  MapPin,
  Printer,
  ShieldCheck,
  Sprout,
  User,
  Wheat,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal.tsx';
import {
  Activity,
  CropSeason,
  Farmer,
  FertilizerApplication,
  Land,
  OptObservation,
} from '../../types/index.ts';

interface CultivationReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  farmer: Farmer | null;
  lands: Land[];
  seasons: CropSeason[];
  activities: Activity[];
  fertilizerApps?: FertilizerApplication[];
  optObservations?: OptObservation[];
}

export function CultivationReportModal({
  isOpen,
  onClose,
  farmer,
  lands,
  seasons,
  activities,
  fertilizerApps = [],
  optObservations = [],
}: CultivationReportModalProps) {
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const todayFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const activeSeasons = seasons.filter((s) => s.status === 'ACTIVE');

  // Format kategori kegiatan
  const formatCategory = (cat: string) => {
    switch (cat) {
      case 'PLANTING':
        return 'Tanam Benih / Pindah Tanam';
      case 'FERTILIZER':
        return 'Aplikasi Pemupukan';
      case 'IRRIGATION':
        return 'Pengairan / Pengeringan Berselang (AWD)';
      case 'OPT':
        return 'Pengamatan / Pengendalian OPT';
      case 'MAINTENANCE':
        return 'Penyiangan / Pemeliharaan';
      case 'HARVEST':
        return 'Panen Padi';
      default:
        return 'Aktivitas Lapang';
    }
  };

  // Handle Cetak Dokumen
  const handlePrint = () => {
    window.print();
  };

  // Buat Teks Ringkasan untuk Disalin (misal kirim WA ke Penyuluh Lapang PPL)
  const generateTextSummary = () => {
    let text = `*LAPORAN BUKU SAKU BUDIDAYA HIKMAT TANI*\n`;
    text += `Tanggal: ${todayFormatted}\n`;
    text += `Petani: ${farmer?.name || 'Petani Padi'}\n`;
    text += `Kelompok Tani: ${farmer?.farmerGroupName || '-'}\n`;
    text += `Lokasi: Desa ${farmer?.village || '-'}, Kec. ${farmer?.district || '-'}, Kab. ${farmer?.regency || '-'}\n\n`;

    text += `*DAFTAR PETAK LAHAN & MUSIM AKTIF:*\n`;
    lands.forEach((l, idx) => {
      const s = activeSeasons.find((sec) => sec.landId === l.id);
      const m2 = Math.round(l.areaHa * 10000);
      text += `${idx + 1}. ${l.name} (${m2} m² / ${l.areaHa} ha) - ${
        s ? `Varietas: ${s.varietyName || 'Padi'}, Tanam: ${s.plantingDate}` : 'Tidak Ada Musim Aktif'
      }\n`;
    });

    text += `\n*TOTAL KEGIATAN TERCATAT:* ${activities.length} Kegiatan\n`;
    text += `*APLIKASI PEMUPUKAN:* ${fertilizerApps.length} Kali Catatan\n`;
    text += `*PENGAMATAN OPT:* ${optObservations.length} Kali Catatan\n\n`;
    text += `_Disusun otomatis melalui Sistem Keputusan Agronomi HIKMAT TANI._`;
    return text;
  };

  const handleCopyText = () => {
    const txt = generateTextSummary();
    navigator.clipboard?.writeText(txt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Laporan Catatan Budidaya"
      subtitle="Dokumen ringkasan untuk arsip mandiri atau konsultasi PPL"
    >
      <div className="space-y-4">
        {/* Tombol Aksi Atas */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-100 rounded-2xl print:hidden">
          <span className="text-xs font-semibold text-slate-700">
            Format Siap Cetak / Bagikan:
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyText}
              className="inline-flex items-center gap-1 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 transition-colors shadow-2xs min-h-[40px]"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? 'Tersalin!' : 'Salin Teks WA'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1 px-4 py-2 bg-emerald-800 hover:bg-emerald-900 active:bg-black text-white rounded-xl text-xs font-bold transition-colors shadow-xs min-h-[40px]"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Laporan</span>
            </button>
          </div>
        </div>

        {/* Tampilan Lembar Laporan (Printable Area) */}
        <div
          id="cultivation-report-sheet"
          className="p-5 sm:p-6 bg-white rounded-2xl border border-slate-200 space-y-5 text-slate-900 shadow-2xs print:border-none print:p-0"
        >
          {/* Header Kop Laporan */}
          <div className="border-b-2 border-slate-900 pb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-950 uppercase tracking-wide">
                Laporan Rekapitulasi Budidaya Padi
              </h2>
              <p className="text-xs text-slate-600 font-medium">
                Sistem Pendukung Keputusan Agronomi • HIKMAT TANI
              </p>
            </div>
            <div className="text-left sm:text-right text-xs text-slate-500">
              <div>Tanggal: <strong>{todayFormatted}</strong></div>
              <div>Status: Dokumen Mandiri Petani</div>
            </div>
          </div>

          {/* Profil Petani */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Identitas Petani</span>
              <strong className="text-sm text-slate-900">{farmer?.name || 'Petani Padi Indonesia'}</strong>
              <div className="text-slate-600">Kelompok: {farmer?.farmerGroupName || 'Mandiri'}</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Wilayah Domisili</span>
              <div className="text-slate-800 font-medium">
                Desa {farmer?.village || '-'}, Kec. {farmer?.district || '-'}
              </div>
              <div className="text-slate-600">Kabupaten: {farmer?.regency || '-'}</div>
            </div>
          </div>

          {/* Daftar Lahan & Musim Tanam */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-700" />
              <span>Petak Lahan & Status Musim Tanam</span>
            </h4>

            {lands.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-xl">
                Belum ada data petak lahan yang didaftarkan.
              </p>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold text-[11px]">
                    <tr>
                      <th className="p-2.5">Nama Petak</th>
                      <th className="p-2.5">Luas (m² / ha)</th>
                      <th className="p-2.5">Sumber Air</th>
                      <th className="p-2.5">Varietas Ditanam</th>
                      <th className="p-2.5">Tanggal Tanam</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lands.map((land) => {
                      const season = seasons.find(
                        (s) => s.landId === land.id && s.status === 'ACTIVE'
                      );
                      const m2 = Math.round(land.areaHa * 10000);
                      return (
                        <tr key={land.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold text-slate-900">{land.name}</td>
                          <td className="p-2.5 text-slate-700">
                            {m2.toLocaleString('id-ID')} m² ({land.areaHa} ha)
                          </td>
                          <td className="p-2.5 text-slate-600 capitalize">
                            {land.waterSource ? land.waterSource.replace(/_/g, ' ').toLowerCase() : 'Irigasi'}
                          </td>
                          <td className="p-2.5 font-semibold text-emerald-800">
                            {season ? (season.varietyName || 'Padi') : '-'}
                          </td>
                          <td className="p-2.5 text-slate-700">
                            {season ? season.plantingDate : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Ringkasan Kejadian Budidaya Terkini */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sprout className="w-3.5 h-3.5 text-emerald-700" />
              <span>Aktivitas Budidaya Terakhir</span>
            </h4>

            {activities.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-xl">
                Belum ada aktivitas lapang yang dicatat.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {activities.slice(0, 8).map((act) => {
                  const season = seasons.find((s) => s.id === act.cropSeasonId);
                  const land = lands.find((l) => l.id === season?.landId);
                  const actDate = new Date(act.activityDate).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  });

                  return (
                    <div
                      key={act.id}
                      className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs"
                    >
                      <div>
                        <strong className="text-slate-900 font-bold block">
                          {formatCategory(act.category)}
                        </strong>
                        <span className="text-[11px] text-slate-500">
                          {land?.name || 'Petak Sawah'} • Umur {act.hst} HST {act.notes ? `• "${act.notes}"` : ''}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-600 shrink-0">
                        {actDate}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Dokumen */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>Data tervalidasi secara offline di perangkat pengguna.</span>
            </div>
            <span className="font-semibold text-slate-700">HIKMAT TANI v1.0.0</span>
          </div>
        </div>

        {/* Tombol Tutup */}
        <div className="pt-2 flex justify-end print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-colors"
          >
            Tutup Lembar Laporan
          </button>
        </div>
      </div>
    </Modal>
  );
}
