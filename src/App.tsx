/**
 * HIKMAT TANI - App Shell & UI/UX Core (Langkah 5 & 16)
 * 
 * Tagline Resmi: "CERDAS BERTANI, BIJAK MENGAMBIL KEPUTUSAN."
 * 
 * Arsitektur:
 * AuthGate (Mandatory) -> Dexie DB Partition -> Repository -> Agriculture Engine -> React -> UI
 * 
 * Menu Utama:
 * 1. Beranda
 * 2. Lahan
 * 3. Kegiatan
 * 4. Informasi
 * 5. Saya (Termasuk "Dukung HIKMAT TANI", Akun & Isolasi)
 */

import { useCallback, useEffect, useState } from 'react';
import { AppLayout } from './components/layout/AppLayout.tsx';
import { MainNavTab } from './components/layout/BottomNav.tsx';
import { AuthGate } from './components/auth/AuthGate.tsx';
import {
  activityRepository,
  cropSeasonRepository,
  db,
  farmerRepository,
  initializeDatabase,
  knowledgeRepository,
  landRepository,
  setActiveFarmerDb,
} from './db/index.ts';
import {
  AddLandModal,
  BerandaView,
  InformasiView,
  KegiatanView,
  LahanView,
  SayaView,
  StartSeasonModal,
} from './modules/index.ts';
import {
  Activity,
  CropSeason,
  Farmer,
  Fertilizer,
  FertilizerApplication,
  KnowledgeArticle,
  Land,
  NaturalEnemy,
  Opt,
  OptObservation,
  Reference,
  RiceVariety,
} from './types/index.ts';
import { authClientService, AuthSession } from './services/authClientService.ts';
import { useBrandConfig } from './services/publicConfigService.ts';
import { syncEngine } from './sync/syncEngine.ts';
import { runDatabaseTests } from '../tests/index.test.ts';
import { runEngineTests } from '../tests/engine.test.ts';
import { runBackupTests } from '../tests/backup.test.ts';

export default function App() {
  // Brand configuration
  const brandConfig = useBrandConfig();

  // Authentication & Session State
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => authClientService.getSession());

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<MainNavTab>('beranda');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // App Data State (Dexie IndexedDB)
  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [lands, setLands] = useState<Land[]>([]);
  const [activeSeasons, setActiveSeasons] = useState<CropSeason[]>([]);
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [allFertApps, setAllFertApps] = useState<FertilizerApplication[]>([]);
  const [allOptObs, setAllOptObs] = useState<OptObservation[]>([]);
  const [fertilizers, setFertilizers] = useState<Fertilizer[]>([]);
  const [varieties, setVarieties] = useState<RiceVariety[]>([]);
  const [opts, setOpts] = useState<Opt[]>([]);
  const [naturalEnemies, setNaturalEnemies] = useState<NaturalEnemy[]>([]);
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [references, setReferences] = useState<Reference[]>([]);

  // Navigation lintas modul ke modul informasi
  const [knowledgeNavigationTarget, setKnowledgeNavigationTarget] = useState<{
    category: 'opt' | 'pupuk' | 'musuh_alami' | 'varietas' | 'panduan';
    itemId?: string;
  } | null>(null);

  const [selectedLandId, setSelectedLandId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Global Modals State
  const [isAddLandModalOpen, setIsAddLandModalOpen] = useState<boolean>(false);
  const [isStartSeasonModalOpen, setIsStartSeasonModalOpen] = useState<boolean>(false);
  const [targetLandForSeason, setTargetLandForSeason] = useState<Land | null>(null);

  // Diagnostics state
  const [isTestingRunning, setIsTestingRunning] = useState<boolean>(false);

  // Subscribe ke perubahan authClientService
  useEffect(() => {
    const unsubscribe = authClientService.subscribe((sess) => {
      setAuthSession(sess);
    });
    return () => unsubscribe();
  }, []);

  // 1. Data Loader & Synchronizer
  const loadData = useCallback(async () => {
    const currentSess = authClientService.getSession();
    if (!currentSess?.farmer?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const farmerId = currentSess.farmer.id;

      // Inisialisasi partisi DB untuk petani ini (idempotent)
      setActiveFarmerDb(farmerId);
      await initializeDatabase(farmerId);

      // Inisialisasi Sync Engine background sync
      syncEngine.init().catch((e) => console.warn('[HIKMAT TANI] Sync engine init note:', e));

      // Profil Petani dari partisi lokal
      let currentFarmer = await farmerRepository.getById(farmerId);
      if (!currentFarmer) {
        // Simpan profil petani dari sesi ke partisi lokal jika belum tersimpan
        const newFarmer: Farmer = {
          id: farmerId,
          name: currentSess.farmer.name || 'Petani Padi',
          phoneNumber: currentSess.farmer.phoneNumber || '081234567890',
          village: currentSess.farmer.village || 'Sukamaju',
          district: currentSess.farmer.district || 'Kasokandel',
          regency: currentSess.farmer.regency || 'Majalengka',
          province: currentSess.farmer.province || 'Jawa Barat',
          farmerGroupName: currentSess.farmer.farmerGroupName || 'Kelompok Tani Mandiri',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await farmerRepository.create(newFarmer);
        currentFarmer = newFarmer;
      }
      setFarmer(currentFarmer);

      // Data Lahan & Musim Tanam (Scoped ke Partisi Petani ini)
      const allLands = await landRepository.getAll();
      const allSeasons = await cropSeasonRepository.getAllActive();
      const rawActivities = await db.activities.toArray();
      const rawFertApps = await db.fertilizerApplications.toArray();
      const rawOptObs = await db.optObservations.toArray();

      setLands(allLands);
      setActiveSeasons(allSeasons);
      setAllActivities(rawActivities);
      setAllFertApps(rawFertApps);
      setAllOptObs(rawOptObs);

      // Master Knowledge
      const [ferts, vars, allOpts, enemies, arts, refs] = await Promise.all([
        knowledgeRepository.getAllFertilizers(),
        knowledgeRepository.getAllVarieties(),
        knowledgeRepository.getAllOpts(),
        knowledgeRepository.getAllNaturalEnemies(),
        knowledgeRepository.getAllArticles(),
        knowledgeRepository.getAllReferences(),
      ]);

      setFertilizers(ferts);
      setVarieties(vars);
      setOpts(allOpts);
      setNaturalEnemies(enemies);
      setArticles(arts);
      setReferences(refs);

      setSelectedLandId((prev) => {
        if (prev && allLands.some((l) => l.id === prev)) {
          return prev;
        }
        return allLands.length > 0 ? allLands[0].id : null;
      });
    } catch (err) {
      console.error('[HIKMAT TANI] Error loading data from Dexie:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (authSession) {
      loadData();
    } else {
      setIsLoading(false);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [authSession, loadData]);

  // Handler: Tambah Lahan Baru
  const handleSaveLand = async (
    landData: Omit<Land, 'id' | 'farmerId' | 'createdAt' | 'updatedAt'>
  ) => {
    const currentFarmerId = authSession?.farmer?.id || farmer?.id || 'farmer-default';
    const now = new Date().toISOString();

    const newLand: Land = {
      ...landData,
      id: `land-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      farmerId: currentFarmerId,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    await landRepository.create(newLand);
    await loadData();
    setIsAddLandModalOpen(false);
    setSelectedLandId(newLand.id);
  };

  // Handler: Buka Modal Mulai Musim
  const handleOpenStartSeasonModal = (landOrLandId?: Land | string) => {
    if (typeof landOrLandId === 'string') {
      const found = lands.find((l) => l.id === landOrLandId);
      setTargetLandForSeason(found || (lands.length > 0 ? lands[0] : null));
    } else if (landOrLandId) {
      setTargetLandForSeason(landOrLandId);
    } else if (selectedLandId) {
      const current = lands.find((l) => l.id === selectedLandId);
      setTargetLandForSeason(current || (lands.length > 0 ? lands[0] : null));
    } else {
      setTargetLandForSeason(lands.length > 0 ? lands[0] : null);
    }
    setIsStartSeasonModalOpen(true);
  };

  // Handler: Simpan Musim Tanam Baru
  const handleSaveCropSeason = async (
    seasonData: Omit<CropSeason, 'id' | 'status' | 'createdAt' | 'updatedAt'>
  ) => {
    const now = new Date().toISOString();

    const newSeason: CropSeason = {
      ...seasonData,
      id: `season-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    await cropSeasonRepository.create(newSeason);
    await loadData();
    setIsStartSeasonModalOpen(false);
    setTargetLandForSeason(null);
  };

  // Handler: Update Profil Petani
  const handleUpdateFarmer = async (updates: Partial<Farmer>) => {
    if (!farmer) return;
    const updated = { ...farmer, ...updates, updatedAt: new Date().toISOString() };
    await farmerRepository.update(farmer.id, updated);
    authClientService.updateCurrentFarmerProfile(updates);
    setFarmer(updated);
  };

  // Handler: Navigasi Lintas Modul ke Informasi
  const handleNavigateToKnowledge = (
    category: 'opt' | 'pupuk' | 'musuh_alami' | 'varietas' | 'panduan',
    itemId?: string
  ) => {
    setKnowledgeNavigationTarget({ category, itemId });
    setActiveTab('informasi');
  };

  // Handler: Jalankan Uji Diagnostik Sistem (Langkah 14)
  const handleRunDiagnostics = async () => {
    setIsTestingRunning(true);
    try {
      console.log('--- [HIKMAT TANI] Memulai Pengujian Diagnostik Otomatis ---');
      await runDatabaseTests();
      await runEngineTests();
      await runBackupTests();
      alert('Semua pengujian diagnostik (Database, Engine, Backup) berhasil 100%!');
    } catch (err: any) {
      alert(`Kegagalan pengujian diagnostik: ${err?.message || 'Error tidak diketahui'}`);
    } finally {
      setIsTestingRunning(false);
    }
  };

  // Handler: Keluar / Logout
  const handleLogout = async () => {
    await authClientService.logout();
    setAuthSession(null);
    setFarmer(null);
    setLands([]);
    setActiveSeasons([]);
    setAllActivities([]);
  };

  // Handler: Ganti Akun
  const handleSwitchAccount = async () => {
    await handleLogout();
  };

  // --------------------------------------------------------------------------
  // MANDATORY AUTHENTICATION / REGISTRATION GATE
  // --------------------------------------------------------------------------
  if (!authSession) {
    return (
      <AuthGate
        onAuthenticated={async (sess) => {
          setAuthSession(sess);
          await loadData();
        }}
      />
    );
  }

  // --------------------------------------------------------------------------
  // MAIN DASHBOARD (AUTHENTICATED & ISOLATED)
  // --------------------------------------------------------------------------
  return (
    <AppLayout activeTab={activeTab} onSelectTab={setActiveTab}>
      {/* 1. Tab Beranda */}
      {activeTab === 'beranda' && (
        <BerandaView
          lands={lands}
          activeSeasons={activeSeasons}
          allActivities={allActivities}
          fertilizers={fertilizers}
          varieties={varieties}
          opts={opts}
          selectedLandId={selectedLandId}
          onSelectLandId={setSelectedLandId}
          onNavigateToTab={setActiveTab}
          onNavigateToKnowledge={handleNavigateToKnowledge}
          onOpenAddLand={() => setIsAddLandModalOpen(true)}
          onOpenStartSeason={handleOpenStartSeasonModal}
          onRefreshData={loadData}
        />
      )}

      {/* 2. Tab Lahan */}
      {activeTab === 'lahan' && (
        <LahanView
          lands={lands}
          activeSeasons={activeSeasons}
          varieties={varieties}
          selectedLandId={selectedLandId}
          onSelectLandId={setSelectedLandId}
          onNavigateToTab={setActiveTab}
          onOpenAddLand={() => setIsAddLandModalOpen(true)}
          onOpenStartSeason={(land) => handleOpenStartSeasonModal(land)}
          onRefreshData={loadData}
        />
      )}

      {/* 3. Tab Kegiatan */}
      {activeTab === 'kegiatan' && (
        <KegiatanView
          lands={lands}
          activeSeasons={activeSeasons}
          allActivities={allActivities}
          fertilizers={fertilizers}
          varieties={varieties}
          opts={opts}
          selectedLandId={selectedLandId}
          onSelectLandId={setSelectedLandId}
          onNavigateToKnowledge={handleNavigateToKnowledge}
          onRefreshData={loadData}
        />
      )}

      {/* 4. Tab Informasi */}
      {activeTab === 'informasi' && (
        <InformasiView
          varieties={varieties}
          fertilizers={fertilizers}
          opts={opts}
          naturalEnemies={naturalEnemies}
          articles={articles}
          references={references}
          activeSeasons={activeSeasons}
          lands={lands}
          navigationTarget={knowledgeNavigationTarget}
          onClearNavigationTarget={() => setKnowledgeNavigationTarget(null)}
          onRefreshKnowledge={loadData}
        />
      )}

      {/* 5. Tab Saya (Termasuk "Dukung HIKMAT TANI") */}
      {activeTab === 'saya' && (
        <SayaView
          farmer={farmer}
          authSession={authSession}
          isOnline={isOnline}
          lands={lands}
          seasons={activeSeasons}
          activities={allActivities}
          fertilizerApps={allFertApps}
          optObservations={allOptObs}
          onUpdateFarmer={handleUpdateFarmer}
          onRefreshData={loadData}
          onRunDiagnostics={handleRunDiagnostics}
          onLogout={handleLogout}
          onSwitchAccount={handleSwitchAccount}
          isTestingRunning={isTestingRunning}
        />
      )}

      {/* Modal Tambah Lahan */}
      <AddLandModal
        isOpen={isAddLandModalOpen}
        onClose={() => setIsAddLandModalOpen(false)}
        onSave={handleSaveLand}
      />

      {/* Modal Mulai Musim Tanam */}
      <StartSeasonModal
        isOpen={isStartSeasonModalOpen}
        onClose={() => {
          setIsStartSeasonModalOpen(false);
          setTargetLandForSeason(null);
        }}
        land={targetLandForSeason}
        allLands={lands}
        varieties={varieties}
        onSave={handleSaveCropSeason}
      />
    </AppLayout>
  );
}
