/**
 * HIKMAT TANI - Farmer Repository
 */

import { Farmer } from '../../types/index.ts';
import { db } from '../database.ts';
import { outboxRepository } from './outboxRepository.ts';

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
    const now = new Date().toISOString();
    const item: Farmer = {
      ...farmer,
      createdAt: farmer.createdAt || now,
      updatedAt: farmer.updatedAt || now,
    };
    await db.farmers.add(item);
    await outboxRepository.recordMutation('FARMER', item.id, 'CREATE', item);
    return item.id;
  },

  async update(id: string, updates: Partial<Farmer>): Promise<number> {
    const now = new Date().toISOString();
    const count = await db.farmers.update(id, {
      ...updates,
      updatedAt: now,
    });
    const updated = await db.farmers.get(id);
    if (updated) {
      await outboxRepository.recordMutation('FARMER', id, 'UPDATE', updated);
    }
    return count;
  },

  async delete(id: string): Promise<void> {
    await db.farmers.delete(id);
    await outboxRepository.recordMutation('FARMER', id, 'DELETE', { id });
  },
};
