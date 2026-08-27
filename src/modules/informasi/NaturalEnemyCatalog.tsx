/**
 * HIKMAT TANI - Katalog Musuh Alami (Sahabat Petani)
 * 
 * Fitur:
 * - Pencarian nama, nama ilmiah latin, atau hama yang dimangsa.
 * - Penyaringan jenis (Predator, Parasitoid, Patogen).
 * - Panduan pelestarian PHT dan penanaman tanaman refugia di pematang.
 */

import { useMemo, useState } from 'react';
import {
  ChevronRight,
  Flower2,
  HeartHandshake,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { NaturalEnemy, Opt, Reference } from '../../types/index.ts';
import { NaturalEnemyDetailModal } from './NaturalEnemyDetailModal.tsx';

interface NaturalEnemyCatalogProps {
  naturalEnemies: NaturalEnemy[];
  opts?: Opt[];
  references?: Reference[];
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  selectedEnemyId?: string | null;
  onSelectOpt?: (opt: Opt) => void;
}

export function NaturalEnemyCatalog({
  naturalEnemies,
  opts = [],
  references = [],
  searchQuery = '',
  onSearchChange,
  selectedEnemyId,
  onSelectOpt,
}: NaturalEnemyCatalogProps) {
  const [localSearch, setLocalSearch] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [activeModalEnemy, setActiveModalEnemy] = useState<NaturalEnemy | null>(null);

  const query = (onSearchChange ? searchQuery : localSearch).toLowerCase().trim();

  // Buka modal jika selectedEnemyId diberikan dari navigasi lintas modul
  useMemo(() => {
    if (selectedEnemyId) {
      const found = naturalEnemies.find((e) => e.id === selectedEnemyId);
      if (found) setActiveModalEnemy(found);
    }
  }, [selectedEnemyId, naturalEnemies]);

  const filteredEnemies = useMemo(() => {
    return naturalEnemies.filter((enemy) => {
      // 1. Filter Tipe
      if (selectedType !== 'ALL' && enemy.type !== selectedType) {
        return false;
      }

      // 2. Filter Pencarian
      if (!query) return true;

      const matchName = enemy.name.toLowerCase().includes(query);
      const matchScientific = enemy.scientificName?.toLowerCase().includes(query);
      const matchHabitat = enemy.habitat?.toLowerCase().includes(query);
      const matchStages = enemy.attackedStages?.some((s) => s.toLowerCase().includes(query));

      return matchName || matchScientific || matchHabitat || matchStages;
    });
  }, [naturalEnemies, selectedType, query]);

  const types = [
    { id: 'ALL', label: 'Semua Musuh Alami', count: naturalEnemies.length },
    {
      id: 'PREDATOR',
      label: 'Predator / Pemangsa',
      count: naturalEnemies.filter((e) => e.type === 'PREDATOR').length,
    },
    {
      id: 'PARASITOID',
      label: 'Parasitoid Telur',
      count: naturalEnemies.filter((e) => e.type === 'PARASITOID').length,
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
          placeholder="Cari musuh alami atau nama latin (misal: laba-laba, kumbang kubah, trichogramma)..."
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

      {/* Filter Kategori */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {types.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSelectedType(t.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border min-h-[38px] ${
              selectedType === t.id
                ? 'bg-teal-800 text-white border-teal-800 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>{t.label}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                selectedType === t.id
                  ? 'bg-teal-950 text-teal-200'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Grid Kartu Musuh Alami */}
      {filteredEnemies.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <Flower2 className="w-8 h-8 text-slate-300 mx-auto" />
          <h4 className="text-sm font-bold text-slate-800">
            Musuh Alami Tidak Ditemukan
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Tidak ada data musuh alami yang cocok dengan kata kunci "{query}".
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredEnemies.map((enemy) => {
            const isPredator = enemy.type === 'PREDATOR';

            return (
              <div
                key={enemy.id}
                onClick={() => setActiveModalEnemy(enemy)}
                className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 hover:border-teal-400 hover:shadow-sm transition-all cursor-pointer space-y-3 group"
              >
                {/* Header Card */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-teal-900 transition-colors">
                      {enemy.name}
                    </h3>
                    {enemy.scientificName && (
                      <p className="text-xs italic text-slate-500 font-serif">
                        {enemy.scientificName}
                      </p>
                    )}
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                      isPredator
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-teal-50 text-teal-800 border-teal-200'
                    }`}
                  >
                    {isPredator ? 'Predator' : 'Parasitoid'}
                  </span>
                </div>

                {/* Fase yang Diserang & Habitat */}
                <div className="text-xs text-slate-600 space-y-1">
                  <div>
                    Menyerang:{' '}
                    <strong className="text-slate-800">
                      {enemy.attackedStages?.join(', ') || 'Telur & Nimfa'}
                    </strong>
                  </div>
                  {enemy.habitat && (
                    <div className="text-[11px] text-slate-500 truncate">
                      Habitat: {enemy.habitat}
                    </div>
                  )}
                </div>

                {/* Footer Action */}
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Penjaga Alami Sawah
                  </span>

                  <span className="inline-flex items-center gap-0.5 font-bold text-teal-800 group-hover:text-teal-950 text-xs">
                    <span>Lihat Pelestarian</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Detail Musuh Alami */}
      <NaturalEnemyDetailModal
        isOpen={activeModalEnemy !== null}
        onClose={() => setActiveModalEnemy(null)}
        naturalEnemy={activeModalEnemy}
        allOpts={opts}
        allReferences={references}
        onSelectOpt={(opt) => {
          setActiveModalEnemy(null);
          if (onSelectOpt) onSelectOpt(opt);
        }}
      />
    </div>
  );
}
