/**
 * HIKMAT TANI - Layanan Cadangkan & Pulihkan Data (Backup & Restore)
 * 
 * Prinsip:
 * - Menyimpan seluruh data pribadi & operasional budidaya petani ke file JSON.
 * - Master data knowledge (varietas, pupuk, opt, musuh alami, artikel, rujukan bawaan)
 *   tidak perlu di-export ulang jika bawaan sistem, hanya data operasional pengguna.
 * - Validasi ketat saat proses pemulihan (restore) agar tidak merusak database.
 */

import { db } from '../db/database.ts';
import {
  Activity,
  ActualAction,
  CropSeason,
  CultivationExpense,
  Farmer,
  FarmerDecision,
  FertilizerApplication,
  HikmatBackup,
  HikmatBackupData,
  Land,
  OptObservation,
  Recommendation,
  Seedbed,
} from '../types/index.ts';

export interface BackupResult {
  fileName: string;
  backup: HikmatBackup;
  jsonString: string;
}

export interface RestoreSummary {
  success: boolean;
  message: string;
  recordCounts: {
    farmers: number;
    lands: number;
    cropSeasons: number;
    activities: number;
    fertilizerApplications: number;
    optObservations: number;
    seedbeds: number;
    expenses: number;
    recommendations: number;
    farmerDecisions: number;
    actualActions: number;
  };
}

export const backupService = {
  /**
   * Mengumpulkan seluruh data operasional petani ke struktur HikmatBackup
   */
  async generateBackup(): Promise<BackupResult> {
    const [
      farmers,
      lands,
      cropSeasons,
      activities,
      fertilizerApplications,
      optObservations,
      seedbeds,
      expenses,
      recommendations,
      farmerDecisions,
      actualActions,
    ] = await Promise.all([
      db.farmers.toArray(),
      db.lands.toArray(),
      db.cropSeasons.toArray(),
      db.activities.toArray(),
      db.fertilizerApplications.toArray(),
      db.optObservations.toArray(),
      db.seedbeds.toArray(),
      db.expenses.toArray(),
      db.recommendations.toArray(),
      db.farmerDecisions.toArray(),
      db.actualActions.toArray(),
    ]);

    const backupData: Partial<HikmatBackupData> = {
      farmers,
      lands,
      cropSeasons,
      activities,
      fertilizerApplications,
      optObservations,
      seedbeds,
      expenses,
      recommendations,
      farmerDecisions,
      actualActions,
    };

    const recordCounts: Record<string, number> = {
      farmers: farmers.length,
      lands: lands.length,
      cropSeasons: cropSeasons.length,
      activities: activities.length,
      fertilizerApplications: fertilizerApplications.length,
      optObservations: optObservations.length,
      seedbeds: seedbeds.length,
      expenses: expenses.length,
      recommendations: recommendations.length,
      farmerDecisions: farmerDecisions.length,
      actualActions: actualActions.length,
    };

    const backup: HikmatBackup = {
      format: 'hikmat-tani-backup',
      version: 1,
      createdAt: new Date().toISOString(),
      metadata: {
        backupVersion: '1.0.0',
        appVersion: '1.0.0',
        createdAt: new Date().toISOString(),
        recordCounts,
      },
      data: backupData,
    };

    const jsonString = JSON.stringify(backup, null, 2);
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `cadangan-hikmat-tani-${dateStr}.json`;

    return {
      fileName,
      backup,
      jsonString,
    };
  },

  /**
   * Mengunduh berkas backup JSON langsung ke penyimpanan lokal pengguna
   */
  async downloadBackup(): Promise<{ success: boolean; fileName: string }> {
    try {
      const { fileName, jsonString } = await this.generateBackup();
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return { success: true, fileName };
    } catch (err) {
      console.error('Gagal mengunduh cadangan:', err);
      throw new Error('Gagal membuat berkas cadangan data.');
    }
  },

  /**
   * Memvalidasi format berkas JSON cadangan sebelum dieksekusi
   */
  validateBackupData(jsonObj: unknown): jsonObj is HikmatBackup {
    if (!jsonObj || typeof jsonObj !== 'object') return false;
    const candidate = jsonObj as Partial<HikmatBackup>;

    // Harus memiliki format 'hikmat-tani-backup' ATAU metadata.backupVersion (kompatibilitas)
    const isHikmatFormat =
      candidate.format === 'hikmat-tani-backup' ||
      (candidate.metadata && typeof candidate.metadata === 'object' && 'backupVersion' in candidate.metadata);

    if (!isHikmatFormat) return false;
    if (!candidate.data || typeof candidate.data !== 'object') return false;

    // Pastikan tidak ada data yang bukan bertipe array jika properti didefinisikan
    const dataKeys: (keyof HikmatBackupData)[] = [
      'farmers',
      'lands',
      'cropSeasons',
      'activities',
      'fertilizerApplications',
      'optObservations',
      'seedbeds',
      'expenses',
      'recommendations',
      'farmerDecisions',
      'actualActions',
    ];

    for (const key of dataKeys) {
      if (candidate.data[key] !== undefined && !Array.isArray(candidate.data[key])) {
        return false;
      }
    }

    return true;
  },

  /**
   * Memvalidasi integritas relasional data sebelum transaksi pemulihan
   */
  validateDataIntegrity(data: Partial<HikmatBackupData>): { valid: boolean; reason?: string } {
    // 1. Validasi Lahan
    if (data.lands && Array.isArray(data.lands)) {
      for (const land of data.lands) {
        if (!land.id || typeof land.name !== 'string' || typeof land.areaHa !== 'number' || land.areaHa <= 0) {
          return { valid: false, reason: 'Data petak lahan tidak memiliki ID atau luas yang valid.' };
        }
      }
    }

    // 2. Validasi Musim Tanam
    if (data.cropSeasons && Array.isArray(data.cropSeasons)) {
      for (const season of data.cropSeasons) {
        if (!season.id || !season.landId || !season.plantingDate) {
          return { valid: false, reason: 'Data musim tanam tidak lengkap atau kehilangan rujukan lahan.' };
        }
      }
    }

    // 3. Validasi Aktivitas
    if (data.activities && Array.isArray(data.activities)) {
      for (const act of data.activities) {
        if (!act.id || !act.cropSeasonId || !act.category || !act.activityDate) {
          return { valid: false, reason: 'Data aktivitas tidak lengkap atau kehilangan rujukan musim tanam.' };
        }
      }
    }

    // 4. Validasi Pemupukan
    if (data.fertilizerApplications && Array.isArray(data.fertilizerApplications)) {
      for (const fa of data.fertilizerApplications) {
        if (!fa.id || !fa.activityId || typeof fa.amountKg !== 'number' || fa.amountKg < 0) {
          return { valid: false, reason: 'Data aplikasi pemupukan tidak valid atau bernilai negatif.' };
        }
      }
    }

    // 5. Validasi Pengamatan OPT
    if (data.optObservations && Array.isArray(data.optObservations)) {
      for (const opt of data.optObservations) {
        if (!opt.id || !opt.activityId) {
          return { valid: false, reason: 'Data pengamatan OPT tidak memiliki rujukan aktivitas yang valid.' };
        }
      }
    }

    return { valid: true };
  },

  /**
   * Memulihkan data dari berkas JSON cadangan ke dalam database Dexie
   */
  async restoreBackup(backup: HikmatBackup): Promise<RestoreSummary> {
    if (!this.validateBackupData(backup)) {
      throw new Error('File cadangan tidak dapat digunakan.');
    }

    const data = backup.data;
    if (!data) {
      throw new Error('File cadangan tidak dapat digunakan.');
    }

    const integrity = this.validateDataIntegrity(data);
    if (!integrity.valid) {
      throw new Error(`File cadangan tidak dapat digunakan: ${integrity.reason || 'Integritas data rusak'}`);
    }

    const counts = {
      farmers: 0,
      lands: 0,
      cropSeasons: 0,
      activities: 0,
      fertilizerApplications: 0,
      optObservations: 0,
      seedbeds: 0,
      expenses: 0,
      recommendations: 0,
      farmerDecisions: 0,
      actualActions: 0,
    };

    // Jalankan transaksi atomik untuk memasukkan seluruh data
    await db.transaction(
      'rw',
      [
        db.farmers,
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
      ],
      async () => {
        // 1. Profil Petani
        if (data.farmers && Array.isArray(data.farmers) && data.farmers.length > 0) {
          for (const item of data.farmers) {
            await db.farmers.put(item);
            counts.farmers++;
          }
        }

        // 2. Lahan
        if (data.lands && Array.isArray(data.lands)) {
          for (const item of data.lands) {
            await db.lands.put(item);
            counts.lands++;
          }
        }

        // 3. Musim Tanam
        if (data.cropSeasons && Array.isArray(data.cropSeasons)) {
          for (const item of data.cropSeasons) {
            await db.cropSeasons.put(item);
            counts.cropSeasons++;
          }
        }

        // 4. Aktivitas
        if (data.activities && Array.isArray(data.activities)) {
          for (const item of data.activities) {
            await db.activities.put(item);
            counts.activities++;
          }
        }

        // 5. Pemupukan
        if (data.fertilizerApplications && Array.isArray(data.fertilizerApplications)) {
          for (const item of data.fertilizerApplications) {
            await db.fertilizerApplications.put(item);
            counts.fertilizerApplications++;
          }
        }

        // 6. Pengamatan OPT
        if (data.optObservations && Array.isArray(data.optObservations)) {
          for (const item of data.optObservations) {
            await db.optObservations.put(item);
            counts.optObservations++;
          }
        }

        // 7. Persemaian (Seedbed)
        if (data.seedbeds && Array.isArray(data.seedbeds)) {
          for (const item of data.seedbeds) {
            await db.seedbeds.put(item);
            counts.seedbeds++;
          }
        }

        // 8. Pengeluaran / Biaya (Expenses)
        if (data.expenses && Array.isArray(data.expenses)) {
          for (const item of data.expenses) {
            await db.expenses.put(item);
            counts.expenses++;
          }
        }

        // 9. Rekomendasi
        if (data.recommendations && Array.isArray(data.recommendations)) {
          for (const item of data.recommendations) {
            await db.recommendations.put(item);
            counts.recommendations++;
          }
        }

        // 10. Keputusan Petani
        if (data.farmerDecisions && Array.isArray(data.farmerDecisions)) {
          for (const item of data.farmerDecisions) {
            await db.farmerDecisions.put(item);
            counts.farmerDecisions++;
          }
        }

        // 11. Tindakan Aktual
        if (data.actualActions && Array.isArray(data.actualActions)) {
          for (const item of data.actualActions) {
            await db.actualActions.put(item);
            counts.actualActions++;
          }
        }
      }
    );

    return {
      success: true,
      message: 'Data berhasil dipulihkan ke perangkat.',
      recordCounts: counts,
    };
  },
};
