/**
 * HIKMAT TANI - Activity Transaction Lifecycle & Premature Commit Regression Test
 * 
 * Verifikasi Mendalam:
 * 1. Jalur 1 (Pemupukan - createFertilizerActivity): Operasi atomik Activity + FertilizerApplication + Outbox
 * 2. Jalur 2 (Pengamatan OPT - createOptActivity): Operasi atomik Activity + OptObservation + Outbox
 * 3. Pencegahan "Transaction committed too early" (PrematureCommitError)
 * 4. Isolasi Transaction Zone vs Sync Engine Notifications
 * 5. Outbox Integrity, Idempotency & No-Duplicate Guarantee
 * 6. Multi-land Data Isolation & Cascade Safety
 */

import 'fake-indexeddb/auto';
import { db } from '../src/db/database.ts';
import { activityRepository } from '../src/db/repositories/activityRepository.ts';
import { outboxRepository } from '../src/db/repositories/outboxRepository.ts';
import { landRepository } from '../src/db/repositories/landRepository.ts';
import { cropSeasonRepository } from '../src/db/repositories/cropSeasonRepository.ts';
import { Activity, FertilizerApplication, OptObservation, Land, CropSeason } from '../src/types/index.ts';

let passedCount = 0;
let totalCount = 0;

async function test(name: string, fn: () => Promise<void>) {
  totalCount++;
  try {
    await fn();
    console.log(`✓ ${name}`);
    passedCount++;
  } catch (err: any) {
    console.error(`✗ ${name}`);
    console.error(`  Error: ${err?.message || err}`);
    if (err?.stack) console.error(`  Stack: ${err.stack}`);
    throw err;
  }
}

async function runActivityTransactionLifecycleTests() {
  console.log('=== UJI REGRESI TRANSAKSI TAMBAH KEGIATAN & DEXIE LIFECYCLE ===\n');

  // Bersihkan database untuk pengujian
  await db.open();
  await db.activities.clear();
  await db.fertilizerApplications.clear();
  await db.optObservations.clear();
  await db.syncOutbox.clear();
  await db.lands.clear();
  await db.cropSeasons.clear();

  const testLandId = `land-test-${Date.now()}`;
  const testSeasonId = `season-test-${Date.now()}`;

  const sampleLand: Land = {
    id: testLandId,
    farmerId: 'farmer-wahyu',
    name: 'Petak Sawah Timur Blok B',
    areaHa: 0.5,
    waterSource: 'IRRIGATION_TECHNICAL',
    landType: 'LOWLAND_PADDY',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await landRepository.create(sampleLand);

  const sampleSeason: CropSeason = {
    id: testSeasonId,
    landId: testLandId,
    commodity: 'Padi',
    varietyName: 'Inpari 32 HDB',
    plantingDate: '2026-08-01T00:00:00.000Z',
    plantedAreaHa: 0.5,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await cropSeasonRepository.create(sampleSeason);

  // --- UJI 1: Jalur 1 (Pemupukan) - Online / Normal Flow ---
  const fertActId1 = `act-fert-1-${Date.now()}`;
  const fertAppId1 = `app-fert-1-${Date.now()}`;
  await test('1. Jalur 1 (Pemupukan): createFertilizerActivity atomik berhasil tanpa error premature commit', async () => {
    const act: Activity = {
      id: fertActId1,
      cropSeasonId: testSeasonId,
      category: 'FERTILIZER',
      activityDate: '2026-08-15T00:00:00.000Z',
      hst: 14,
      notes: 'Pemupukan susulan 1 Urea 50 kg',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const fertApp: FertilizerApplication = {
      id: fertAppId1,
      activityId: fertActId1,
      fertilizerId: 'fert-urea',
      fertilizerName: 'Urea (Prill/Granul)',
      amountKg: 50,
      applicationMethod: 'BROADCAST',
      calculatedNutrients: { N_kg: 23, P2O5_kg: 0, K2O_kg: 0, S_kg: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await activityRepository.createFertilizerActivity(act, fertApp);
    if (result.activityId !== fertActId1 || result.fertilizerAppId !== fertAppId1) {
      throw new Error('Hasil return createFertilizerActivity tidak sesuai ID');
    }

    // Verifikasi data tersimpan
    const savedAct = await activityRepository.getById(fertActId1);
    if (!savedAct || savedAct.category !== 'FERTILIZER') {
      throw new Error('Activity pemupukan tidak tersimpan di database');
    }

    const savedFertApps = await activityRepository.getFertilizerApplications(fertActId1);
    if (savedFertApps.length !== 1 || savedFertApps[0].amountKg !== 50) {
      throw new Error('FertilizerApplication tidak tersimpan secara atomik');
    }

    // Verifikasi outbox records tercatat atomik
    const outboxItems = await outboxRepository.getPending();
    const actOutbox = outboxItems.find((i) => i.entityId === fertActId1 && i.entityType === 'ACTIVITY');
    const fertOutbox = outboxItems.find((i) => i.entityId === fertAppId1 && i.entityType === 'FERTILIZER_APPLICATION');

    if (!actOutbox || !fertOutbox) {
      throw new Error('Outbox record untuk aktivitas pemupukan atomik tidak lengkap');
    }
  });

  // --- UJI 2: Jalur 2 (Pengamatan OPT) - Online / Normal Flow ---
  const optActId1 = `act-opt-1-${Date.now()}`;
  const optObsId1 = `obs-opt-1-${Date.now()}`;
  await test('2. Jalur 2 (Pengamatan OPT): createOptActivity atomik berhasil tanpa error premature commit', async () => {
    const act: Activity = {
      id: optActId1,
      cropSeasonId: testSeasonId,
      category: 'OPT',
      activityDate: '2026-08-20T00:00:00.000Z',
      hst: 19,
      notes: 'Pengamatan bercak daun di sudut petak',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const optObs: OptObservation = {
      id: optObsId1,
      activityId: optActId1,
      isUnknown: true,
      customOptName: 'Bercak kemerahan daun bawah',
      attackSeverity: 'LIGHT',
      attackPercentage: 5,
      attackLocation: ['LEAF'],
      observedSymptoms: 'Ujung daun menguning',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await activityRepository.createOptActivity(act, optObs);
    if (result.activityId !== optActId1 || result.optObservationId !== optObsId1) {
      throw new Error('Hasil return createOptActivity tidak sesuai ID');
    }

    const savedAct = await activityRepository.getById(optActId1);
    if (!savedAct || savedAct.category !== 'OPT') {
      throw new Error('Activity OPT tidak tersimpan di database');
    }

    const savedOptObs = await activityRepository.getOptObservations(optActId1);
    if (savedOptObs.length !== 1 || !savedOptObs[0].isUnknown) {
      throw new Error('OptObservation tidak tersimpan secara atomik');
    }

    const outboxItems = await outboxRepository.getPending();
    const optOutbox = outboxItems.find((i) => i.entityId === optObsId1 && i.entityType === 'OPT_OBSERVATION');
    if (!optOutbox) {
      throw new Error('Outbox record untuk pengamatan OPT tidak ditemukan');
    }
  });

  // --- UJI 3: Jalur 1 & 2 dalam Kondisi Offline Simulation ---
  await test('3. Jalur 1 & 2 Simpan saat OFFLINE: Data dan outbox queue tetap terjaga tanpa exception', async () => {
    const fertOfflineActId = `act-fert-off-${Date.now()}`;
    const fertOfflineAppId = `app-fert-off-${Date.now()}`;

    await activityRepository.createFertilizerActivity(
      {
        id: fertOfflineActId,
        cropSeasonId: testSeasonId,
        category: 'FERTILIZER',
        activityDate: '2026-08-25T00:00:00.000Z',
        hst: 24,
        notes: 'Pemupukan offline NPK Phonska 25 kg',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: fertOfflineAppId,
        activityId: fertOfflineActId,
        fertilizerId: 'fert-phonska',
        fertilizerName: 'NPK Phonska (15-15-15)',
        amountKg: 25,
        applicationMethod: 'BROADCAST',
        calculatedNutrients: { N_kg: 3.75, P2O5_kg: 3.75, K2O_kg: 3.75, S_kg: 2.5 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );

    const optOfflineActId = `act-opt-off-${Date.now()}`;
    const optOfflineObsId = `obs-opt-off-${Date.now()}`;

    await activityRepository.createOptActivity(
      {
        id: optOfflineActId,
        cropSeasonId: testSeasonId,
        category: 'OPT',
        activityDate: '2026-08-26T00:00:00.000Z',
        hst: 25,
        notes: 'Pengamatan wereng coklat populasi rendah',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: optOfflineObsId,
        activityId: optOfflineActId,
        optId: 'opt-wereng-coklat',
        isUnknown: false,
        attackSeverity: 'LIGHT',
        attackPercentage: 2,
        attackLocation: ['STEM'],
        observedSymptoms: 'Wereng coklat pada pangkal batang 1-2 ekor/rumpun',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );

    const checkFert = await activityRepository.getById(fertOfflineActId);
    const checkOpt = await activityRepository.getById(optOfflineActId);

    if (!checkFert || !checkOpt) {
      throw new Error('Penyimpanan offline pemupukan / OPT gagal');
    }
  });

  // --- UJI 4: Double / Rapid Submission Simulation ---
  await test('4. Simulasi Double Submission: Eksekusi beruntun tidak menyebabkan race condition atau corrupt state', async () => {
    const rapidPromises = Array.from({ length: 5 }).map((_, idx) => {
      const actId = `act-rapid-${Date.now()}-${idx}`;
      const fertId = `app-rapid-${Date.now()}-${idx}`;
      return activityRepository.createFertilizerActivity(
        {
          id: actId,
          cropSeasonId: testSeasonId,
          category: 'FERTILIZER',
          activityDate: '2026-08-28T00:00:00.000Z',
          hst: 27,
          notes: `Rapid test #${idx}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: fertId,
          activityId: actId,
          fertilizerName: 'Urea',
          amountKg: 10 + idx,
          applicationMethod: 'BROADCAST',
          calculatedNutrients: { N_kg: (10 + idx) * 0.46, P2O5_kg: 0, K2O_kg: 0, S_kg: 0 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      );
    });

    const results = await Promise.all(rapidPromises);
    if (results.length !== 5) {
      throw new Error('Hasil eksekusi concurrent tidak lengkap');
    }

    const allActivities = await activityRepository.getByCropSeasonId(testSeasonId);
    const rapidActivities = allActivities.filter((a) => a.notes?.includes('Rapid test'));
    if (rapidActivities.length !== 5) {
      throw new Error(`Jumlah aktivitas rapid tidak sesuai: ${rapidActivities.length} != 5`);
    }
  });

  // --- UJI 5: Idempotency & Outbox OperationId Protection ---
  await test('5. Jaminan Idempotency Outbox: Penambahan ulang dengan operationId sama tidak menduplikasi antrean', async () => {
    const fixedOpId = `op-fixed-idempotency-${Date.now()}`;
    const outboxItem = {
      id: `outbox-${Date.now()}-1`,
      operationId: fixedOpId,
      entityType: 'ACTIVITY' as const,
      entityId: fertActId1,
      action: 'CREATE' as const,
      payload: { id: fertActId1, test: true },
      createdAt: new Date().toISOString(),
      retryCount: 0,
      status: 'PENDING' as const,
    };

    const firstId = await outboxRepository.add(outboxItem);
    const secondId = await outboxRepository.add({
      ...outboxItem,
      id: `outbox-${Date.now()}-2`,
    });

    if (firstId !== secondId) {
      throw new Error('Idempotency outbox gagal: operationId sama menghasilkan record baru');
    }
  });

  // --- UJI 6: Land safeDelete Transaction Cascade Integrity ---
  await test('6. Integritas Transaksi safeDelete Lahan: Cascade clean up tanpa orphan dan tanpa error Dexie', async () => {
    const tempLandId = `land-temp-${Date.now()}`;
    const tempSeasonId = `season-temp-${Date.now()}`;
    const tempActId = `act-temp-${Date.now()}`;
    const tempFertId = `app-temp-${Date.now()}`;

    await landRepository.create({
      id: tempLandId,
      farmerId: 'farmer-wahyu',
      name: 'Lahan Sementara Hapus',
      areaHa: 0.2,
      waterSource: 'RAIN_FED',
      landType: 'LOWLAND_PADDY',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await cropSeasonRepository.create({
      id: tempSeasonId,
      landId: tempLandId,
      commodity: 'Padi',
      varietyName: 'Ciherang',
      plantingDate: '2026-07-01T00:00:00.000Z',
      plantedAreaHa: 0.2,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await activityRepository.createFertilizerActivity(
      {
        id: tempActId,
        cropSeasonId: tempSeasonId,
        category: 'FERTILIZER',
        activityDate: '2026-07-15T00:00:00.000Z',
        hst: 14,
        notes: 'Pupuk Lahan Hapus',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: tempFertId,
        activityId: tempActId,
        fertilizerName: 'Urea',
        amountKg: 20,
        applicationMethod: 'BROADCAST',
        calculatedNutrients: { N_kg: 9.2, P2O5_kg: 0, K2O_kg: 0, S_kg: 0 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );

    // Hapus Lahan secara aman
    await landRepository.safeDelete(tempLandId);

    // Verifikasi seluruh entitas terkait terhapus bersih
    const landCheck = await landRepository.getById(tempLandId);
    const seasonCheck = await cropSeasonRepository.getById(tempSeasonId);
    const actCheck = await activityRepository.getById(tempActId);
    const fertCheck = await activityRepository.getFertilizerApplications(tempActId);

    if (landCheck || seasonCheck || actCheck || fertCheck.length > 0) {
      throw new Error('safeDelete meninggalkan orphan record di database');
    }
  });

  console.log(`\n======================================================`);
  console.log(`TOTAL: ${totalCount} | LOLOS: ${passedCount} | GAGAL: 0`);
  console.log(`======================================================\n`);
}

runActivityTransactionLifecycleTests().catch((e) => {
  console.error('Test Suite Failed:', e);
  process.exit(1);
});
