/**
 * HIKMAT TANI - Floating Polygon Drawer Toolbar & Modal
 * 
 * Toolbar saat petani menggambar batas petak sawah baru di peta satelit.
 * Standar Luasan: STRICTLY m² (Meter Persegi).
 */

import { useState } from 'react';
import {
  Check,
  Compass,
  MapPin,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { calculateGeodesicPerimeterM, calculateGeodesicPolygonAreaM2, formatAreaM2, LatLngPoint } from '../../utils/geoUtils.ts';

interface PolygonDrawerControlsProps {
  points: LatLngPoint[];
  onUndoPoint: () => void;
  onClearPoints: () => void;
  onCancelDraw: () => void;
  onAddGpsPoint: () => void;
  onCompleteDraw: (areaM2: number, perimeterM: number) => void;
}

export function PolygonDrawerControls({
  points,
  onUndoPoint,
  onClearPoints,
  onCancelDraw,
  onAddGpsPoint,
  onCompleteDraw,
}: PolygonDrawerControlsProps) {
  const perimeterM = calculateGeodesicPerimeterM(points);
  const areaM2 = calculateGeodesicPolygonAreaM2(points);
  const canComplete = points.length >= 3;

  return (
    <div className="absolute top-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-20 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-emerald-700/30 p-4 space-y-3 font-sans animate-in fade-in slide-in-from-top-4 duration-200">
      {/* Header Info */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-xs font-black text-slate-900 uppercase tracking-wide">
            Mode Gambar Petak Sawah
          </span>
        </div>
        <button
          type="button"
          onClick={onCancelDraw}
          className="text-slate-400 hover:text-rose-600 p-1"
          title="Batal"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Instruction */}
      <p className="text-xs text-slate-700 leading-snug">
        {points.length === 0 && 'Ketuk pada peta satelit atau klik "+ GPS" untuk menandai sudut ke-1 petak sawah.'}
        {points.length === 1 && 'Ketuk peta untuk menandai titik sudut ke-2.'}
        {points.length === 2 && 'Ketuk peta untuk titik ke-3 agar bidang poligon mulai terbentuk.'}
        {points.length >= 3 && 'Batas petak terbentuk! Anda dapat menambah titik lagi atau klik "Selesai & Simpan".'}
      </p>

      {/* Real-time Metrics (m²) */}
      <div className="grid grid-cols-3 gap-2 bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-2.5 text-center">
        <div>
          <div className="text-[10px] text-slate-500 font-bold uppercase">Titik Sudut</div>
          <div className="text-sm font-black text-slate-900">{points.length}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 font-bold uppercase">Keliling</div>
          <div className="text-sm font-black text-slate-900">
            {perimeterM > 0 ? `${perimeterM.toLocaleString('id-ID')} m` : '-'}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-emerald-800 font-bold uppercase">Luas Petak</div>
          <div className="text-sm font-black text-emerald-900">
            {areaM2 > 0 ? formatAreaM2(areaM2) : '-'}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-1.5 pt-1">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onUndoPoint}
            disabled={points.length === 0}
            title="Hapus Titik Terakhir"
            className="px-2.5 py-2 min-h-[40px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-40 flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Urungkan</span>
          </button>
          <button
            type="button"
            onClick={onAddGpsPoint}
            title="Tambah Titik dari GPS Saya"
            className="px-2.5 py-2 min-h-[40px] bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>+ GPS</span>
          </button>
        </div>

        <button
          type="button"
          disabled={!canComplete}
          onClick={() => onCompleteDraw(areaM2, perimeterM)}
          className="px-4 py-2 min-h-[42px] bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Check className="w-4 h-4" />
          <span>Selesai & Simpan</span>
        </button>
      </div>
    </div>
  );
}
