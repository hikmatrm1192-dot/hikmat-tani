/**
 * HIKMAT TANI - Recommendation Engine Types
 * 
 * Struktur rekomendasi agronomi berbasis data dan aturan deterministik.
 * Memastikan rekomendasi bersifat saran ilmiah (bukan perintah mutlak)
 * dan memiliki keterlacakan referensi (traceability).
 */

import { ContextType, RecommendationPriority } from '../../types/index.ts';
import { FieldContext } from '../contextEngine.ts';

export type RecommendationConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface EvaluatedRecommendation {
  id: string;
  cropSeasonId: string;
  contextType: ContextType;
  title: string;
  message: string;
  basis: string;
  confidence: RecommendationConfidence;
  priority: RecommendationPriority;
  referenceIds: string[];
  suggestedActionType?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AgronomyRule {
  id: string;
  name: string;
  description: string;
  contextType: ContextType;
  priority: RecommendationPriority;
  referenceIds: string[];
  isApplicable: (context: FieldContext) => boolean;
  evaluate: (context: FieldContext) => EvaluatedRecommendation | null;
}
