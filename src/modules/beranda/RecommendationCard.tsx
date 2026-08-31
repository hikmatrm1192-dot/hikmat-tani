/**
 * HIKMAT TANI - Recommendation Card Component (Perlu Diperhatikan)
 * 
 * Menjawab pertanyaan petani: "Apa yang perlu saya perhatikan?"
 * 
 * Prinsip:
 * - Rekomendasi berupa SARAN ilmiah santun, BUKAN perintah mutlak.
 * - Petani tetap sebagai pengambil keputusan tertinggi.
 * - Menggunakan bahasa manusia yang bersahabat ("Disarankan...", "Perlu diperhatikan...", "Dapat dipertimbangkan...").
 * - Menghindari kata imperatif ("WAJIB", "HARUS", "PASTI", "SEGERA").
 * - Korelasi langsung antara Catatan Kegiatan Lapang (terutama Pengamatan OPT & Pemupukan) dengan Pustaka Agronomi.
 * - Satu slide per saran pertimbangan jika terdapat 2 atau lebih rekomendasi (navigasi "1 dari N" yang bersih & ringan).
 * - Progressive disclosure: Ringkasan kontekstual di depan, detail & rujukan ilmiah dapat dibuka-tutup.
 */

import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CloudSun,
  FlaskConical,
  Info,
  Leaf,
  Lightbulb,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sprout,
} from 'lucide-react';
import { useEffect, useState, type TouchEvent } from 'react';
import { EvaluatedRecommendation } from '../../engine/recommendation/types.ts';
import { FarmerDecision } from '../../types/index.ts';

interface RecommendationCardProps {
  recommendations: EvaluatedRecommendation[];
  hasActiveSeason: boolean;
  onOpenSeasonForm?: () => void;
  onOpenDecisionModal?: (rec: EvaluatedRecommendation) => void;
  onNavigateToKnowledge?: (
    category: 'opt' | 'pupuk' | 'musuh_alami' | 'varietas' | 'panduan',
    itemId?: string,
    searchQuery?: string
  ) => void;
  existingDecisions?: FarmerDecision[];
}

export function RecommendationCard({
  recommendations,
  hasActiveSeason,
  onOpenSeasonForm,
  onOpenDecisionModal,
  onNavigateToKnowledge,
  existingDecisions = [],
}: RecommendationCardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  // Pastikan currentIndex selalu valid jika daftar rekomendasi berubah
  useEffect(() => {
    if (currentIndex >= recommendations.length) {
      setCurrentIndex(Math.max(0, recommendations.length - 1));
    }
  }, [recommendations.length, currentIndex]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < recommendations.length - 1 ? prev + 1 : prev));
  };

  // Support Mobile Swipe
  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length > 0) {
      setTouchStartX(e.touches[0].clientX);
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (touchStartX === null || e.changedTouches.length === 0) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchStartX - touchEndX;

    // Threshold swipe 40px
    if (diffX > 40 && currentIndex < recommendations.length - 1) {
      handleNext();
    } else if (diffX < -40 && currentIndex > 0) {
      handlePrev();
    }
    setTouchStartX(null);
  };

  // Kasus jika belum ada musim tanam
  if (!hasActiveSeason) {
    return (
      <div id="card-perlu-diperhatikan-no-season" className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-5 shadow-xs">
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
                id="btn-mulai-musim-tanam-beranda"
                onClick={onOpenSeasonForm}
                className="mt-2 text-xs font-bold text-emerald-800 hover:text-emerald-950 underline underline-offset-4 cursor-pointer"
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
      <div id="card-perlu-diperhatikan-empty" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
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

  const getDecisionLabel = (choice: string) => {
    switch (choice) {
      case 'ACCEPT':
        return 'Mengikuti Saran';
      case 'ADJUST':
        return 'Menyesuaikan';
      case 'REJECT':
        return 'Tidak Mengikuti';
      case 'ALTERNATIVE':
        return 'Cara Lain';
      default:
        return choice;
    }
  };

  const totalCount = recommendations.length;
  const currentRec = recommendations[currentIndex] || recommendations[0];
  const isExpanded = expandedId === currentRec.id;
  const isHighPriority = currentRec.priority === 'HIGH' || currentRec.priority === 'CRITICAL';
  const decision = existingDecisions.find((d) => d.recommendationId === currentRec.id);
  const isOptControl = currentRec.contextType === 'OPT_CONTROL';
  const isFertilizer = currentRec.contextType === 'FERTILIZER';
  const isGrowthStage = currentRec.contextType === 'GROWTH_STAGE';
  const meta = currentRec.metadata || {};

  return (
    <div id="section-perlu-diperhatikan" className="space-y-3">
      {/* Header Bar dengan Jumlah Saran & Kontrol Navigasi */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
            Perlu Diperhatikan
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200/80">
            {totalCount} Saran Pertimbangan
          </span>

          {totalCount > 1 && (
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
              <button
                type="button"
                id="btn-rec-prev"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
                  currentIndex === 0
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'text-slate-700 hover:bg-slate-100 active:bg-slate-200 cursor-pointer'
                }`}
                title="Saran Sebelumnya"
                aria-label="Saran Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-[11px] font-bold text-slate-800 px-1 select-none">
                {currentIndex + 1} dari {totalCount}
              </span>

              <button
                type="button"
                id="btn-rec-next"
                onClick={handleNext}
                disabled={currentIndex === totalCount - 1}
                className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
                  currentIndex === totalCount - 1
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'text-slate-700 hover:bg-slate-100 active:bg-slate-200 cursor-pointer'
                }`}
                title="Saran Berikutnya"
                aria-label="Saran Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Kartu Saran Aktif (Slide Tunggal yang Bersih & Fokus) */}
      <div
        id={`rec-slide-${currentRec.id}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`rounded-2xl border transition-all duration-200 shadow-xs overflow-hidden ${
          isHighPriority
            ? 'bg-amber-50/60 border-amber-200/90 text-amber-950'
            : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        <div className="p-4 sm:p-5 space-y-3.5">
          {/* Badge Konteks Sumber Kegiatan */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {isOptControl ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-100/90 text-amber-950 rounded-lg text-[11px] font-extrabold border border-amber-300/80">
                <Sparkles className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>BERDASARKAN PENGAMATAN ANDA</span>
              </div>
            ) : isFertilizer ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100/90 text-emerald-950 rounded-lg text-[11px] font-extrabold border border-emerald-300/80">
                <FlaskConical className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>BERDASARKAN CATATAN PEMUPUKAN</span>
              </div>
            ) : isGrowthStage ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-100/90 text-blue-950 rounded-lg text-[11px] font-extrabold border border-blue-300/80">
                <Sprout className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                <span>BERDASARKAN FASE PERTUMBUHAN</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg text-[11px] font-extrabold border border-slate-300/80">
                <Info className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                <span>BERDASARKAN CATATAN MUSIM TANAM</span>
              </div>
            )}

            {/* Indikator Keyakinan / Dasar Ilmiah */}
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                currentRec.confidence === 'HIGH'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              {currentRec.confidence === 'HIGH' ? 'Dasar Kuat' : 'Estimasi'}
            </span>
          </div>

          {/* Judul & Isi Saran Utama */}
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                isHighPriority
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              <Lightbulb className="w-5 h-5" />
            </div>

            <div className="flex-1 space-y-1.5 min-w-0">
              <h3 className="text-base sm:text-lg font-black tracking-tight text-slate-900 leading-snug">
                {currentRec.title}
              </h3>
              <p className="text-sm sm:text-base text-slate-800 leading-relaxed font-normal">
                {currentRec.message}
              </p>
            </div>
          </div>

          {/* Ringkasan Kontekstual Berbasis Temuan Lapang */}
          <div className="p-3.5 bg-slate-50/90 rounded-xl border border-slate-200/80 text-xs sm:text-sm space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Sumber Kegiatan
                </span>
                <span className="font-bold text-slate-900 text-xs sm:text-sm mt-0.5 block">
                  {meta.sourceActivity || 'Catatan Lapangan'}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Temuan Utama
                </span>
                <span className="font-bold text-slate-900 text-xs sm:text-sm mt-0.5 block">
                  {meta.mainFinding || currentRec.title}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/60">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Alasan Menjadi Perhatian
              </span>
              <p className="text-slate-800 text-xs sm:text-sm mt-1 leading-relaxed">
                {meta.attentionReason || currentRec.basis}
              </p>
            </div>

            {meta.supportingReference && (
              <div className="pt-2 flex items-center gap-1.5 text-xs sm:text-sm text-emerald-900 font-semibold border-t border-emerald-100/60">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Rujukan: {meta.supportingReference}</span>
              </div>
            )}
          </div>

          {/* Status Keputusan Petani jika sudah pernah disimpan */}
          {decision && (
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
              <div className="flex items-center gap-2 text-emerald-950 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Keputusan Anda: {getDecisionLabel(decision.decision)}</span>
              </div>
              {decision.notes && (
                <span className="text-xs sm:text-sm text-emerald-800 italic max-w-full sm:max-w-xs truncate">
                  "{decision.notes}"
                </span>
              )}
            </div>
          )}

          {/* Action Bar: Lihat Rujukan & Tombol Keputusan */}
          <div className="pt-3 border-t border-slate-100/80 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                id={`btn-toggle-ref-${currentRec.id}`}
                onClick={() => toggleExpand(currentRec.id)}
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#0F5132] hover:text-[#0B3D26] min-h-[40px] py-1.5 px-3 rounded-xl hover:bg-emerald-50 active:bg-emerald-100 transition-colors cursor-pointer border border-[#0F5132]/20"
                aria-expanded={isExpanded}
              >
                <BookOpen className="w-4 h-4 text-[#D4AF37]" />
                <span>{isExpanded ? 'Sembunyikan Rujukan' : 'Lihat Alasan & Rujukan'}</span>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {isOptControl && onNavigateToKnowledge && (
                <button
                  type="button"
                  id="btn-panduan-pht-beranda"
                  onClick={() => {
                    if (meta?.optId) {
                      onNavigateToKnowledge('opt', meta.optId);
                    } else if (meta?.observedSymptoms || meta?.customOptName) {
                      onNavigateToKnowledge('opt', undefined, meta.observedSymptoms || meta.customOptName);
                    } else {
                      onNavigateToKnowledge('opt');
                    }
                  }}
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 active:bg-amber-300 px-3 py-1.5 rounded-xl border border-amber-300 transition-colors min-h-[40px] cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                  <span>Panduan PHT & Musuh Alami</span>
                </button>
              )}
            </div>

            {onOpenDecisionModal && (
              <button
                type="button"
                id={`btn-decision-${currentRec.id}`}
                onClick={() => onOpenDecisionModal(currentRec)}
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold px-4 py-2 min-h-[42px] bg-[#0F5132] hover:bg-[#0B3D26] active:bg-[#072417] text-white rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4 text-[#D4AF37]" />
                <span>{decision ? 'Ubah Keputusan' : 'Tentukan Keputusan'}</span>
              </button>
            )}
          </div>

          {/* Expanded Details: Progressive Disclosure Content */}
          {isExpanded && (
            <div className="mt-2.5 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs sm:text-sm space-y-3 animate-in fade-in slide-in-from-top-1">
              <div>
                <span className="font-bold text-slate-900 block mb-1">
                  Dasar Agronomi Lengkap:
                </span>
                <p className="text-slate-700 leading-relaxed">{currentRec.basis}</p>
              </div>

              {/* Catatan Cuaca Kontekstual jika ada (Terpisah & Non-Pengganti) */}
              {meta.weatherContext && (
                <div className="p-3 bg-sky-50 rounded-xl border border-sky-200 text-sky-950 space-y-1">
                  <span className="font-bold text-xs sm:text-sm flex items-center gap-1.5">
                    <CloudSun className="w-4 h-4 text-sky-700" />
                    Pertimbangan Cuaca Kontekstual:
                  </span>
                  <p className="text-xs sm:text-sm leading-relaxed text-sky-900">
                    {meta.weatherContext}
                  </p>
                </div>
              )}

              {/* Daftar Rujukan Ilmiah Terverifikasi */}
              {currentRec.referenceIds && currentRec.referenceIds.length > 0 && (
                <div className="pt-2.5 border-t border-slate-200">
                  <span className="font-bold text-emerald-900 block mb-1.5 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Rujukan Ilmiah Terdaftar:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {currentRec.referenceIds.map((refId) => (
                      <span
                        key={refId}
                        className="text-xs bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-800 font-medium"
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

              {onNavigateToKnowledge && (
                <div className="pt-2 border-t border-slate-200/60 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (currentRec.contextType === 'OPT_CONTROL') {
                        if (meta?.optId) {
                          onNavigateToKnowledge('opt', meta.optId);
                        } else if (meta?.observedSymptoms || meta?.customOptName) {
                          onNavigateToKnowledge('opt', undefined, meta.observedSymptoms || meta.customOptName);
                        } else {
                          onNavigateToKnowledge('opt');
                        }
                      } else if (currentRec.contextType === 'FERTILIZER') {
                        onNavigateToKnowledge('pupuk');
                      } else {
                        onNavigateToKnowledge('panduan');
                      }
                    }}
                    className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <BookOpen className="w-3 h-3 text-emerald-600" />
                    <span>
                      {currentRec.contextType === 'OPT_CONTROL'
                        ? 'Buka Panduan PHT & Musuh Alami'
                        : currentRec.contextType === 'FERTILIZER'
                        ? 'Buka Pustaka Pupuk & Nutrisi'
                        : 'Buka Panduan Terkait'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Indikator Titik Paginasi jika lebih dari 1 saran */}
        {totalCount > 1 && (
          <div className="bg-slate-50/80 px-4 py-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="font-medium">
              Saran ke-{currentIndex + 1} dari {totalCount}
            </span>
            <div className="flex items-center gap-1.5">
              {recommendations.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    idx === currentIndex
                      ? 'w-5 bg-[#0F5132]'
                      : 'w-2 bg-slate-300 hover:bg-slate-400'
                  }`}
                  aria-label={`Buka saran ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
