/**
 * HIKMAT TANI - Sync Outbox Repository (Storage Foundation)
 */

import Dexie from 'dexie';
import { SyncOutboxItem, SyncStatus } from '../../types/index.ts';
import { db } from '../database.ts';
import { syncEngine } from '../../sync/syncEngine.ts';

export interface OutboxMutationOptions {
  skipNotify?: boolean;
}

export const outboxRepository = {
  /**
   * Menambahkan item ke antrean sinkronisasi dengan jaminan idempotency via operationId.
   */
  async add(item: SyncOutboxItem, options?: OutboxMutationOptions): Promise<string> {
    if (item.operationId) {
      const existing = await db.syncOutbox.where('operationId').equals(item.operationId).first();
      if (existing) {
        return existing.id;
      }
    }
    const id = await db.syncOutbox.add(item);
    if (!options?.skipNotify) {
      Dexie.ignoreTransaction(() => {
        syncEngine.notifyMutation();
      });
    }
    return id;
  },

  /**
   * Helper pendaftaran mutasi ke outbox secara otomatis
   */
  async enqueue(
    entityType: SyncOutboxItem['entityType'],
    entityId: string,
    action: SyncOutboxItem['action'],
    payload: Record<string, any> | any,
    operationId?: string,
    options?: OutboxMutationOptions
  ): Promise<string> {
    const opId = operationId || `op-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const item: SyncOutboxItem = {
      id: `outbox-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      operationId: opId,
      entityType,
      entityId,
      action,
      payload: payload as Record<string, any>,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      status: 'PENDING',
    };
    return await this.add(item, options);
  },

  /**
   * Alias pencatatan mutasi lokal ke syncOutbox
   */
  async recordMutation(
    entityType: SyncOutboxItem['entityType'],
    entityId: string,
    action: SyncOutboxItem['action'],
    payload: Record<string, any> | any,
    operationId?: string,
    options?: OutboxMutationOptions
  ): Promise<string> {
    return await this.enqueue(entityType, entityId, action, payload, operationId, options);
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
