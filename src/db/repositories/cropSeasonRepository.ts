/**
 * HIKMAT TANI - CropSeason Repository
 */

import { CropSeason, CropSeasonStatus } from '../../types/index.ts';
import { db } from '../database.ts';

export const cropSeasonRepository = {
  async getById(id: string): Promise<CropSeason | undefined> {
    return await db.cropSeasons.get(id);
  },

  async getAll(): Promise<CropSeason[]> {
    return await db.cropSeasons.toArray();
  },

  async getByLandId(landId: string): Promise<CropSeason[]> {
    return await db.cropSeasons.where('landId').equals(landId).toArray();
  },

  async getActiveByLandId(landId: string): Promise<CropSeason | undefined> {
    return await db.cropSeasons
      .where('[landId+status]')
      .equals([landId, 'ACTIVE'])
      .first();
  },

  async getAllActive(): Promise<CropSeason[]> {
    return await db.cropSeasons.where('status').equals('ACTIVE').toArray();
  },

  async create(cropSeason: CropSeason): Promise<string> {
    return await db.cropSeasons.add(cropSeason);
  },

  async updateStatus(id: string, status: CropSeasonStatus): Promise<number> {
    return await db.cropSeasons.update(id, {
      status,
      updatedAt: new Date().toISOString(),
    });
  },

  async update(id: string, updates: Partial<CropSeason>): Promise<number> {
    return await db.cropSeasons.update(id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },

  async delete(id: string): Promise<void> {
    await db.cropSeasons.delete(id);
  },
};
