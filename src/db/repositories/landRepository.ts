/**
 * HIKMAT TANI - Land Repository
 */

import { Land } from '../../types/index.ts';
import { db } from '../database.ts';
import { outboxRepository } from './outboxRepository.ts';

export const landRepository = {
  async getById(id: string): Promise<Land | undefined> {
    return await db.lands.get(id);
  },

  async getAll(includeArchived = true): Promise<Land[]> {
    const list = await db.lands.toArray();
    if (includeArchived) return list;
    return list.filter((l) => l.status !== 'ARCHIVED');
  },

  async getByFarmerId(farmerId: string, includeArchived = true): Promise<Land[]> {
    const list = await db.lands.where('farmerId').equals(farmerId).toArray();
    if (includeArchived) return list;
    return list.filter((l) => l.status !== 'ARCHIVED');
  },

  async create(land: Land): Promise<string> {
    const now = new Date().toISOString();
    const item: Land = {
      ...land,
      status: land.status || 'ACTIVE',
      createdAt: land.createdAt || now,
      updatedAt: land.updatedAt || now,
    };
    await db.lands.add(item);
    await outboxRepository.recordMutation('LAND', item.id, 'CREATE', item);
    return item.id;
  },

  async update(id: string, updates: Partial<Land>): Promise<number> {
    const now = new Date().toISOString();
    const cleanUpdates = {
      ...updates,
      updatedAt: now,
    };
    const count = await db.lands.update(id, cleanUpdates);
    const updated = await db.lands.get(id);
    if (updated) {
      await outboxRepository.recordMutation('LAND', id, 'UPDATE', updated);
    }
    return count;
  },

  /**
   * Arsipkan Lahan (Tindakan Utama - Aman, Mempertahankan Seluruh Riwayat Data)
   */
  async archive(id: string): Promise<void> {
    await this.update(id, { status: 'ARCHIVED' });
  },

  /**
   * Aktifkan Kembali Lahan yang Diarsipkan
   */
  async unarchive(id: string): Promise<void> {
    await this.update(id, { status: 'ACTIVE' });
  },

  /**
   * Hapus Permanen Lahan (Cascade Audit Aman Tanpa Meninggalkan Orphan Record)
   */
  async safeDelete(id: string): Promise<void> {
    const land = await db.lands.get(id);
    if (!land) return;

    await db.transaction(
      'rw',
      [
        db.lands,
        db.cropSeasons,
        db.activities,
        db.fertilizerApplications,
        db.optObservations,
        db.seedbeds,
        db.expenses,
        db.recommendations,
        db.farmerDecisions,
        db.actualActions,
        db.syncOutbox,
      ],
      async () => {
        // 1. Cari seluruh musim tanam di lahan ini
        const seasons = await db.cropSeasons.where('landId').equals(id).toArray();
        const seasonIds = seasons.map((s) => s.id);

        for (const seasonId of seasonIds) {
          // Cari aktivitas di musim ini
          const activities = await db.activities.where('cropSeasonId').equals(seasonId).toArray();
          const activityIds = activities.map((a) => a.id);

          // Hapus sub-record aktivitas
          for (const actId of activityIds) {
            await db.fertilizerApplications.where('activityId').equals(actId).delete();
            await db.optObservations.where('activityId').equals(actId).delete();
            await db.seedbeds.where('activityId').equals(actId).delete();
            await db.expenses.where('activityId').equals(actId).delete();
          }

          // Hapus aktivitas
          await db.activities.where('cropSeasonId').equals(seasonId).delete();

          // Hapus sisa seedbed & expense musim ini
          await db.seedbeds.where('cropSeasonId').equals(seasonId).delete();
          await db.expenses.where('cropSeasonId').equals(seasonId).delete();

          // Hapus rekomendasi, keputusan, aksi aktual
          await db.recommendations.where('cropSeasonId').equals(seasonId).delete();
          await db.farmerDecisions.where('cropSeasonId').equals(seasonId).delete();
          await db.actualActions.where('cropSeasonId').equals(seasonId).delete();

          // Hapus musim tanam
          await db.cropSeasons.delete(seasonId);
          await outboxRepository.recordMutation('CROP_SEASON', seasonId, 'DELETE', { id: seasonId });
        }

        // Hapus lahan
        await db.lands.delete(id);
        await outboxRepository.recordMutation('LAND', id, 'DELETE', { id });
      }
    );
  },

  async delete(id: string): Promise<void> {
    await this.safeDelete(id);
  },
};
