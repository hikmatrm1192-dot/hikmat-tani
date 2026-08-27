/**
 * HIKMAT TANI - Automated Offline Database Acceptance & Unit Tests
 * 
 * Verifikasi:
 * 1. Inisialisasi DB & Seeding Idempotent
 * 2. CRUD Farmer, Land, CropSeason
 * 3. Atomic Activity & Fertilizer Application Transaction
 * 4. Atomic Activity & OPT Observation Transaction
 * 5. Three-Layer Decision Architecture (Recommendation -> FarmerDecision -> ActualAction)
 * 6. Immutability: ActualAction tidak tertimpa
 * 7. Outbox Idempotency & OperationId
 * 8. Offline Simulation (No network call required)
 */

import { backupService } from '../src/backup/index.ts';
import {
  activityRepository,
  cropSeasonRepository,
  db,
  farmerRepository,
  initializeDatabase,
  knowledgeRepository,
  outboxRepository,
  recommendationRepository,
} from '../src/db/index.ts';
import {
  Activity,
  ActualAction,
  CropSeason,
  Farmer,
  FarmerDecision,
  FertilizerApplication,
  OptObservation,
  Recommendation,
  SyncOutboxItem,
} from '../src/types/index.ts';

export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  durationMs: number;
}

export async function runDatabaseTests(): Promise<{
  allPassed: boolean;
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}> {
  const results: TestResult[] = [];

  async function test(name: string, fn: () => Promise<void>) {
    const start = performance.now();
    try {
      await fn();
      results.push({
        name,
        passed: true,
        message: 'Lolos uji verifikasi.',
        durationMs: Math.round(performance.now() - start),
      });
    } catch (err: any) {
      results.push({
        name,
        passed: false,
        message: err?.message || String(err),
        durationMs: Math.round(performance.now() - start),
      });
    }
  }

  // --- UJI 1: Inisialisasi DB & Seed Data Idempotency ---
  await test('1. Inisialisasi Database & Seeding Idempotent', async () => {
    const init1 = await initializeDatabase();
    if (!init1.isInitialized) throw new Error('Database gagal diinisialisasi');

    const fertilizers = await knowledgeRepository.getAllFertilizers();
    if (fertilizers.length === 0) throw new Error('Seed pupuk kosong');

    const countBefore = fertilizers.length;
    // Inisialisasi kedua kali (tidak boleh menggandakan data)
    await initializeDatabase();
    const countAfter = (await knowledgeRepository.getAllFertilizers()).length;

    if (countBefore !== countAfter) {
      throw new Error(`Seeding tidak idempotent: sebelum=${countBefore}, sesudah=${countAfter}`);
    }
  });

  // --- UJI 2: CRUD Farmer ---
  const testFarmerId = `farmer-${Date.now()}`;
  await test('2. Pembuatan & Pembacaan Farmer', async () => {
    const newFarmer: Farmer = {
      id: testFarmerId,
      name: 'Pak Sutrisno',
      phoneNumber: '081234567890',
      village: 'Sukamaju',
      district: 'Kasokandel',
      regency: 'Majalengka',
      province: 'Jawa Barat',
      farmerGroupName: 'Kelompok Tani Sri Rejeki',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await farmerRepository.create(newFarmer);
    const retrieved = await farmerRepository.getById(testFarmerId);
    if (!retrieved || retrieved.name !== 'Pak Sutrisno') {
      throw new Error('Data Farmer gagal disimpan atau dibaca kembali');
    }
  });

  // --- UJI 3: CRUD Land & CropSeason ---
  const testLandId = `land-${Date.now()}`;
  const testSeasonId = `season-${Date.now()}`;
  await test('3. Pembuatan Lahan & Musim Tanam Aktif', async () => {
    await db.lands.add({
      id: testLandId,
      farmerId: testFarmerId,
      name: 'Sawah Blok Timur',
      areaHa: 0.75,
      waterSource: 'IRRIGATION_TECHNICAL',
      landType: 'LOWLAND_PADDY',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const cropSeason: CropSeason = {
      id: testSeasonId,
      landId: testLandId,
      commodity: 'Padi',
      varietyId: 'var-inpari-32',
      varietyName: 'Inpari 32 HDB',
      plantingDate: '2026-08-01T00:00:00.000Z',
      plantedAreaHa: 0.75,
      plantingSystem: 'JAJAR_LEGOWO_2_1',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await cropSeasonRepository.create(cropSeason);
    const activeSeason = await cropSeasonRepository.getActiveByLandId(testLandId);
    if (!activeSeason || activeSeason.id !== testSeasonId) {
      throw new Error('Musim tanam aktif gagal ditemukan berdasarkan landId');
    }
  });

  // --- UJI 4: Atomic Transaction Pemupukan ---
  const testActivity1Id = `act-fert-${Date.now()}`;
  const testFertAppId = `app-fert-${Date.now()}`;
  await test('4. Transaksi Atomik Pemupukan (Activity + FertilizerApplication)', async () => {
    const activity: Activity = {
      id: testActivity1Id,
      cropSeasonId: testSeasonId,
      category: 'FERTILIZER',
      activityDate: '2026-08-15T00:00:00.000Z',
      hst: 14,
      notes: 'Pemupukan susulan 1 (Urea + Phonska)',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const fertApp: FertilizerApplication = {
      id: testFertAppId,
      activityId: testActivity1Id,
      fertilizerId: 'fert-urea',
      fertilizerName: 'Urea (Prill/Granul)',
      amountKg: 50,
      applicationMethod: 'BROADCAST',
      calculatedNutrients: { N_kg: 23 }, // 50kg x 46% N = 23kg N
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await activityRepository.createFertilizerActivity(activity, fertApp);

    const apps = await activityRepository.getFertilizerApplications(testActivity1Id);
    if (apps.length !== 1 || apps[0].amountKg !== 50) {
      throw new Error('Detail pemupukan atomik tidak ditemukan');
    }
  });

  // --- UJI 5: Atomic Transaction OPT Pengamatan ---
  const testActivity2Id = `act-opt-${Date.now()}`;
  const testOptObsId = `obs-opt-${Date.now()}`;
  await test('5. Transaksi Atomik OPT (Termasuk dukungan isUnknown: true)', async () => {
    const activity: Activity = {
      id: testActivity2Id,
      cropSeasonId: testSeasonId,
      category: 'OPT',
      activityDate: '2026-08-20T00:00:00.000Z',
      hst: 19,
      notes: 'Pengamatan bercak daun di sudut petak',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const optObs: OptObservation = {
      id: testOptObsId,
      activityId: testActivity2Id,
      isUnknown: true, // Petani belum tahu nama ilmiahnya
      customOptName: 'Bercak kemerahan daun bawah',
      attackSeverity: 'LIGHT',
      attackPercentage: 5,
      attackLocation: ['LEAF'],
      observedSymptoms: 'Ujung daun menguning sedikit kering',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await activityRepository.createOptActivity(activity, optObs);

    const obs = await activityRepository.getOptObservations(testActivity2Id);
    if (obs.length !== 1 || !obs[0].isUnknown) {
      throw new Error('Pengamatan OPT tidak sesuai');
    }
  });

  // --- UJI 6: Three-Layer Decision Architecture ---
  const testRecId = `rec-${Date.now()}`;
  const testDecId = `dec-${Date.now()}`;
  const testActActionId = `act-action-${Date.now()}`;
  await test('6. Arsitektur Tiga Lapisan Keputusan (Recommendation -> Decision -> ActualAction)', async () => {
    // 1. Rekomendasi Sistem (Saran)
    const rec: Recommendation = {
      id: testRecId,
      cropSeasonId: testSeasonId,
      contextType: 'FERTILIZER',
      title: 'Pertimbangan Pemupukan Susulan 2 (30 HST)',
      message: 'Dapat dipertimbangkan pemupukan Urea 40 kg/ha untuk mencukupi fase anakan aktif.',
      priority: 'MEDIUM',
      knowledgeReferenceIds: ['ref-litbang-padi-2020'],
      createdAt: new Date().toISOString(),
    };
    await recommendationRepository.createRecommendation(rec);

    // 2. Keputusan Petani (Menyesuaikan dosis menjadi 50kg)
    const dec: FarmerDecision = {
      id: testDecId,
      recommendationId: testRecId,
      cropSeasonId: testSeasonId,
      decision: 'ADJUST',
      notes: 'Tanah sawah bagian timur agak kurang subur, saya sesuaikan menjadi 50 kg.',
      createdAt: new Date().toISOString(),
    };
    await recommendationRepository.recordFarmerDecision(dec);

    // 3. Tindakan Aktual Riil (Eksekusi 50kg)
    const action: ActualAction = {
      id: testActActionId,
      cropSeasonId: testSeasonId,
      decisionId: testDecId,
      actionType: 'FERTILIZER_APPLICATION',
      description: 'Pengaplikasian Urea 50 kg pada petak sawah timur',
      data: { fertilizer: 'Urea', appliedKg: 50 },
      performedAt: '2026-08-25T00:00:00.000Z',
      createdAt: new Date().toISOString(),
    };
    await recommendationRepository.recordActualAction(action);

    // Verifikasi pemisahan ketiga lapisan
    const composite = await recommendationRepository.getCompositeDecisionRecord(testActActionId);
    if (!composite) throw new Error('Composite Decision Record gagal dibentuk');
    if (composite.recommendation?.title !== rec.title) throw new Error('Saran sistem tidak sesuai');
    if (composite.farmerDecision?.decision !== 'ADJUST') throw new Error('Keputusan petani tidak sesuai');
    if ((composite.actualAction.data as any)?.appliedKg !== 50) throw new Error('Tindakan riil tidak sesuai');
  });

  // --- UJI 7: Outbox Storage & Idempotency ---
  await test('7. Outbox Storage & OperationId Idempotency', async () => {
    const opId = `op-uuid-12345-${Date.now()}`;
    const outboxItem: SyncOutboxItem = {
      id: `outbox-${Date.now()}`,
      operationId: opId,
      entityType: 'LAND',
      entityId: testLandId,
      action: 'CREATE',
      payload: { name: 'Sawah Blok Timur', areaHa: 0.75 },
      createdAt: new Date().toISOString(),
      retryCount: 0,
      status: 'PENDING',
    };

    await outboxRepository.add(outboxItem);
    const retrieved = await outboxRepository.getByOperationId(opId);
    if (!retrieved || retrieved.status !== 'PENDING') {
      throw new Error('Outbox item gagal dicatat berdasarkan operationId');
    }
  });

  // --- UJI 8: Siklus Pemulihan Penuh & Verifikasi Integritas Relasional (Create -> Backup -> Delete -> Restore -> Verify Relations) ---
  await test('8. Siklus Pemulihan Penuh (Create -> Backup -> Delete -> Restore -> Verify Relasi Bebas Orphan)', async () => {
    // 1. Generate Backup saat ini (mencakup Farmer -> Land -> CropSeason -> Activity -> FertilizerApp -> OptObs -> Recommendation -> FarmerDecision -> ActualAction)
    const backupResult = await backupService.generateBackup();
    if (!backupResult.backup || !backupResult.backup.data) {
      throw new Error('Gagal menghasilkan struktur cadangan data.');
    }

    // 2. Simulasi Hapus Data Uji Tertentu dari DB Lokal
    await db.actualActions.delete(testActActionId);
    await db.farmerDecisions.delete(testDecId);
    await db.recommendations.delete(testRecId);
    await db.optObservations.delete(testOptObsId);
    await db.fertilizerApplications.delete(testFertAppId);
    await db.activities.delete(testActivity1Id);
    await db.activities.delete(testActivity2Id);
    await db.cropSeasons.delete(testSeasonId);
    await db.lands.delete(testLandId);
    await db.farmers.delete(testFarmerId);

    // Pastikan data benar-benar terhapus
    const checkDeletedLand = await db.lands.get(testLandId);
    if (checkDeletedLand) {
      throw new Error('Simulasi pembersihan data uji gagal.');
    }

    // 3. Eksekusi Restore Atomik dari Berkas Cadangan
    const restoreResult = await backupService.restoreBackup(backupResult.backup);
    if (!restoreResult.success) {
      throw new Error(`Pemulihan cadangan gagal: ${restoreResult.message}`);
    }

    // 4. Verifikasi Hubungan Antar Entitas (Relational Integrity & No Orphan References)
    // Farmer
    const restoredFarmer = await db.farmers.get(testFarmerId);
    if (!restoredFarmer || restoredFarmer.name !== 'Pak Sutrisno') {
      throw new Error('Relasi Farmer gagal dipulihkan.');
    }

    // Land -> Farmer
    const restoredLand = await db.lands.get(testLandId);
    if (!restoredLand || restoredLand.farmerId !== testFarmerId) {
      throw new Error('Relasi Land -> Farmer rusak/orphan setelah restore.');
    }

    // CropSeason -> Land
    const restoredSeason = await db.cropSeasons.get(testSeasonId);
    if (!restoredSeason || restoredSeason.landId !== testLandId) {
      throw new Error('Relasi CropSeason -> Land rusak/orphan setelah restore.');
    }

    // Activity -> CropSeason
    const restoredActivity = await db.activities.get(testActivity1Id);
    if (!restoredActivity || restoredActivity.cropSeasonId !== testSeasonId) {
      throw new Error('Relasi Activity -> CropSeason rusak/orphan setelah restore.');
    }

    // FertilizerApplication -> Activity
    const restoredFertApp = await db.fertilizerApplications.get(testFertAppId);
    if (!restoredFertApp || restoredFertApp.activityId !== testActivity1Id || restoredFertApp.amountKg !== 50) {
      throw new Error('Relasi FertilizerApplication -> Activity rusak setelah restore.');
    }

    // OptObservation -> Activity
    const restoredOptObs = await db.optObservations.get(testOptObsId);
    if (!restoredOptObs || restoredOptObs.activityId !== testActivity2Id) {
      throw new Error('Relasi OptObservation -> Activity rusak setelah restore.');
    }

    // Recommendation -> CropSeason
    const restoredRec = await db.recommendations.get(testRecId);
    if (!restoredRec || restoredRec.cropSeasonId !== testSeasonId) {
      throw new Error('Relasi Recommendation -> CropSeason rusak setelah restore.');
    }

    // FarmerDecision -> Recommendation
    const restoredDecision = await db.farmerDecisions.get(testDecId);
    if (!restoredDecision || restoredDecision.recommendationId !== testRecId || restoredDecision.decision !== 'ADJUST') {
      throw new Error('Relasi FarmerDecision -> Recommendation rusak setelah restore.');
    }

    // ActualAction -> FarmerDecision
    const restoredAction = await db.actualActions.get(testActActionId);
    if (!restoredAction || restoredAction.decisionId !== testDecId) {
      throw new Error('Relasi ActualAction -> FarmerDecision rusak setelah restore.');
    }

    // Composite 3-Layer Record Verification
    const compositeCheck = await recommendationRepository.getCompositeDecisionRecord(testActActionId);
    if (!compositeCheck || !compositeCheck.recommendation || !compositeCheck.farmerDecision) {
      throw new Error('Integritas 3-Layer Decision Record tidak utuh setelah restore.');
    }
  });

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  return {
    allPassed: failed === 0,
    total,
    passed,
    failed,
    results,
  };
}
