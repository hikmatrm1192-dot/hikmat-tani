/**
 * HIKMAT TANI - Modul "Prakiraan Cuaca & Pertanian" (CuacaView)
 * 
 * Filosofi: "CERDAS BERTANI, BIJAK MENGAMBIL KEPUTUSAN."
 * 
 * Fitur:
 * 1. Prakiraan Cuaca Jangka Pendek (1–10 Hari) dengan metrik lengkap & tingkat risiko.
 * 2. Prakiraan Jangka Menengah (2–4 Minggu) dengan pendekatan agroklimat probabilistik.
 * 3. Outlook 1–3 Bulan (Kecenderungan sifat hujan bulanan & panduan tata air).
 * 4. Rekomendasi Pertanian Praktis terintegrasi data riil (HST, fase, pupuk, semprot, OPT, panen).
 * 5. Peringatan & Mitigasi Risiko Cuaca Ekstrem.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Compass,
  Droplets,
  HelpCircle,
  Info,
  Layers,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Sprout,
  Sun,
  Thermometer,
  Wheat,
  Wind,
} from 'lucide-react';
import {
  Activity,
  CropSeason,
  FertilizerApplication,
  Land,
  OptObservation,
  RiceVariety,
  WeatherConditionType,
  WeatherData,
} from '../../types/index.ts';
import { clientWeatherService, ClientWeatherService } from '../../services/weatherService.ts';
import { WeatherAgriEngine } from '../../engine/weatherAgriEngine.ts';
import { ShortTermForecast } from './ShortTermForecast.tsx';
import { MediumTermForecast } from './MediumTermForecast.tsx';
import { SeasonalOutlook } from './SeasonalOutlook.tsx';
import { AgriRecommendations } from './AgriRecommendations.tsx';
import { WeatherAlerts } from './WeatherAlerts.tsx';

interface CuacaViewProps {
  lands: Land[];
  activeSeasons: CropSeason[];
  allActivities: Activity[];
  allFertApps: FertilizerApplication[];
  allOptObs: OptObservation[];
  varieties: RiceVariety[];
  onNavigateToTab?: (tab: any) => void;
}

type WeatherViewTab = 'saran' | 'harian' | 'mingguan' | 'musiman';

export function CuacaView({
  lands,
  activeSeasons,
  allActivities,
  allFertApps,
  allOptObs,
  varieties,
  onNavigateToTab,
}: CuacaViewProps) {
  // Tab view state
  const [activeSubTab, setActiveSubTab] = useState<WeatherViewTab>('saran');

  // Selected land for coordinates & crop season context
  const [selectedLandId, setSelectedLandId] = useState<string>(() => {
    return lands.length > 0 ? lands[0].id : '';
  });

  // Weather data state
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [refreshMessage, setRefreshMessage] = useState<string>('');

  // Selected Land & active season derivation
  const activeLand = useMemo(() => {
    if (!selectedLandId) return lands[0] || null;
    return lands.find((l) => l.id === selectedLandId) || lands[0] || null;
  }, [lands, selectedLandId]);

  const activeSeason = useMemo(() => {
    if (!activeLand) return activeSeasons[0] || null;
    return activeSeasons.find((s) => s.landId === activeLand.id) || null;
  }, [activeLand, activeSeasons]);

  // Coordinates
  const coordinates = useMemo(() => {
    if (activeLand && activeLand.latitude && activeLand.longitude) {
      return { lat: activeLand.latitude, lon: activeLand.longitude };
    }
    // Default sentra padi Karawang (-6.25, 107.45)
    return { lat: -6.25, lon: 107.45 };
  }, [activeLand]);

  // Fetch weather data
  const loadWeather = useCallback(
    async (forceRefresh = false) => {
      setIsLoading(true);
      try {
        const result = await clientWeatherService.getWeather(coordinates.lat, coordinates.lon, {
          forceRefresh,
        });

        if (result.data) {
          setWeatherData(result.data);
          setRefreshMessage(result.message);
        }
      } catch (err: any) {
        console.warn('Gagal memuat cuaca:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [coordinates.lat, coordinates.lon]
  );

  useEffect(() => {
    loadWeather(false);
  }, [loadWeather]);

  // Evaluasi cerdas keterpaduan cuaca & agronomi
  const agriEvaluation = useMemo(() => {
    return WeatherAgriEngine.evaluate({
      land: activeLand,
      cropSeason: activeSeason,
      activities: allActivities,
      fertilizerApplications: allFertApps,
      optObservations: allOptObs,
      varieties,
      weatherData,
    });
  }, [activeLand, activeSeason, allActivities, allFertApps, allOptObs, varieties, weatherData]);

  // Weather condition icon helper
  const renderWeatherIcon = (type?: WeatherConditionType, className = 'w-7 h-7') => {
    switch (type) {
      case 'CLEAR':
        return <Sun className={`${className} text-amber-500`} />;
      case 'PARTLY_CLOUDY':
        return <CloudSun className={`${className} text-amber-500`} />;
      case 'CLOUDY':
        return <Cloud className={`${className} text-slate-500`} />;
      case 'FOG':
        return <CloudFog className={`${className} text-slate-400`} />;
      case 'DRIZZLE':
        return <CloudDrizzle className={`${className} text-sky-500`} />;
      case 'LIGHT_RAIN':
      case 'MODERATE_RAIN':
        return <CloudRain className={`${className} text-blue-500`} />;
      case 'HEAVY_RAIN':
        return <CloudRain className={`${className} text-indigo-600`} />;
      case 'THUNDERSTORM':
        return <CloudLightning className={`${className} text-purple-600`} />;
      default:
        return <CloudSun className={`${className} text-amber-500`} />;
    }
  };

  const current = weatherData?.current;
  const todayForecast = weatherData?.daily?.[0];

  return (
    <div className="space-y-4 pb-12 max-w-4xl mx-auto">
      {/* Header Utama Modul */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
              <CloudSun className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                Prakiraan Cuaca & Pertanian
              </h1>
              <p className="text-[10px] sm:text-[11px] font-bold text-emerald-800 tracking-wide">
                CERDAS BERTANI, BIJAK MENGAMBIL KEPUTUSAN
              </p>
            </div>
          </div>
        </div>

        {/* Pemilih Lahan & Tombol Refresh */}
        <div className="flex items-center gap-2 flex-wrap">
          {lands.length > 1 && (
            <div className="relative min-w-[140px] max-w-[200px]">
              <select
                id="land-weather-selector"
                value={selectedLandId}
                onChange={(e) => setSelectedLandId(e.target.value)}
                className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 pr-7 appearance-none focus:outline-emerald-600 focus:bg-white truncate"
              >
                {lands.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
            </div>
          )}

          <button
            type="button"
            id="refresh-weather-btn"
            onClick={() => loadWeather(true)}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 px-3 py-1.5 rounded-xl border border-slate-200 transition-all disabled:opacity-50"
            title="Perbarui data cuaca"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-700' : ''}`} />
            <span>{isLoading ? 'Memuat...' : 'Perbarui'}</span>
          </button>
        </div>
      </div>

      {/* Hero Card Cuaca Hari Ini & Risiko */}
      <div className="bg-gradient-to-br from-emerald-800 via-teal-900 to-slate-900 text-white rounded-3xl p-4 sm:p-5 shadow-sm space-y-4">
        {/* Lokasi & Status Waktu */}
        <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-emerald-200">
            <MapPin className="w-4 h-4 shrink-0 text-emerald-300" />
            <span className="truncate">{agriEvaluation.locationDisplayName}</span>
          </div>

          <div className="text-[10px] sm:text-[11px] text-emerald-200/80 font-medium">
            {current?.updatedAt ? ClientWeatherService.formatUpdatedTime(current.updatedAt) : 'Prakiraan Terkini'}
          </div>
        </div>

        {/* Kondisi Utama Suhu & Cuaca */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center shrink-0">
              {renderWeatherIcon(current?.conditionType, 'w-8 h-8 sm:w-10 sm:h-10')}
            </div>

            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-black tracking-tight">
                  {current?.temperature !== undefined ? Math.round(current.temperature) : 29}
                </span>
                <span className="text-lg font-bold text-emerald-300">°C</span>
              </div>
              <div className="text-xs sm:text-sm font-extrabold text-white">
                {current?.condition || 'Cerah Berawan'}
              </div>
            </div>
          </div>

          {/* Quick Metrics (Peluang Hujan, Kelembapan, Angin) */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-white/10 backdrop-blur-xs p-2 rounded-xl border border-white/10">
              <div className="flex items-center justify-center gap-1 text-[10px] text-emerald-200 font-semibold">
                <CloudRain className="w-3.5 h-3.5 text-sky-300" />
                <span>Hujan</span>
              </div>
              <div className="font-extrabold text-sm text-white mt-0.5">
                {current?.rainProbability || 20}%
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-xs p-2 rounded-xl border border-white/10">
              <div className="flex items-center justify-center gap-1 text-[10px] text-emerald-200 font-semibold">
                <Droplets className="w-3.5 h-3.5 text-sky-300" />
                <span>Lembap</span>
              </div>
              <div className="font-extrabold text-sm text-white mt-0.5">
                {current?.humidity || 75}%
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-xs p-2 rounded-xl border border-white/10">
              <div className="flex items-center justify-center gap-1 text-[10px] text-emerald-200 font-semibold">
                <Wind className="w-3.5 h-3.5 text-emerald-300" />
                <span>Angin</span>
              </div>
              <div className="font-extrabold text-sm text-white mt-0.5 truncate">
                {current?.windSpeed || 7} <span className="text-[10px] font-normal">km/j</span>
              </div>
            </div>
          </div>
        </div>

        {/* Ringkasan Analisis Cuaca & Agronomi */}
        <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/15 text-xs sm:text-[13px] text-emerald-100 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
          <p className="leading-relaxed font-medium">
            {agriEvaluation.summary}
          </p>
        </div>
      </div>

      {/* Weather Alerts if any */}
      <WeatherAlerts alerts={agriEvaluation.alerts} />

      {/* Navigasi Tab Sub-Modul Cuaca */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 rounded-2xl border border-slate-200 overflow-x-auto no-scrollbar">
        <button
          type="button"
          id="tab-saran-pertanian"
          onClick={() => setActiveSubTab('saran')}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap flex-1 shrink-0 ${
            activeSubTab === 'saran'
              ? 'bg-emerald-800 text-white shadow-2xs'
              : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Sprout className="w-3.5 h-3.5" />
          <span>Saran Pertanian</span>
          {agriEvaluation.recommendations.length > 0 && (
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                activeSubTab === 'saran' ? 'bg-emerald-700 text-white' : 'bg-slate-300 text-slate-800'
              }`}
            >
              {agriEvaluation.recommendations.length}
            </span>
          )}
        </button>

        <button
          type="button"
          id="tab-1-10-hari"
          onClick={() => setActiveSubTab('harian')}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap flex-1 shrink-0 ${
            activeSubTab === 'harian'
              ? 'bg-emerald-800 text-white shadow-2xs'
              : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>1–10 Hari</span>
        </button>

        <button
          type="button"
          id="tab-2-4-minggu"
          onClick={() => setActiveSubTab('mingguan')}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap flex-1 shrink-0 ${
            activeSubTab === 'mingguan'
              ? 'bg-emerald-800 text-white shadow-2xs'
              : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <CalendarRange className="w-3.5 h-3.5" />
          <span>2–4 Minggu</span>
        </button>

        <button
          type="button"
          id="tab-1-3-bulan"
          onClick={() => setActiveSubTab('musiman')}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap flex-1 shrink-0 ${
            activeSubTab === 'musiman'
              ? 'bg-emerald-800 text-white shadow-2xs'
              : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>1–3 Bulan</span>
        </button>
      </div>

      {/* Konten Tab Aktif */}
      <div className="pt-1">
        {activeSubTab === 'saran' && (
          <AgriRecommendations
            recommendations={agriEvaluation.recommendations}
            hst={agriEvaluation.hst}
            growthPhaseName={agriEvaluation.growthPhaseName}
            stageCategory={agriEvaluation.stageCategory}
            landName={agriEvaluation.activeLandName}
            daysToHarvest={agriEvaluation.daysToHarvest}
          />
        )}

        {activeSubTab === 'harian' && (
          <ShortTermForecast dailyForecasts={weatherData?.daily || []} />
        )}

        {activeSubTab === 'mingguan' && (
          <MediumTermForecast trends={weatherData?.mediumTermTrends || []} />
        )}

        {activeSubTab === 'musiman' && (
          <SeasonalOutlook outlooks={weatherData?.seasonalOutlooks || []} />
        )}
      </div>

      {/* Catatan Sumber Data & Disclaimer */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-2 text-[10px] sm:text-[11px] text-slate-500 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Sumber data: {weatherData?.dataSource || 'Open-Meteo & Agroklimatologi BMKG'}</span>
        </div>
        <span className="font-semibold text-emerald-800">
          HIKMAT TANI • Mandiri & Bebas Biaya
        </span>
      </div>
    </div>
  );
}
