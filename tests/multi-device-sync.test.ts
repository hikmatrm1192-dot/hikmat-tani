/**
 * HIKMAT TANI - Multi-Device Data Synchronization Test Suite (HP 1 <-> HP 2)
 * 
 * Pengujian Kelayakan Nyata:
 * - Tes A (HP 1): Tambah lahan, mulai musim tanam, catat kegiatan tanam / pupuk / pengamatan OPT -> tersimpan di Cloud D1.
 * - Tes B (HP 2): Login akun yang sama di HP 2 -> lahan, musim tanam, kegiatan dari HP 1 muncul lengkap.
 * - Tes C (HP 2 ke HP 1): Catat kegiatan baru di HP 2 -> muncul di HP 1 setelah sinkron.
 * - Tes D (Offline): Catat saat offline di HP 1 -> online -> login di HP 2 -> data offline tersinkron ke HP 2.
 * - Tes E (Foto AI): Catat pengamatan OPT di HP 1 -> foto lokal tidak membebani cloud -> metadata agronomi tersinkron utuh ke HP 2.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SyncService, SyncPushItem } from '../server/services/syncService.ts';
import { AuthSessionPayload } from '../server/services/authService.ts';
import { InMemoryD1Database } from '../server/db/d1/testD1.ts';
import { drizzle } from 'drizzle-orm/d1';
import * as d1Schema from '../server/db/d1/schema.ts';

describe('HIKMAT TANI — Sinkronisasi Data Multi-Perangkat (HP 1 & HP 2)', async () => {
  // Shared persistent Cloud D1 Database
  const sharedD1Engine = new InMemoryD1Database();
  const sharedD1Client = drizzle(sharedD1Engine, { schema: d1Schema });
  const syncService = new SyncService(sharedD1Client);
  await syncService.resetStore();

  const userAccount: AuthSessionPayload = {
    userId: 'usr_petani_pak_ujang',
    farmerId: 'farmer_ujang_888',
    role: 'farmer',
    isAnonymous: false,
    issuedAt: Date.now(),
  };

  // State Simulasi Memori Lokal HP 1 & HP 2 (IndexedDB Cache)
  const hp1LocalDb: {
    lands: any[];
    cropSeasons: any[];
    activities: any[];
    fertilizerApps: any[];
    optObservations: any[];
    outbox: SyncPushItem[];
    syncCursor: string;
  } = {
    lands: [],
    cropSeasons: [],
    activities: [],
    fertilizerApps: [],
    optObservations: [],
    outbox: [],
    syncCursor: '',
  };

  const hp2LocalDb: {
    lands: any[];
    cropSeasons: any[];
    activities: any[];
    fertilizerApps: any[];
    optObservations: any[];
    outbox: SyncPushItem[];
    syncCursor: string;
  } = {
    lands: [],
    cropSeasons: [],
    activities: [],
    fertilizerApps: [],
    optObservations: [],
    outbox: [],
    syncCursor: '',
  };

  // Helper sinkronisasi HP 1 -> Cloud -> HP 1
  const syncHp1 = async () => {
    // 1. Push
    if (hp1LocalDb.outbox.length > 0) {
      const pushRes = await syncService.processPush(userAccount, hp1LocalDb.outbox);
      if (pushRes.success) {
        hp1LocalDb.outbox = hp1LocalDb.outbox.filter(
          (item) => !pushRes.acknowledgedOperationIds.includes(item.operationId)
        );
      }
    }
    // 2. Pull
    const pullRes = await syncService.processPull(userAccount, hp1LocalDb.syncCursor);
    for (const change of pullRes.changes) {
      if (change.entityType === 'LAND') {
        const idx = hp1LocalDb.lands.findIndex((l) => l.id === change.entityId);
        if (idx >= 0) hp1LocalDb.lands[idx] = change.payload;
        else hp1LocalDb.lands.push(change.payload);
      } else if (change.entityType === 'CROP_SEASON') {
        const idx = hp1LocalDb.cropSeasons.findIndex((s) => s.id === change.entityId);
        if (idx >= 0) hp1LocalDb.cropSeasons[idx] = change.payload;
        else hp1LocalDb.cropSeasons.push(change.payload);
      } else if (change.entityType === 'ACTIVITY') {
        const idx = hp1LocalDb.activities.findIndex((a) => a.id === change.entityId);
        if (idx >= 0) hp1LocalDb.activities[idx] = change.payload;
        else hp1LocalDb.activities.push(change.payload);
      } else if (change.entityType === 'FERTILIZER_APPLICATION') {
        const idx = hp1LocalDb.fertilizerApps.findIndex((f) => f.id === change.entityId);
        if (idx >= 0) hp1LocalDb.fertilizerApps[idx] = change.payload;
        else hp1LocalDb.fertilizerApps.push(change.payload);
      } else if (change.entityType === 'OPT_OBSERVATION') {
        const idx = hp1LocalDb.optObservations.findIndex((o) => o.id === change.entityId);
        if (idx >= 0) hp1LocalDb.optObservations[idx] = change.payload;
        else hp1LocalDb.optObservations.push(change.payload);
      }
    }
    hp1LocalDb.syncCursor = pullRes.serverTimestamp;
  };

  // Helper sinkronisasi HP 2 -> Cloud -> HP 2
  const syncHp2 = async () => {
    // 1. Push
    if (hp2LocalDb.outbox.length > 0) {
      const pushRes = await syncService.processPush(userAccount, hp2LocalDb.outbox);
      if (pushRes.success) {
        hp2LocalDb.outbox = hp2LocalDb.outbox.filter(
          (item) => !pushRes.acknowledgedOperationIds.includes(item.operationId)
        );
      }
    }
    // 2. Pull
    const pullRes = await syncService.processPull(userAccount, hp2LocalDb.syncCursor);
    for (const change of pullRes.changes) {
      if (change.entityType === 'LAND') {
        const idx = hp2LocalDb.lands.findIndex((l) => l.id === change.entityId);
        if (idx >= 0) hp2LocalDb.lands[idx] = change.payload;
        else hp2LocalDb.lands.push(change.payload);
      } else if (change.entityType === 'CROP_SEASON') {
        const idx = hp2LocalDb.cropSeasons.findIndex((s) => s.id === change.entityId);
        if (idx >= 0) hp2LocalDb.cropSeasons[idx] = change.payload;
        else hp2LocalDb.cropSeasons.push(change.payload);
      } else if (change.entityType === 'ACTIVITY') {
        const idx = hp2LocalDb.activities.findIndex((a) => a.id === change.entityId);
        if (idx >= 0) hp2LocalDb.activities[idx] = change.payload;
        else hp2LocalDb.activities.push(change.payload);
      } else if (change.entityType === 'FERTILIZER_APPLICATION') {
        const idx = hp2LocalDb.fertilizerApps.findIndex((f) => f.id === change.entityId);
        if (idx >= 0) hp2LocalDb.fertilizerApps[idx] = change.payload;
        else hp2LocalDb.fertilizerApps.push(change.payload);
      } else if (change.entityType === 'OPT_OBSERVATION') {
        const idx = hp2LocalDb.optObservations.findIndex((o) => o.id === change.entityId);
        if (idx >= 0) hp2LocalDb.optObservations[idx] = change.payload;
        else hp2LocalDb.optObservations.push(change.payload);
      }
    }
    hp2LocalDb.syncCursor = pullRes.serverTimestamp;
  };

  it('Tes A (HP 1): Tambah lahan, musim tanam, tanam & pupuk -> tersimpan di Cloud', async () => {
    // 1. HP 1 mencatat Lahan
    const landA = {
      id: 'land_sawah_timur_01',
      farmerId: 'farmer_ujang_888',
      name: 'Petak Sawah Blok Kidul',
      areaM2: 5000,
      soilType: 'Lempung Berpasir',
      irrigationType: 'Irigasi Teknis',
    };
    hp1LocalDb.lands.push(landA);
    hp1LocalDb.outbox.push({
      operationId: 'op_hp1_land_1',
      entityType: 'LAND',
      entityId: landA.id,
      action: 'CREATE',
      payload: landA,
    });

    // 2. HP 1 mencatat Musim Tanam
    const seasonA = {
      id: 'season_kidul_mt1',
      landId: landA.id,
      seasonNumber: 1,
      varietyName: 'Inpari 32 HDB',
      plantingDate: '2026-05-15',
      status: 'ACTIVE',
    };
    hp1LocalDb.cropSeasons.push(seasonA);
    hp1LocalDb.outbox.push({
      operationId: 'op_hp1_season_1',
      entityType: 'CROP_SEASON',
      entityId: seasonA.id,
      action: 'CREATE',
      payload: seasonA,
    });

    // 3. HP 1 mencatat Kegiatan Tanam & Pupuk
    const actTanam = {
      id: 'act_tanam_01',
      cropSeasonId: seasonA.id,
      activityDate: '2026-05-15',
      category: 'PLANTING',
      hst: 0,
      notes: 'Tanam bibit 2-3 batang per rumpun, jajar legowo 2:1',
    };
    const actPupuk = {
      id: 'act_pupuk_01',
      cropSeasonId: seasonA.id,
      activityDate: '2026-05-25',
      category: 'FERTILIZER',
      hst: 10,
      notes: 'Aplikasi Urea 50 kg dan NPK Phonska 100 kg',
    };
    const fertApp1 = {
      id: 'fa_pupuk_01',
      activityId: actPupuk.id,
      fertilizerName: 'Urea',
      amountKg: 50,
      applicationMethod: 'BROADCAST',
    };

    hp1LocalDb.activities.push(actTanam, actPupuk);
    hp1LocalDb.fertilizerApps.push(fertApp1);

    hp1LocalDb.outbox.push(
      {
        operationId: 'op_hp1_act_tanam',
        entityType: 'ACTIVITY',
        entityId: actTanam.id,
        action: 'CREATE',
        payload: actTanam,
      },
      {
        operationId: 'op_hp1_act_pupuk',
        entityType: 'ACTIVITY',
        entityId: actPupuk.id,
        action: 'CREATE',
        payload: actPupuk,
      },
      {
        operationId: 'op_hp1_fa_pupuk',
        entityType: 'FERTILIZER_APPLICATION',
        entityId: fertApp1.id,
        action: 'CREATE',
        payload: fertApp1,
      }
    );

    // HP 1 Sinkronisasi ke Cloud
    await syncHp1();

    assert.strictEqual(hp1LocalDb.outbox.length, 0, 'Outbox HP 1 harus bersih setelah sync');

    // Verifikasi data tersimpan di Cloud journal
    const cloudStats = await syncService.getStats('farmer_ujang_888');
    assert.ok(cloudStats.totalJournalEntries >= 4, 'Data HP 1 harus tersimpan di Cloud D1');
  });

  it('Tes B (HP 2): Login dengan akun yang sama -> Lahan, Musim Tanam, & Kegiatan HP 1 muncul utuh di HP 2', async () => {
    // Pada HP 2, database lokal awalnya kosong
    assert.strictEqual(hp2LocalDb.lands.length, 0, 'HP 2 awalnya kosong');
    assert.strictEqual(hp2LocalDb.cropSeasons.length, 0, 'HP 2 awalnya kosong');
    assert.strictEqual(hp2LocalDb.activities.length, 0, 'HP 2 awalnya kosong');

    // HP 2 melakukan sync (pull dari Cloud D1)
    await syncHp2();

    // Verifikasi seluruh data dari HP 1 berhasil masuk ke HP 2
    assert.strictEqual(hp2LocalDb.lands.length, 1, 'Lahan dari HP 1 harus muncul di HP 2');
    assert.strictEqual(hp2LocalDb.lands[0].name, 'Petak Sawah Blok Kidul');
    assert.strictEqual(hp2LocalDb.lands[0].areaM2, 5000);

    assert.strictEqual(hp2LocalDb.cropSeasons.length, 1, 'Musim tanam dari HP 1 harus muncul di HP 2');
    assert.strictEqual(hp2LocalDb.cropSeasons[0].varietyName, 'Inpari 32 HDB');

    assert.strictEqual(hp2LocalDb.activities.length, 2, 'Kegiatan Tanam & Pupuk HP 1 harus muncul di HP 2');
    assert.strictEqual(hp2LocalDb.fertilizerApps.length, 1, 'Aplikasi pupuk HP 1 harus muncul di HP 2');
    assert.strictEqual(hp2LocalDb.fertilizerApps[0].fertilizerName, 'Urea');
  });

  it('Tes C (HP 2 ke HP 1): Catat kegiatan baru di HP 2 -> muncul di HP 1 setelah sinkron', async () => {
    // Petani membuka HP 2 di sawah dan mencatat Pengairan
    const actPengairan = {
      id: 'act_irigasi_01',
      cropSeasonId: 'season_kidul_mt1',
      activityDate: '2026-05-28',
      category: 'IRRIGATION',
      hst: 13,
      notes: 'Pengairan macak-macak tinggi air 2 cm',
    };

    hp2LocalDb.activities.push(actPengairan);
    hp2LocalDb.outbox.push({
      operationId: 'op_hp2_act_irigasi',
      entityType: 'ACTIVITY',
      entityId: actPengairan.id,
      action: 'CREATE',
      payload: actPengairan,
    });

    // HP 2 sync ke Cloud
    await syncHp2();
    assert.strictEqual(hp2LocalDb.outbox.length, 0, 'Outbox HP 2 harus bersih');

    // HP 1 sync dari Cloud
    await syncHp1();

    // Verifikasi HP 1 sekarang memiliki kegiatan pengairan yang dicatat dari HP 2
    const foundInHp1 = hp1LocalDb.activities.find((a) => a.id === 'act_irigasi_01');
    assert.ok(foundInHp1, 'Kegiatan dari HP 2 harus muncul di HP 1');
    assert.strictEqual(foundInHp1.notes, 'Pengairan macak-macak tinggi air 2 cm');
    assert.strictEqual(hp1LocalDb.activities.length, 3);
  });

  it('Tes D (Offline HP 1 -> Online -> HP 2): Catat saat offline di HP 1, setelah online tersinkron ke HP 2', async () => {
    // 1. HP 1 sedang offline di pedalaman tanpa sinyal, mencatat Pengendalian Hama
    const actHamaOffline = {
      id: 'act_hama_offline_01',
      cropSeasonId: 'season_kidul_mt1',
      activityDate: '2026-06-01',
      category: 'MAINTENANCE',
      hst: 17,
      notes: 'Penyemprotan biopestisida ekstrak daun nimba (Dicatat Offline)',
    };

    hp1LocalDb.activities.push(actHamaOffline);
    hp1LocalDb.outbox.push({
      operationId: 'op_hp1_offline_hama',
      entityType: 'ACTIVITY',
      entityId: actHamaOffline.id,
      action: 'CREATE',
      payload: actHamaOffline,
    });

    // Karena offline, outbox tertahan di HP 1
    assert.strictEqual(hp1LocalDb.outbox.length, 1);

    // HP 2 melakukan sync saat HP 1 masih offline (data belum masuk)
    await syncHp2();
    assert.strictEqual(
      hp2LocalDb.activities.some((a) => a.id === 'act_hama_offline_01'),
      false,
      'HP 2 belum menerima data offline sebelum HP 1 tersambung internet'
    );

    // HP 1 mendapat sinyal dan melakukan sinkronisasi ke Cloud
    await syncHp1();
    assert.strictEqual(hp1LocalDb.outbox.length, 0, 'Outbox HP 1 terkirim saat online');

    // Sekarang HP 2 melakukan sinkronisasi
    await syncHp2();

    // Verifikasi data offline dari HP 1 sekarang sudah muncul di HP 2
    const foundInHp2 = hp2LocalDb.activities.find((a) => a.id === 'act_hama_offline_01');
    assert.ok(foundInHp2, 'Data yang dicatat saat offline di HP 1 harus tersinkron ke HP 2 setelah online');
    assert.strictEqual(foundInHp2.notes, 'Penyemprotan biopestisida ekstrak daun nimba (Dicatat Offline)');
  });

  it('Tes E (Foto AI & OPT Observation): Foto hanya di lokal perangkat, metadata pengamatan tersinkron utuh ke HP 2', async () => {
    // Di HP 1, petani menggunakan Kamera AI untuk memotret gejala bercak daun
    const optActivity = {
      id: 'act_opt_foto_01',
      cropSeasonId: 'season_kidul_mt1',
      activityDate: '2026-06-05',
      category: 'OPT',
      hst: 21,
      notes: 'Pengamatan Blas Daun (Pyricularia oryzae) (Tingkat: LIGHT)',
    };

    const optObservationData = {
      id: 'obs_blas_01',
      activityId: optActivity.id,
      optId: 'blas_daun',
      isUnknown: false,
      customOptName: 'Blas Daun (Pyricularia oryzae)',
      attackSeverity: 'LIGHT',
      attackAreaM2: 125, // Satuan m²
      attackLocation: ['LEAF'],
      observedSymptoms: 'Bercak belah ketupat runcing di kedua ujung dengan pusat abu-abu',
      identificationMethod: 'AI_IMAGE_CAPTURE',
      confidenceLevel: 'HIGH',
      detectedTraits: ['Bercak belah ketupat', 'Pusat abu-abu tepi cokelat', 'Ujung daun mengering'],
      visualClues: ['Bercak tipikal infeksi jamur Pyricularia'],
      candidateOptIds: ['blas_daun'],
      photoAnalysisNotes: 'Gejala khas infeksi bercak blas stadium awal fase vegetatif',
      photoLocalUri: undefined, // ATURAN PRIVASI & ZERO STORAGE: FOTO TIDAK DISIMPAN KE CLOUD/DATABASE
    };

    hp1LocalDb.activities.push(optActivity);
    hp1LocalDb.optObservations.push(optObservationData);

    hp1LocalDb.outbox.push(
      {
        operationId: 'op_hp1_act_opt',
        entityType: 'ACTIVITY',
        entityId: optActivity.id,
        action: 'CREATE',
        payload: optActivity,
      },
      {
        operationId: 'op_hp1_obs_opt',
        entityType: 'OPT_OBSERVATION',
        entityId: optObservationData.id,
        action: 'CREATE',
        payload: optObservationData,
      }
    );

    // HP 1 sync ke Cloud
    await syncHp1();

    // HP 2 sync dari Cloud
    await syncHp2();

    // Verifikasi di HP 2:
    const optInHp2 = hp2LocalDb.optObservations.find((o) => o.id === 'obs_blas_01');
    assert.ok(optInHp2, 'Pengamatan OPT harus tersinkron ke HP 2');
    assert.strictEqual(optInHp2.customOptName, 'Blas Daun (Pyricularia oryzae)');
    assert.strictEqual(optInHp2.attackAreaM2, 125, 'Luas serangan harus 125 m²');
    assert.strictEqual(optInHp2.identificationMethod, 'AI_IMAGE_CAPTURE');
    assert.strictEqual(optInHp2.confidenceLevel, 'HIGH');
    assert.strictEqual(optInHp2.photoLocalUri, undefined, 'Blob foto tidak boleh dikirim/disimpan ke Cloud');
    assert.deepStrictEqual(optInHp2.detectedTraits, [
      'Bercak belah ketupat',
      'Pusat abu-abu tepi cokelat',
      'Ujung daun mengering',
    ]);
  });
});
