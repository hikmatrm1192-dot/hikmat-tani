/**
 * HIKMAT TANI - Offline Outbox & Synchronization Foundation
 * 
 * Prinsip:
 * - Operasi mutasi lokal menghasilkan entri outbox dengan operationId unik (Idempotency).
 * - Tidak mengandalkan timestamp sebagai satu-satunya penentu sinkronisasi.
 */

import { EntityId, ISODateString } from './common.ts';

export type SyncEntityType =
  | 'FARMER'
  | 'LAND'
  | 'CROP_SEASON'
  | 'ACTIVITY'
  | 'FERTILIZER_APPLICATION'
  | 'OPT_OBSERVATION'
  | 'FARMER_DECISION'
  | 'ACTUAL_ACTION'
  | 'FERTILIZER'
  | 'OPT'
  | 'NATURAL_ENEMY'
  | 'REFERENCE'
  | 'KNOWLEDGE_ARTICLE';

export type SyncAction = 'CREATE' | 'UPDATE' | 'DELETE';

export type SyncStatus = 'PENDING' | 'SYNCING' | 'FAILED';

export interface SyncOutboxItem {
  id: EntityId;                 // UUID unik item antrean outbox
  operationId: string;          // UUID idempotency unik per operasi mutasi
  entityType: SyncEntityType;
  entityId: EntityId;
  action: SyncAction;
  payload: Record<string, unknown>; // Snapshot payload data
  createdAt: ISODateString;
  retryCount: number;
  status: SyncStatus;
  errorMessage?: string;
}
