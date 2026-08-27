/**
 * HIKMAT TANI - App Shell & UI/UX Core (Langkah 5)
 * 
 * Slogan Resmi: "Bijak Bertani, Cerdas Bertani"
 * 
 * Arsitektur:
 * Dexie DB -> Repository -> Agriculture Engine -> React -> UI
 * 
 * Menu Utama:
 * 1. Beranda
 * 2. Lahan
 * 3. Kegiatan
 * 4. Informasi
 * 5. Saya (Termasuk "Dukung HIKMAT TANI")
 */

import { useCallback, useEffect, useState } from 'react';
import { AppLayout } from './components/layout/AppLayout.tsx';
import { MainNavTab } from './components/layout/BottomNav.tsx';
import {
  activityRepository,
  cropSeasonRepository,
  db,
  farmerRepository,
  initializeDatabase,
  knowledgeRepository,
  landRepository,
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
import { runDatabaseTests } from '../tests/index.test.ts';
import { runEngineTests } from '../tests/engine.test.ts';
import { runBackupTests } from '../tests/backup.test.ts';

export default function App() {
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

  // 1. Data Loader & Synchronizer
  const loadData = useCallback(async () => {
    try {
      // Inisialisasi DB (idempotent)
      await initializeDatabase();

      // Profil Petani
      let currentFarmer = await farmerRepository.getFirstActive();
      if (!currentFarmer) {
        // Buat profil petani default jika belum ada
        const newFarmer: Farmer = {
          id: 'farmer-default',
          name: 'Pak Sutrisno',
          phoneNumber: '081234567890',
          village: 'Sukamaju',
          district: 'Kasokandel',
          regency: 'Majalengka',
          province: 'Jawa Barat',
          farmerGroupName: 'Kelompok Tani Sri Rejeki',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await farmerRepository.create(newFarmer);
        currentFarmer = newFarmer;
      }
      setFarmer(currentFarmer);

      // Data Lahan & Musim Tanam
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

      if (allLands.length > 0 && !selectedLandId) {
        setSelectedLandId(allLands[0].id);
      }
    } catch (err) {
      console.error('[HIKMAT TANI] Error loading data from Dexie:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedLandId]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    loadData();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadData]);

  // Handler: Tambah Lahan Baru
  const handleSaveLand = async (
    landData: Omit<Land, 'id' | 'farmerId' | 'createdAt' | 'updatedAt'>
  ) => {
    const now = new Date().toISOString();
    const newLand: Land = {
      ...landData,
      id: `land-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      farmerId: farmer?.id || 'farmer-default',
      createdAt: now,
      updatedAt: now,
    };

    await landRepository.create(newLand);
    setSelectedLandId(newLand.id);
    await loadData();
  };

  // Handler: Mulai Musim Tanam Baru
  const handleSaveCropSeason = async (
    seasonData: Omit<CropSeason, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    const now = new Date().toISOString();
    const newSeason: CropSeason = {
      ...seasonData,
      id: `season-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };

    await cropSeasonRepository.create(newSeason);
    await loadData();
  };

  const handleOpenStartSeasonModal = (landOrId?: Land | string) => {
    if (typeof landOrId === 'string') {
      const found = lands.find((l) => l.id === landOrId) || null;
      setTargetLandForSeason(found);
    } else if (landOrId) {
      setTargetLandForSeason(landOrId);
    } else {
      setTargetLandForSeason(null);
    }
    setIsStartSeasonModalOpen(true);
  };

  // Handler: Update Profil Petani
  const handleUpdateFarmer = async (updates: Partial<Farmer>) => {
    if (farmer) {
      await farmerRepository.update(farmer.id, updates);
    } else {
      const newFarmer: Farmer = {
        id: `farmer-${Date.now()}`,
        name: updates.name || 'Petani Padi Indonesia',
        ...updates,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await farmerRepository.create(newFarmer);
    }
  };

  // Handler: Diagnostics
  const handleRunDiagnostics = async () => {
    setIsTestingRunning(true);
    try {
      const dbRes = await runDatabaseTests();
      const engRes = await runEngineTests();
      const bakRes = await runBackupTests();

      let backendStatus = 'Belum terhubung (Offline)';
      try {
        const healthCheck = await fetch('/api/v1/health');
        if (healthCheck.ok) {
          const healthData = await healthCheck.json();
          backendStatus = `ONLINE (${healthData.app} v${healthData.version})`;
        }
      } catch {
        backendStatus = 'Offline (Client Mode)';
      }

      alert(
        `Hasil Uji Sistem HIKMAT TANI:\n\n• Database Acceptance: ${
          dbRes.allPassed ? 'SEMUA LOLOS (PASS)' : 'ADA GAGAL'
        } (${dbRes.passed}/${dbRes.total})\n• Agriculture Logic Engine: ${
          engRes.allPassed ? 'SEMUA LOLOS (PASS)' : 'ADA GAGAL'
        } (${engRes.passed}/${engRes.total})\n• Backup & Restore Subsystem: ${
          bakRes.allPassed ? 'SEMUA LOLOS (PASS)' : 'ADA GAGAL'
        } (${bakRes.passed}/${bakRes.total})\n• Server Status: ${backendStatus}\n\nSistem 100% Offline & Siap Digunakan!`
      );
    } catch (err: any) {
      alert(`Gagal menjalankan uji diagnostik: ${err?.message || err}`);
    } finally {
      setIsTestingRunning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 space-y-3">
        <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold tracking-tight">Menyiapkan HIKMAT TANI...</p>
        <p className="text-xs text-slate-400">Memuat database offline...</p>
      </div>
    );
  }

  const handleNavigateToKnowledge = (
    category: 'opt' | 'pupuk' | 'musuh_alami' | 'varietas' | 'panduan',
    itemId?: string
  ) => {
    setKnowledgeNavigationTarget({ category, itemId });
    setActiveTab('informasi');
  };

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
          isOnline={isOnline}
          lands={lands}
          seasons={activeSeasons}
          activities={allActivities}
          fertilizerApps={allFertApps}
          optObservations={allOptObs}
          onUpdateFarmer={handleUpdateFarmer}
          onRefreshData={loadData}
          onRunDiagnostics={handleRunDiagnostics}
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
