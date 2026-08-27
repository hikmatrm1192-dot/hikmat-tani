/**
 * HIKMAT TANI - Kegiatan View (Pusat Riwayat & Pencatatan Aktivitas Lapang)
 * 
 * Prinsip:
 * - "Catat sedikit, sistem yang mengolah lebih banyak."
 * - Linimasa riwayat kegiatan lapang yang bersih, berkontras tinggi, ramah sentuhan.
 * - Menghindari tabel desktop padat.
 * - Mendukung penyaringan kategori & kalkulasi akumulasi hara semusim.
 * - Terkoneksi ke Tiga Jalur Keputusan.
 */

import { useMemo, useState } from 'react';
import {
  Bug,
  CalendarDays,
  CheckCircle2,
  Droplets,
  Filter,
  FlaskConical,
  Plus,
  Scissors,
  Sprout,
  Wheat,
} from 'lucide-react';
import { EmptyState } from '../../components/common/EmptyState.tsx';
import { PageHeader } from '../../components/common/PageHeader.tsx';
import { activityRepository } from '../../db/repositories/activityRepository.ts';
import {
  Activity,
  ActivityCategory,
  CropSeason,
  Fertilizer,
  FertilizerApplication,
  Land,
  Opt,
  OptObservation,
  RiceVariety,
} from '../../types/index.ts';
import { ActivityCard } from './ActivityCard.tsx';
import { ActivityDetailModal } from './ActivityDetailModal.tsx';
import { ActivityFormModal } from './ActivityFormModal.tsx';

interface KegiatanViewProps {
  lands: Land[];
  activeSeasons: CropSeason[];
  allActivities: Activity[];
  fertilizers: Fertilizer[];
  varieties?: RiceVariety[];
  opts?: Opt[];
  selectedLandId?: string;
  onSelectLandId?: (landId: string) => void;
  onNavigateToKnowledge?: (category: 'opt' | 'pupuk' | 'musuh_alami' | 'varietas' | 'panduan', itemId?: string) => void;
  onRefreshData: () => Promise<void>;
}

export function KegiatanView({
  lands,
  activeSeasons,
  allActivities,
  fertilizers,
  varieties = [],
  opts = [],
  selectedLandId,
  onSelectLandId,
  onNavigateToKnowledge,
  onRefreshData,
}: KegiatanViewProps) {
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [initialFormCategory, setInitialFormCategory] = useState<ActivityCategory | null>(null);

  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [detailFertApps, setDetailFertApps] = useState<FertilizerApplication[]>([]);
  const [detailOptObs, setDetailOptObs] = useState<OptObservation[]>([]);

  // Tentukan musim tanam yang aktif/dipilih dengan sinkronisasi ke lahan terpilih
  const activeSeasonForLand = activeSeasons.find(
    (s) => s.landId === selectedLandId && s.status === 'ACTIVE'
  );

  const currentSeason =
    activeSeasons.find((s) => s.id === selectedSeasonId) ||
    activeSeasonForLand ||
    activeSeasons[0] ||
    null;

  const currentLand = currentSeason
    ? lands.find((l) => l.id === currentSeason.landId) || null
    : null;

  // Filter aktivitas untuk musim tanam yang dipilih
  const seasonActivities = useMemo(() => {
    if (!currentSeason) return [];
    const raw = allActivities.filter((a) => a.cropSeasonId === currentSeason.id);
    return raw.sort(
      (a, b) => new Date(b.activityDate).getTime() - new Date(a.activityDate).getTime()
    );
  }, [allActivities, currentSeason]);

  // Filter aktivitas berdasarkan kategori
  const filteredActivities = useMemo(() => {
    if (selectedCategory === 'ALL') return seasonActivities;
    return seasonActivities.filter((a) => a.category === selectedCategory);
  }, [seasonActivities, selectedCategory]);

  // Buka detail aktivitas
  const handleOpenDetail = async (activity: Activity) => {
    setSelectedActivity(activity);
    try {
      if (activity.category === 'FERTILIZER') {
        const ferts = await activityRepository.getFertilizerApplications(activity.id);
        setDetailFertApps(ferts);
        setDetailOptObs([]);
      } else if (activity.category === 'OPT') {
        const obs = await activityRepository.getOptObservations(activity.id);
        setDetailOptObs(obs);
        setDetailFertApps([]);
      } else {
        setDetailFertApps([]);
        setDetailOptObs([]);
      }
    } catch (err) {
      console.error('Error fetching detail activity:', err);
    }
  };

  const handleOpenNewActivity = (cat?: ActivityCategory) => {
    setInitialFormCategory(cat || null);
    setIsFormModalOpen(true);
  };

  const categories = [
    { id: 'ALL', label: 'Semua', count: seasonActivities.length },
    {
      id: 'FERTILIZER',
      label: 'Pupuk',
      icon: <FlaskConical className="w-3.5 h-3.5" />,
      count: seasonActivities.filter((a) => a.category === 'FERTILIZER').length,
    },
    {
      id: 'OPT',
      label: 'OPT / Hama',
      icon: <Bug className="w-3.5 h-3.5" />,
      count: seasonActivities.filter((a) => a.category === 'OPT').length,
    },
    {
      id: 'IRRIGATION',
      label: 'Pengairan',
      icon: <Droplets className="w-3.5 h-3.5" />,
      count: seasonActivities.filter((a) => a.category === 'IRRIGATION').length,
    },
    {
      id: 'MAINTENANCE',
      label: 'Perawatan',
      icon: <Scissors className="w-3.5 h-3.5" />,
      count: seasonActivities.filter((a) => a.category === 'MAINTENANCE').length,
    },
    {
      id: 'PLANTING',
      label: 'Tanam',
      icon: <Sprout className="w-3.5 h-3.5" />,
      count: seasonActivities.filter((a) => a.category === 'PLANTING').length,
    },
    {
      id: 'HARVEST',
      label: 'Panen',
      icon: <Wheat className="w-3.5 h-3.5" />,
      count: seasonActivities.filter((a) => a.category === 'HARVEST').length,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Riwayat Kegiatan Lapang"
        subtitle="Catatan kronologis seluruh aktivitas budidaya di petak sawah"
        action={
          currentSeason && (
            <button
              type="button"
              onClick={() => handleOpenNewActivity()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[48px] bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold rounded-xl text-xs sm:text-sm transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>+ Catat Kegiatan</span>
            </button>
          )
        }
      />

      {activeSeasons.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="w-8 h-8 text-emerald-700" />}
          title="Belum Ada Musim Tanam Aktif"
          description="Pencatatan kegiatan lapang membutuhkan musim tanam yang sedang berjalan. Silakan mulai musim tanam pada menu Lahan."
        />
      ) : (
        <div className="space-y-5">
          {/* Header Seleksi Lahan & Musim Tanam */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-100">
                <Sprout className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  {currentLand?.name || 'Petak Sawah'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Varietas: {currentSeason?.varietyName || 'Padi'} • Luas:{' '}
                  {currentLand?.areaHa} ha
                </p>
              </div>
            </div>

            {/* Pilihan Musim jika ada lebih dari 1 */}
            {activeSeasons.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 shrink-0">Pilih:</span>
                <select
                  value={currentSeason?.id || ''}
                  onChange={(e) => {
                    const newSeasonId = e.target.value;
                    setSelectedSeasonId(newSeasonId);
                    const matchedSeason = activeSeasons.find((s) => s.id === newSeasonId);
                    if (matchedSeason && onSelectLandId) {
                      onSelectLandId(matchedSeason.landId);
                    }
                  }}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[40px]"
                >
                  {activeSeasons.map((s) => {
                    const l = lands.find((item) => item.id === s.landId);
                    return (
                      <option key={s.id} value={s.id}>
                        {l?.name || 'Lahan'} — {s.varietyName || 'Padi'}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>

          {/* Filter Kategori Kegiatan (Pills) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all min-h-[40px] border ${
                  selectedCategory === cat.id
                    ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {cat.icon}
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    selectedCategory === cat.id
                      ? 'bg-emerald-950 text-emerald-200'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            ))}
          </div>

          {/* Daftar Riwayat Kartu Kegiatan */}
          {filteredActivities.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <CalendarDays className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">
                  Belum Ada Catatan Kegiatan
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {selectedCategory === 'ALL'
                    ? 'Belum ada aktivitas yang dicatat pada musim tanam ini. Mulai catat pemupukan, pengairan, atau pengamatan OPT Anda.'
                    : `Belum ada kegiatan kategori ini yang tercatat.`}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleOpenNewActivity(
                    selectedCategory !== 'ALL'
                      ? (selectedCategory as ActivityCategory)
                      : undefined
                  )
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Catat Kegiatan Baru</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredActivities.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  onClick={() => handleOpenDetail(activity)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Detail Kegiatan */}
      <ActivityDetailModal
        isOpen={selectedActivity !== null}
        onClose={() => setSelectedActivity(null)}
        activity={selectedActivity}
        land={currentLand}
        cropSeason={currentSeason}
        fertilizerApps={detailFertApps}
        optObs={detailOptObs}
        onNavigateToKnowledge={onNavigateToKnowledge}
        onDeleted={async () => {
          await onRefreshData();
          setSelectedActivity(null);
        }}
      />

      {/* Modal Form Pencatatan Kegiatan */}
      {currentLand && currentSeason && (
        <ActivityFormModal
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          initialCategory={initialFormCategory}
          land={currentLand}
          activeSeason={currentSeason}
          fertilizers={fertilizers}
          varieties={varieties}
          opts={opts}
          onSuccess={async () => {
            await onRefreshData();
          }}
        />
      )}
    </div>
  );
}
