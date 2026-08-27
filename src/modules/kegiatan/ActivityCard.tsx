/**
 * HIKMAT TANI - Activity Card Component
 * 
 * Kartu linimasa riwayat kegiatan lapang:
 * - Mobile-first, kontras tinggi, mudah dibaca di luar ruangan
 * - Menampilkan Tanggal, Jenis Kegiatan, Ringkasan Aksi, Snapshot HST, dan Status Rekomendasi
 * - Menghindari tabel desktop padat.
 */

import {
  Bug,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Droplets,
  FlaskConical,
  Scissors,
  Sprout,
  Wheat,
} from 'lucide-react';
import { Activity, ActivityCategory } from '../../types/index.ts';

interface ActivityCardProps {
  key?: string | number;
  activity: Activity;
  onClick: () => void;
  hasDecisionLink?: boolean;
}

export function ActivityCard({
  activity,
  onClick,
  hasDecisionLink = false,
}: ActivityCardProps) {
  const getCategoryTheme = (cat: ActivityCategory) => {
    switch (cat) {
      case 'PLANTING':
        return {
          label: 'Tanam Padi',
          icon: <Sprout className="w-4 h-4" />,
          badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
          iconBg: 'bg-emerald-100 text-emerald-800',
        };
      case 'FERTILIZER':
        return {
          label: 'Pemupukan',
          icon: <FlaskConical className="w-4 h-4" />,
          badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
          iconBg: 'bg-emerald-100 text-emerald-800',
        };
      case 'IRRIGATION':
        return {
          label: 'Pengairan',
          icon: <Droplets className="w-4 h-4" />,
          badgeClass: 'bg-sky-100 text-sky-900 border-sky-300',
          iconBg: 'bg-sky-100 text-sky-800',
        };
      case 'OPT':
        return {
          label: 'Pengamatan OPT',
          icon: <Bug className="w-4 h-4" />,
          badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
          iconBg: 'bg-amber-100 text-amber-800',
        };
      case 'MAINTENANCE':
        return {
          label: 'Perawatan',
          icon: <Scissors className="w-4 h-4" />,
          badgeClass: 'bg-teal-100 text-teal-900 border-teal-300',
          iconBg: 'bg-teal-100 text-teal-800',
        };
      case 'HARVEST':
        return {
          label: 'Panen Padi',
          icon: <Wheat className="w-4 h-4" />,
          badgeClass: 'bg-yellow-100 text-yellow-950 border-yellow-300',
          iconBg: 'bg-yellow-100 text-yellow-900',
        };
      default:
        return {
          label: 'Kegiatan',
          icon: <CheckCircle2 className="w-4 h-4" />,
          badgeClass: 'bg-slate-100 text-slate-900 border-slate-300',
          iconBg: 'bg-slate-100 text-slate-800',
        };
    }
  };

  const theme = getCategoryTheme(activity.category);

  // Format tanggal Indonesia
  const dateObj = new Date(activity.activityDate);
  const formattedDay = dateObj.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
  });
  const formattedYear = dateObj.getFullYear();

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-3.5 sm:p-4 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 hover:border-emerald-300 rounded-2xl transition-all shadow-xs flex items-center gap-3.5 group min-h-[64px]"
    >
      {/* Date badge */}
      <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 shrink-0 text-center">
        <span className="text-xs font-black text-slate-800 leading-none">
          {formattedDay}
        </span>
        <span className="text-[10px] text-slate-500 font-medium mt-0.5">
          {formattedYear}
        </span>
      </div>

      {/* Category Icon & Summary */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${theme.badgeClass}`}
          >
            {theme.icon}
            <span>{theme.label}</span>
          </span>

          <span className="text-[11px] font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            {activity.hst} HST
          </span>

          {hasDecisionLink && (
            <span className="text-[10px] font-bold text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
              Jalur Keputusan
            </span>
          )}
        </div>

        <p className="text-xs sm:text-sm font-semibold text-slate-800 truncate block">
          {activity.notes || 'Catatan kegiatan lapang'}
        </p>
      </div>

      {/* Action Arrow */}
      <div className="text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-0.5 transition-all shrink-0">
        <ChevronRight className="w-5 h-5" />
      </div>
    </button>
  );
}
