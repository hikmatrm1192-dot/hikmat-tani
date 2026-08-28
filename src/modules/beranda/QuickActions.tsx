/**
 * HIKMAT TANI - Quick Actions Component (Aksi Cepat)
 * 
 * Prinsip:
 * - Tombol besar, ramah sentuhan (tap target >= 48px), kontras tinggi.
 * - Petani dapat langsung mencatat kegiatan lapang dengan mudah.
 * - Mendukung: Pemupukan, Pengamatan OPT, Pengairan, Perawatan, Panen, dan Catat Umum.
 */

import { Bug, Droplets, FlaskConical, Plus, Scissors, Wheat } from 'lucide-react';
import { ActivityCategory } from '../../types/index.ts';

interface QuickActionsProps {
  onAddFertilizer: () => void;
  onAddObservation: () => void;
  onAddIrrigation: () => void;
  onAddMaintenance: () => void;
  onAddHarvest: () => void;
  onAddGeneral: () => void;
  disabled?: boolean;
}

export function QuickActions({
  onAddFertilizer,
  onAddObservation,
  onAddIrrigation,
  onAddMaintenance,
  onAddHarvest,
  onAddGeneral,
  disabled = false,
}: QuickActionsProps) {
  const quickButtons = [
    {
      id: 'fertilizer',
      title: 'Pemupukan',
      subtitle: 'Dosis & jenis pupuk',
      icon: FlaskConical,
      color: 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:border-emerald-400',
      action: onAddFertilizer,
    },
    {
      id: 'opt',
      title: 'Pengamatan OPT',
      subtitle: 'Hama & gejala lapang',
      icon: Bug,
      color: 'bg-amber-100 text-amber-900 border-amber-200 hover:border-amber-400',
      action: onAddObservation,
    },
    {
      id: 'irrigation',
      title: 'Pengairan',
      subtitle: 'Macak-macak & genangan',
      icon: Droplets,
      color: 'bg-sky-100 text-sky-800 border-sky-200 hover:border-sky-400',
      action: onAddIrrigation,
    },
    {
      id: 'maintenance',
      title: 'Perawatan',
      subtitle: 'Penyiangan & pembersihan',
      icon: Scissors,
      color: 'bg-teal-100 text-teal-800 border-teal-200 hover:border-teal-400',
      action: onAddMaintenance,
    },
    {
      id: 'harvest',
      title: 'Panen',
      subtitle: 'Hasil ubinan & gabah',
      icon: Wheat,
      color: 'bg-yellow-100 text-yellow-900 border-yellow-200 hover:border-yellow-400',
      action: onAddHarvest,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm sm:text-base font-bold text-slate-900">Aksi Cepat</h2>
        <button
          type="button"
          onClick={onAddGeneral}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-emerald-50 active:bg-emerald-100 text-[#0F5132] font-bold rounded-xl text-xs transition-colors border border-[#0F5132]/30 shadow-xs disabled:opacity-50 disabled:pointer-events-none min-h-[36px]"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Catat Kegiatan</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
        {quickButtons.map((btn) => {
          const Icon = btn.icon;
          return (
            <button
              key={btn.id}
              type="button"
              onClick={btn.action}
              disabled={disabled}
              className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 p-3.5 min-h-[64px] bg-white hover:bg-[#FBF9F2] active:bg-emerald-50/60 border border-slate-200/90 hover:border-[#0F5132]/40 rounded-2xl transition-all shadow-xs text-left group disabled:opacity-50 disabled:pointer-events-none"
            >
              <div
                className={`w-10 h-10 rounded-xl ${btn.color} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-xs`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs sm:text-sm font-bold text-slate-900 block truncate group-hover:text-[#0F5132]">
                  {btn.title}
                </span>
                <span className="text-[10px] text-slate-500 block truncate">
                  {btn.subtitle}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
