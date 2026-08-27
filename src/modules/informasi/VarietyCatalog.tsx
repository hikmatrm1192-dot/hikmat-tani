/**
 * HIKMAT TANI - Katalog Varietas Unggul Padi Sawah
 * 
 * Fitur:
 * - Pencarian nama varietas dan nama populer/pasar.
 * - Indikator kontekstual jika varietas sedang aktif ditanam petani.
 * - Rincian umur panen, potensi hasil, dan ketahanan HDB/Blas/Wereng.
 */

import { useMemo, useState } from 'react';
import {
  ChevronRight,
  Clock,
  MapPin,
  Search,
  Sprout,
  TrendingUp,
  Wheat,
  X,
} from 'lucide-react';
import { CropSeason, Land, Reference, RiceVariety } from '../../types/index.ts';
import { VarietyDetailModal } from './VarietyDetailModal.tsx';

interface VarietyCatalogProps {
  varieties: RiceVariety[];
  activeSeasons?: CropSeason[];
  lands?: Land[];
  references?: Reference[];
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  selectedVarietyId?: string | null;
}

export function VarietyCatalog({
  varieties,
  activeSeasons = [],
  lands = [],
  references = [],
  searchQuery = '',
  onSearchChange,
  selectedVarietyId,
}: VarietyCatalogProps) {
  const [localSearch, setLocalSearch] = useState<string>('');
  const [activeModalVariety, setActiveModalVariety] = useState<RiceVariety | null>(null);

  const query = (onSearchChange ? searchQuery : localSearch).toLowerCase().trim();

  // Buka modal jika selectedVarietyId diberikan dari navigasi lintas modul
  useMemo(() => {
    if (selectedVarietyId) {
      const found = varieties.find((v) => v.id === selectedVarietyId);
      if (found) setActiveModalVariety(found);
    }
  }, [selectedVarietyId, varieties]);

  const filteredVarieties = useMemo(() => {
    return varieties.filter((v) => {
      if (!query) return true;
      const matchName = v.name.toLowerCase().includes(query);
      const matchAliases = v.aliases?.some((a) => a.toLowerCase().includes(query));
      const matchResist = v.resistanceProfile?.toLowerCase().includes(query);
      return matchName || matchAliases || matchResist;
    });
  }, [varieties, query]);

  const handleSearchInput = (val: string) => {
    if (onSearchChange) {
      onSearchChange(val);
    } else {
      setLocalSearch(val);
    }
  };

  return (
    <div className="space-y-4">
      {/* Kolom Pencarian */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={onSearchChange ? searchQuery : localSearch}
          onChange={(e) => handleSearchInput(e.target.value)}
          placeholder="Cari varietas unggul (misal: Inpari 32, Ciherang, Inpari 42)..."
          className="w-full pl-10 pr-10 py-3 bg-white border border-slate-300 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-xs"
        />
        {query && (
          <button
            type="button"
            onClick={() => handleSearchInput('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Grid Kartu Varietas */}
      {filteredVarieties.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <Wheat className="w-8 h-8 text-slate-300 mx-auto" />
          <h4 className="text-sm font-bold text-slate-800">
            Varietas Tidak Ditemukan
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Tidak ada data varietas yang cocok dengan kata kunci "{query}".
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredVarieties.map((v) => {
            const isCurrentlyPlanted = activeSeasons.some(
              (s) =>
                s.status === 'ACTIVE' &&
                (s.varietyId === v.id ||
                  s.varietyName.toLowerCase() === v.name.toLowerCase())
            );

            return (
              <div
                key={v.id}
                onClick={() => setActiveModalVariety(v)}
                className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:shadow-sm transition-all cursor-pointer space-y-3 group"
              >
                {/* Header Card */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-emerald-900 transition-colors">
                      {v.name}
                    </h3>
                    {v.aliases && v.aliases.length > 0 && (
                      <p className="text-xs text-slate-500 font-medium">
                        Alias: {v.aliases.join(', ')}
                      </p>
                    )}
                  </div>

                  {isCurrentlyPlanted && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black shrink-0">
                      <Sprout className="w-3 h-3 text-emerald-700" />
                      Ditanam
                    </span>
                  )}
                </div>

                {/* Info Umur & Potensi Hasil */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-400 block">Umur</span>
                      <strong className="text-xs text-slate-800">~{v.growthDurationDays} Hari</strong>
                    </div>
                  </div>

                  <div className="p-2 bg-emerald-50/60 rounded-xl border border-emerald-100 flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <div>
                      <span className="text-[10px] text-emerald-700 block">Potensi</span>
                      <strong className="text-xs text-emerald-950">
                        {(v.potentialYieldKgHa / 1000).toFixed(1)} t/ha
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Profil Ketahanan Ringkas */}
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {v.resistanceProfile}
                </p>

                {/* Footer Action */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-500 font-medium">
                    Benih Bersertifikat Resmi
                  </span>

                  <span className="inline-flex items-center gap-0.5 font-bold text-emerald-800 group-hover:text-emerald-950 text-xs">
                    <span>Lihat Deskripsi</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Detail Varietas */}
      <VarietyDetailModal
        isOpen={activeModalVariety !== null}
        onClose={() => setActiveModalVariety(null)}
        variety={activeModalVariety}
        activeSeasons={activeSeasons}
        lands={lands}
        allReferences={references}
      />
    </div>
  );
}
