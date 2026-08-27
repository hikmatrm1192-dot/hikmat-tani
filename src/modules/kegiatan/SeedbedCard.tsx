/**
 * HIKMAT TANI - Seedbed (Persemaian) Card
 * 
 * Menampilkan ringkasan data persemaian benih dengan kalkulasi HSS (Hari Setelah Semai).
 */

import { Calendar, Edit, Leaf, MapPin, Scale, Trash2 } from 'lucide-react';
import { Seedbed } from '../../types/index.ts';

interface SeedbedCardProps {
  key?: string | number;
  seedbed: Seedbed;
  onEdit?: (seedbed: Seedbed) => void;
  onDelete?: (seedbed: Seedbed) => void;
}

export function SeedbedCard({ seedbed, onEdit, onDelete }: SeedbedCardProps) {
  // Hitung HSS (Hari Setelah Semai)
  const start = new Date(seedbed.startDate);
  const now = new Date();
  const diffTime = now.getTime() - start.getTime();
  const hss = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  const methodLabel: Record<string, string> = {
    WET_BED: 'Persemaian Basah Tradisional',
    DRY_BED: 'Persemaian Kering',
    DAPOG: 'Dapog Nampan Transplanter',
    TRAY: 'Tray Semai Moderen',
  };

  const displayMethod = methodLabel[seedbed.nurseryMethod] || seedbed.nurseryMethod;

  // Status kesiapan bibit
  let readinessBadge = {
    text: `${hss} HSS (Fase Perkecambahan / Bibit Muda)`,
    color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  };

  if (hss >= 15 && hss <= 21) {
    readinessBadge = {
      text: `${hss} HSS (Umur Ideal Pindah Tanam)`,
      color: 'bg-emerald-600 text-white border-emerald-700',
    };
  } else if (hss > 21) {
    readinessBadge = {
      text: `${hss} HSS (Bibit Tua - Segera Tanam)`,
      color: 'bg-amber-100 text-amber-900 border-amber-300',
    };
  } else if (hss < 0) {
    readinessBadge = {
      text: `Rencana Semai (${Math.abs(hss)} hari lagi)`,
      color: 'bg-slate-100 text-slate-700 border-slate-200',
    };
  }

  const formattedDate = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(start);

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs hover:border-emerald-200 transition-all space-y-3.5">
      {/* Baris Atas: Badge HSS & Aksi */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200">
            <Leaf className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
              Varietas: {seedbed.varietyName}
            </h4>
            <p className="text-xs text-slate-500 font-medium">{displayMethod}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(seedbed)}
              aria-label="Edit Persemaian"
              className="p-2 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <Edit className="w-4 h-4" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(seedbed)}
              aria-label="Hapus Persemaian"
              className="p-2 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Badge Kesiapan Bibit */}
      <div>
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${readinessBadge.color}`}
        >
          <span className="w-2 h-2 rounded-full bg-current opacity-80" />
          <span>{readinessBadge.text}</span>
        </span>
      </div>

      {/* Parameter Teknis Persemaian */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
        <div>
          <span className="text-slate-500 block text-[11px]">Mulai Semai:</span>
          <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
            <Calendar className="w-3 h-3 text-emerald-700 shrink-0" />
            <span>{formattedDate}</span>
          </span>
        </div>

        <div>
          <span className="text-slate-500 block text-[11px]">Jumlah Benih:</span>
          <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
            <Scale className="w-3 h-3 text-emerald-700 shrink-0" />
            <span>{seedbed.seedAmountKg} kg</span>
          </span>
        </div>

        {seedbed.nurseryAreaM2 && (
          <div>
            <span className="text-slate-500 block text-[11px]">Luas Bedengan:</span>
            <span className="font-bold text-slate-800 mt-0.5 block">
              {seedbed.nurseryAreaM2} m²
            </span>
          </div>
        )}

        {seedbed.nurseryLocation && (
          <div className="col-span-2 sm:col-span-3 pt-1 border-t border-slate-200/60 flex items-center gap-1 text-slate-600 text-[11px]">
            <MapPin className="w-3 h-3 text-emerald-700 shrink-0" />
            <span>Lokasi: {seedbed.nurseryLocation}</span>
          </div>
        )}
      </div>

      {/* Catatan Persemaian jika ada */}
      {seedbed.notes && (
        <p className="text-xs text-slate-600 bg-amber-50/50 p-2.5 rounded-xl border border-amber-200/50 italic leading-relaxed">
          "{seedbed.notes}"
        </p>
      )}
    </div>
  );
}
