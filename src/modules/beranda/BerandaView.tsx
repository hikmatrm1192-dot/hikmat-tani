/**
 * HIKMAT TANI - Beranda View (Home View)
 * 
 * Filosofi:
 * "Ini keadaan sawah saya sekarang."
 * Bukan dashboard sistem yang penuh statistik rumit.
 * 
 * Arsitektur:
 * Dexie DB -> Repositories -> Agriculture Engine -> BerandaView -> UI Components
 */

import { useEffect, useState } from 'react';
import { Sprout } from 'lucide-react';
import { EmptyState } from '../../components/common/EmptyState.tsx';
import { recommendationRepository } from '../../db/repositories/recommendationRepository.ts';
import { landRepository } from '../../db/repositories/landRepository.ts';
import { buildActivityTimeline } from '../../engine/activityTimeline.ts';
import { buildFieldContext } from '../../engine/contextEngine.ts';
import { evaluateRecommendations } from '../../engine/recommendation/evaluator.ts';
import { EvaluatedRecommendation } from '../../engine/recommendation/types.ts';
import {
  Activity,
  ActivityCategory,
  CropSeason,
  FarmerDecision,
  FarmerDecisionChoice,
  Fertilizer,
  FertilizerApplication,
  Land,
  Opt,
  OptObservation,
  RiceVariety,
  WeatherData,
} from '../../types/index.ts';
import { clientWeatherService } from '../../services/weatherService.ts';
import { ActivityFormModal } from '../kegiatan/ActivityFormModal.tsx';
import { ActivityDetailModal } from '../kegiatan/ActivityDetailModal.tsx';
import { SeasonDetailModal } from '../lahan/SeasonDetailModal.tsx';
import { ActiveLandCard } from './ActiveLandCard.tsx';
import { FarmerDecisionModal } from './FarmerDecisionModal.tsx';
import { QuickActions } from './QuickActions.tsx';
import { RecentActivities } from './RecentActivities.tsx';
import { RecommendationCard } from './RecommendationCard.tsx';
import { WeatherCard } from './WeatherCard.tsx';

interface BerandaViewProps {
  lands: Land[];
  activeSeasons: CropSeason[];
  allActivities: Activity[];
  fertilizers: Fertilizer[];
  varieties: RiceVariety[];
  opts?: Opt[];
  selectedLandId: string | null;
  onSelectLandId: (landId: string) => void;
  onNavigateToTab: (tab: 'beranda' | 'lahan' | 'kegiatan' | 'informasi' | 'saya') => void;
  onNavigateToKnowledge?: (
    category: 'opt' | 'pupuk' | 'musuh_alami' | 'varietas' | 'panduan',
    itemId?: string,
    searchQuery?: string
  ) => void;
  onOpenAddLand: () => void;
  onOpenStartSeason: (landId?: string) => void;
  onRefreshData: () => Promise<void>;
}

export function BerandaView({
  lands,
  activeSeasons,
  allActivities,
  fertilizers,
  varieties,
  opts = [],
  selectedLandId,
  onSelectLandId,
  onNavigateToTab,
  onNavigateToKnowledge,
  onOpenAddLand,
  onOpenStartSeason,
  onRefreshData,
}: BerandaViewProps) {
  // Modal states
  const [isSeasonDetailOpen, setIsSeasonDetailOpen] = useState<boolean>(false);
  const [activityFormCategory, setActivityFormCategory] = useState<ActivityCategory | null>(null);
  const [isActivityFormOpen, setIsActivityFormOpen] = useState<boolean>(false);
  const [activeDecisionId, setActiveDecisionId] = useState<string | undefined>(undefined);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [detailFertApps, setDetailFertApps] = useState<FertilizerApplication[]>([]);
  const [detailOptObs, setDetailOptObs] = useState<OptObservation[]>([]);

  // Decision Modal state (Tiga Jalur Keputusan)
  const [selectedRecommendation, setSelectedRecommendation] = useState<EvaluatedRecommendation | null>(null);
  const [farmerDecisions, setFarmerDecisions] = useState<FarmerDecision[]>([]);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);

  // Tentukan Lahan Terpilih & Musim Tanam Aktif
  const activeLand =
    lands.find((l) => l.id === selectedLandId) ||
    lands.find((l) => activeSeasons.some((s) => s.landId === l.id)) ||
    lands[0] ||
    null;

  const activeSeason = activeLand
    ? activeSeasons.find((s) => s.landId === activeLand.id && s.status === 'ACTIVE') || null
    : null;

  // Muat cache cuaca lokal segera saat activeLand berubah untuk instant offline-first context
  useEffect(() => {
    if (activeLand) {
      const lat = typeof activeLand.latitude === 'number' ? activeLand.latitude : -6.57;
      const lon = typeof activeLand.longitude === 'number' ? activeLand.longitude : 107.75;
      const cacheKey = `hikmat_tani_weather_${lat.toFixed(2)}_${lon.toFixed(2)}`;
      const cached = clientWeatherService.getLocalCache(cacheKey);
      if (cached) {
        setWeatherData(cached);
      }
    }
  }, [activeLand?.id, activeLand?.latitude, activeLand?.longitude]);

  // Muat riwayat keputusan petani pada musim tanam aktif (selalu dipanggil secara konsisten di top level)
  useEffect(() => {
    let isMounted = true;
    async function loadDecisions() {
      if (activeSeason?.id) {
        try {
          const decs = await recommendationRepository.getDecisionsByCropSeason(activeSeason.id);
          if (isMounted) {
            setFarmerDecisions(decs);
          }
        } catch (err) {
          console.error('Gagal memuat keputusan petani:', err);
        }
      } else {
        if (isMounted) {
          setFarmerDecisions([]);
        }
      }
    }
    loadDecisions();
    return () => {
      isMounted = false;
    };
  }, [activeSeason?.id, allActivities]);

  // 1. Empty State Utama: Belum ada lahan terdaftar sama sekali
  if (lands.length === 0 || !activeLand) {
    return (
      <div className="space-y-6">
        <div className="text-center sm:text-left">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Selamat Datang di HIKMAT TANI
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Pendamping cerdas budidaya padi sawah berbasis ilmiah & bekerja 100% offline.
          </p>
        </div>

        <EmptyState
          icon={<Sprout className="w-8 h-8 text-emerald-700" />}
          title="Belum Ada Petak Sawah Terdaftar"
          description="Tambahkan petak sawah pertama Anda untuk mulai memantau umur tanaman (HST), fase pertumbuhan, serta memperoleh pertimbangan agronomi yang santun dan bersahabat."
          actionText="+ Tambah Petak Sawah Baru"
          onAction={onOpenAddLand}
        />

        <WeatherCard />
      </div>
    );
  }

  // Temukan umur varietas dari master knowledge data
  const matchedVariety = varieties.find(
    (v) =>
      v.name.toLowerCase().trim() === (activeSeason?.varietyName || '').toLowerCase().trim()
  );
  const varietyDurationDays = matchedVariety?.growthDurationDays || 120;

  // Filter aktivitas terkait musim tanam aktif
  const seasonActivities = activeSeason
    ? allActivities.filter((a) => a.cropSeasonId === activeSeason.id)
    : [];

  // Bangun Konteks Lapangan via Agriculture Engine
  const fieldContext = activeSeason
    ? buildFieldContext({
        cropSeason: activeSeason,
        land: activeLand,
        activities: seasonActivities,
        targetDate: new Date(),
        varietyDurationDays,
        weatherData,
      })
    : null;

  // Evaluasi Rekomendasi (Saran) via Agriculture Engine
  const evaluatedRecommendations = fieldContext
    ? evaluateRecommendations(fieldContext)
    : [];

  // Bangun Linimasa Kegiatan Lapang via Agriculture Engine
  const timelineEvents = activeSeason
    ? buildActivityTimeline({
        cropSeason: activeSeason,
        activities: seasonActivities,
      })
    : [];

  const handleOpenActivityForm = (cat?: ActivityCategory | null) => {
    setActiveDecisionId(undefined);
    setActivityFormCategory(cat || null);
    setIsActivityFormOpen(true);
  };

  const handleDecisionSaved = (
    decisionId: string,
    _choice: FarmerDecisionChoice,
    suggestedCategory?: ActivityCategory
  ) => {
    // Refresh decisions list
    if (activeSeason?.id) {
      recommendationRepository.getDecisionsByCropSeason(activeSeason.id).then(setFarmerDecisions);
    }

    if (suggestedCategory) {
      // Buka form kegiatan aktual langsung ditautkan ke ID Keputusan
      setActiveDecisionId(decisionId);
      setActivityFormCategory(suggestedCategory);
      setIsActivityFormOpen(true);
    }
  };

  const handleUpdateLandLocation = async (lat: number, lon: number) => {
    if (activeLand?.id) {
      try {
        await landRepository.update(activeLand.id, {
          latitude: lat,
          longitude: lon,
        });
        await onRefreshData();
      } catch (err) {
        console.error('Gagal memperbarui koordinat lahan:', err);
      }
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Lahan Aktif, Musim Tanam, Varietas, HST & Fase Tanaman */}
      <ActiveLandCard
        land={activeLand}
        activeSeason={activeSeason || undefined}
        varietyDurationDays={varietyDurationDays}
        onOpenLandDetail={() => setIsSeasonDetailOpen(true)}
        onStartSeason={(landId) => onOpenStartSeason(landId)}
        allLands={lands}
        onSelectLand={onSelectLandId}
      />

      {/* 2. Yang Perlu Diperhatikan (Saran Ilmiah Santun & Jalur Keputusan Petani) */}
      <RecommendationCard
        recommendations={evaluatedRecommendations}
        hasActiveSeason={Boolean(activeSeason)}
        onOpenSeasonForm={() => onOpenStartSeason(activeLand.id)}
        onOpenDecisionModal={(rec) => setSelectedRecommendation(rec)}
        onNavigateToKnowledge={onNavigateToKnowledge}
        existingDecisions={farmerDecisions}
      />

      {/* 3. Cuaca Lapang */}
      <WeatherCard
        land={activeLand}
        onUpdateLandLocation={handleUpdateLandLocation}
        onWeatherLoaded={setWeatherData}
      />

      {/* 4. Kegiatan Terakhir */}
      <RecentActivities
        timelineEvents={timelineEvents}
        onViewAll={() => onNavigateToTab('kegiatan')}
        onAddFirstActivity={() => handleOpenActivityForm('FERTILIZER')}
        hasActiveSeason={Boolean(activeSeason)}
      />

      {/* 5. Aksi Cepat (Catat Kegiatan Lapang) */}
      <QuickActions
        onAddFertilizer={() => handleOpenActivityForm('FERTILIZER')}
        onAddObservation={() => handleOpenActivityForm('OPT')}
        onAddIrrigation={() => handleOpenActivityForm('IRRIGATION')}
        onAddMaintenance={() => handleOpenActivityForm('MAINTENANCE')}
        onAddHarvest={() => handleOpenActivityForm('HARVEST')}
        onAddGeneral={() => handleOpenActivityForm(null)}
        disabled={!activeSeason}
      />

      {/* Detail Modal Musim Tanam */}
      {activeSeason && (
        <SeasonDetailModal
          isOpen={isSeasonDetailOpen}
          onClose={() => setIsSeasonDetailOpen(false)}
          land={activeLand}
          season={activeSeason}
          varietyDurationDays={varietyDurationDays}
          onSeasonUpdated={onRefreshData}
        />
      )}

      {/* Modal Tiga Jalur Keputusan Petani */}
      {activeSeason && (
        <FarmerDecisionModal
          isOpen={selectedRecommendation !== null}
          onClose={() => setSelectedRecommendation(null)}
          recommendation={selectedRecommendation}
          land={activeLand}
          cropSeason={activeSeason}
          onDecisionSaved={handleDecisionSaved}
        />
      )}

      {/* Modal Detail Kegiatan */}
      <ActivityDetailModal
        isOpen={selectedActivity !== null}
        onClose={() => setSelectedActivity(null)}
        activity={selectedActivity}
        land={activeLand}
        cropSeason={activeSeason}
        fertilizerApps={detailFertApps}
        optObs={detailOptObs}
        opts={opts}
        onNavigateToKnowledge={onNavigateToKnowledge}
        onDeleted={async () => {
          await onRefreshData();
          setSelectedActivity(null);
        }}
      />

      {/* Modal Form Pencatatan Kegiatan */}
      {activeSeason && (
        <ActivityFormModal
          isOpen={isActivityFormOpen}
          onClose={() => {
            setIsActivityFormOpen(false);
            setActiveDecisionId(undefined);
          }}
          initialCategory={activityFormCategory}
          land={activeLand}
          activeSeason={activeSeason}
          fertilizers={fertilizers}
          varieties={varieties}
          opts={opts}
          decisionId={activeDecisionId}
          onNavigateToKnowledge={onNavigateToKnowledge}
          onSuccess={async (createdActivity, createdOptObs) => {
            await onRefreshData();
            if (createdActivity) {
              setSelectedActivity(createdActivity);
              if (createdOptObs) {
                setDetailOptObs([createdOptObs]);
                setDetailFertApps([]);
              } else {
                setDetailOptObs([]);
                setDetailFertApps([]);
              }
            }
          }}
        />
      )}
    </div>
  );
}
