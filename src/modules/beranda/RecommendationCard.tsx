/**
 * HIKMAT TANI - Recommendation Card Component (Perlu Diperhatikan)
 * 
 * Menjawab pertanyaan petani: "Apa yang perlu saya perhatikan?"
 * 
 * Prinsip:
 * - Rekomendasi berupa SARAN ilmiah santun, BUKAN perintah mutlak.
 * - Petani tetap sebagai pengambil keputusan tertinggi.
 * - Menggunakan bahasa manusia yang bersahabat ("Disarankan...", "Perlu diperhatikan...").
 * - Menghindari kata imperatif ("WAJIB", "HARUS", "PASTI").
 * - Progressive disclosure: Layar utama tetap bersih, tombol "Lihat alasan" menampilkan rujukan ilmiah.
 */

import { BookOpen, ChevronDown, ChevronUp, Info, Lightbulb, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { EvaluatedRecommendation } from '../../engine/recommendation/types.ts';

interface RecommendationCardProps {
  recommendations: EvaluatedRecommendation[];
  hasActiveSeason: boolean;
  onOpenSeasonForm?: () => void;
}

export function RecommendationCard({
  recommendations,
  hasActiveSeason,
  onOpenSeasonForm,
}: RecommendationCardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // Kasus jika belum ada musim tanam
  if (!hasActiveSeason) {
    return (
      <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-5 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
            <Info className="w-5 h-5" />
          </div>
          <div className="space-y-1.5 flex-1">
            <h3 className="text-sm sm:text-base font-bold text-amber-950">
              Perlu Diperhatikan
            </h3>
            <p className="text-xs sm:text-sm text-amber-900 leading-relaxed">
              Belum cukup informasi untuk memberikan saran khusus. Silakan mulai musim tanam untuk mencatat tanggal tanam dan varietas padi Anda.
            </p>
            {onOpenSeasonForm && (
              <button
                type="button"
                onClick={onOpenSeasonForm}
                className="mt-2 text-xs font-bold text-emerald-800 hover:text-emerald-950 underline underline-offset-4"
              >
                + Mulai Musim Tanam Sekarang
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Kasus jika tidak ada rekomendasi atau data masih sangat minim
  if (recommendations.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
            <Lightbulb className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm sm:text-base font-bold text-slate-800">
              Perlu Diperhatikan
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Kondisi pertanaman tercatat berjalan normal. Pengamatan kondisi tanaman secara berkala dapat terus dilanjutkan.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          <h2 className="text-sm sm:text-base font-bold text-slate-900">
            Perlu Diperhatikan
          </h2>
        </div>
        <span className="text-[11px] text-slate-500 font-medium">
          {recommendations.length} Saran Pertimbangan
        </span>
      </div>

      <div className="space-y-3">
        {recommendations.map((rec) => {
          const isExpanded = expandedId === rec.id;

          const isHighPriority = rec.priority === 'HIGH' || rec.priority === 'CRITICAL';

          return (
            <div
              key={rec.id}
              className={`rounded-2xl border transition-all shadow-xs overflow-hidden ${
                isHighPriority
                  ? 'bg-amber-50/60 border-amber-200/90 text-amber-950'
                  : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              <div className="p-4 sm:p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isHighPriority
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    <Lightbulb className="w-5 h-5" />
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm sm:text-base font-bold tracking-tight">
                        {rec.title}
                      </h4>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          rec.confidence === 'HIGH'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {rec.confidence === 'HIGH' ? 'Dasar Kuat' : 'Estimasi'}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
                      {rec.message}
                    </p>
                  </div>
                </div>

                {/* Progressive Disclosure Action */}
                <div className="pt-2 border-t border-slate-100/80 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => toggleExpand(rec.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 hover:text-emerald-950 min-h-[36px] py-1 px-2 rounded-lg hover:bg-emerald-50/60 transition-colors"
                    aria-expanded={isExpanded}
                  >
                    <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                    <span>{isExpanded ? 'Sembunyikan Alasan Ilmiah' : 'Lihat Alasan & Rujukan'}</span>
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <span className="text-[10px] text-slate-400">
                    Saran Ilmiah • Keputusan Petani
                  </span>
                </div>

                {/* Expanded Details: Progressive Disclosure Content */}
                {isExpanded && (
                  <div className="mt-2 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-2.5 animate-in fade-in slide-in-from-top-1">
                    <div>
                      <span className="font-bold text-slate-700 block mb-0.5">
                        Dasar Pertimbangan:
                      </span>
                      <p className="text-slate-600 leading-relaxed">{rec.basis}</p>
                    </div>

                    {rec.referenceIds && rec.referenceIds.length > 0 && (
                      <div className="pt-2 border-t border-slate-200/60">
                        <span className="font-bold text-emerald-800 block mb-1 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          Rujukan Ilmiah Terdaftar:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {rec.referenceIds.map((refId) => (
                            <span
                              key={refId}
                              className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700"
                            >
                              {refId === 'ref-litbang-padi-2020'
                                ? 'Balitpa Kementan (2020) — Petunjuk Lapang Budidaya Padi'
                                : refId === 'ref-pupuk-kementan-2021'
                                ? 'Puslitbangtan (2021) — Rekomendasi Pemupukan Spesifik Lokasi'
                                : refId === 'ref-pht-padi-2019'
                                ? 'Ditlin TP (2019) — Prinsip 4 Pilar PHT Tanaman Padi'
                                : refId}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
