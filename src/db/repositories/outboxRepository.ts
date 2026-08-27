/**
 * HIKMAT TANI - Sync Outbox Repository (Storage Foundation)
 */

import { SyncOutboxItem, SyncStatus } from '../../types/index.ts';
import { db } from '../database.ts';

export const outboxRepository = {
  /**
   * Menambahkan item ke antrean sinkronisasi dengan jaminan idempotency via operationId.
   */
  async add(item: SyncOutboxItem): Promise<string> {
    if (item.operationId) {
      const existing = await db.syncOutbox.where('operationId').equals(item.operationId).first();
      if (existing) {
        return existing.id;
      }
    }
    return await db.syncOutbox.add(item);
  },

  /**
   * Helper pendaftaran mutasi ke outbox secara otomatis
   */
  async enqueue(
    entityType: SyncOutboxItem['entityType'],
    entityId: string,
    action: SyncOutboxItem['action'],
    payload: Record<string, unknown>,
    operationId?: string
  ): Promise<string> {
    const opId = operationId || `op-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const item: SyncOutboxItem = {
      id: `outbox-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      operationId: opId,
      entityType,
      entityId,
      action,
      payload,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      status: 'PENDING',
    };
    return await this.add(item);
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
