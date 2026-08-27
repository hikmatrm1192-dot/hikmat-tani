/**
 * HIKMAT TANI - Katalog Pupuk & Nutrisi Padi Sawah
 * 
 * Fitur:
 * - Pencarian nama pupuk, rumus kimia, dan alias pasar (e.g., urea, phonska, sp-36, kcl, za).
 * - Penyaringan jenis (Tunggal, Majemuk NPK, Organik).
 * - Tampilan komposisi hara ringkas langsung di kartu.
 */

import { useMemo, useState } from 'react';
import {
  ChevronRight,
  FlaskConical,
  Plus,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { Fertilizer, Reference } from '../../types/index.ts';
import { FertilizerDetailModal } from './FertilizerDetailModal.tsx';

interface FertilizerCatalogProps {
  fertilizers: Fertilizer[];
  references?: Reference[];
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  selectedFertilizerId?: string | null;
}

export function FertilizerCatalog({
  fertilizers,
  references = [],
  searchQuery = '',
  onSearchChange,
  selectedFertilizerId,
}: FertilizerCatalogProps) {
  const [localSearch, setLocalSearch] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [activeModalFert, setActiveModalFert] = useState<Fertilizer | null>(null);

  const query = (onSearchChange ? searchQuery : localSearch).toLowerCase().trim();

  // Buka modal jika selectedFertilizerId diberikan dari navigasi lintas modul
  useMemo(() => {
    if (selectedFertilizerId) {
      const found = fertilizers.find((f) => f.id === selectedFertilizerId);
      if (found) setActiveModalFert(found);
    }
  }, [selectedFertilizerId, fertilizers]);

  const filteredFertilizers = useMemo(() => {
    return fertilizers.filter((fert) => {
      // 1. Filter Tipe Pupuk
      if (selectedType !== 'ALL' && fert.type !== selectedType) {
        return false;
      }

      // 2. Filter Pencarian Cerdas
      if (!query) return true;

      const matchName = fert.name.toLowerCase().includes(query);
      const matchFormula = fert.formula?.toLowerCase().includes(query);
      const matchAliases = fert.aliases?.some((a) => a.toLowerCase().includes(query));

      return matchName || matchFormula || matchAliases;
    });
  }, [fertilizers, selectedType, query]);

  const types = [
    { id: 'ALL', label: 'Semua Pupuk', count: fertilizers.length },
    {
      id: 'INORGANIC_SINGLE',
      label: 'Anorganik Tunggal',
      count: fertilizers.filter((f) => f.type === 'INORGANIC_SINGLE').length,
    },
    {
      id: 'INORGANIC_COMPOUND',
      label: 'Majemuk NPK',
      count: fertilizers.filter((f) => f.type === 'INORGANIC_COMPOUND').length,
    },
    {
      id: 'ORGANIC',
      label: 'Pupuk Organik',
      count: fertilizers.filter((f) => f.type === 'ORGANIC').length,
    },
  ];

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
          placeholder="Cari pupuk, nama pasar, atau rumus (misal: urea, phonska, kcl, sp36)..."
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

      {/* Filter Jenis Pupuk */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {types.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSelectedType(t.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border min-h-[38px] ${
              selectedType === t.id
                ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>{t.label}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                selectedType === t.id
                  ? 'bg-emerald-950 text-emerald-200'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Daftar Kartu Pupuk */}
      {filteredFertilizers.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <FlaskConical className="w-8 h-8 text-slate-300 mx-auto" />
          <h4 className="text-sm font-bold text-slate-800">
            Pupuk Tidak Ditemukan
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Tidak ada data pupuk yang cocok dengan kata kunci "{query}".
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredFertilizers.map((fert) => {
            const comp = fert.nutrientComposition;
            const isCompound = fert.type === 'INORGANIC_COMPOUND';
            const isOrganic = fert.type === 'ORGANIC';

            return (
              <div
                key={fert.id}
                onClick={() => setActiveModalFert(fert)}
                className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 hover:border-emerald-400 hover:shadow-sm transition-all cursor-pointer space-y-3 group"
              >
                {/* Header Card */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-emerald-900 transition-colors">
                      {fert.name}
                    </h3>
                    {fert.formula && (
                      <span className="font-mono text-[11px] text-slate-500 font-semibold">
                        {fert.formula}
                      </span>
                    )}
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                      isCompound
                        ? 'bg-blue-50 text-blue-800 border-blue-200'
                        : isOrganic
                        ? 'bg-amber-50 text-amber-900 border-amber-200'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    {isCompound ? 'Majemuk NPK' : isOrganic ? 'Organik' : 'Tunggal'}
                  </span>
                </div>

                {/* Aliases */}
                {fert.aliases && fert.aliases.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] font-medium text-slate-400">Alias:</span>
                    {fert.aliases.map((alias) => (
                      <span
                        key={alias}
                        className="px-1.5 py-0.2 bg-slate-100 text-slate-700 text-[10px] font-medium rounded"
                      >
                        {alias}
                      </span>
                    ))}
                  </div>
                )}

                {/* Nutrient Chips Grid */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {comp.N_pct !== undefined && comp.N_pct > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs font-bold">
                      <span>N:</span>
                      <strong className="font-black">{comp.N_pct}%</strong>
                    </span>
                  )}
                  {comp.P2O5_pct !== undefined && comp.P2O5_pct > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-900 border border-blue-200 text-xs font-bold">
                      <span>P₂O₅:</span>
                      <strong className="font-black">{comp.P2O5_pct}%</strong>
                    </span>
                  )}
                  {comp.K2O_pct !== undefined && comp.K2O_pct > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-950 border border-amber-200 text-xs font-bold">
                      <span>K₂O:</span>
                      <strong className="font-black">{comp.K2O_pct}%</strong>
                    </span>
                  )}
                  {comp.S_pct !== undefined && comp.S_pct > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-teal-50 text-teal-900 border border-teal-200 text-xs font-bold">
                      <span>S:</span>
                      <strong className="font-black">{comp.S_pct}%</strong>
                    </span>
                  )}
                </div>

                {/* Footer Action */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-500 font-medium">
                    Kandungan hara standar resmi
                  </span>

                  <span className="inline-flex items-center gap-0.5 font-bold text-emerald-800 group-hover:text-emerald-950 text-xs">
                    <span>Simulasi Takaran</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Detail Pupuk */}
      <FertilizerDetailModal
        isOpen={activeModalFert !== null}
        onClose={() => setActiveModalFert(null)}
        fertilizer={activeModalFert}
        allReferences={references}
      />
    </div>
  );
}
