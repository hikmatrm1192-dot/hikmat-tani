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
    return await db.activities.add(activity);
  },

  /**
   * Operasi Atomik: Simpan Aktivitas + Detail Pemupukan
   */
  async createFertilizerActivity(
    activity: Activity,
    fertilizerApp: FertilizerApplication
  ): Promise<{ activityId: string; fertilizerAppId: string }> {
    return await db.transaction('rw', [db.activities, db.fertilizerApplications], async () => {
      await db.activities.add(activity);
      await db.fertilizerApplications.add(fertilizerApp);
      return {
        activityId: activity.id,
        fertilizerAppId: fertilizerApp.id,
      };
    });
  },

  /**
   * Operasi Atomik: Simpan Aktivitas + Pengamatan OPT
   */
  async createOptActivity(
    activity: Activity,
    optObservation: OptObservation
  ): Promise<{ activityId: string; optObservationId: string }> {
    return await db.transaction('rw', [db.activities, db.optObservations], async () => {
      await db.activities.add(activity);
      await db.optObservations.add(optObservation);
      return {
        activityId: activity.id,
        optObservationId: optObservation.id,
      };
    });
  },

  async getFertilizerApplications(activityId: string): Promise<FertilizerApplication[]> {
    return await db.fertilizerApplications.where('activityId').equals(activityId).toArray();
  },

  async getOptObservations(activityId: string): Promise<OptObservation[]> {
    return await db.optObservations.where('activityId').equals(activityId).toArray();
  },

  async delete(id: string): Promise<void> {
    await db.activities.delete(id);
  },
};
