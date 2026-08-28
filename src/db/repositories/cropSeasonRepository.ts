/**
 * HIKMAT TANI - CropSeason Repository
 */

import { CropSeason, CropSeasonStatus } from '../../types/index.ts';
import { db } from '../database.ts';
import { outboxRepository } from './outboxRepository.ts';

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
    const now = new Date().toISOString();
    const item: CropSeason = {
      ...cropSeason,
      createdAt: cropSeason.createdAt || now,
      updatedAt: cropSeason.updatedAt || now,
    };
    await db.cropSeasons.add(item);
    await outboxRepository.recordMutation('CROP_SEASON', item.id, 'CREATE', item);
    return item.id;
  },

  async updateStatus(id: string, status: CropSeasonStatus): Promise<number> {
    return await this.update(id, { status });
  },

  async update(id: string, updates: Partial<CropSeason>): Promise<number> {
    const now = new Date().toISOString();
    const count = await db.cropSeasons.update(id, {
      ...updates,
      updatedAt: now,
    });
    const updated = await db.cropSeasons.get(id);
    if (updated) {
      await outboxRepository.recordMutation('CROP_SEASON', id, 'UPDATE', updated);
    }
    return count;
  },

  async delete(id: string): Promise<void> {
    await db.cropSeasons.delete(id);
    await outboxRepository.recordMutation('CROP_SEASON', id, 'DELETE', { id });
  },
};
