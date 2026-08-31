/**
 * HIKMAT TANI - Recommendation Evaluator
 * 
 * Mengevaluasi kondisi lapangan (FieldContext) terhadap daftar aturan agronomi (AgronomyRules)
 * secara deterministik dan murni.
 * 
 * Prinsip:
 * - Menghasilkan SARAN (Recommendation), BUKAN keputusan petani.
 * - Tidak memodifikasi state aplikasi atau database secara langsung.
 * - Setiap saran yang dihasilkan memiliki basis dan rujukan ilmiah.
 * - Pure logic tanpa ketergantungan UI/DOM/React.
 */

import { FieldContext } from '../contextEngine.ts';
import { INITIAL_AGRONOMY_RULES } from './rules.ts';
import { AgronomyRule, EvaluatedRecommendation } from './types.ts';
import { enhanceRecommendationsWithWeather } from './weatherModifier.ts';

export interface EvaluationOptions {
  rules?: AgronomyRule[];
  filterContextType?: string;
  skipWeatherModifier?: boolean;
}

/**
 * Mengevaluasi FieldContext dan menghasilkan daftar saran rekomendasi.
 * 
 * Prinsip:
 * - Agronomy Rules adalah penentu dasar rekomendasi (fase, hara, OPT, dsb).
 * - Cuaca murni sebagai modifier kontekstual (timing, referensi situasi lapang).
 * - Jika data cuaca tidak tersedia, evaluasi menghasilkan rekomendasi dasar tanpa kendala.
 */
export function evaluateRecommendations(
  context: FieldContext,
  options?: EvaluationOptions
): EvaluatedRecommendation[] {
  const activeRules = options?.rules || INITIAL_AGRONOMY_RULES;
  const recommendations: EvaluatedRecommendation[] = [];

  for (const rule of activeRules) {
    if (options?.filterContextType && rule.contextType !== options.filterContextType) {
      continue;
    }

    try {
      if (rule.isApplicable(context)) {
        const res = rule.evaluate(context);
        if (Array.isArray(res)) {
          for (const item of res) {
            if (item) recommendations.push(item);
          }
        } else if (res) {
          recommendations.push(res);
        }
      }
    } catch (err) {
      // Rule failure safety - rule yang error tidak merusak evaluasi rule lainnya
      console.warn(`[Recommendation Engine] Error executing rule ${rule.id}:`, err);
    }
  }

  // Hitung bobot relevansi dan prioritas secara deterministik
  const getRecommendationScore = (rec: EvaluatedRecommendation): number => {
    let score = 0;
    const priorityWeight: Record<string, number> = {
      CRITICAL: 500,
      HIGH: 400,
      MEDIUM: 300,
      LOW: 200,
      INFO: 100,
    };
    score += priorityWeight[rec.priority] || 100;

    // Temuan lapangan (OPT_CONTROL) dengan intensitas sedang/berat diprioritaskan
    if (rec.contextType === 'OPT_CONTROL') {
      score += 50;
      if (rec.metadata?.attackSeverity === 'HEAVY') score += 40;
      else if (rec.metadata?.attackSeverity === 'MEDIUM') score += 20;

      if (typeof rec.metadata?.relevanceScore === 'number') {
        score += Math.min(30, Math.floor(rec.metadata.relevanceScore / 4));
      }
    } else if (rec.contextType === 'GROWTH_STAGE') {
      score += 20;
    } else if (rec.contextType === 'FERTILIZER') {
      score += 15;
    }

    if (rec.confidence === 'HIGH') score += 10;
    else if (rec.confidence === 'MEDIUM') score += 5;

    return score;
  };

  const sorted = recommendations.sort((a, b) => {
    return getRecommendationScore(b) - getRecommendationScore(a);
  });

  // Terapkan pertimbangan cuaca (Weather Context Modifier) jika tersedia & tidak diskip
  if (options?.skipWeatherModifier) {
    return sorted;
  }

  return enhanceRecommendationsWithWeather(sorted, context.weatherContext, context);
}
