/**
 * HIKMAT TANI - Seedbed (Persemaian) Repository
 * 
 * Prinsip:
 * - Menangani penyimpanan catatan persemaian.
 * - Mencatat ke syncOutbox untuk sinkronisasi dua arah.
 */

import { db } from '../database.ts';
import { Seedbed } from '../../types/index.ts';
import { outboxRepository } from './outboxRepository.ts';

export const seedbedRepository = {
  async getById(id: string): Promise<Seedbed | undefined> {
    return db.seedbeds.get(id);
  },

  async getByCropSeasonId(cropSeasonId: string): Promise<Seedbed[]> {
    return db.seedbeds.where('cropSeasonId').equals(cropSeasonId).toArray();
  },

  async getByActivityId(activityId: string): Promise<Seedbed | undefined> {
    return db.seedbeds.where('activityId').equals(activityId).first();
  },

  async create(seedbed: Seedbed): Promise<string> {
    const now = new Date().toISOString();
    const item: Seedbed = {
      ...seedbed,
      createdAt: seedbed.createdAt || now,
      updatedAt: seedbed.updatedAt || now,
    };

    await db.seedbeds.add(item);
    await outboxRepository.recordMutation('SEEDBED', item.id, 'CREATE', item);
    return item.id;
  },

  async update(id: string, updates: Partial<Seedbed>): Promise<void> {
    const now = new Date().toISOString();
    const cleanUpdates = {
      ...updates,
      updatedAt: now,
    };
    await db.seedbeds.update(id, cleanUpdates);
    const updated = await db.seedbeds.get(id);
    if (updated) {
      await outboxRepository.recordMutation('SEEDBED', id, 'UPDATE', updated);
    }
  },

  async delete(id: string): Promise<void> {
    await db.seedbeds.delete(id);
    await outboxRepository.recordMutation('SEEDBED', id, 'DELETE', { id });
  },
};
