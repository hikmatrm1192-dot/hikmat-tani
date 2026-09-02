/**
 * HIKMAT TANI - Peta Pertanian View (Satellite 2D Map View)
 * 
 * Filosofi:
 * "Peta Satelit 2D Lapang Berbasis GPS & Petak Sawah m²."
 * 
 * Modul Terpadu:
 * 1. Peta Satelit 2D & Hibrid / Jalan
 * 2. GPS Geolocation real-time & tracking
 * 3. Gambar Petak Sawah (Polygon Drawer) m² dengan tap capture prioritas
 * 4. Batas Wilayah Administrasi 4 Tingkat Resmi (BIG & Kemendagri):
 *    - Batas Desa/Kelurahan
 *    - Batas Kecamatan
 *    - Batas Kabupaten/Kota
 *    - Batas Provinsi
 * 5. Marker Pengamatan OPT, Pemupukan, Pengairan, Panen & Perawatan
 * 6. Peta Indikasi Kekeringan 5 Tingkat Standar
 */

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Bug,
  Calendar,
  Compass,
  Droplets,
  Layers,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Sprout,
  Wheat,
  X,
} from 'lucide-react';
import {
  Activity,
  ActivityCategory,
  CropSeason,
  DroughtZoneFeature,
  Land,
  Opt,
  OptObservation,
  RiceVariety,
  VillageBoundaryFeature,
  WeatherData,
} from '../../types/index.ts';
import {
  ADMIN_MAP_CONFIG,
  AdministrativeFeature,
  BoundingBox,
} from '../../types/administrativeBoundary.ts';
import { authClientService } from '../../services/authClientService.ts';
import { bigGeospatialService } from '../../services/bigGeospatialService.ts';
import { AgriculturalMap, BaseMapType, MapLayerVisibility } from './AgriculturalMap.tsx';

import { MapLayerControl } from './MapLayerControl.tsx';
import { PolygonDrawerControls } from './PolygonDrawerControls.tsx';
import { ParcelDetailDrawer } from './ParcelDetailDrawer.tsx';
import { DroughtLegendModal } from './DroughtLegendModal.tsx';
import { SaveDrawnParcelModal } from './SaveDrawnParcelModal.tsx';
import { AdminBoundaryDetailModal } from './AdminBoundaryDetailModal.tsx';
import { SAMPLE_DROUGHT_ZONES } from '../../engine/droughtEngine.ts';
import { LatLngPoint } from '../../utils/geoUtils.ts';
import { landRepository } from '../../db/repositories/landRepository.ts';
import { ActivityDetailModal } from '../kegiatan/ActivityDetailModal.tsx';

interface PetaPertanianViewProps {
  lands: Land[];
  activeSeasons: CropSeason[];
  allActivities?: Activity[];
  allOptObs?: OptObservation[];
  varieties?: RiceVariety[];
  opts?: Opt[];
  weather?: WeatherData | null;
  selectedLandId?: string | null;
  onSelectLandId?: (landId: string) => void;
  onOpenAddActivity?: (category?: ActivityCategory, landId?: string) => void;
  onOpenStartSeason?: (land: Land) => void;
  onRefreshData?: () => Promise<void>;
  onNavigateToTab?: (tab: 'beranda' | 'lahan' | 'kegiatan' | 'informasi' | 'saya' | 'cuaca') => void;
}

export function PetaPertanianView({
  lands,
  activeSeasons,
  allActivities = [],
  allOptObs = [],
  varieties = [],
  opts = [],
  weather,
  selectedLandId,
  onSelectLandId,
  onOpenAddActivity,
  onOpenStartSeason,
  onRefreshData,
  onNavigateToTab,
}: PetaPertanianViewProps) {
  // Base map & layer settings
  const [baseMapType, setBaseMapType] = useState<BaseMapType>('hybrid');
  const [layerVisibility, setLayerVisibility] = useState<MapLayerVisibility>({
    showSatellite: true,
    showParcels: true,
    showGps: true,
    showOptMarkers: true,
    showFertilizerMarkers: true,
    showIrrigationMarkers: true,
    showMaintenanceMarkers: true,
    showHarvestMarkers: true,
    showDroughtOverlay: false,
    showWeatherLayer: true,
    showVillageBoundaries: true,
    showDistrictBoundaries: true,
    showRegencyBoundaries: true,
    showProvinceBoundaries: true,
  });

  // 4-Level Administrative Boundaries State (Resmi BIG & Kemendagri)
  const [villageBoundaries, setVillageBoundaries] = useState<VillageBoundaryFeature[]>([]);
  const [districtBoundaries, setDistrictBoundaries] = useState<AdministrativeFeature[]>([]);
  const [regencyBoundaries, setRegencyBoundaries] = useState<AdministrativeFeature[]>([]);
  const [provinceBoundaries, setProvinceBoundaries] = useState<AdministrativeFeature[]>([]);
  const [selectedAdminFeature, setSelectedAdminFeature] = useState<AdministrativeFeature | VillageBoundaryFeature | null>(null);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);

  // Inisialisasi batas wilayah tingkat makro (Provinsi & Kabupaten) yang ringan
  useEffect(() => {
    const regencies = bigGeospatialService.getRegenciesByProvinceCode('32');
    const provinces = bigGeospatialService.getAllProvinces();

    setRegencyBoundaries(regencies);
    setProvinceBoundaries(provinces);
  }, []);

  // Progressive Viewport & Zoom LOD Handler untuk Kecamatan & Desa
  const handleViewportChange = useCallback((viewport: BoundingBox, zoom: number) => {
    // Progressive LOD untuk Kecamatan
    if (layerVisibility.showDistrictBoundaries && zoom >= ADMIN_MAP_CONFIG.zoomLevels.districtMinZoom) {
      const districts = bigGeospatialService.getViewportBoundaries('DISTRICT', viewport, zoom);
      setDistrictBoundaries(districts);
    } else if (zoom < ADMIN_MAP_CONFIG.zoomLevels.districtMinZoom) {
      setDistrictBoundaries((prev) => (prev.length > 0 ? [] : prev));
    }

    // Progressive LOD untuk Desa / Kelurahan
    if (layerVisibility.showVillageBoundaries && zoom >= ADMIN_MAP_CONFIG.zoomLevels.villageMinZoom) {
      const villages = bigGeospatialService.getViewportVillages(viewport, zoom);
      setVillageBoundaries(villages);
    } else if (zoom < ADMIN_MAP_CONFIG.zoomLevels.villageMinZoom) {
      setVillageBoundaries((prev) => (prev.length > 0 ? [] : prev));
    }
  }, [layerVisibility.showDistrictBoundaries, layerVisibility.showVillageBoundaries]);

  // GPS State
  const [userGps, setUserGps] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // Preload vicinity cache saat GPS terdeteksi
  useEffect(() => {
    if (userGps) {
      bigGeospatialService.preloadVicinity({ lat: userGps.lat, lng: userGps.lng }, 5);
    }
  }, [userGps]);


  // Drawing Polygon State
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(false);
  const [drawingPoints, setDrawingPoints] = useState<LatLngPoint[]>([]);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
  const [savedAreaM2, setSavedAreaM2] = useState<number>(0);
  const [savedPerimeterM, setSavedPerimeterM] = useState<number>(0);

  // Selected Parcel Drawer
  const [selectedParcel, setSelectedParcel] = useState<Land | null>(null);

  // Modals & Popups
  const [isDroughtLegendOpen, setIsDroughtLegendOpen] = useState<boolean>(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  // Search input
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Land[]>([]);

  // Mengambil GPS pengguna secara santun & aman
  const requestGpsLocation = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGpsError('Perangkat Anda tidak mendukung fitur GPS Geolocation.');
      return;
    }

    setIsLocating(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        setUserGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        setIsLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError('Izin akses lokasi belum diberikan. Aktifkan GPS pada pengaturan browser/HP Anda.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGpsError('Sinyal GPS tidak ditemukan saat ini. Pastikan Anda berada di luar ruangan.');
        } else {
          setGpsError('Gagal mendeteksi lokasi GPS. Coba beberapa saat lagi.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // Inisialisasi GPS saat pertama kali masuk ke peta
  useEffect(() => {
    requestGpsLocation();
  }, [requestGpsLocation]);

  // Set selected parcel jika selectedLandId diberikan dari luar
  useEffect(() => {
    if (selectedLandId) {
      const match = lands.find((l) => l.id === selectedLandId);
      if (match) setSelectedParcel(match);
    }
  }, [selectedLandId, lands]);

  // Toggle layer
  const handleToggleLayer = (key: keyof MapLayerVisibility) => {
    setLayerVisibility((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Drawing Handlers
  const handleStartDrawing = () => {
    setIsDrawingMode(true);
    setDrawingPoints([]);
    setSelectedParcel(null);
  };

  const handleAddDrawingPoint = (pt: LatLngPoint) => {
    setDrawingPoints((prev) => [...prev, pt]);
  };

  const handleUndoPoint = () => {
    setDrawingPoints((prev) => prev.slice(0, -1));
  };

  const handleClearPoints = () => {
    setDrawingPoints([]);
  };

  const handleCancelDrawing = () => {
    setIsDrawingMode(false);
    setDrawingPoints([]);
  };

  const handleAddGpsToDraw = () => {
    if (userGps) {
      handleAddDrawingPoint({ lat: userGps.lat, lng: userGps.lng });
    } else {
      if (typeof window !== 'undefined' && navigator.geolocation) {
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setIsLocating(false);
            const pt = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setUserGps({ ...pt, accuracy: pos.coords.accuracy });
            handleAddDrawingPoint(pt);
          },
          (err) => {
            setIsLocating(false);
            setGpsError('Gagal mendeteksi koordinat GPS saat ini. Pastikan izin lokasi aktif.');
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      } else {
        requestGpsLocation();
      }
    }
  };

  const handleCompleteDraw = (areaM2: number, perimeterM: number) => {
    setSavedAreaM2(areaM2);
    setSavedPerimeterM(perimeterM);
    setIsSaveModalOpen(true);
  };

  const handleSaveLandSuccess = async (
    landData: Omit<Land, 'id' | 'farmerId' | 'createdAt' | 'updatedAt'>
  ) => {
    const session = authClientService.getSession();
    const currentFarmerId = session?.farmer?.id || 'farmer-default';
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
    setIsDrawingMode(false);
    setDrawingPoints([]);
    setIsSaveModalOpen(false);
    setSelectedParcel(newLand);
    if (onSelectLandId) {
      onSelectLandId(newLand.id);
    }
    if (onRefreshData) {
      await onRefreshData();
    }
  };

  // Search Filter
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const matches = lands.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.location && l.location.toLowerCase().includes(q))
    );
    setSearchResults(matches);
  }, [searchQuery, lands]);

  const activeSeasonForSelected = selectedParcel
    ? activeSeasons.find((s) => s.landId === selectedParcel.id && s.status === 'ACTIVE') || null
    : null;

  return (
    <div className="relative w-full h-[calc(100vh-130px)] md:h-[calc(100vh-80px)] overflow-hidden font-sans select-none rounded-2xl border border-slate-200/80 shadow-md">
      {/* Top Floating Action Bar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between gap-2 pointer-events-none">
        {/* Left Side: Search & Layers */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <MapLayerControl
            baseMapType={baseMapType}
            onChangeBaseMap={setBaseMapType}
            layerVisibility={layerVisibility}
            onToggleLayer={handleToggleLayer}
            onOpenDroughtLegend={() => setIsDroughtLegendOpen(true)}
          />

          <button
            type="button"
            onClick={() => setIsDroughtLegendOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-amber-500/90 hover:bg-amber-500 text-slate-950 font-bold rounded-xl shadow-md text-xs backdrop-blur-md transition-all active:scale-95 min-h-[42px]"
          >
            <ShieldAlert className="w-4 h-4 text-slate-950" />
            <span>Peta Kekeringan</span>
          </button>
        </div>

        {/* Right Side: + Gambar Petak Sawah */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {!isDrawingMode && (
            <button
              type="button"
              onClick={handleStartDrawing}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold rounded-xl shadow-lg text-xs transition-all active:scale-95 min-h-[42px]"
            >
              <Plus className="w-4 h-4" />
              <span>+ Gambar Petak (m²)</span>
            </button>
          )}
        </div>
      </div>

      {/* GPS Error Banner if any */}
      {gpsError && (
        <div className="absolute top-16 left-4 right-4 z-20 max-w-md mx-auto bg-amber-50/95 border border-amber-200 text-amber-900 rounded-2xl p-3 shadow-lg flex items-center justify-between text-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{gpsError}</span>
          </div>
          <button
            type="button"
            onClick={() => setGpsError(null)}
            className="p-1 text-amber-600 hover:text-amber-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Drawing Controls if in Drawing Mode */}
      {isDrawingMode && (
        <PolygonDrawerControls
          points={drawingPoints}
          onUndoPoint={handleUndoPoint}
          onClearPoints={handleClearPoints}
          onCancelDraw={handleCancelDrawing}
          onAddGpsPoint={handleAddGpsToDraw}
          onCompleteDraw={handleCompleteDraw}
        />
      )}

      {/* Fullscreen Satellite Map Component with 4-Level Boundaries */}
      <AgriculturalMap
        lands={lands}
        activeSeasons={activeSeasons}
        activities={allActivities}
        optObservations={allOptObs}
        droughtZones={SAMPLE_DROUGHT_ZONES}
        villageBoundaries={villageBoundaries}
        districtBoundaries={districtBoundaries}
        regencyBoundaries={regencyBoundaries}
        provinceBoundaries={provinceBoundaries}
        selectedLandId={selectedParcel?.id || selectedLandId}
        baseMapType={baseMapType}
        layerVisibility={layerVisibility}
        isDrawingMode={isDrawingMode}
        drawingPoints={drawingPoints}
        onAddDrawingPoint={handleAddDrawingPoint}
        onSelectLand={(land) => {
          setSelectedParcel(land);
          if (onSelectLandId) onSelectLandId(land.id);
        }}
        onSelectActivity={(act) => setSelectedActivity(act)}
        onSelectOptObs={(optObs, parentAct) => {
          if (parentAct) setSelectedActivity(parentAct);
        }}
        onSelectDroughtZone={(zone) => {
          setIsDroughtLegendOpen(true);
        }}
        onSelectVillage={(village) => {
          setSelectedAdminFeature(village);
          setIsAdminModalOpen(true);
        }}
        onSelectAdminFeature={(feature) => {
          setSelectedAdminFeature(feature);
          setIsAdminModalOpen(true);
        }}
        onViewportChange={handleViewportChange}
        userGps={userGps}
        onGpsRequested={requestGpsLocation}
      />

      {/* Bottom Selected Parcel Drawer */}
      {selectedParcel && (
        <ParcelDetailDrawer
          land={selectedParcel}
          activeSeason={activeSeasonForSelected}
          activities={allActivities}
          optObservations={allOptObs}
          weather={weather}
          onClose={() => setSelectedParcel(null)}
          onOpenAddActivity={(cat) => {
            if (onOpenAddActivity) onOpenAddActivity(cat, selectedParcel.id);
          }}
          onOpenOptObservation={() => {
            if (onOpenAddActivity) onOpenAddActivity('OPT', selectedParcel.id);
          }}
          onOpenStartSeason={(land) => {
            if (onOpenStartSeason) onOpenStartSeason(land);
          }}
          onOpenDroughtLegend={() => setIsDroughtLegendOpen(true)}
        />
      )}

      {/* Drought Standard Legend Modal */}
      <DroughtLegendModal
        isOpen={isDroughtLegendOpen}
        onClose={() => setIsDroughtLegendOpen(false)}
      />

      {/* 4-Level Administrative Boundary Detail Modal (BIG & Kemendagri) */}
      <AdminBoundaryDetailModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        feature={selectedAdminFeature}
      />

      {/* Save Drawn Parcel Modal */}
      <SaveDrawnParcelModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        points={drawingPoints}
        areaM2={savedAreaM2}
        perimeterM={savedPerimeterM}
        onSave={handleSaveLandSuccess}
      />

      {/* Activity Details Modal */}
      {selectedActivity && (
        <ActivityDetailModal
          isOpen={Boolean(selectedActivity)}
          onClose={() => setSelectedActivity(null)}
          activity={selectedActivity}
          land={
            lands.find((l) => {
              const season = activeSeasons.find((s) => s.id === selectedActivity.cropSeasonId);
              return l.id === season?.landId;
            }) || null
          }
          cropSeason={activeSeasons.find((s) => s.id === selectedActivity.cropSeasonId) || null}
          fertilizerApps={[]}
          optObs={allOptObs.filter((o) => o.activityId === selectedActivity.id)}
          opts={opts}
        />
      )}
    </div>
  );
}
