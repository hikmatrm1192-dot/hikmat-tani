/**
 * HIKMAT TANI - Farmer Repository
 */

import { Farmer } from '../../types/index.ts';
import { db } from '../database.ts';

export const farmerRepository = {
  async getById(id: string): Promise<Farmer | undefined> {
    return await db.farmers.get(id);
  },

  async getAll(): Promise<Farmer[]> {
    return await db.farmers.toArray();
  },

  async getFirstActive(): Promise<Farmer | undefined> {
    return await db.farmers.toCollection().first();
  },

  async create(farmer: Farmer): Promise<string> {
    return await db.farmers.add(farmer);
  },

  async update(id: string, updates: Partial<Farmer>): Promise<number> {
    return await db.farmers.update(id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },

  async delete(id: string): Promise<void> {
    await db.farmers.delete(id);
  },
};
