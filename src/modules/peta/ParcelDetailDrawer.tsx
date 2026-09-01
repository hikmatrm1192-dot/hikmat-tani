/**
 * HIKMAT TANI - Parcel Detail Drawer & Spatial History
 * 
 * Filosofi:
 * "CERDAS BERTANI, BIJAK MENGAMBIL KEPUTUSAN."
 * 
 * Ditampilkan saat petani mengetuk polygon petak sawah di peta satelit.
 * Memuat:
 * - Nama & Luas petak m²
 * - Umur & Fase Tanaman (HST)
 * - Indikasi Risiko Kekeringan (5 Kategori Resmi: TERANCAM, RINGAN, SEDANG, BERAT, PUSO)
 * - Cuaca & Saran HIKMAT TANI
 * - Linimasa Riwayat Spasial Kegiatan Lapang
 * - Tombol Aksi Cepat
 */

import { useMemo } from 'react';
import {
  Activity as ActivityIcon,
  AlertTriangle,
  ArrowRight,
  Bug,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CloudSun,
  Droplets,
  HelpCircle,
  History,
  Layers,
  MapPin,
  Plus,
  Scissors,
  Shield,
  ShieldAlert,
  Sparkles,
  Sprout,
  TrendingDown,
  TrendingUp,
  Wheat,
  X,
} from 'lucide-react';
import {
  Activity,
  ActivityCategory,
  CropSeason,
  DroughtCategory,
  DROUGHT_STANDARDS,
  Land,
  OptObservation,
  WeatherData,
} from '../../types/index.ts';
import { calculateHST } from '../../engine/hstCalculator.ts';
import { determineGrowthPhase } from '../../engine/growthPhase.ts';
import { analyzeDroughtRisk, getDroughtAgronomicAdvice } from '../../engine/droughtEngine.ts';
import { formatAreaM2 } from '../../utils/geoUtils.ts';

interface ParcelDetailDrawerProps {
  land: Land | null;
  activeSeason: CropSeason | null;
  activities: Activity[];
  optObservations: OptObservation[];
  weather?: WeatherData | null;
  onClose: () => void;
  onOpenAddActivity: (category?: ActivityCategory) => void;
  onOpenOptObservation: () => void;
  onOpenStartSeason: (land: Land) => void;
  onOpenDroughtLegend: () => void;
}

export function ParcelDetailDrawer({
  land,
  activeSeason,
  activities,
  optObservations,
  weather,
  onClose,
  onOpenAddActivity,
  onOpenOptObservation,
  onOpenStartSeason,
  onOpenDroughtLegend,
}: ParcelDetailDrawerProps) {
  if (!land) return null;

  // Hitung HST & Fase
  const hstResult = activeSeason?.plantingDate
    ? calculateHST(activeSeason.plantingDate, new Date().toISOString())
    : { isValid: false, hst: null };
  const hst = hstResult.isValid && typeof hstResult.hst === 'number' ? hstResult.hst : 0;
  const growthPhase = determineGrowthPhase(activeSeason ? hst : null);

  // Analisis Risiko Kekeringan Komprehensif
  const droughtAnalysis = useMemo(() => {
    return analyzeDroughtRisk({
      land,
      activeSeason,
      weather,
    });
  }, [land, activeSeason, weather]);

  const droughtCategory = droughtAnalysis.overallCategory;
  const droughtInfo = DROUGHT_STANDARDS[droughtCategory];
  const advice = getDroughtAgronomicAdvice({
    category: droughtCategory,
    hst,
    waterSource: land.waterSource,
  });

  // Filter kegiatan khusus untuk musim/lahan ini
  const parcelActivities = activities
    .filter((a) => a.cropSeasonId === activeSeason?.id)
    .sort((a, b) => new Date(b.activityDate).getTime() - new Date(a.activityDate).getTime());

  const parcelOptCount = optObservations.filter((opt) => {
    const parent = activities.find((a) => a.id === opt.activityId);
    return parent?.cropSeasonId === activeSeason?.id;
  }).length;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 max-h-[85vh] sm:max-h-[90vh] bg-white rounded-t-3xl shadow-2xl border-t border-slate-200 overflow-y-auto font-sans animate-in slide-in-from-bottom duration-300">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">
        {/* Drag Handle & Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                {land.name}
              </h2>
              <p className="text-xs text-slate-500 font-semibold">
                Luas: <span className="text-slate-900 font-black">{formatAreaM2(land.areaM2, land.areaHa)}</span> • {land.location || 'Petak Aktif'}
              </p>
              {(land.village || land.administrative?.village) && (
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-emerald-800 font-bold">
                  <Building2 className="w-3 h-3 text-emerald-700 shrink-0" />
                  <span>
                    Desa {land.village || land.administrative?.village}, {land.district || land.administrative?.district}
                  </span>
                  <span className="px-1 py-0.2 bg-emerald-100 text-emerald-900 text-[9px] rounded font-black">
                    BIG
                  </span>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Status Musim & Fase Tanaman */}
        {activeSeason ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#FBF9F2] border border-emerald-900/15 rounded-2xl p-3.5">
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase">Varietas Padi</div>
              <div className="text-xs font-black text-slate-900 truncate">
                {activeSeason.varietyName || 'Padi Sawah'}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase">Umur Tanaman</div>
              <div className="text-xs font-black text-emerald-800">{hst} HST</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase">Fase Tumbuh</div>
              <div className="text-xs font-black text-emerald-900 truncate">{growthPhase.label}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase">Pengamatan OPT</div>
              <div className="text-xs font-black text-rose-700">{parcelOptCount} Catatan</div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-4 text-center space-y-2">
            <p className="text-xs text-slate-500">Lahan ini sedang dalam masa istirahat / belum ada musim tanam aktif.</p>
            <button
              type="button"
              onClick={() => onOpenStartSeason(land)}
              className="px-4 py-2 bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Mulai Musim Tanam Baru</span>
            </button>
          </div>
        )}

        {/* 2. Indikasi Risiko Kekeringan (Standar 5 Kategori Resmi) */}
        <div className="border border-slate-200/90 rounded-2xl p-4 space-y-3 bg-white shadow-2xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-orange-600" />
              <span className="text-xs font-bold text-slate-800">
                Indikasi Risiko Kekeringan
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs border ${droughtInfo.badgeClass}`}>
                <span>{droughtInfo.icon}</span>
                <span>{droughtInfo.label}</span>
              </span>

              {droughtAnalysis.trend === 'WORSENING' && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                  <TrendingUp className="w-3 h-3" /> Memburuk
                </span>
              )}
              {droughtAnalysis.trend === 'IMPROVING' && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <TrendingDown className="w-3 h-3" /> Membaik
                </span>
              )}
              {droughtAnalysis.trend === 'STABLE' && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                  ➡️ Stabil
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <strong>Definisi Standar:</strong> {droughtInfo.definition}
          </p>

          {/* 3 Analisis Rinci */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-100">
              <div className="text-[10px] font-bold text-blue-900 uppercase">Meteorologis</div>
              <div className="text-[11px] font-semibold text-slate-800 mt-0.5">
                {droughtAnalysis.meteorological.label}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                HTH: {droughtAnalysis.meteorological.consecutiveDryDays} hari • {droughtAnalysis.meteorological.rainfall30DaysMm} mm/30hr
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
              <div className="text-[10px] font-bold text-emerald-900 uppercase">Vegetasi Satelit</div>
              <div className="text-[11px] font-semibold text-slate-800 mt-0.5">
                {droughtAnalysis.vegetation.label}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Indeks VCI: {droughtAnalysis.vegetation.vciValue || 70}/100
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-100">
              <div className="text-[10px] font-bold text-amber-900 uppercase">Pertanian & Lahan</div>
              <div className="text-[11px] font-semibold text-slate-800 mt-0.5">
                Defisit Air: {droughtAnalysis.agricultural.waterDeficitLevel}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {droughtAnalysis.agricultural.vulnerableStageNotice || 'Kebutuhan air standar'}
              </div>
            </div>
          </div>

          {/* Saran HIKMAT TANI */}
          <div className="bg-emerald-900 text-white rounded-xl p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-black text-amber-300">
              <Sparkles className="w-4 h-4" />
              <span>Saran HIKMAT TANI ({advice.actionTitle})</span>
            </div>
            <ul className="text-xs text-emerald-100/90 space-y-1 pl-4 list-disc">
              {advice.recommendations.map((rec, idx) => (
                <li key={idx}>{rec}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* 3. Quick Action Buttons */}
        <div className="space-y-2">
          <span className="text-xs font-black text-slate-800">Aksi Lapang Petak Ini</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => onOpenAddActivity('FERTILIZER')}
              className="py-2.5 px-3 min-h-[46px] bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
            >
              <span>🧪 + Pupuk</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenAddActivity('IRRIGATION')}
              className="py-2.5 px-3 min-h-[46px] bg-cyan-50 hover:bg-cyan-100 active:bg-cyan-200 text-cyan-900 border border-cyan-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
            >
              <span>💧 + Pengairan</span>
            </button>
            <button
              type="button"
              onClick={onOpenOptObservation}
              className="py-2.5 px-3 min-h-[46px] bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-900 border border-rose-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
            >
              <span>🐛 + Amati OPT</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenAddActivity()}
              className="py-2.5 px-3 min-h-[46px] bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>+ Kegiatan Lain</span>
            </button>
          </div>
        </div>

        {/* 4. Linimasa Riwayat Spasial Petak Sawah */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <History className="w-4 h-4 text-emerald-800" />
              Linimasa Riwayat Kegiatan Petak Ini
            </span>
            <span className="text-[11px] text-slate-500 font-bold">
              {parcelActivities.length} Riwayat
            </span>
          </div>

          {parcelActivities.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {parcelActivities.map((act) => {
                let badgeEmoji = '🌱';
                let label = 'Tanam';
                let colorClass = 'bg-emerald-50 text-emerald-900 border-emerald-200';

                if (act.category === 'FERTILIZER') {
                  badgeEmoji = '🧪';
                  label = 'Pemupukan';
                  colorClass = 'bg-amber-50 text-amber-900 border-amber-200';
                } else if (act.category === 'IRRIGATION') {
                  badgeEmoji = '💧';
                  label = 'Pengairan';
                  colorClass = 'bg-cyan-50 text-cyan-900 border-cyan-200';
                } else if (act.category === 'OPT') {
                  badgeEmoji = '🐛';
                  label = 'Pengamatan OPT';
                  colorClass = 'bg-rose-50 text-rose-900 border-rose-200';
                } else if (act.category === 'MAINTENANCE') {
                  badgeEmoji = '✂️';
                  label = 'Perawatan';
                  colorClass = 'bg-orange-50 text-orange-900 border-orange-200';
                } else if (act.category === 'HARVEST') {
                  badgeEmoji = '🌾';
                  label = 'Panen';
                  colorClass = 'bg-yellow-50 text-yellow-900 border-yellow-200';
                }

                return (
                  <div
                    key={act.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${colorClass}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{badgeEmoji}</span>
                      <div>
                        <div className="font-bold text-slate-900">
                          {label} ({act.hst} HST)
                        </div>
                        <div className="text-[10px] text-slate-500">{act.activityDate}</div>
                      </div>
                    </div>
                    {act.notes && (
                      <span className="text-[11px] text-slate-600 italic max-w-[140px] truncate">
                        "{act.notes}"
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-3 text-center italic bg-slate-50 rounded-xl">
              Belum ada riwayat kegiatan tercatat pada petak sawah ini.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
