/**
 * HIKMAT TANI - Master Knowledge & Reference Repository
 */

import {
  Fertilizer,
  KnowledgeArticle,
  NaturalEnemy,
  Opt,
  Reference,
  RiceVariety,
} from '../../types/index.ts';
import { db } from '../database.ts';

export const knowledgeRepository = {
  // --- References ---
  async getReferenceById(id: string): Promise<Reference | undefined> {
    return await db.references.get(id);
  },

  async getAllReferences(): Promise<Reference[]> {
    return await db.references.toArray();
  },

  // --- Master Fertilizers ---
  async getAllFertilizers(): Promise<Fertilizer[]> {
    return await db.fertilizers.toArray();
  },

  async getFertilizerById(id: string): Promise<Fertilizer | undefined> {
    return await db.fertilizers.get(id);
  },

  async searchFertilizers(query: string): Promise<Fertilizer[]> {
    const q = query.toLowerCase().trim();
    if (!q) return await db.fertilizers.toArray();
    return await db.fertilizers
      .filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.aliases.some((a) => a.toLowerCase().includes(q))
      )
      .toArray();
  },

  // --- Master OPTs ---
  async getAllOpts(): Promise<Opt[]> {
    return await db.opts.toArray();
  },

  async getOptById(id: string): Promise<Opt | undefined> {
    return await db.opts.get(id);
  },

  async searchOpts(query: string): Promise<Opt[]> {
    const q = query.toLowerCase().trim();
    if (!q) return await db.opts.toArray();
    return await db.opts
      .filter(
        (opt) =>
          opt.commonName.toLowerCase().includes(q) ||
          (opt.scientificName && opt.scientificName.toLowerCase().includes(q)) ||
          opt.aliases.some((a) => a.toLowerCase().includes(q))
      )
      .toArray();
  },

  // --- Natural Enemies ---
  async getAllNaturalEnemies(): Promise<NaturalEnemy[]> {
    return await db.naturalEnemies.toArray();
  },

  async getNaturalEnemiesByOptId(optId: string): Promise<NaturalEnemy[]> {
    return await db.naturalEnemies
      .filter((ne) => ne.targetOptIds.includes(optId))
      .toArray();
  },

  // --- Varieties ---
  async getAllVarieties(): Promise<RiceVariety[]> {
    return await db.riceVarieties.toArray();
  },

  async getVarietyById(id: string): Promise<RiceVariety | undefined> {
    return await db.riceVarieties.get(id);
  },

  // --- Knowledge Articles ---
  async getAllArticles(): Promise<KnowledgeArticle[]> {
    return await db.knowledgeArticles.toArray();
  },

  async getArticlesByCategory(category: string): Promise<KnowledgeArticle[]> {
    return await db.knowledgeArticles.where('category').equals(category).toArray();
  },
};
