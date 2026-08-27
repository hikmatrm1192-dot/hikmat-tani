/**
 * HIKMAT TANI - Reference Badge & Source Display Component
 * 
 * Menampilkan rujukan ilmiah resmi (BBPadi, Ditlin TP, Balittanah, IRRI, BRIN):
 * - Menampilkan institusi/penulis, tahun, dan judul dokumen.
 * - Membedakan status VERIFIED (Terverifikasi) dan REVIEW (Dalam Penelaahan Ilmiah).
 */

import { BookOpen, CheckCircle2, Clock, ShieldCheck } from 'lucide-react';
import { Reference } from '../../types/index.ts';

interface ReferenceBadgeProps {
  reference?: Reference | null;
  referenceId?: string;
  allReferences?: Reference[];
  compact?: boolean;
}

export function ReferenceBadge({
  reference,
  referenceId,
  allReferences = [],
  compact = false,
}: ReferenceBadgeProps) {
  const ref =
    reference ||
    (referenceId ? allReferences.find((r) => r.id === referenceId) : null);

  if (!ref) {
    return (
      <div className="text-[11px] text-slate-400 italic flex items-center gap-1">
        <BookOpen className="w-3 h-3" />
        <span>Rujukan: Basis Data Agronomi Lapang</span>
      </div>
    );
  }

  const isVerified = ref.validationStatus === 'VERIFIED';

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100/90 text-slate-700 text-[11px] border border-slate-200">
        <BookOpen className="w-3 h-3 text-emerald-700 shrink-0" />
        <span className="font-semibold truncate max-w-[200px]">
          {ref.authorInstitution || ref.title} ({ref.publicationYear || '2022'})
        </span>
        {isVerified ? (
          <span className="inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded">
            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-700" />
            Terverifikasi
          </span>
        ) : (
          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded">
            <Clock className="w-2.5 h-2.5" />
            Penelaahan
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200 text-xs space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-emerald-900 font-bold">
          <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>Rujukan & Sumber Ilmiah</span>
        </div>
        {isVerified ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
            Terverifikasi Ilmiah
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full border border-amber-200">
            <Clock className="w-3 h-3" />
            Dalam Penelaahan Ilmiah
          </span>
        )}
      </div>

      <div className="text-slate-700 space-y-0.5">
        <p className="font-semibold text-slate-900">{ref.title}</p>
        <p className="text-[11px] text-slate-600">
          {ref.authorInstitution || 'Badan Standardisasi Instrumen Pertanian'}
          {ref.publicationYear ? ` • Tahun ${ref.publicationYear}` : ''}
        </p>
        {ref.regionApplicability && (
          <p className="text-[10px] text-slate-500">Kesesuaian: {ref.regionApplicability}</p>
        )}
      </div>
    </div>
  );
}
