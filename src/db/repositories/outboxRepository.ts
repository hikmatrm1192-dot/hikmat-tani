/**
 * HIKMAT TANI - Sync Outbox Repository (Storage Foundation)
 */

import { SyncOutboxItem, SyncStatus } from '../../types/index.ts';
import { db } from '../database.ts';

export const outboxRepository = {
  async add(item: SyncOutboxItem): Promise<string> {
    return await db.syncOutbox.add(item);
  },

  async getPending(): Promise<SyncOutboxItem[]> {
    return await db.syncOutbox.where('status').equals('PENDING').toArray();
  },

  async updateStatus(id: string, status: SyncStatus, errorMessage?: string): Promise<number> {
    return await db.syncOutbox.update(id, {
      status,
      errorMessage,
    });
  },

  async getByOperationId(operationId: string): Promise<SyncOutboxItem | undefined> {
    return await db.syncOutbox.where('operationId').equals(operationId).first();
  },

  async countPending(): Promise<number> {
    return await db.syncOutbox.where('status').equals('PENDING').count();
  },

  async clearSynced(id: string): Promise<void> {
    await db.syncOutbox.delete(id);
  },
};
