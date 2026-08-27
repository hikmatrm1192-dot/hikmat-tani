/**
 * HIKMAT TANI - Modal Rincian Panduan & Pengetahuan Budidaya
 * 
 * Menampilkan:
 * - Isi panduan praktis lapang yang mudah dipahami
 * - Rujukan ilmiah dan status verifikasi
 * - Tag topik terkait
 */

import {
  BookOpen,
  Calendar,
  CheckCircle2,
  FileText,
  Layers,
  Sparkles,
  Tag,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal.tsx';
import { KnowledgeArticle, Reference } from '../../types/index.ts';
import { ReferenceBadge } from './ReferenceBadge.tsx';

interface ArticleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: KnowledgeArticle | null;
  allReferences?: Reference[];
}

export function ArticleDetailModal({
  isOpen,
  onClose,
  article,
  allReferences = [],
}: ArticleDetailModalProps) {
  if (!isOpen || !article) return null;

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'CULTIVATION':
        return { label: 'Tata Kelola Budidaya', color: 'bg-emerald-100 text-emerald-900 border-emerald-200' };
      case 'FERTILIZATION':
        return { label: 'Pedoman Pemupukan', color: 'bg-teal-100 text-teal-900 border-teal-200' };
      case 'PEST_DISEASE':
        return { label: 'Perlindungan & PHT', color: 'bg-amber-100 text-amber-900 border-amber-200' };
      case 'IRRIGATION':
        return { label: 'Tata Kelola Air', color: 'bg-sky-100 text-sky-900 border-sky-200' };
      case 'HARVEST':
        return { label: 'Panen & Pasca Panen', color: 'bg-yellow-100 text-yellow-900 border-yellow-300' };
      default:
        return { label: 'Panduan Praktis', color: 'bg-slate-100 text-slate-800 border-slate-200' };
    }
  };

  const badge = getCategoryBadge(article.category);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={article.title}
      subtitle={badge.label}
    >
      <div className="space-y-4">
        {/* Header Summary Box */}
        {article.summary && (
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-700 leading-relaxed">
            {article.summary}
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3 shadow-xs">
          <div className="prose prose-sm max-w-none text-slate-800 text-xs sm:text-sm leading-relaxed whitespace-pre-line font-normal">
            {article.content}
          </div>
        </div>

        {/* Tags */}
        {article.tags && article.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <Tag className="w-3.5 h-3.5 text-slate-400" />
            {article.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[11px] font-semibold rounded-md border border-slate-200"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Rujukan Ilmiah */}
        <div className="pt-2 border-t border-slate-100">
          <ReferenceBadge
            referenceId={article.referenceId}
            allReferences={allReferences}
          />
        </div>

        {/* Tombol Tutup */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] bg-slate-800 hover:bg-slate-900 active:bg-black text-white font-bold text-xs rounded-xl transition-colors"
          >
            Tutup Panduan
          </button>
        </div>
      </div>
    </Modal>
  );
}
