/**
 * HIKMAT TANI - Activity Repository
 * 
 * Mendukung operasi atomik:
 * - Menyimpan aktivitas umum.
 * - Menyimpan aktivitas pemupukan atomik (+ FertilizerApplication).
 * - Menyimpan aktivitas pengamatan OPT atomik (+ OptObservation).
 */

import {
  Activity,
  ActivityCategory,
  FertilizerApplication,
  OptObservation,
} from '../../types/index.ts';
import { db } from '../database.ts';
import { outboxRepository } from './outboxRepository.ts';
import { syncEngine } from '../../sync/syncEngine.ts';

export const activityRepository = {
  async getById(id: string): Promise<Activity | undefined> {
    return await db.activities.get(id);
  },

  async getByCropSeasonId(cropSeasonId: string): Promise<Activity[]> {
    return await db.activities
      .where('cropSeasonId')
      .equals(cropSeasonId)
      .reverse()
      .sortBy('activityDate');
  },

  async getByCategory(cropSeasonId: string, category: ActivityCategory): Promise<Activity[]> {
    return await db.activities
      .where('[cropSeasonId+category]')
      .equals([cropSeasonId, category])
      .reverse()
      .sortBy('activityDate');
  },

  async create(activity: Activity): Promise<string> {
    const now = new Date().toISOString();
    const item: Activity = {
      ...activity,
      createdAt: activity.createdAt || now,
      updatedAt: activity.updatedAt || now,
    };
    await db.activities.add(item);
    await outboxRepository.recordMutation('ACTIVITY', item.id, 'CREATE', item);
    return item.id;
  },

  /**
   * Operasi Atomik: Simpan Aktivitas + Detail Pemupukan
   */
  async createFertilizerActivity(
    activity: Activity,
    fertilizerApp: FertilizerApplication
  ): Promise<{ activityId: string; fertilizerAppId: string }> {
    const now = new Date().toISOString();
    const actItem: Activity = {
      ...activity,
      createdAt: activity.createdAt || now,
      updatedAt: activity.updatedAt || now,
    };
    const fertItem: FertilizerApplication = {
      ...fertilizerApp,
      createdAt: fertilizerApp.createdAt || now,
    };

    const result = await db.transaction('rw', [db.activities, db.fertilizerApplications, db.syncOutbox], async () => {
      await db.activities.add(actItem);
      await db.fertilizerApplications.add(fertItem);
      await outboxRepository.recordMutation('ACTIVITY', actItem.id, 'CREATE', actItem, undefined, { skipNotify: true });
      await outboxRepository.recordMutation('FERTILIZER_APPLICATION', fertItem.id, 'CREATE', fertItem, undefined, { skipNotify: true });
      return {
        activityId: actItem.id,
        fertilizerAppId: fertItem.id,
      };
    });

    // Notifikasi sinkronisasi setelah transaksi selesai di-commit ke IndexedDB
    syncEngine.notifyMutation();

    return result;
  },

  /**
   * Operasi Atomik: Simpan Aktivitas + Pengamatan OPT
   */
  async createOptActivity(
    activity: Activity,
    optObservation: OptObservation
  ): Promise<{ activityId: string; optObservationId: string }> {
    const now = new Date().toISOString();
    const actItem: Activity = {
      ...activity,
      createdAt: activity.createdAt || now,
      updatedAt: activity.updatedAt || now,
    };
    const optItem: OptObservation = {
      ...optObservation,
      createdAt: optObservation.createdAt || now,
    };

    const result = await db.transaction('rw', [db.activities, db.optObservations, db.syncOutbox], async () => {
      await db.activities.add(actItem);
      await db.optObservations.add(optItem);
      await outboxRepository.recordMutation('ACTIVITY', actItem.id, 'CREATE', actItem, undefined, { skipNotify: true });
      await outboxRepository.recordMutation('OPT_OBSERVATION', optItem.id, 'CREATE', optItem, undefined, { skipNotify: true });
      return {
        activityId: actItem.id,
        optObservationId: optItem.id,
      };
    });

    // Notifikasi sinkronisasi setelah transaksi selesai di-commit ke IndexedDB
    syncEngine.notifyMutation();

    return result;
  },

  async getFertilizerApplications(activityId: string): Promise<FertilizerApplication[]> {
    return await db.fertilizerApplications.where('activityId').equals(activityId).toArray();
  },

  async getOptObservations(activityId: string): Promise<OptObservation[]> {
    return await db.optObservations.where('activityId').equals(activityId).toArray();
  },

  async delete(id: string): Promise<void> {
    await db.activities.delete(id);
    await outboxRepository.recordMutation('ACTIVITY', id, 'DELETE', { id });
  },
};
