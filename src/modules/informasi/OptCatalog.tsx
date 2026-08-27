/**
 * HIKMAT TANI - Katalog OPT (Hama & Penyakit Padi Sawah)
 * 
 * Fitur:
 * - Pencarian cepat nama umum, nama ilmiah, dan alias lokal (e.g., sundep, beluk, kresek).
 * - Penyaringan jenis OPT (Serangga, Penyakit Jamur/Bakteri, Gulma, Tikus).
 * - Kartu informasi responsif dan berkontras tinggi.
 */

import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Bug,
  ChevronRight,
  Filter,
  Leaf,
  Search,
  ShieldAlert,
  Sprout,
  X,
} from 'lucide-react';
import { NaturalEnemy, Opt, Reference } from '../../types/index.ts';
import { OptDetailModal } from './OptDetailModal.tsx';

interface OptCatalogProps {
  opts: Opt[];
  naturalEnemies?: NaturalEnemy[];
  references?: Reference[];
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  selectedOptId?: string | null;
  onSelectNaturalEnemy?: (enemy: NaturalEnemy) => void;
}

export function OptCatalog({
  opts,
  naturalEnemies = [],
  references = [],
  searchQuery = '',
  onSearchChange,
  selectedOptId,
  onSelectNaturalEnemy,
}: OptCatalogProps) {
  const [localSearch, setLocalSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [activeModalOpt, setActiveModalOpt] = useState<Opt | null>(null);

  const query = (onSearchChange ? searchQuery : localSearch).toLowerCase().trim();

  // Buka modal jika selectedOptId diberikan dari navigasi lintas modul
  useMemo(() => {
    if (selectedOptId) {
      const found = opts.find((o) => o.id === selectedOptId);
      if (found) setActiveModalOpt(found);
    }
  }, [selectedOptId, opts]);

  const filteredOpts = useMemo(() => {
    return opts.filter((opt) => {
      // 1. Filter Kategori
      if (selectedCategory !== 'ALL' && opt.category !== selectedCategory) {
        return false;
      }

      // 2. Filter Pencarian Cerdas (Nama umum, nama ilmiah, alias/sebutan lokal, gejala)
      if (!query) return true;

      const matchCommon = opt.commonName.toLowerCase().includes(query);
      const matchScientific = opt.scientificName?.toLowerCase().includes(query);
      const matchAliases = opt.aliases?.some((a) => a.toLowerCase().includes(query));
      const matchSymptoms = opt.symptoms?.toLowerCase().includes(query);

      return matchCommon || matchScientific || matchAliases || matchSymptoms;
    });
  }, [opts, selectedCategory, query]);

  const categories = [
    { id: 'ALL', label: 'Semua OPT', count: opts.length },
    {
      id: 'INSECT_PEST',
      label: 'Hama Serangga',
      count: opts.filter((o) => o.category === 'INSECT_PEST').length,
    },
    {
      id: 'DISEASE',
      label: 'Penyakit Tanaman',
      count: opts.filter((o) => o.category === 'DISEASE').length,
    },
    {
      id: 'RODENT',
      label: 'Hama Tikus',
      count: opts.filter((o) => o.category === 'RODENT').length,
    },
    {
      id: 'WEED',
      label: 'Gulma Sawah',
      count: opts.filter((o) => o.category === 'WEED').length,
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
      {/* Kolom Pencarian Cepat */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={onSearchChange ? searchQuery : localSearch}
          onChange={(e) => handleSearchInput(e.target.value)}
          placeholder="Cari OPT, nama latin, atau alias (misal: sundep, beluk, kresek)..."
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

      {/* Filter Kategori (Pills) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(cat.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border min-h-[38px] ${
              selectedCategory === cat.id
                ? 'bg-amber-800 text-white border-amber-800 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>{cat.label}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                selectedCategory === cat.id
                  ? 'bg-amber-950 text-amber-200'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {cat.count}
            </span>
          </button>
        ))}
      </div>

      {/* Daftar Kartu OPT */}
      {filteredOpts.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <Bug className="w-8 h-8 text-slate-300 mx-auto" />
          <h4 className="text-sm font-bold text-slate-800">
            OPT Tidak Ditemukan
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Tidak ada data hama atau penyakit yang cocok dengan kata kunci "{query}".
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredOpts.map((opt) => {
            const isDisease = opt.category === 'DISEASE';
            const isRodent = opt.category === 'RODENT';

            return (
              <div
                key={opt.id}
                onClick={() => setActiveModalOpt(opt)}
                className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 hover:border-amber-400 hover:shadow-sm transition-all cursor-pointer space-y-3 group"
              >
                {/* Header Card */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-amber-900 transition-colors">
                      {opt.commonName}
                    </h3>
                    {opt.scientificName && (
                      <p className="text-xs italic text-slate-500 font-serif">
                        {opt.scientificName}
                      </p>
                    )}
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                      isDisease
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : isRodent
                        ? 'bg-orange-50 text-orange-800 border-orange-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    {isDisease ? 'Penyakit' : isRodent ? 'Tikus' : 'Serangga'}
                  </span>
                </div>

                {/* Alias Lokal Tags */}
                {opt.aliases && opt.aliases.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] font-medium text-slate-500">Sebutan:</span>
                    {opt.aliases.map((alias) => (
                      <span
                        key={alias}
                        className="px-1.5 py-0.5 bg-amber-50 text-amber-900 text-[10px] font-bold rounded border border-amber-200/80"
                      >
                        {alias}
                      </span>
                    ))}
                  </div>
                )}

                {/* Gejala Ringkas */}
                <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                  {opt.symptoms}
                </p>

                {/* Footer Info & Action */}
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] font-semibold text-slate-500">
                    Fase: <strong className="text-slate-800">{opt.vulnerableStage || 'Semua Fase'}</strong>
                  </span>

                  <span className="inline-flex items-center gap-0.5 font-bold text-emerald-800 group-hover:text-emerald-950 text-xs">
                    <span>Lihat Detail PHT</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Detail OPT */}
      <OptDetailModal
        isOpen={activeModalOpt !== null}
        onClose={() => setActiveModalOpt(null)}
        opt={activeModalOpt}
        naturalEnemies={naturalEnemies}
        allReferences={references}
        onSelectNaturalEnemy={(enemy) => {
          setActiveModalOpt(null);
          if (onSelectNaturalEnemy) onSelectNaturalEnemy(enemy);
        }}
      />
    </div>
  );
}
