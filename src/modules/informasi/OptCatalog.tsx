/**
 * HIKMAT TANI - Katalog OPT (Hama & Penyakit Padi Sawah)
 * 
 * Fitur:
 * - Pencarian relevansi berbasis gejala lapang, nama umum, nama ilmiah, dan alias lokal (e.g., sundep, beluk, kresek).
 * - Pemeringkatan cerdas (Relevance Scoring Engine) untuk input bebas/belum teridentifikasi tanpa diagnosis palsu.
 * - Banner rujukan pembanding observasi lapang yang ramah petani.
 * - Penyaringan jenis OPT (Hama Serangga, Penyakit, Tikus, Gulma).
 * - Kartu informasi responsif dan berkontras tinggi.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Bug,
  ChevronRight,
  Filter,
  HelpCircle,
  Info,
  Leaf,
  Search,
  ShieldAlert,
  Sparkles,
  Sprout,
  X,
} from 'lucide-react';
import { NaturalEnemy, Opt, Reference } from '../../types/index.ts';
import { matchOptRelevance, OptRelevanceMatch } from '../../engine/index.ts';
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

  const query = (onSearchChange ? searchQuery : localSearch).trim();

  // Buka modal jika selectedOptId diberikan dari navigasi lintas modul
  useEffect(() => {
    if (selectedOptId) {
      const found = opts.find((o) => o.id === selectedOptId);
      if (found) {
        setSelectedCategory('ALL');
        setActiveModalOpt(found);
      }
    }
  }, [selectedOptId, opts]);

  // Jika ada searchQuery dari luar, pastikan kategori direset ke ALL agar pencarian tidak terhambat
  useEffect(() => {
    if (searchQuery) {
      setSelectedCategory('ALL');
    }
  }, [searchQuery]);

  // Evaluasi relevansi bertingkat berbasis agronomi
  const relevanceMatches: OptRelevanceMatch[] = useMemo(() => {
    return matchOptRelevance(opts, query, {
      category: selectedCategory,
    });
  }, [opts, query, selectedCategory]);

  const isExactMatchFound = useMemo(() => {
    if (!query) return false;
    return relevanceMatches.some((r) => r.isExactMatch);
  }, [query, relevanceMatches]);

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
      {/* Banner Konteks Pencarian & Rujukan Berdasarkan Pengamatan Petani */}
      {query && relevanceMatches.length > 0 && (
        <>
          {isExactMatchFound ? (
            /* Banner 1: OPT Teridentifikasi / Dikenal */
            <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between gap-3 text-xs text-emerald-950 shadow-xs animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-4 h-4 text-emerald-700 shrink-0" />
                <div>
                  <span className="font-bold block text-emerald-950">
                    Rujukan Berdasarkan Pengamatan Anda
                  </span>
                  <span className="text-emerald-900 text-[11px]">
                    Menampilkan informasi PHT terdaftar untuk: <strong>"{query}"</strong>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleSearchInput('')}
                className="px-2.5 py-1 bg-white hover:bg-emerald-100/60 active:bg-emerald-200 text-emerald-900 font-bold rounded-lg border border-emerald-300 text-[11px] transition-colors shrink-0"
              >
                Tampilkan Semua
              </button>
            </div>
          ) : (
            /* Banner 2: OPT Belum Teridentifikasi / Gejala Lapang (Rujukan Pembanding Tanpa Diagnosis Palsu) */
            <div className="p-3.5 sm:p-4 bg-amber-50/80 rounded-2xl border border-amber-200/90 space-y-2.5 text-xs text-amber-950 shadow-xs animate-in fade-in duration-200">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-amber-950 text-xs sm:text-sm">
                        Rujukan Pembanding Berdasarkan Gejala Anda
                      </span>
                      <span className="px-2 py-0.5 bg-amber-200/80 text-amber-900 font-bold text-[10px] rounded-full border border-amber-300/80">
                        {relevanceMatches.length} Rujukan Relevan
                      </span>
                    </div>
                    <p className="text-amber-900 text-[11px] leading-relaxed">
                      Ditemukan {relevanceMatches.length} rujukan pustaka yang memiliki kemiripan karakter gejala dengan pengamatan: <strong>"{query}"</strong>.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSearchInput('')}
                  className="px-2.5 py-1 bg-white hover:bg-amber-100 active:bg-amber-200 text-amber-900 font-bold rounded-lg border border-amber-300 text-[11px] transition-colors shrink-0"
                >
                  Tampilkan Semua
                </button>
              </div>

              {/* Catatan non-diagnosis lapang yang santun */}
              <div className="pt-2 border-t border-amber-200/60 flex items-start gap-1.5 text-[11px] text-amber-900">
                <Info className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  Rujukan ini ditampilkan sebagai bahan perbandingan observasi lapangan, bukan diagnosis pasti. Petani tetap memegang kendali penuh atas keputusan lapang.
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Kolom Pencarian Cepat */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={onSearchChange ? searchQuery : localSearch}
          onChange={(e) => handleSearchInput(e.target.value)}
          placeholder="Cari OPT, gejala, nama latin, atau sebutan lokal (misal: daun kuning, kerdil, sundep, kresek)..."
          className="w-full pl-10 pr-10 py-3 bg-white border border-slate-300 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-xs"
        />
        {query && (
          <button
            type="button"
            onClick={() => handleSearchInput('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full"
            title="Hapus pencarian"
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

      {/* Daftar Kartu OPT Relevan */}
      {relevanceMatches.length === 0 ? (
        <div className="p-6 sm:p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 mx-auto flex items-center justify-center">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h4 className="text-sm sm:text-base font-bold text-slate-800">
              Belum Ditemukan Rujukan yang Cukup Mirip
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Tidak ditemukan literasi hama atau penyakit yang cukup relevan dengan kata kunci <strong className="text-slate-800">"{query}"</strong>.
            </p>
          </div>

          {/* Panduan Input yang Lebih Spesifik */}
          <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200/80 text-left max-w-md mx-auto text-xs text-emerald-950 space-y-1">
            <span className="font-bold flex items-center gap-1.5 text-emerald-900">
              <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
              Saran untuk Pencarian Rujukan:
            </span>
            <p className="text-[11px] text-emerald-900 leading-relaxed">
              Anda dapat menambahkan bagian tanaman yang terkena (misal: <em>daun, batang, malai, akar</em>) dan gejala visual yang lebih spesifik (misal: <em>menguning, kerdil, bercak, patah, menggulung</em>) agar pencarian rujukan lebih tepat.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => handleSearchInput('')}
              className="px-4 py-2.5 min-h-[40px] bg-slate-800 hover:bg-slate-900 active:bg-black text-white font-bold text-xs rounded-xl transition-colors shadow-xs"
            >
              Tampilkan Semua Katalog OPT
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {relevanceMatches.map((match) => {
            const { opt, matchedKeywords, isExactMatch, relevanceLabel, similarityReason } = match;
            const isDisease = opt.category === 'DISEASE';
            const isRodent = opt.category === 'RODENT';
            const isComparisonCard = query.length > 0 && !isExactMatch;

            return (
              <div
                key={opt.id}
                onClick={() => setActiveModalOpt(opt)}
                className={`bg-white p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer space-y-3 group ${
                  isComparisonCard
                    ? 'border-amber-300 hover:border-amber-500 hover:shadow-md'
                    : 'border-slate-200 hover:border-amber-400 hover:shadow-sm'
                }`}
              >
                {/* Header Card */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-amber-900 transition-colors">
                        {opt.commonName}
                      </h3>
                    </div>
                    {opt.scientificName && (
                      <p className="text-xs italic text-slate-500 font-serif">
                        {opt.scientificName}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                        isDisease
                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : isRodent
                          ? 'bg-orange-50 text-orange-800 border-orange-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {isDisease ? 'Penyakit' : isRodent ? 'Tikus' : 'Serangga'}
                    </span>

                    {isComparisonCard && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-200">
                        {relevanceLabel}
                      </span>
                    )}
                  </div>
                </div>

                {/* Kemiripan Karakter Gejala (Jika dalam Mode Pencarian Pembanding) */}
                {isComparisonCard && matchedKeywords.length > 0 && (
                  <div className="p-2 bg-amber-50/60 rounded-xl border border-amber-200/70 text-[11px] text-amber-950 space-y-0.5">
                    <div className="flex items-center gap-1 font-semibold text-amber-900">
                      <Sparkles className="w-3 h-3 text-amber-700 shrink-0" />
                      <span>Karakteristik Cocok:</span>
                    </div>
                    <p className="text-amber-900 text-[11px] leading-snug">
                      {similarityReason}
                    </p>
                  </div>
                )}

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
