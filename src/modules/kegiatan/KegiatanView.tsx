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

import { useEffect, useMemo, useState } from 'react';
import {
  Bug,
  CalendarDays,
  Coins,
  DollarSign,
  Droplets,
  Filter,
  FlaskConical,
  Leaf,
  Plus,
  Scissors,
  Sprout,
  Wheat,
} from 'lucide-react';
import { EmptyState } from '../../components/common/EmptyState.tsx';
import { PageHeader } from '../../components/common/PageHeader.tsx';
import { activityRepository } from '../../db/repositories/activityRepository.ts';
import { expenseRepository } from '../../db/repositories/expenseRepository.ts';
import { seedbedRepository } from '../../db/repositories/seedbedRepository.ts';
import {
  Activity,
  ActivityCategory,
  CropSeason,
  CultivationExpense,
  Fertilizer,
  FertilizerApplication,
  Land,
  Opt,
  OptObservation,
  RiceVariety,
  SeasonExpenseReport,
  Seedbed,
} from '../../types/index.ts';
import { ActivityCard } from './ActivityCard.tsx';
import { ActivityDetailModal } from './ActivityDetailModal.tsx';
import { ActivityFormModal } from './ActivityFormModal.tsx';
import { ExpenseCard } from './ExpenseCard.tsx';
import { ExpenseFormModal } from './ExpenseFormModal.tsx';
import { ExpenseSummaryCard } from './ExpenseSummaryCard.tsx';
import { SeedbedCard } from './SeedbedCard.tsx';
import { SeedbedFormModal } from './SeedbedFormModal.tsx';

interface KegiatanViewProps {
  lands: Land[];
  activeSeasons: CropSeason[];
  allActivities: Activity[];
  fertilizers: Fertilizer[];
  varieties?: RiceVariety[];
  opts?: Opt[];
  selectedLandId?: string;
  onSelectLandId?: (landId: string) => void;
  onNavigateToKnowledge?: (
    category: 'opt' | 'pupuk' | 'musuh_alami' | 'varietas' | 'panduan',
    itemId?: string,
    searchQuery?: string
  ) => void;
  onRefreshData: () => Promise<void>;
}

type MainTab = 'ACTIVITIES' | 'SEEDBEDS' | 'EXPENSES';

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
  const [mainTab, setMainTab] = useState<MainTab>('ACTIVITIES');
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Modal states for Activities
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [initialFormCategory, setInitialFormCategory] = useState<ActivityCategory | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [detailFertApps, setDetailFertApps] = useState<FertilizerApplication[]>([]);
  const [detailOptObs, setDetailOptObs] = useState<OptObservation[]>([]);

  // Seedbed state & modals
  const [seedbeds, setSeedbeds] = useState<Seedbed[]>([]);
  const [isSeedbedModalOpen, setIsSeedbedModalOpen] = useState<boolean>(false);
  const [editingSeedbed, setEditingSeedbed] = useState<Seedbed | null>(null);

  // Expense state & modals
  const [expenses, setExpenses] = useState<CultivationExpense[]>([]);
  const [expenseReport, setExpenseReport] = useState<SeasonExpenseReport | null>(null);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState<boolean>(false);
  const [editingExpense, setEditingExpense] = useState<CultivationExpense | null>(null);

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

  // Load Seedbeds & Expenses for current season
  const loadSubData = async () => {
    if (!currentSeason) {
      setSeedbeds([]);
      setExpenses([]);
      setExpenseReport(null);
      return;
    }
    try {
      const sbeds = await seedbedRepository.getByCropSeasonId(currentSeason.id);
      setSeedbeds(sbeds);

      const exps = await expenseRepository.getByCropSeasonId(currentSeason.id);
      setExpenses(exps);

      const report = await expenseRepository.getSeasonReport(currentSeason.id);
      setExpenseReport(report);
    } catch (err) {
      console.error('Error loading seedbed or expense data:', err);
    }
  };

  useEffect(() => {
    loadSubData();
  }, [currentSeason?.id, allActivities.length]);

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

  // Seedbed handlers
  const handleCreateSeedbed = () => {
    setEditingSeedbed(null);
    setIsSeedbedModalOpen(true);
  };

  const handleEditSeedbed = (s: Seedbed) => {
    setEditingSeedbed(s);
    setIsSeedbedModalOpen(true);
  };

  const handleDeleteSeedbed = async (s: Seedbed) => {
    if (window.confirm(`Hapus catatan persemaian varietas ${s.varietyName}?`)) {
      await seedbedRepository.delete(s.id);
      await loadSubData();
      await onRefreshData();
    }
  };

  // Expense handlers
  const handleCreateExpense = () => {
    setEditingExpense(null);
    setIsExpenseModalOpen(true);
  };

  const handleEditExpense = (exp: CultivationExpense) => {
    setEditingExpense(exp);
    setIsExpenseModalOpen(true);
  };

  const handleDeleteExpense = async (exp: CultivationExpense) => {
    if (window.confirm(`Hapus catatan biaya "${exp.description}"?`)) {
      await expenseRepository.delete(exp.id);
      await loadSubData();
      await onRefreshData();
    }
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
        title="Riwayat & Pencatatan Lapang"
        subtitle="Kelola kegiatan budidaya, data persemaian bibit, dan biaya usaha tani"
        action={
          currentSeason && (
            <div className="flex items-center gap-2">
              {mainTab === 'ACTIVITIES' && (
                <button
                  type="button"
                  onClick={() => handleOpenNewActivity()}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[48px] bg-[#0F5132] hover:bg-[#0B3D26] active:bg-[#072417] text-white font-bold rounded-xl text-xs sm:text-sm transition-colors shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Catat Kegiatan</span>
                </button>
              )}
              {mainTab === 'SEEDBEDS' && (
                <button
                  type="button"
                  onClick={handleCreateSeedbed}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[48px] bg-[#0F5132] hover:bg-[#0B3D26] active:bg-[#072417] text-white font-bold rounded-xl text-xs sm:text-sm transition-colors shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Catat Persemaian</span>
                </button>
              )}
              {mainTab === 'EXPENSES' && (
                <button
                  type="button"
                  onClick={handleCreateExpense}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[48px] bg-[#0F5132] hover:bg-[#0B3D26] active:bg-[#072417] text-white font-bold rounded-xl text-xs sm:text-sm transition-colors shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Catat Biaya</span>
                </button>
              )}
            </div>
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

          {/* Tab Utama: Kegiatan Lapang | Persemaian | Biaya Usaha Tani */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-2xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setMainTab('ACTIVITIES')}
              className={`flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[44px] ${
                mainTab === 'ACTIVITIES'
                  ? 'bg-white text-emerald-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarDays className="w-4 h-4 text-emerald-700" />
              <span>Kegiatan Lapang</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-black">
                {seasonActivities.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMainTab('SEEDBEDS')}
              className={`flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[44px] ${
                mainTab === 'SEEDBEDS'
                  ? 'bg-white text-emerald-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Leaf className="w-4 h-4 text-emerald-700" />
              <span>Persemaian</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-black">
                {seedbeds.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMainTab('EXPENSES')}
              className={`flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[44px] ${
                mainTab === 'EXPENSES'
                  ? 'bg-white text-emerald-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Coins className="w-4 h-4 text-emerald-700" />
              <span>Biaya Usaha Tani</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-black">
                {expenses.length}
              </span>
            </button>
          </div>

          {/* TAB 1: KEGIATAN LAPANG */}
          {mainTab === 'ACTIVITIES' && (
            <div className="space-y-4">
              {/* Filter Kategori Kegiatan (Pills) */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all min-h-[40px] border ${
                      selectedCategory === cat.id
                        ? 'bg-[#0F5132] text-white border-[#0F5132] shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {cat.icon}
                    <span>{cat.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                        selectedCategory === cat.id
                          ? 'bg-[#072417] text-emerald-200'
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

          {/* TAB 2: PERSEMAIAN */}
          {mainTab === 'SEEDBEDS' && (
            <div className="space-y-4">
              {seedbeds.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-100">
                    <Leaf className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">
                      Belum Ada Catatan Persemaian
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Catat tanggal mulai sebar benih untuk memantau Hari Setelah Semai (HSS) dan umur ideal pindah tanam (15-21 HSS).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateSeedbed}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Catat Persemaian Sekarang</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {seedbeds.map((s) => (
                    <SeedbedCard
                      key={s.id}
                      seedbed={s}
                      onEdit={handleEditSeedbed}
                      onDelete={handleDeleteSeedbed}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: BIAYA USAHA TANI */}
          {mainTab === 'EXPENSES' && (
            <div className="space-y-4">
              {/* Ringkasan Akumulasi Biaya */}
              {expenseReport && (
                <ExpenseSummaryCard report={expenseReport} land={currentLand} season={currentSeason} />
              )}

              {/* Daftar Transaksi Biaya */}
              {expenses.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-100">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">
                      Belum Ada Transaksi Biaya
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Catat pengeluaran nyata pembelian pupuk, benih, sewa traktor, dan upah kerja untuk menghitung total biaya produksi per musim.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateExpense}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Catat Pengeluaran Pertama</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-xs font-bold text-slate-700">
                      Daftar Riwayat Transaksi ({expenses.length})
                    </h4>
                  </div>
                  {expenses.map((exp) => (
                    <ExpenseCard
                      key={exp.id}
                      expense={exp}
                      onEdit={handleEditExpense}
                      onDelete={handleDeleteExpense}
                    />
                  ))}
                </div>
              )}
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
          await loadSubData();
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
          onNavigateToKnowledge={onNavigateToKnowledge}
          onSuccess={async () => {
            await onRefreshData();
            await loadSubData();
          }}
        />
      )}

      {/* Modal Form Persemaian */}
      {currentLand && currentSeason && (
        <SeedbedFormModal
          isOpen={isSeedbedModalOpen}
          onClose={() => {
            setIsSeedbedModalOpen(false);
            setEditingSeedbed(null);
          }}
          land={currentLand}
          activeSeason={currentSeason}
          varieties={varieties}
          editSeedbed={editingSeedbed}
          onSuccess={async () => {
            await loadSubData();
            await onRefreshData();
          }}
        />
      )}

      {/* Modal Form Biaya Usaha Tani */}
      {currentLand && currentSeason && (
        <ExpenseFormModal
          isOpen={isExpenseModalOpen}
          onClose={() => {
            setIsExpenseModalOpen(false);
            setEditingExpense(null);
          }}
          land={currentLand}
          activeSeason={currentSeason}
          editExpense={editingExpense}
          onSuccess={async () => {
            await loadSubData();
            await onRefreshData();
          }}
        />
      )}
    </div>
  );
}

