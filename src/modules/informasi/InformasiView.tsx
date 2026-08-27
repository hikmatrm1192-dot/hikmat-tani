/**
 * HIKMAT TANI - Modul Informasi & Pustaka Agronomi
 * 
 * Prinsip:
 * - "Pengetahuan lengkap di dalam sistem, tetapi tidak membebani tampilan."
 * - Tersedia 5 Kategori Praktis:
 *   1. Hama & Penyakit (OPT)
 *   2. Pupuk & Nutrisi
 *   3. Musuh Alami (Sahabat Petani)
 *   4. Varietas Padi Unggul
 *   5. Panduan Budidaya Lapang
 * - Berbasis IndexedDB Offline-First dengan atribusi rujukan ilmiah resmi (BRIN, BBPadi, IRRI, Kementan).
 */

import { useEffect, useState } from 'react';
import {
  BookOpen,
  Bug,
  CheckCircle2,
  FileText,
  FlaskConical,
  Flower2,
  HelpCircle,
  Leaf,
  ShieldCheck,
  Sparkles,
  Sprout,
  Wheat,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader.tsx';
import {
  CropSeason,
  Fertilizer,
  KnowledgeArticle,
  Land,
  NaturalEnemy,
  Opt,
  Reference,
  RiceVariety,
} from '../../types/index.ts';
import { ArticleCatalog } from './ArticleCatalog.tsx';
import { FertilizerCatalog } from './FertilizerCatalog.tsx';
import { NaturalEnemyCatalog } from './NaturalEnemyCatalog.tsx';
import { OptCatalog } from './OptCatalog.tsx';
import { VarietyCatalog } from './VarietyCatalog.tsx';

export type InfoCategory = 'opt' | 'pupuk' | 'musuh_alami' | 'varietas' | 'panduan';

interface NavigationTarget {
  category: InfoCategory;
  itemId?: string;
}

interface InformasiViewProps {
  varieties: RiceVariety[];
  fertilizers: Fertilizer[];
  opts: Opt[];
  naturalEnemies: NaturalEnemy[];
  articles: KnowledgeArticle[];
  references: Reference[];
  activeSeasons?: CropSeason[];
  lands?: Land[];
  navigationTarget?: NavigationTarget | null;
  onClearNavigationTarget?: () => void;
}

export function InformasiView({
  varieties,
  fertilizers,
  opts,
  naturalEnemies,
  articles,
  references,
  activeSeasons = [],
  lands = [],
  navigationTarget,
  onClearNavigationTarget,
}: InformasiViewProps) {
  const [activeCategory, setActiveCategory] = useState<InfoCategory>('opt');
  const [targetItemId, setTargetItemId] = useState<string | null>(null);

  // Tangani navigasi langsung dari modul lain (Beranda / Kegiatan)
  useEffect(() => {
    if (navigationTarget) {
      setActiveCategory(navigationTarget.category);
      if (navigationTarget.itemId) {
        setTargetItemId(navigationTarget.itemId);
      }
      if (onClearNavigationTarget) {
        onClearNavigationTarget();
      }
    }
  }, [navigationTarget, onClearNavigationTarget]);

  const categories = [
    {
      id: 'opt' as InfoCategory,
      label: 'Hama & Penyakit',
      shortLabel: 'Hama (OPT)',
      icon: <Bug className="w-4 h-4 text-amber-700" />,
      count: opts.length,
      color: 'border-amber-200',
    },
    {
      id: 'pupuk' as InfoCategory,
      label: 'Pupuk & Nutrisi',
      shortLabel: 'Pupuk',
      icon: <FlaskConical className="w-4 h-4 text-emerald-700" />,
      count: fertilizers.length,
      color: 'border-emerald-200',
    },
    {
      id: 'musuh_alami' as InfoCategory,
      label: 'Musuh Alami',
      shortLabel: 'Musuh Alami',
      icon: <Flower2 className="w-4 h-4 text-teal-700" />,
      count: naturalEnemies.length,
      color: 'border-teal-200',
    },
    {
      id: 'varietas' as InfoCategory,
      label: 'Varietas Padi',
      shortLabel: 'Varietas',
      icon: <Wheat className="w-4 h-4 text-yellow-700" />,
      count: varieties.length,
      color: 'border-yellow-200',
    },
    {
      id: 'panduan' as InfoCategory,
      label: 'Panduan Budidaya',
      shortLabel: 'Panduan',
      icon: <BookOpen className="w-4 h-4 text-blue-700" />,
      count: articles.length,
      color: 'border-blue-200',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header Halaman */}
      <PageHeader
        title="Pustaka Informasi"
        subtitle="Rujukan agronomi terverifikasi, pedoman PHT, pupuk, varietas, dan budidaya"
      />

      {/* Navigasi Kategori (5 Tab Utama) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1.5 bg-slate-200/70 rounded-2xl">
        {categories.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setActiveCategory(cat.id);
                setTargetItemId(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-2 min-h-[44px] rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
              }`}
            >
              {cat.icon}
              <span className="truncate">{cat.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-300/80 text-slate-700'
                }`}
              >
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Konten Berdasarkan Tab Aktif */}
      <div className="space-y-4">
        {/* 1. Hama & Penyakit (OPT) */}
        {activeCategory === 'opt' && (
          <OptCatalog
            opts={opts}
            naturalEnemies={naturalEnemies}
            references={references}
            selectedOptId={targetItemId}
            onSelectNaturalEnemy={(enemy) => {
              setActiveCategory('musuh_alami');
              setTargetItemId(enemy.id);
            }}
          />
        )}

        {/* 2. Pupuk & Nutrisi */}
        {activeCategory === 'pupuk' && (
          <FertilizerCatalog
            fertilizers={fertilizers}
            references={references}
            selectedFertilizerId={targetItemId}
          />
        )}

        {/* 3. Musuh Alami */}
        {activeCategory === 'musuh_alami' && (
          <NaturalEnemyCatalog
            naturalEnemies={naturalEnemies}
            opts={opts}
            references={references}
            selectedEnemyId={targetItemId}
            onSelectOpt={(opt) => {
              setActiveCategory('opt');
              setTargetItemId(opt.id);
            }}
          />
        )}

        {/* 4. Varietas Padi */}
        {activeCategory === 'varietas' && (
          <VarietyCatalog
            varieties={varieties}
            activeSeasons={activeSeasons}
            lands={lands}
            references={references}
            selectedVarietyId={targetItemId}
          />
        )}

        {/* 5. Panduan Budidaya */}
        {activeCategory === 'panduan' && (
          <ArticleCatalog
            articles={articles}
            references={references}
            selectedArticleId={targetItemId}
          />
        )}
      </div>

      {/* Catatan Kaki Rujukan Ilmiah Terpadu */}
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>
            Seluruh basis data agronomi disarikan dari standar BBPadi Sukamandi, Ditlin TP Kementan, Balittanah, dan IRRI.
          </span>
        </div>
        <span className="text-[11px] font-bold text-slate-500 shrink-0">
          {references.length} Dokumen Rujukan Terdaftar
        </span>
      </div>
    </div>
  );
}
