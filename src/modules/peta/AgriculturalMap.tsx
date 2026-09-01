/**
 * HIKMAT TANI - Interactive Agricultural Satellite 2D Map (Leaflet)
 * 
 * Filosofi:
 * "Peta Satelit 2D Lapang Berbasis GPS & Petak Sawah m²."
 * 
 * Kemampuan Utama:
 * 1. Base Layer: Satelit (Esri World Imagery), Hibrid (Satelit + Label/Jalan), Roadmap (OSM).
 * 2. GPS Geolocation: Tracking posisi petani real-time dengan akurasi meter & tombol centring.
 * 3. Gambar Petak Sawah (Polygon Drawer): Tap titik, hitung keliling (m) & luas otomatis (m²).
 * 4. Marker Spasial: Titik OPT, Pemupukan, Pengairan, Tanam, Panen, Perawatan dengan warna baku.
 * 5. Overlay Peta Kekeringan: Zona TERANCAM (🟡), RINGAN (🟠), SEDANG (🔴), BERAT (🟣), PUSO (⚫).
 * 6. Responsive Mobile First: Sentuhan responsif, tanpa flicker, gesture zoom & drag mulus.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import {
  Activity,
  CropSeason,
  DroughtCategory,
  DroughtZoneFeature,
  DROUGHT_STANDARDS,
  Land,
  OptObservation,
} from '../../types/index.ts';
import {
  calculateGeodesicPerimeterM,
  calculateGeodesicPolygonAreaM2,
  calculatePolygonCentroid,
  formatAreaM2,
  LatLngPoint,
} from '../../utils/geoUtils.ts';

// Default center Karawang / Pantura Jawa Barat jika belum ada GPS
const DEFAULT_CENTER: [number, number] = [-6.3039, 107.3009];
const DEFAULT_ZOOM = 16;

export type BaseMapType = 'satellite' | 'hybrid' | 'roadmap';

export interface MapLayerVisibility {
  showSatellite: boolean;
  showParcels: boolean;
  showGps: boolean;
  showOptMarkers: boolean;
  showFertilizerMarkers: boolean;
  showIrrigationMarkers: boolean;
  showMaintenanceMarkers: boolean;
  showHarvestMarkers: boolean;
  showDroughtOverlay: boolean;
  showWeatherLayer: boolean;
}

interface AgriculturalMapProps {
  lands: Land[];
  activeSeasons: CropSeason[];
  activities?: Activity[];
  optObservations?: OptObservation[];
  droughtZones?: DroughtZoneFeature[];
  selectedLandId?: string | null;
  baseMapType: BaseMapType;
  layerVisibility: MapLayerVisibility;
  isDrawingMode: boolean;
  drawingPoints: LatLngPoint[];
  onAddDrawingPoint?: (pt: LatLngPoint) => void;
  onSelectLand?: (land: Land) => void;
  onSelectActivity?: (activity: Activity) => void;
  onSelectOptObs?: (optObs: OptObservation, activity?: Activity) => void;
  onSelectDroughtZone?: (zone: DroughtZoneFeature) => void;
  userGps?: { lat: number; lng: number; accuracy?: number } | null;
  onGpsRequested?: () => void;
}

export function AgriculturalMap({
  lands,
  activeSeasons,
  activities = [],
  optObservations = [],
  droughtZones = [],
  selectedLandId,
  baseMapType,
  layerVisibility,
  isDrawingMode,
  drawingPoints,
  onAddDrawingPoint,
  onSelectLand,
  onSelectActivity,
  onSelectOptObs,
  onSelectDroughtZone,
  userGps,
  onGpsRequested,
}: AgriculturalMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const hybridOverlayRef = useRef<L.TileLayer | null>(null);

  // Layer groups untuk manajemen render
  const parcelsLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const droughtLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const drawingLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const gpsLayerGroupRef = useRef<L.LayerGroup | null>(null);

  // Inisialisasi Peta Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Inisialisasi Map
      const map = L.map(mapContainerRef.current, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: false,
        attributionControl: false,
        maxZoom: 20,
      });

      // Tambahkan zoom control di pojok kanan atas
      L.control.zoom({ position: 'topright' }).addTo(map);

      // Inisialisasi layer groups
      parcelsLayerGroupRef.current = L.layerGroup().addTo(map);
      droughtLayerGroupRef.current = L.layerGroup().addTo(map);
      markersLayerGroupRef.current = L.layerGroup().addTo(map);
      drawingLayerGroupRef.current = L.layerGroup().addTo(map);
      gpsLayerGroupRef.current = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;

      // Event listener klik pada peta untuk drawing mode
      map.on('click', (e: L.LeafletMouseEvent) => {
        if (isDrawingMode && onAddDrawingPoint) {
          onAddDrawingPoint({ lat: e.latlng.lat, lng: e.latlng.lng });
        }
      });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Base Map Tiles (Satelit vs Hybrid vs Roadmap)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Hapus layer lama
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }
    if (hybridOverlayRef.current) {
      map.removeLayer(hybridOverlayRef.current);
      hybridOverlayRef.current = null;
    }

    if (baseMapType === 'satellite') {
      tileLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution: 'Esri Satellite',
        }
      ).addTo(map);
    } else if (baseMapType === 'hybrid') {
      tileLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution: 'Esri Satellite',
        }
      ).addTo(map);

      hybridOverlayRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution: 'Esri Labels',
        }
      ).addTo(map);
    } else {
      tileLayerRef.current = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          maxZoom: 19,
          attribution: 'OpenStreetMap',
        }
      ).addTo(map);
    }
  }, [baseMapType]);

  // Render Poligon Petak Sawah Lahan
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = parcelsLayerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    if (!layerVisibility.showParcels) return;

    lands.forEach((land) => {
      // Dapatkan titik-titik koordinat polygon
      let coords: [number, number][] = [];

      if (land.coordinates && land.coordinates.length >= 3) {
        coords = land.coordinates.map((pt) => [pt.lat, pt.lng]);
      } else if (land.latitude && land.longitude) {
        // Jika hanya ada titik pin tengah, buat perkiraan kotak petak sawah proporsional
        const lat = land.latitude;
        const lng = land.longitude;
        const delta = 0.0003; // ~33 meter persegi
        coords = [
          [lat - delta, lng - delta],
          [lat - delta, lng + delta],
          [lat + delta, lng + delta],
          [lat + delta, lng - delta],
        ];
      }

      if (coords.length < 3) return;

      const isSelected = selectedLandId === land.id;
      const droughtCat = land.droughtCategory;
      const droughtInfo = droughtCat ? DROUGHT_STANDARDS[droughtCat] : null;

      // Warna polygon: prioritaskan status kekeringan jika ada, atau hijau padi
      const strokeColor = isSelected
        ? '#D4AF37'
        : droughtInfo
        ? droughtInfo.borderHex
        : '#10B981';
      const fillColor = droughtInfo ? droughtInfo.bgHex : '#059669';

      const polygon = L.polygon(coords, {
        color: strokeColor,
        weight: isSelected ? 3.5 : 2,
        opacity: 1,
        fillColor: fillColor,
        fillOpacity: isSelected ? 0.45 : 0.28,
        dashArray: isSelected ? '4, 4' : undefined,
      });

      // Popup & Tooltip
      const areaLabel = formatAreaM2(land.areaM2, land.areaHa);
      const activeSeason = activeSeasons.find(
        (s) => s.landId === land.id && s.status === 'ACTIVE'
      );

      const tooltipContent = `
        <div class="px-2 py-1 text-center font-sans">
          <div class="font-bold text-xs text-slate-900">${land.name}</div>
          <div class="text-[11px] font-semibold text-emerald-800">${areaLabel}</div>
          ${
            activeSeason
              ? `<div class="text-[10px] text-slate-600 mt-0.5">${activeSeason.varietyName || 'Padi Sawah'}</div>`
              : '<div class="text-[10px] text-slate-400">Istirahat</div>'
          }
          ${
            droughtInfo
              ? `<div class="text-[10px] font-bold text-slate-800 mt-1">${droughtInfo.icon} ${droughtInfo.label}</div>`
              : ''
          }
        </div>
      `;

      polygon.bindTooltip(tooltipContent, {
        permanent: true,
        direction: 'center',
        className: 'hikmat-parcel-tooltip',
      });

      polygon.on('click', () => {
        if (onSelectLand) {
          onSelectLand(land);
        }
      });

      group.addLayer(polygon);
    });
  }, [lands, activeSeasons, selectedLandId, layerVisibility.showParcels, onSelectLand]);

  // Render Overlay Peta Kekeringan
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = droughtLayerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    if (!layerVisibility.showDroughtOverlay) return;

    droughtZones.forEach((zone) => {
      const info = DROUGHT_STANDARDS[zone.category];
      const coords: [number, number][] = zone.coordinates.map((pt) => [pt.lat, pt.lng]);

      const polygon = L.polygon(coords, {
        color: info.borderHex,
        weight: 1.5,
        fillColor: info.bgHex,
        fillOpacity: 0.22,
        dashArray: '6, 6',
      });

      polygon.bindTooltip(
        `<div class="p-1 font-sans text-center">
          <div class="font-bold text-xs text-slate-900">${info.icon} ${zone.name}</div>
          <div class="text-[10px] font-bold text-slate-700">Status: ${info.label} (${zone.rainfallMm} mm)</div>
        </div>`,
        { permanent: false, direction: 'top' }
      );

      polygon.on('click', () => {
        if (onSelectDroughtZone) {
          onSelectDroughtZone(zone);
        }
      });

      group.addLayer(polygon);
    });
  }, [droughtZones, layerVisibility.showDroughtOverlay, onSelectDroughtZone]);

  // Render Marker Kegiatan & OPT
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersLayerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // 1. Marker Kegiatan (Pupuk, Tanam, Pengairan, dll)
    activities.forEach((act) => {
      // Cari koordinat: dari activity langsung atau centroid land musimnya
      let lat = act.latitude;
      let lng = act.longitude;

      if (!lat || !lng) {
        const season = activeSeasons.find((s) => s.id === act.cropSeasonId);
        if (season) {
          const land = lands.find((l) => l.id === season.landId);
          if (land) {
            if (land.coordinates && land.coordinates.length > 0) {
              const c = calculatePolygonCentroid(land.coordinates);
              lat = c.lat;
              lng = c.lng;
            } else if (land.latitude && land.longitude) {
              lat = land.latitude;
              lng = land.longitude;
            }
          }
        }
      }

      if (!lat || !lng) return;

      // Filter layer visibility berdasarkan kategori
      if (act.category === 'PLANTING' && !layerVisibility.showParcels) return;
      if (act.category === 'FERTILIZER' && !layerVisibility.showFertilizerMarkers) return;
      if (act.category === 'IRRIGATION' && !layerVisibility.showIrrigationMarkers) return;
      if (act.category === 'MAINTENANCE' && !layerVisibility.showMaintenanceMarkers) return;
      if (act.category === 'HARVEST' && !layerVisibility.showHarvestMarkers) return;
      if (act.category === 'OPT' && !layerVisibility.showOptMarkers) return;

      // Icon Styling
      let colorBg = '#059669';
      let iconEmoji = '🌱';
      let label = 'Tanam';

      switch (act.category) {
        case 'FERTILIZER':
          colorBg = '#D97706';
          iconEmoji = '🧪';
          label = 'Pupuk';
          break;
        case 'IRRIGATION':
          colorBg = '#0284C7';
          iconEmoji = '💧';
          label = 'Pengairan';
          break;
        case 'OPT':
          colorBg = '#E11D48';
          iconEmoji = '🐛';
          label = 'OPT';
          break;
        case 'MAINTENANCE':
          colorBg = '#EA580C';
          iconEmoji = '✂️';
          label = 'Perawatan';
          break;
        case 'HARVEST':
          colorBg = '#CA8A04';
          iconEmoji = '🌾';
          label = 'Panen';
          break;
      }

      const customIcon = L.divIcon({
        className: 'hikmat-activity-marker',
        html: `
          <div style="
            background-color: ${colorBg};
            width: 28px;
            height: 28px;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 5px rgba(0,0,0,0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            cursor: pointer;
          ">
            ${iconEmoji}
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      marker.bindTooltip(
        `<div class="text-center font-sans text-xs">
          <strong>${iconEmoji} ${label} (${act.hst} HST)</strong>
          <div class="text-[10px] text-slate-500">${act.activityDate}</div>
        </div>`,
        { direction: 'top' }
      );

      marker.on('click', () => {
        if (onSelectActivity) {
          onSelectActivity(act);
        }
      });

      group.addLayer(marker);
    });

    // 2. Marker Khusus Pengamatan OPT
    if (layerVisibility.showOptMarkers) {
      optObservations.forEach((optObs) => {
        let lat = optObs.latitude;
        let lng = optObs.longitude;

        const parentActivity = activities.find((a) => a.id === optObs.activityId);

        if (!lat || !lng) {
          if (parentActivity && parentActivity.latitude && parentActivity.longitude) {
            lat = parentActivity.latitude;
            lng = parentActivity.longitude;
          } else if (parentActivity) {
            const season = activeSeasons.find((s) => s.id === parentActivity.cropSeasonId);
            if (season) {
              const land = lands.find((l) => l.id === season.landId);
              if (land && land.coordinates && land.coordinates.length > 0) {
                const c = calculatePolygonCentroid(land.coordinates);
                lat = c.lat + 0.0001; // offset sedikit agar tidak tumpang tindih
                lng = c.lng + 0.0001;
              }
            }
          }
        }

        if (!lat || !lng) return;

        const attackM2Label = optObs.attackAreaM2 ? `${optObs.attackAreaM2} m²` : null;

        const optIcon = L.divIcon({
          className: 'hikmat-opt-marker',
          html: `
            <div style="
              background-color: #BE123C;
              width: 32px;
              height: 32px;
              border-radius: 50%;
              border: 2px solid #FFFFFF;
              box-shadow: 0 3px 8px rgba(190, 18, 60, 0.5);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 15px;
              color: white;
              cursor: pointer;
            ">
              🐛
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([lat, lng], { icon: optIcon });

        marker.bindTooltip(
          `<div class="p-1 text-center font-sans text-xs">
            <strong class="text-rose-700">Pengamatan OPT</strong>
            <div class="text-[11px] font-semibold text-slate-800">${optObs.customOptName || 'Hama / Gejala Lapang'}</div>
            ${attackM2Label ? `<div class="text-[10px] text-rose-600 font-bold">Luas Serangan: ${attackM2Label}</div>` : ''}
          </div>`,
          { direction: 'top' }
        );

        marker.on('click', () => {
          if (onSelectOptObs) {
            onSelectOptObs(optObs, parentActivity);
          }
        });

        group.addLayer(marker);
      });
    }
  }, [
    activities,
    optObservations,
    activeSeasons,
    lands,
    layerVisibility,
    onSelectActivity,
    onSelectOptObs,
  ]);

  // Render Drawing Mode (Polygon yang sedang digambar)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = drawingLayerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    if (!isDrawingMode || drawingPoints.length === 0) return;

    const latLngs: [number, number][] = drawingPoints.map((p) => [p.lat, p.lng]);

    // Titik marker untuk setiap vertex
    drawingPoints.forEach((pt, idx) => {
      const isFirst = idx === 0;
      const vertexIcon = L.divIcon({
        className: 'hikmat-draw-vertex',
        html: `
          <div style="
            background-color: ${isFirst ? '#D4AF37' : '#FFFFFF'};
            color: ${isFirst ? '#072417' : '#0F5132'};
            width: 22px;
            height: 22px;
            border-radius: 50%;
            border: 2px solid #0F5132;
            box-shadow: 0 2px 4px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: bold;
          ">
            ${idx + 1}
          </div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const m = L.marker([pt.lat, pt.lng], { icon: vertexIcon });
      group.addLayer(m);
    });

    // Garis atau Poligon yang sedang terbentuk
    if (drawingPoints.length >= 3) {
      const drawPoly = L.polygon(latLngs, {
        color: '#D4AF37',
        weight: 3,
        fillColor: '#F59E0B',
        fillOpacity: 0.35,
        dashArray: '4, 4',
      });
      group.addLayer(drawPoly);
    } else if (drawingPoints.length === 2) {
      const line = L.polyline(latLngs, {
        color: '#D4AF37',
        weight: 3,
        dashArray: '4, 4',
      });
      group.addLayer(line);
    }
  }, [isDrawingMode, drawingPoints]);

  // Render Marker GPS Pengguna
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = gpsLayerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    if (!layerVisibility.showGps || !userGps) return;

    // Lingkaran akurasi
    if (userGps.accuracy && userGps.accuracy < 200) {
      const circle = L.circle([userGps.lat, userGps.lng], {
        radius: userGps.accuracy,
        color: '#3B82F6',
        weight: 1,
        fillColor: '#60A5FA',
        fillOpacity: 0.15,
      });
      group.addLayer(circle);
    }

    // Titik lokasi berkedip
    const gpsIcon = L.divIcon({
      className: 'hikmat-gps-marker',
      html: `
        <div style="position: relative; width: 24px; height: 24px;">
          <div style="
            position: absolute;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background-color: rgba(59, 130, 246, 0.4);
            animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
          "></div>
          <div style="
            position: absolute;
            top: 4px;
            left: 4px;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background-color: #2563EB;
            border: 2.5px solid white;
            box-shadow: 0 2px 5px rgba(0,0,0,0.4);
          "></div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const gpsMarker = L.marker([userGps.lat, userGps.lng], { icon: gpsIcon });
    gpsMarker.bindTooltip('<span class="text-xs font-bold">📍 Lokasi Saya</span>', {
      direction: 'top',
    });
    group.addLayer(gpsMarker);
  }, [userGps, layerVisibility.showGps]);

  // Centering saat selectedLandId berubah
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedLandId) return;

    const land = lands.find((l) => l.id === selectedLandId);
    if (!land) return;

    if (land.coordinates && land.coordinates.length >= 3) {
      const bounds = L.latLngBounds(land.coordinates.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18, animate: true });
    } else if (land.latitude && land.longitude) {
      map.setView([land.latitude, land.longitude], 17, { animate: true });
    }
  }, [selectedLandId, lands]);

  // Fungsi Centering ke GPS
  const handleCenterGps = useCallback(() => {
    const map = mapInstanceRef.current;
    if (userGps && map) {
      map.setView([userGps.lat, userGps.lng], 18, { animate: true });
    } else if (onGpsRequested) {
      onGpsRequested();
    }
  }, [userGps, onGpsRequested]);

  return (
    <div className="relative w-full h-full min-h-[480px] bg-slate-900 overflow-hidden select-none">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating GPS Centering Button */}
      <div className="absolute bottom-6 right-4 z-20 flex flex-col gap-2">
        <button
          type="button"
          onClick={handleCenterGps}
          title="Pusatkan ke Lokasi Saya"
          className="w-12 h-12 bg-white/95 hover:bg-white text-slate-800 hover:text-emerald-700 rounded-2xl shadow-lg border border-slate-200/80 flex items-center justify-center transition-transform active:scale-95"
        >
          <span className="text-xl">📍</span>
        </button>
      </div>

      {/* Custom Styles for Leaflet Tooltips */}
      <style>{`
        .hikmat-parcel-tooltip {
          background-color: rgba(255, 255, 255, 0.95);
          border: 1px solid #10b981;
          border-radius: 8px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          padding: 2px 6px;
        }
        .hikmat-parcel-tooltip:before {
          display: none;
        }
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
