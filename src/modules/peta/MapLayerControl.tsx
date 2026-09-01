/**
 * HIKMAT TANI - Map Layer & Filter Control Panel
 * 
 * Mengatur visibilitas:
 * - Base Map (Satelit, Hibrid, Jalan)
 * - Petak Sawah
 * - GPS Saya
 * - Titik OPT
 * - Titik Pemupukan
 * - Titik Pengairan
 * - Titik Perawatan & Panen
 * - Peta Kekeringan (Overlay)
 */

import { useState } from 'react';
import {
  Bug,
  Check,
  ChevronDown,
  CloudSun,
  Droplets,
  Eye,
  Layers,
  MapPin,
  Scissors,
  ShieldAlert,
  Sparkles,
  Wheat,
  X,
} from 'lucide-react';
import { BaseMapType, MapLayerVisibility } from './AgriculturalMap.tsx';

interface MapLayerControlProps {
  baseMapType: BaseMapType;
  onChangeBaseMap: (type: BaseMapType) => void;
  layerVisibility: MapLayerVisibility;
  onToggleLayer: (key: keyof MapLayerVisibility) => void;
  onOpenDroughtLegend: () => void;
}

export function MapLayerControl({
  baseMapType,
  onChangeBaseMap,
  layerVisibility,
  onToggleLayer,
  onOpenDroughtLegend,
}: MapLayerControlProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-2 bg-white/95 backdrop-blur-md hover:bg-white text-slate-800 rounded-xl shadow-md border border-slate-200/80 text-xs font-bold transition-all active:scale-95 min-h-[42px]"
      >
        <Layers className="w-4 h-4 text-emerald-700" />
        <span>Lapisan Peta</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown / Modal Panel */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-12 left-0 z-30 w-72 sm:w-80 bg-white/98 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 p-4 space-y-4 font-sans text-slate-900 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-700" />
                Pilihan Lapisan Peta
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 1. Base Map Selector */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Peta Dasar
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => onChangeBaseMap('satellite')}
                  className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all ${
                    baseMapType === 'satellite'
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  🛰️ Satelit
                </button>
                <button
                  type="button"
                  onClick={() => onChangeBaseMap('hybrid')}
                  className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all ${
                    baseMapType === 'hybrid'
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  🌐 Hibrid
                </button>
                <button
                  type="button"
                  onClick={() => onChangeBaseMap('roadmap')}
                  className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all ${
                    baseMapType === 'roadmap'
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  🗺️ Jalan
                </button>
              </div>
            </div>

            {/* 2. Layer Toggles */}
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Elemen Lapang
              </span>

              {/* Petak Sawah */}
              <label className="flex items-center justify-between text-xs font-bold text-slate-800 cursor-pointer select-none">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-sm bg-emerald-600 inline-block" />
                  <span>Petak Sawah (m²)</span>
                </div>
                <input
                  type="checkbox"
                  checked={layerVisibility.showParcels}
                  onChange={() => onToggleLayer('showParcels')}
                  className="rounded text-emerald-700 focus:ring-emerald-500 w-4 h-4"
                />
              </label>

              {/* GPS Saya */}
              <label className="flex items-center justify-between text-xs font-bold text-slate-800 cursor-pointer select-none">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" />
                  <span>Posisi GPS Saya</span>
                </div>
                <input
                  type="checkbox"
                  checked={layerVisibility.showGps}
                  onChange={() => onToggleLayer('showGps')}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
              </label>

              {/* Titik OPT */}
              <label className="flex items-center justify-between text-xs font-bold text-slate-800 cursor-pointer select-none">
                <div className="flex items-center gap-2">
                  <Bug className="w-3.5 h-3.5 text-rose-600" />
                  <span>Pengamatan OPT (Hama/Penyakit)</span>
                </div>
                <input
                  type="checkbox"
                  checked={layerVisibility.showOptMarkers}
                  onChange={() => onToggleLayer('showOptMarkers')}
                  className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                />
              </label>

              {/* Pemupukan */}
              <label className="flex items-center justify-between text-xs font-bold text-slate-800 cursor-pointer select-none">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[9px]">🧪</span>
                  <span>Pemupukan</span>
                </div>
                <input
                  type="checkbox"
                  checked={layerVisibility.showFertilizerMarkers}
                  onChange={() => onToggleLayer('showFertilizerMarkers')}
                  className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                />
              </label>

              {/* Pengairan */}
              <label className="flex items-center justify-between text-xs font-bold text-slate-800 cursor-pointer select-none">
                <div className="flex items-center gap-2">
                  <Droplets className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Pengairan</span>
                </div>
                <input
                  type="checkbox"
                  checked={layerVisibility.showIrrigationMarkers}
                  onChange={() => onToggleLayer('showIrrigationMarkers')}
                  className="rounded text-cyan-600 focus:ring-cyan-500 w-4 h-4"
                />
              </label>

              {/* Panen & Perawatan */}
              <label className="flex items-center justify-between text-xs font-bold text-slate-800 cursor-pointer select-none">
                <div className="flex items-center gap-2">
                  <Wheat className="w-3.5 h-3.5 text-amber-700" />
                  <span>Panen & Perawatan</span>
                </div>
                <input
                  type="checkbox"
                  checked={layerVisibility.showHarvestMarkers}
                  onChange={() => onToggleLayer('showHarvestMarkers')}
                  className="rounded text-amber-700 focus:ring-amber-500 w-4 h-4"
                />
              </label>
            </div>

            {/* 3. Drought Overlay */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="flex items-center justify-between text-xs font-bold text-slate-900 cursor-pointer select-none">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-orange-600" />
                  <span>Peta Indikasi Kekeringan</span>
                </div>
                <input
                  type="checkbox"
                  checked={layerVisibility.showDroughtOverlay}
                  onChange={() => onToggleLayer('showDroughtOverlay')}
                  className="rounded text-orange-600 focus:ring-orange-500 w-4 h-4"
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenDroughtLegend();
                }}
                className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Lihat Standar 5 Kategori Kekeringan</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
