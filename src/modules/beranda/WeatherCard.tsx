/**
 * HIKMAT TANI - Weather Card Component (Langkah 12)
 * 
 * Prinsip:
 * - Terintegrasi di Beranda ("Ini keadaan sawah saya sekarang").
 * - Istilah sederhana, santun, dan mudah dipahami petani lapang.
 * - Offline-First: Menampilkan data tersimpan saat tidak ada sinyal internet.
 * - Tanpa Pelacakan Latar Belakang: Menggunakan koordinat lahan aktif.
 *   Jika belum disetel, memberikan opsi deteksi lokasi perangkat atas izin pengguna.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Compass,
  Droplets,
  MapPin,
  RefreshCw,
  Sun,
  Thermometer,
  WifiOff,
  Wind,
} from 'lucide-react';
import { Land } from '../../types/index.ts';
import { WeatherConditionType, WeatherData } from '../../types/weather.ts';
import {
  clientWeatherService,
  ClientWeatherService,
} from '../../services/weatherService.ts';

interface WeatherCardProps {
  land?: Land | null;
  onUpdateLandLocation?: (lat: number, lon: number) => void;
}

export function WeatherCard({ land, onUpdateLandLocation }: WeatherCardProps) {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Pantau status online / offline browser
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Koordinat efektif: dari lahan aktif atau fallback regional (Subang/Jawa Barat sbg default sentra padi)
  const hasLandCoords =
    typeof land?.latitude === 'number' && typeof land?.longitude === 'number';

  const effectiveLat = hasLandCoords ? land.latitude! : -6.57;
  const effectiveLon = hasLandCoords ? land.longitude! : 107.75;

  const loadWeather = useCallback(
    async (forceRefresh: boolean = false) => {
      setIsLoading(true);
      setLocationError(null);
      try {
        const result = await clientWeatherService.getWeather(
          effectiveLat,
          effectiveLon,
          { forceRefresh }
        );
        if (result.data) {
          setWeatherData(result.data);
          setStatusMessage(result.message);
        } else {
          setStatusMessage(result.message || 'Informasi cuaca belum tersedia.');
        }
      } catch (err: any) {
        console.warn('Gagal memuat cuaca:', err?.message);
        setStatusMessage('Informasi cuaca belum dapat diperbarui.');
      } finally {
        setIsLoading(false);
      }
    },
    [effectiveLat, effectiveLon]
  );

  useEffect(() => {
    loadWeather(false);
  }, [loadWeather]);

  // Handler deteksi lokasi perangkat atas permintaan pengguna (tanpa background tracking)
  const handleRequestDeviceLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Perangkat Anda tidak mendukung fitur lokasi otomatis.');
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setIsLocating(false);
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        if (onUpdateLandLocation) {
          onUpdateLandLocation(lat, lon);
        }

        // Ambil cuaca untuk koordinat baru
        setIsLoading(true);
        try {
          const result = await clientWeatherService.getWeather(lat, lon, {
            forceRefresh: true,
          });
          if (result.data) {
            setWeatherData(result.data);
            setStatusMessage(result.message);
          }
        } finally {
          setIsLoading(false);
        }
      },
      (error) => {
        setIsLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError('Izin akses lokasi tidak diberikan.');
        } else {
          setLocationError('Tidak dapat menentukan lokasi saat ini.');
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  };

  // Helper ikon cuaca
  const renderWeatherIcon = (type: WeatherConditionType, className = 'w-7 h-7') => {
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
  const isDataOffline = Boolean(
    isOffline || weatherData?.isOfflineFallback || current?.source === 'FALLBACK'
  );

  return (
    <div className="bg-gradient-to-br from-sky-50/90 via-emerald-50/40 to-white border border-sky-200/80 rounded-2xl p-4 sm:p-5 shadow-xs transition-all">
      {/* Bar Header Widget Cuaca */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-sky-100/80">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-bold text-sky-950 uppercase tracking-wide">
            <Compass className="w-3.5 h-3.5 text-sky-700" />
            <span>Perkiraan Cuaca Lapang</span>
          </div>

          {land?.name && (
            <span className="inline-flex items-center gap-1 text-[11px] bg-white/90 border border-sky-200/70 text-slate-700 px-2 py-0.5 rounded-md font-medium">
              <MapPin className="w-2.5 h-2.5 text-emerald-600" />
              {land.name}
            </span>
          )}

          {isDataOffline ? (
            <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold">
              <WifiOff className="w-2.5 h-2.5" />
              Offline (Data Tersimpan)
            </span>
          ) : (
            <span className="text-[10px] bg-sky-200/60 text-sky-900 px-2 py-0.5 rounded-full font-semibold">
              {current?.source === 'CACHE' ? 'Cache' : 'Terkini'}
            </span>
          )}
        </div>

        {/* Tombol Segarkan */}
        <button
          type="button"
          onClick={() => loadWeather(true)}
          disabled={isLoading || isOffline}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 rounded-lg transition-colors disabled:opacity-40"
          title="Perbarui data cuaca"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          <span className="hidden sm:inline">{isLoading ? 'Memuat...' : 'Segarkan'}</span>
        </button>
      </div>

      {/* Konten Utama Cuaca */}
      {current ? (
        <div className="mt-3.5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
            {/* Suhu & Kondisi */}
            <div className="flex items-center gap-3.5">
              <div className="w-13 h-13 rounded-2xl bg-white flex items-center justify-center shadow-xs border border-sky-100 shrink-0">
                {renderWeatherIcon(current.conditionType, 'w-8 h-8')}
              </div>

              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    {Math.round(current.temperature)}°C
                  </span>
                  <span className="text-sm font-bold text-slate-800">
                    {current.condition}
                  </span>
                </div>

                <p className="text-xs text-slate-600 mt-0.5">
                  {current.rainProbability > 50
                    ? `Kemungkinan hujan cukup tinggi (~${current.rainProbability}%). Pertimbangkan jadwal penyemprotan & pengeringan.`
                    : current.rainProbability > 20
                    ? `Kemungkinan hujan ringan/lokal (~${current.rainProbability}%). Kondisi cukup baik untuk aktivitas sawah.`
                    : `Cuaca relatif bersahabat (~${current.rainProbability}% hujan). Mendukung pemupukan dan penyiangan.`}
                </p>
              </div>
            </div>

            {/* Metrik Lapang Ramah Petani */}
            <div className="grid grid-cols-3 sm:flex sm:items-center gap-2 sm:gap-4 p-2.5 bg-white/70 rounded-xl border border-sky-100 text-xs text-slate-700">
              <div className="flex items-center gap-1.5" title="Kemungkinan Hujan">
                <CloudRain className="w-4 h-4 text-blue-600 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-400">Peluang Hujan</div>
                  <div className="font-bold">{current.rainProbability}%</div>
                </div>
              </div>

              <div className="flex items-center gap-1.5" title="Kelembapan Udara">
                <Droplets className="w-4 h-4 text-sky-600 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-400">Kelembapan</div>
                  <div className="font-bold">{current.humidity}%</div>
                </div>
              </div>

              <div className="flex items-center gap-1.5" title="Kecepatan Angin">
                <Wind className="w-4 h-4 text-slate-500 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-400">Angin</div>
                  <div className="font-bold">{current.windSpeed} km/j</div>
                </div>
              </div>
            </div>
          </div>

          {/* Prakiraan Beberapa Hari ke Depan (Strip Ringkas) */}
          {weatherData?.daily && weatherData.daily.length > 0 && (
            <div className="pt-2 border-t border-sky-100/70">
              <div className="text-[11px] font-bold text-slate-700 mb-2">
                Prakiraan Beberapa Hari ke Depan:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {weatherData.daily.slice(0, 5).map((day, idx) => (
                  <div
                    key={day.date || idx}
                    className="p-2 bg-white/90 rounded-xl border border-sky-100 flex flex-col items-center text-center shadow-2xs"
                  >
                    <span className="text-[11px] font-bold text-slate-800">
                      {day.dayLabel}
                    </span>
                    <div className="my-1">
                      {renderWeatherIcon(day.conditionType, 'w-5 h-5')}
                    </div>
                    <span className="text-[11px] text-slate-600 leading-tight font-medium">
                      {day.condition}
                    </span>
                    <div className="text-[10px] font-bold text-slate-900 mt-1">
                      {day.tempMax}° / {day.tempMin}°
                    </div>
                    <div className="text-[9px] text-blue-600 font-medium mt-0.5">
                      Hujan {day.rainProbability}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status Waktu Pembaruan & Lokasi */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pt-2 text-[11px] text-slate-500 border-t border-sky-100/50">
            <div>
              {isDataOffline ? (
                <span className="text-amber-800 font-medium">
                  Menampilkan informasi terakhir yang tersimpan ({ClientWeatherService.formatUpdatedTime(current.updatedAt)}).
                </span>
              ) : (
                <span>
                  {ClientWeatherService.formatUpdatedTime(current.updatedAt)}
                </span>
              )}
            </div>

            {!hasLandCoords && (
              <div className="flex items-center gap-1.5 text-slate-600">
                <span>(Estimasi koordinat default sentra tani).</span>
                <button
                  type="button"
                  onClick={handleRequestDeviceLocation}
                  disabled={isLocating}
                  className="text-emerald-700 font-bold hover:underline inline-flex items-center gap-0.5"
                >
                  <MapPin className="w-3 h-3" />
                  {isLocating ? 'Mendeteksi...' : 'Pakai Lokasi HP'}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Kondisi Belum Ada Data */
        <div className="py-6 text-center space-y-2">
          <div className="w-10 h-10 mx-auto rounded-full bg-sky-100 text-sky-600 flex items-center justify-center">
            <CloudSun className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-slate-700">
            {statusMessage || 'Informasi cuaca belum tersedia.'}
          </p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Hubungkan perangkat ke internet untuk memuat perkiraan cuaca lapang secara otomatis.
          </p>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => loadWeather(true)}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-bold hover:bg-emerald-800 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Muat Cuaca
            </button>
          </div>
        </div>
      )}

      {/* Error Notifikasi Lokasi Jika Ada */}
      {locationError && (
        <div className="mt-2.5 p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800">
          {locationError}
        </div>
      )}
    </div>
  );
}
