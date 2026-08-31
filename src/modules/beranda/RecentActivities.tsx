/**
 * HIKMAT TANI - Recent Activities Component
 * 
 * Menampilkan 3-5 kegiatan terbaru dari linimasa.
 */

import { Bug, Calendar, ChevronRight, Droplets, FlaskConical, Sprout, Wheat } from 'lucide-react';
import { TimelineEvent } from '../../engine/activityTimeline.ts';

interface RecentActivitiesProps {
  timelineEvents: TimelineEvent[];
  onViewAll?: () => void;
  onAddFirstActivity?: () => void;
  hasActiveSeason: boolean;
}

export function RecentActivities({
  timelineEvents,
  onViewAll,
  onAddFirstActivity,
  hasActiveSeason,
}: RecentActivitiesProps) {
  // Ambil 3-5 event terbaru (urutkan terbaru di atas)
  const recentEvents = [...timelineEvents]
    .sort((a, b) => new Date(b.activityDate).getTime() - new Date(a.activityDate).getTime())
    .slice(0, 4);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'PLANTING':
        return <Sprout className="w-4 h-4 text-emerald-700" />;
      case 'FERTILIZER':
        return <FlaskConical className="w-4 h-4 text-emerald-700" />;
      case 'OPT':
        return <Bug className="w-4 h-4 text-amber-700" />;
      case 'IRRIGATION':
        return <Droplets className="w-4 h-4 text-sky-700" />;
      case 'HARVEST':
        return <Wheat className="w-4 h-4 text-amber-700" />;
      default:
        return <Calendar className="w-4 h-4 text-slate-600" />;
    }
  };

  const getCategoryBg = (category: string) => {
    switch (category) {
      case 'PLANTING':
      case 'FERTILIZER':
        return 'bg-emerald-100/80';
      case 'OPT':
        return 'bg-amber-100/80';
      case 'IRRIGATION':
        return 'bg-sky-100/80';
      case 'HARVEST':
        return 'bg-amber-200/80';
      default:
        return 'bg-slate-100';
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h2 className="text-base sm:text-lg font-black text-slate-900">Aktivitas Terakhir</h2>
        {recentEvents.length > 0 && onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs sm:text-sm font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-0.5 min-h-[36px]"
          >
            <span>Lihat Semua</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {recentEvents.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center space-y-2 shadow-xs">
          <p className="text-xs sm:text-sm text-slate-600 font-medium">
            Belum ada catatan aktivitas pada musim tanam ini.
          </p>
          {hasActiveSeason && onAddFirstActivity && (
            <button
              type="button"
              onClick={onAddFirstActivity}
              className="text-xs sm:text-sm font-bold text-emerald-800 hover:text-emerald-950 underline underline-offset-4"
            >
              + Catat Kegiatan Pertama
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 shadow-xs overflow-hidden">
          {recentEvents.map((evt) => {
            const formattedDate = new Date(evt.activityDate).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });

            return (
              <div
                key={evt.id}
                className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${getCategoryBg(
                      evt.category
                    )}`}
                  >
                    {getCategoryIcon(evt.category)}
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm sm:text-base font-bold text-slate-900 block truncate">
                      {evt.title}
                    </span>
                    <span className="text-xs text-slate-600 font-medium block truncate mt-0.5">
                      {evt.notes || formattedDate}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="inline-block px-2.5 py-0.5 bg-emerald-50 text-[#0F5132] text-xs font-black rounded-full border border-[#0F5132]/30">
                    {evt.hst} HST
                  </span>
                  <span className="block text-xs text-slate-500 mt-0.5">
                    {formattedDate}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
