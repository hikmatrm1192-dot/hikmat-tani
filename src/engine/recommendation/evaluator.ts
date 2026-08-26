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

export interface EvaluationOptions {
  rules?: AgronomyRule[];
  filterContextType?: string;
}

/**
 * Mengevaluasi FieldContext dan menghasilkan daftar saran rekomendasi.
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
        const rec = rule.evaluate(context);
        if (rec) {
          recommendations.push(rec);
        }
      }
    } catch (err) {
      // Rule failure safety - rule yang error tidak merusak evaluasi rule lainnya
      console.warn(`[Recommendation Engine] Error executing rule ${rule.id}:`, err);
    }
  }

  // Urutkan prioritas (HIGH -> MEDIUM -> LOW -> INFO)
  const priorityWeight: Record<string, number> = {
    CRITICAL: 5,
    HIGH: 4,
    MEDIUM: 3,
    LOW: 2,
    INFO: 1,
  };

  return recommendations.sort((a, b) => {
    const weightA = priorityWeight[a.priority] || 0;
    const weightB = priorityWeight[b.priority] || 0;
    return weightB - weightA;
  });
}
