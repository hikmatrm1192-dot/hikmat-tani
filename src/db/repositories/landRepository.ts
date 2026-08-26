/**
 * HIKMAT TANI - Land Repository
 */

import { Land } from '../../types/index.ts';
import { db } from '../database.ts';

export const landRepository = {
  async getById(id: string): Promise<Land | undefined> {
    return await db.lands.get(id);
  },

  async getAll(): Promise<Land[]> {
    return await db.lands.toArray();
  },

  async getByFarmerId(farmerId: string): Promise<Land[]> {
    return await db.lands.where('farmerId').equals(farmerId).toArray();
  },

  async create(land: Land): Promise<string> {
    return await db.lands.add(land);
  },

  async update(id: string, updates: Partial<Land>): Promise<number> {
    return await db.lands.update(id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },

  async delete(id: string): Promise<void> {
    await db.lands.delete(id);
  },
};
