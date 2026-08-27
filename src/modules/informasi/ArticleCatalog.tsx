/**
 * HIKMAT TANI - Katalog Panduan & Artikel Budidaya
 * 
 * Fitur:
 * - Pencarian topik, judul panduan, dan tag kata kunci.
 * - Penyaringan kategori (Budidaya, Pemupukan, Hama/OPT, Air, Panen).
 * - Desain kartu yang ringkas dan tidak membebani petani dengan teks berlebih.
 */

import { useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronRight,
  FileText,
  Search,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import { KnowledgeArticle, Reference } from '../../types/index.ts';
import { ArticleDetailModal } from './ArticleDetailModal.tsx';

interface ArticleCatalogProps {
  articles: KnowledgeArticle[];
  references?: Reference[];
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  selectedArticleId?: string | null;
}

export function ArticleCatalog({
  articles,
  references = [],
  searchQuery = '',
  onSearchChange,
  selectedArticleId,
}: ArticleCatalogProps) {
  const [localSearch, setLocalSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [activeModalArticle, setActiveModalArticle] = useState<KnowledgeArticle | null>(
    null
  );

  const query = (onSearchChange ? searchQuery : localSearch).toLowerCase().trim();

  // Buka modal jika selectedArticleId diberikan dari navigasi lintas modul
  useMemo(() => {
    if (selectedArticleId) {
      const found = articles.find((a) => a.id === selectedArticleId);
      if (found) setActiveModalArticle(found);
    }
  }, [selectedArticleId, articles]);

  const filteredArticles = useMemo(() => {
    return articles.filter((art) => {
      // 1. Filter Kategori
      if (selectedCategory !== 'ALL' && art.category !== selectedCategory) {
        return false;
      }

      // 2. Filter Pencarian Cerdas
      if (!query) return true;

      const matchTitle = art.title.toLowerCase().includes(query);
      const matchSummary = art.summary?.toLowerCase().includes(query);
      const matchContent = art.content?.toLowerCase().includes(query);
      const matchTags = art.tags?.some((t) => t.toLowerCase().includes(query));

      return matchTitle || matchSummary || matchContent || matchTags;
    });
  }, [articles, selectedCategory, query]);

  const categories = [
    { id: 'ALL', label: 'Semua Panduan', count: articles.length },
    {
      id: 'CULTIVATION',
      label: 'Budidaya',
      count: articles.filter((a) => a.category === 'CULTIVATION').length,
    },
    {
      id: 'FERTILIZATION',
      label: 'Pemupukan',
      count: articles.filter((a) => a.category === 'FERTILIZATION').length,
    },
    {
      id: 'PEST_DISEASE',
      label: 'Hama & OPT',
      count: articles.filter((a) => a.category === 'PEST_DISEASE').length,
    },
    {
      id: 'IRRIGATION',
      label: 'Pengairan Air',
      count: articles.filter((a) => a.category === 'IRRIGATION').length,
    },
    {
      id: 'HARVEST',
      label: 'Panen & Pasca Panen',
      count: articles.filter((a) => a.category === 'HARVEST').length,
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
          placeholder="Cari panduan budidaya (misal: jajar legowo, pemupukan berimbang, AWD air)..."
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
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(cat.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border min-h-[38px] ${
              selectedCategory === cat.id
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>{cat.label}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                selectedCategory === cat.id
                  ? 'bg-slate-800 text-slate-200'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {cat.count}
            </span>
          </button>
        ))}
      </div>

      {/* Daftar Kartu Panduan */}
      {filteredArticles.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
          <h4 className="text-sm font-bold text-slate-800">
            Panduan Tidak Ditemukan
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Tidak ada panduan budidaya yang cocok dengan kata kunci "{query}".
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredArticles.map((art) => (
            <div
              key={art.id}
              onClick={() => setActiveModalArticle(art)}
              className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:shadow-sm transition-all cursor-pointer space-y-3 group"
            >
              {/* Header Card */}
              <div className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-emerald-900 transition-colors">
                    {art.title}
                  </h3>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 font-normal">
                  {art.summary}
                </p>
              </div>

              {/* Tags */}
              {art.tags && art.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {art.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[10px] font-semibold rounded"
                    >
                      #{tag}
                    </span>
                  ))}
                  {art.tags.length > 3 && (
                    <span className="text-[10px] text-slate-400 font-medium self-center">
                      +{art.tags.length - 3} lainnya
                    </span>
                  )}
                </div>
              )}

              {/* Footer Action */}
              <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[11px] text-emerald-800 font-bold">
                  Terverifikasi Litbang
                </span>

                <span className="inline-flex items-center gap-0.5 font-bold text-emerald-800 group-hover:text-emerald-950 text-xs">
                  <span>Baca Lengkap</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Detail Artikel */}
      <ArticleDetailModal
        isOpen={activeModalArticle !== null}
        onClose={() => setActiveModalArticle(null)}
        article={activeModalArticle}
        allReferences={references}
      />
    </div>
  );
}
