/**
 * HIKMAT TANI - Modal Rincian OPT (Hama & Penyakit Padi)
 * 
 * Prinsip PHT:
 * - Tidak memberikan rekomendasi pestisida secara serampangan.
 * - Menjelaskan ambang ekonomi, musuh alami pemangsa, dan pencegahan kultur teknis.
 */

import { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Bug,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Flame,
  Flower2,
  Info,
  Layers,
  Leaf,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wrench,
  Zap,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal.tsx';
import { NaturalEnemy, Opt, Reference } from '../../types/index.ts';
import { ReferenceBadge } from './ReferenceBadge.tsx';

interface OptDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  opt: Opt | null;
  naturalEnemies?: NaturalEnemy[];
  allReferences?: Reference[];
  onSelectNaturalEnemy?: (enemy: NaturalEnemy) => void;
}

export function OptDetailModal({
  isOpen,
  onClose,
  opt,
  naturalEnemies = [],
  allReferences = [],
  onSelectNaturalEnemy,
}: OptDetailModalProps) {
  const [activeSubTab, setActiveSubTab] = useState<'gejala' | 'pengendalian' | 'biologi'>(
    'gejala'
  );

  if (!isOpen || !opt) return null;

  // Temukan musuh alami yang memangsa OPT ini
  const predatorEnemies = naturalEnemies.filter(
    (ne) => ne.targetOptIds && ne.targetOptIds.includes(opt.id)
  );

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'INSECT_PEST':
        return { label: 'Hama Serangga', color: 'bg-amber-100 text-amber-900 border-amber-200' };
      case 'DISEASE':
        return { label: 'Penyakit Tanaman', color: 'bg-rose-100 text-rose-900 border-rose-200' };
      case 'WEED':
        return { label: 'Gulma Sawah', color: 'bg-emerald-100 text-emerald-900 border-emerald-200' };
      case 'RODENT':
        return { label: 'Hama Tikus / Vertebrata', color: 'bg-orange-100 text-orange-900 border-orange-200' };
      default:
        return { label: 'OPT', color: 'bg-slate-100 text-slate-800 border-slate-200' };
    }
  };

  const badge = getCategoryBadge(opt.category);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={opt.commonName}
      subtitle={opt.scientificName ? `Nama Ilmiah: ${opt.scientificName}` : undefined}
    >
      <div className="space-y-4">
        {/* Header Badges & Aliases */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full border ${badge.color}`}
            >
              <Bug className="w-3.5 h-3.5" />
              {badge.label}
            </span>

            {opt.vulnerableStage && (
              <span className="text-[11px] font-semibold text-slate-600 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200">
                Fase Rentan: <strong>{opt.vulnerableStage}</strong>
              </span>
            )}
          </div>

          {opt.aliases && opt.aliases.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Nama Lokal / Alias:</span>
              <div className="flex flex-wrap gap-1">
                {opt.aliases.map((alias) => (
                  <span
                    key={alias}
                    className="px-2 py-0.5 bg-amber-50 text-amber-900 font-bold rounded-md border border-amber-200/70 text-[11px]"
                  >
                    {alias}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sub-tabs Navigasi Internal Modal */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-200/60 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveSubTab('gejala')}
            className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
              activeSubTab === 'gejala'
                ? 'bg-white text-emerald-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Gejala & Siklus</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('pengendalian')}
            className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
              activeSubTab === 'pengendalian'
                ? 'bg-white text-emerald-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Pengendalian (PHT)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('biologi')}
            className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
              activeSubTab === 'biologi'
                ? 'bg-white text-emerald-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Flower2 className="w-3.5 h-3.5" />
            <span>Musuh Alami</span>
          </button>
        </div>

        {/* Sub-tab 1: Gejala, Siklus, & Faktor Pemicu */}
        {activeSubTab === 'gejala' && (
          <div className="space-y-3">
            {/* Gejala Utama */}
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Leaf className="w-4 h-4 text-emerald-700" />
                Gejala Serangan di Lapang:
              </span>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                {opt.symptoms}
              </p>
            </div>

            {/* Siklus Hidup & Perkembangan */}
            {opt.lifeCycle && (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  Siklus Hidup & Perkembangan:
                </span>
                <p className="text-xs text-slate-600 leading-relaxed font-mono">
                  {opt.lifeCycle}
                </p>
              </div>
            )}

            {/* Faktor Pemicu Ledakan Populasi */}
            {opt.triggerFactors && opt.triggerFactors.length > 0 && (
              <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/90 space-y-1.5">
                <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-700" />
                  Kondisi yang Mendukung Ledakan Populasi:
                </span>
                <ul className="list-disc list-inside text-xs text-amber-900 space-y-1 pl-1">
                  {opt.triggerFactors.map((factor, idx) => (
                    <li key={idx}>{factor}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Cara Pemantauan & Monitoring Lapang */}
            {opt.monitoringMethod && (
              <div className="p-3 bg-sky-50/60 rounded-xl border border-sky-200 space-y-1">
                <span className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-sky-700" />
                  Cara Pengamatan di Lapangan:
                </span>
                <p className="text-xs text-sky-900 leading-relaxed">
                  {opt.monitoringMethod}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Sub-tab 2: 4 Jalur Pengendalian PHT & Ambang Ekonomi */}
        {activeSubTab === 'pengendalian' && (
          <div className="space-y-3">
            {/* Ambang Ekonomi / Ambang Pengendalian */}
            {opt.economicThreshold && (
              <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1">
                <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5 uppercase tracking-wide">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  Ambang Kendali / Ambang Ekonomi (PHT):
                </span>
                <p className="text-xs sm:text-sm font-semibold text-emerald-900 leading-relaxed">
                  {opt.economicThreshold}
                </p>
                <p className="text-[10px] text-emerald-700">
                  *Tindakan kimia hanya dipertimbangkan jika populasi melampaui ambang kendali ini.
                </p>
              </div>
            )}

            {/* 1. Kultur Teknis */}
            {opt.culturalControl && (
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1 shadow-xs">
                <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <Leaf className="w-3.5 h-3.5 text-emerald-600" />
                  1. Pengendalian Kultur Teknis (Budidaya Tanaman Sehat):
                </span>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {opt.culturalControl}
                </p>
              </div>
            )}

            {/* 2. Fisik & Mekanis */}
            {opt.mechanicalControl && (
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1 shadow-xs">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-slate-600" />
                  2. Pengendalian Fisik & Mekanis:
                </span>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {opt.mechanicalControl}
                </p>
              </div>
            )}

            {/* 3. Hayati / Musuh Alami */}
            {opt.biologicalControl && (
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1 shadow-xs">
                <span className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                  <Flower2 className="w-3.5 h-3.5 text-teal-600" />
                  3. Pengendalian Hayati & Biologis:
                </span>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {opt.biologicalControl}
                </p>
              </div>
            )}

            {/* 4. Kimiawi (Pilihan Terakhir) */}
            {opt.chemicalControl && (
              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200/90 space-y-2">
                <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                  4. Pengendalian Kimiawi (Pilihan Terakhir Sesuai PHT):
                </span>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {opt.chemicalControl}
                </p>

                {opt.activeIngredients && opt.activeIngredients.length > 0 && (
                  <div className="pt-2 border-t border-amber-200/70">
                    <span className="text-[11px] font-bold text-slate-800 block mb-1">
                      Bahan Aktif Terdaftar / Relevan:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {opt.activeIngredients.map((ai) => (
                        <span
                          key={ai}
                          className="px-2 py-0.5 bg-white text-slate-800 font-semibold rounded border border-amber-300 text-[11px]"
                        >
                          {ai}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {opt.resistanceNotes && (
                  <div className="text-[11px] text-amber-900 bg-amber-100/70 p-2 rounded-lg">
                    <strong>Peringatan:</strong> {opt.resistanceNotes}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Sub-tab 3: Musuh Alami Terkait */}
        {activeSubTab === 'biologi' && (
          <div className="space-y-3">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-950 leading-relaxed">
              <strong>Prinsip Konservasi Musuh Alami:</strong> Keberadaan pemangsa dan parasitoid alami di sawah membantu menjaga keseimbangan populasi hama di bawah ambang kerugian ekonomi secara alami dan gratis.
            </div>

            {predatorEnemies.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                Data musuh alami spesifik untuk OPT ini belum terdaftar atau sedang dalam verifikasi rujukan lapang.
              </div>
            ) : (
              <div className="space-y-2">
                {predatorEnemies.map((enemy) => (
                  <div
                    key={enemy.id}
                    onClick={() => {
                      if (onSelectNaturalEnemy) onSelectNaturalEnemy(enemy);
                    }}
                    className="p-3 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition-all cursor-pointer flex items-center justify-between gap-2 shadow-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900">{enemy.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 bg-teal-50 text-teal-800 font-bold rounded">
                          {enemy.type === 'PREDATOR' ? 'Predator' : enemy.type === 'PARASITOID' ? 'Parasitoid' : 'Hayati'}
                        </span>
                      </div>
                      <p className="text-[11px] italic text-slate-500">{enemy.scientificName}</p>
                      <p className="text-[11px] text-slate-600 mt-1">
                        Menyerang: <strong>{enemy.attackedStages?.join(', ') || 'Telur/Larva'}</strong>
                      </p>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Rujukan Ilmiah */}
        <div className="pt-2 border-t border-slate-100">
          <ReferenceBadge
            referenceId={opt.referenceId}
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
