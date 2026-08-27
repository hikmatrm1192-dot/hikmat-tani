/**
 * HIKMAT TANI - Modal Rincian Musuh Alami (Predator & Parasitoid)
 * 
 * Menampilkan:
 * - Klasifikasi predator/parasitoid alami sawah
 * - OPT sasaran yang dimangsa/diparasit
 * - Stadium sasaran & habitat
 * - Pedoman pelestarian / konservasi lapang
 * - Rujukan ilmiah PHT terverifikasi
 */

import {
  BookOpen,
  Bug,
  CheckCircle2,
  ChevronRight,
  Flower2,
  HeartHandshake,
  Home,
  Info,
  Layers,
  Leaf,
  Shield,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal.tsx';
import { NaturalEnemy, Opt, Reference } from '../../types/index.ts';
import { ReferenceBadge } from './ReferenceBadge.tsx';

interface NaturalEnemyDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  naturalEnemy: NaturalEnemy | null;
  allOpts?: Opt[];
  allReferences?: Reference[];
  onSelectOpt?: (opt: Opt) => void;
}

export function NaturalEnemyDetailModal({
  isOpen,
  onClose,
  naturalEnemy,
  allOpts = [],
  allReferences = [],
  onSelectOpt,
}: NaturalEnemyDetailModalProps) {
  if (!isOpen || !naturalEnemy) return null;

  // Dapatkan OPT sasaran
  const targetOpts = allOpts.filter(
    (o) => naturalEnemy.targetOptIds && naturalEnemy.targetOptIds.includes(o.id)
  );

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'PREDATOR':
        return { label: 'Predator / Pemangsa', color: 'bg-emerald-100 text-emerald-900 border-emerald-200' };
      case 'PARASITOID':
        return { label: 'Parasitoid Telur/Larva', color: 'bg-teal-100 text-teal-900 border-teal-200' };
      case 'PATHOGEN':
        return { label: 'Patogen Serangga (Jamur Hayati)', color: 'bg-blue-100 text-blue-900 border-blue-200' };
      default:
        return { label: 'Musuh Alami', color: 'bg-slate-100 text-slate-800 border-slate-200' };
    }
  };

  const badge = getTypeBadge(naturalEnemy.type);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={naturalEnemy.name}
      subtitle={naturalEnemy.scientificName ? `Nama Ilmiah: ${naturalEnemy.scientificName}` : undefined}
    >
      <div className="space-y-4">
        {/* Badge Tipe */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full border ${badge.color}`}
          >
            <Flower2 className="w-3.5 h-3.5" />
            {badge.label}
          </span>

          <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
            Sahabat Petani (PHT)
          </span>
        </div>

        {/* Stadium yang Diserang & Habitat */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-1 shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase block flex items-center gap-1">
              <Bug className="w-3.5 h-3.5 text-amber-700" />
              Fase Hama yang Diserang:
            </span>
            <p className="text-xs font-bold text-slate-900">
              {naturalEnemy.attackedStages?.join(', ') || 'Telur, Nimfa, dan Imago'}
            </p>
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-1 shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase block flex items-center gap-1">
              <Home className="w-3.5 h-3.5 text-sky-700" />
              Habitat di Sawah:
            </span>
            <p className="text-xs font-semibold text-slate-800">
              {naturalEnemy.habitat || 'Kanopi tanaman padi dan pematang'}
            </p>
          </div>
        </div>

        {/* OPT Sasaran yang Dikendalikan */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-900 block flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            Hama Sasaran yang Dikendalikan Secara Alami:
          </span>

          {targetOpts.length === 0 ? (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
              Memangsa berbagai hama serangga kecil pada ekosistem sawah.
            </div>
          ) : (
            <div className="space-y-1.5">
              {targetOpts.map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => {
                    if (onSelectOpt) onSelectOpt(opt);
                  }}
                  className="p-3 bg-white rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/30 transition-all cursor-pointer flex items-center justify-between gap-2 shadow-xs"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900">{opt.commonName}</span>
                      {opt.aliases && opt.aliases.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-amber-100 text-amber-900 font-bold rounded">
                          {opt.aliases[0]}
                        </span>
                      )}
                    </div>
                    {opt.scientificName && (
                      <p className="text-[11px] italic text-slate-500">{opt.scientificName}</p>
                    )}
                  </div>

                  <span className="inline-flex items-center gap-0.5 text-xs font-bold text-amber-800">
                    <span>Lihat Hama</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panduan Konservasi & Pelestarian */}
        {naturalEnemy.conservationNotes && (
          <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200/90 space-y-1.5">
            <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5 uppercase tracking-wide">
              <HeartHandshake className="w-4 h-4 text-emerald-700" />
              Cara Pelestarian di Lapangan:
            </span>
            <p className="text-xs sm:text-sm text-emerald-900 leading-relaxed">
              {naturalEnemy.conservationNotes}
            </p>
          </div>
        )}

        {/* Rujukan Ilmiah */}
        <div className="pt-2 border-t border-slate-100">
          <ReferenceBadge
            referenceId={naturalEnemy.referenceId}
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
