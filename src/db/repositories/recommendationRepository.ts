/**
 * HIKMAT TANI - Recommendation & Three-Layer Decision Repository
 * 
 * Menangani 3 lapisan secara terpisah:
 * - Recommendation (Saran sistem)
 * - FarmerDecision (Keputusan petani)
 * - ActualAction (Tindakan riil / sejarah lapangan)
 */

import {
  ActualAction,
  ContextType,
  DecisionRecord,
  FarmerDecision,
  Recommendation,
} from '../../types/index.ts';
import { db } from '../database.ts';

export const recommendationRepository = {
  // --- Lapisan 1: Recommendation ---
  async createRecommendation(rec: Recommendation): Promise<string> {
    return await db.recommendations.add(rec);
  },

  async getRecommendationsByCropSeason(
    cropSeasonId: string,
    contextType?: ContextType
  ): Promise<Recommendation[]> {
    if (contextType) {
      return await db.recommendations
        .where('[cropSeasonId+contextType]')
        .equals([cropSeasonId, contextType])
        .reverse()
        .sortBy('createdAt');
    }
    return await db.recommendations
      .where('cropSeasonId')
      .equals(cropSeasonId)
      .reverse()
      .sortBy('createdAt');
  },

  // --- Lapisan 2: Farmer Decision ---
  async recordFarmerDecision(decision: FarmerDecision): Promise<string> {
    return await db.farmerDecisions.add(decision);
  },

  async getDecisionsByCropSeason(cropSeasonId: string): Promise<FarmerDecision[]> {
    return await db.farmerDecisions
      .where('cropSeasonId')
      .equals(cropSeasonId)
      .reverse()
      .sortBy('createdAt');
  },

  // --- Lapisan 3: Actual Action ---
  async recordActualAction(action: ActualAction): Promise<string> {
    return await db.actualActions.add(action);
  },

  async getActualActionsByCropSeason(cropSeasonId: string): Promise<ActualAction[]> {
    return await db.actualActions
      .where('cropSeasonId')
      .equals(cropSeasonId)
      .reverse()
      .sortBy('performedAt');
  },

  /**
   * Menggabungkan data Tiga Lapisan untuk keperluan audit & analisis riwayat
   */
  async getCompositeDecisionRecord(
    actualActionId: string
  ): Promise<DecisionRecord | undefined> {
    const actualAction = await db.actualActions.get(actualActionId);
    if (!actualAction) return undefined;

    let farmerDecision: FarmerDecision | undefined;
    if (actualAction.decisionId) {
      farmerDecision = await db.farmerDecisions.get(actualAction.decisionId);
    }

    let recommendation: Recommendation | undefined;
    if (farmerDecision?.recommendationId) {
      recommendation = await db.recommendations.get(farmerDecision.recommendationId);
    }

    return {
      id: `composite-${actualAction.id}`,
      cropSeasonId: actualAction.cropSeasonId,
      activityId: actualAction.activityId,
      contextType: (recommendation?.contextType || 'OTHER') as ContextType,
      recommendation,
      farmerDecision,
      actualAction,
      createdAt: actualAction.createdAt,
    };
  },
};
