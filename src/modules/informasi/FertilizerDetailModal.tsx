/**
 * HIKMAT TANI - Modal Rincian Pupuk & Komposisi Hara
 * 
 * Menampilkan:
 * - Kandungan hara murni (N, P₂O₅, K₂O, S, dll)
 * - Peran hara bagi tanaman padi
 * - Kalkulator Cepat: Input kg pupuk -> terhitung pasokan hara riil
 * - Rujukan ilmiah terverifikasi (Balai Penelitian Tanah / Kementan)
 */

import { useState } from 'react';
import {
  BookOpen,
  Calculator,
  CheckCircle2,
  Coins,
  Droplets,
  FlaskConical,
  Info,
  Layers,
  Leaf,
  Scale,
  Sparkles,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal.tsx';
import { Fertilizer, Reference } from '../../types/index.ts';
import { ReferenceBadge } from './ReferenceBadge.tsx';
import { DEFAULT_COST_BENCHMARKS } from '../../engine/costCalculator.ts';

interface FertilizerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  fertilizer: Fertilizer | null;
  allReferences?: Reference[];
}

export function FertilizerDetailModal({
  isOpen,
  onClose,
  fertilizer,
  allReferences = [],
}: FertilizerDetailModalProps) {
  const [simulatedKg, setSimulatedKg] = useState<number>(50);

  // Ambil benchmark default yang cocok dengan nama pupuk (misal Urea, NPK, SP36, KCl, dll)
  const matchedBenchmark = DEFAULT_COST_BENCHMARKS.find((b) =>
    fertilizer ? fertilizer.name.toLowerCase().includes(b.itemLabel.toLowerCase().split(' ')[1] || 'xxx') ||
    b.itemLabel.toLowerCase().includes(fertilizer.name.toLowerCase()) : false
  );

  const initialPrice = matchedBenchmark ? matchedBenchmark.recommendedUnitPriceRp : 2500;
  const [simulatedPricePerKg, setSimulatedPricePerKg] = useState<string>(String(initialPrice));

  if (!isOpen || !fertilizer) return null;

  const comp = fertilizer.nutrientComposition;

  const nPct = comp.N ?? (comp as any).N_pct ?? 0;
  const pPct = comp.P2O5 ?? (comp as any).P2O5_pct ?? 0;
  const kPct = comp.K2O ?? (comp as any).K2O_pct ?? 0;
  const sPct = comp.S ?? (comp as any).S_pct ?? 0;
  const caPct = comp.Ca ?? 0;
  const mgPct = comp.Mg ?? 0;
  const znPct = comp.Zn ?? 0;

  // Hitung simulasi hara terpasok
  const calculatedN = (simulatedKg * nPct) / 100;
  const calculatedP = (simulatedKg * pPct) / 100;
  const calculatedK = (simulatedKg * kPct) / 100;
  const calculatedS = (simulatedKg * sPct) / 100;

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'INORGANIC_SINGLE':
        return { label: 'Anorganik Tunggal', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'INORGANIC_COMPOUND':
        return { label: 'Majemuk (NPK)', color: 'bg-blue-50 text-blue-800 border-blue-200' };
      case 'ORGANIC':
        return { label: 'Organik Alami', color: 'bg-amber-50 text-amber-900 border-amber-200' };
      case 'BIOLOGICAL':
      case 'BIOFERTILIZER':
        return { label: 'Hayati / Mikroba', color: 'bg-teal-50 text-teal-800 border-teal-200' };
      default:
        return { label: 'Pupuk Pertanian', color: 'bg-slate-50 text-slate-800 border-slate-200' };
    }
  };

  const badge = getTypeBadge(fertilizer.type);

  // Penjelasan peran hara berdasarkan komposisi
  const getNutrientRoleText = () => {
    const roles: string[] = [];
    if (nPct > 0) {
      roles.push(
        'Nitrogen (N): Merangsang pertumbuhan vegetatif, pembentukan anakan baru, dan menghijaukan daun untuk fotosintesis optimal.'
      );
    }
    if (pPct > 0) {
      roles.push(
        'Fosfat (P₂O₅): Mempercepat perkembangan perakaran awal yang kuat dan mempercepat inisiasi pembungaan/malai.'
      );
    }
    if (kPct > 0) {
      roles.push(
        'Kalium (K₂O): Memperkokoh dinding batang agar tidak mudah rebah, meningkatkan ketahanan terhadap hama/penyakit, dan memaksimalkan pengisian gabah bernas.'
      );
    }
    if (sPct > 0) {
      roles.push(
        'Sulfur (S): Pembentukan protein, klorofil, dan enzim tanaman padi.'
      );
    }
    if (roles.length === 0) {
      roles.push('Menyediakan bahan organik / biologi tanah untuk memperbaiki struktur aerasi, C-Organik, dan mikroorganisme tanah sawah.');
    }
    return roles;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={fertilizer.name}
      subtitle={fertilizer.formula ? `Rumus: ${fertilizer.formula}` : undefined}
    >
      <div className="space-y-4">
        {/* Badge Tipe & Rumus & Status Subsidi */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full border ${badge.color}`}
              >
                <FlaskConical className="w-3.5 h-3.5" />
                {badge.label}
              </span>

              {fertilizer.isSubsidized && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                  <Sparkles className="w-3 h-3" />
                  Subsidi Pemerintah
                </span>
              )}
            </div>

            {fertilizer.formula && (
              <span className="font-mono text-xs font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                {fertilizer.formula}
              </span>
            )}
          </div>

          {fertilizer.subsidyNote && (
            <p className="text-[11px] text-amber-900 bg-amber-50 p-2 rounded-xl border border-amber-200">
              {fertilizer.subsidyNote}
            </p>
          )}

          {fertilizer.manufacturer && (
            <div className="text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Produsen / Merek:</span> {fertilizer.manufacturer} {fertilizer.brand ? `(${fertilizer.brand})` : ''}
            </div>
          )}

          {fertilizer.aliases && fertilizer.aliases.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Nama Pasar:</span>
              <div className="flex flex-wrap gap-1">
                {fertilizer.aliases.map((alias) => (
                  <span
                    key={alias}
                    className="px-2 py-0.5 bg-white text-slate-800 font-bold rounded border border-slate-200 text-[11px]"
                  >
                    {alias}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Grid Komposisi Hara */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-900 block">
            Komposisi Kadar Hara Terjamin (%):
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 text-center">
              <span className="text-[10px] font-bold text-emerald-800 uppercase block">
                Nitrogen (N)
              </span>
              <span className="text-lg font-black text-emerald-950">
                {nPct}%
              </span>
            </div>

            <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 text-center">
              <span className="text-[10px] font-bold text-blue-800 uppercase block">
                Fosfat (P₂O₅)
              </span>
              <span className="text-lg font-black text-blue-950">
                {pPct}%
              </span>
            </div>

            <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-center">
              <span className="text-[10px] font-bold text-amber-900 uppercase block">
                Kalium (K₂O)
              </span>
              <span className="text-lg font-black text-amber-950">
                {kPct}%
              </span>
            </div>

            <div className="p-3 bg-teal-50/80 rounded-xl border border-teal-200 text-center">
              <span className="text-[10px] font-bold text-teal-800 uppercase block">
                Sulfur (S)
              </span>
              <span className="text-lg font-black text-teal-950">
                {sPct}%
              </span>
            </div>
          </div>
        </div>

        {/* Simulasi Interaktif Pasokan Hara */}
        <div className="p-3.5 bg-slate-900 text-white rounded-2xl space-y-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-200 uppercase tracking-wide">
                Simulasi Takaran & Pasokan Hara
              </span>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="1"
                max="1000"
                value={simulatedKg}
                onChange={(e) => setSimulatedKg(Math.max(1, Number(e.target.value) || 1))}
                className="w-16 px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-white text-right focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
              <span className="text-xs font-bold text-slate-300">kg</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-300">
            Jika mengaplikasikan <strong>{simulatedKg} kg</strong> {fertilizer.name}, tanaman akan menerima:
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-800">
            <div className="bg-slate-800/80 p-2 rounded-xl text-center border border-slate-700">
              <span className="text-[10px] text-slate-400 block">N Murni</span>
              <span className="font-mono text-sm font-black text-emerald-300">
                {calculatedN.toFixed(1)} kg
              </span>
            </div>
            <div className="bg-slate-800/80 p-2 rounded-xl text-center border border-slate-700">
              <span className="text-[10px] text-slate-400 block">P₂O₅ Murni</span>
              <span className="font-mono text-sm font-black text-blue-300">
                {calculatedP.toFixed(1)} kg
              </span>
            </div>
            <div className="bg-slate-800/80 p-2 rounded-xl text-center border border-slate-700">
              <span className="text-[10px] text-slate-400 block">K₂O Murni</span>
              <span className="font-mono text-sm font-black text-amber-300">
                {calculatedK.toFixed(1)} kg
              </span>
            </div>
            <div className="bg-slate-800/80 p-2 rounded-xl text-center border border-slate-700">
              <span className="text-[10px] text-slate-400 block">S Murni</span>
              <span className="font-mono text-sm font-black text-teal-300">
                {calculatedS.toFixed(1)} kg
              </span>
            </div>
          </div>

          {/* Simulasi Biaya Pembelian Pupuk */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-emerald-400" />
                <span>Simulasi Biaya Pembelian:</span>
              </span>
              <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                Rekomendasi (Dapat Diubah)
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 bg-slate-800/90 p-2.5 rounded-xl border border-slate-700">
              <div className="flex items-center gap-1.5 text-xs text-slate-300">
                <span>Harga / kg:</span>
                <span className="text-slate-400 font-bold">Rp</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={simulatedPricePerKg}
                  onChange={(e) => setSimulatedPricePerKg(e.target.value)}
                  className="w-24 px-2 py-1 bg-slate-900 border border-slate-600 rounded-lg text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </div>

              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">Perkiraan Biaya Total:</span>
                <span className="text-xs sm:text-sm font-mono font-black text-emerald-300">
                  Rp {(simulatedKg * (parseFloat(simulatedPricePerKg) || 0)).toLocaleString('id-ID')}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400">
              Keterangan: Nilai rekomendasi acuan. Anda bebas menentukan harga lebih rendah, lebih tinggi, atau Rp 0 saat mencatat transaksi riil.
            </p>
          </div>
        </div>

        {/* Peran & Manfaat Agronomis */}
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-1.5">
          <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <Leaf className="w-3.5 h-3.5 text-emerald-700" />
            Peran Utama bagi Tanaman Padi:
          </span>
          <ul className="list-disc list-inside text-xs text-slate-700 space-y-1.5 pl-1 leading-relaxed">
            {getNutrientRoleText().map((role, idx) => (
              <li key={idx}>{role}</li>
            ))}
          </ul>
        </div>

        {/* Petunjuk Aplikasi Lapangan */}
        <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/90 text-xs text-emerald-950 space-y-1">
          <span className="font-bold block">Petunjuk Aplikasi Lapang yang Tepat:</span>
          <p className="leading-relaxed text-emerald-900">
            Taburkan pupuk saat kondisi air sawah macak-macak (dangkal sekitar 1-2 cm). Jangan menabur saat saluran pembuangan terbuka atau air meluap agar hara tidak hilang tercuci aliran air.
          </p>
        </div>

        {/* Rujukan Ilmiah */}
        <div className="pt-2 border-t border-slate-100">
          <ReferenceBadge
            referenceId={fertilizer.referenceId}
            allReferences={allReferences}
          />
        </div>

        {/* Tombol Tutup */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] bg-slate-800 hover:bg-slate-900 active:bg-black text-white font-bold text-xs rounded-xl transition-colors"
          >
            Tutup Informasi
          </button>
        </div>
      </div>
    </Modal>
  );
}
