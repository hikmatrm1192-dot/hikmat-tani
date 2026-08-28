/**
 * HIKMAT TANI - Account Switch & Local Partition Isolation Test Suite
 * 
 * Verifikasi:
 * 1. Setiap farmer memiliki partisi IndexedDB lokal terpisah (HikmatTaniDB_{farmerId}).
 * 2. Petani A membuat lahan & outbox -> logout -> Petani B login -> Petani B tidak melihat data Petani A.
 * 3. Petani B membuat lahan -> logout -> Petani A login kembali -> Data Petani A tetap utuh 100%.
 * 4. Master data agronomi otomatis di-seed ke setiap partisi secara offline-first.
 * 5. Outbox sinkronisasi terisolasi per partisi akun petani.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import 'fake-indexeddb/auto';
import {
  db,
  getDatabase,
  initializeDatabase,
  setActiveFarmerDb,
} from '../src/db/database.ts';
import { landRepository } from '../src/db/repositories/landRepository.ts';
import { outboxRepository } from '../src/db/repositories/outboxRepository.ts';
import { Land } from '../src/types/index.ts';

describe('HIKMAT TANI — Account Switch & Local IndexedDB Isolation Test Suite', () => {
  const FARMER_A_ID = 'farmer_user_sutrisno_01';
  const FARMER_B_ID = 'farmer_user_joko_02';

  beforeEach(async () => {
    // Reset test database instances
    setActiveFarmerDb(FARMER_A_ID);
    await initializeDatabase(FARMER_A_ID);

    setActiveFarmerDb(FARMER_B_ID);
    await initializeDatabase(FARMER_B_ID);
  });

  it('Partisi IndexedDB terisolasi: Petani A dan Petani B memiliki database lokal yang terpisah', async () => {
    const dbA = getDatabase(FARMER_A_ID);
    const dbB = getDatabase(FARMER_B_ID);

    assert.ok(dbA.name.includes(FARMER_A_ID));
    assert.ok(dbB.name.includes(FARMER_B_ID));
    assert.notStrictEqual(dbA.name, dbB.name);
  });

  it('Siklus Ganti Akun: Petani A membuat data -> Petani B tidak melihat data A -> Petani A login kembali dan datanya utuh', async () => {
    // =========================================================================
    // 1. Sesi Petani A: Aktifkan Petani A & Buat Petak Lahan A
    // =========================================================================
    setActiveFarmerDb(FARMER_A_ID);

    const landA: Land = {
      id: 'land-a-101',
      farmerId: FARMER_A_ID,
      name: 'Petak Sawah Blok Timur Milik Pak Sutrisno',
      areaHa: 0.75,
      landType: 'LOWLAND_PADDY',
      waterSource: 'IRRIGATION_TECHNICAL',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await landRepository.create(landA);

    // Verifikasi Petani A dapat membaca lahannya sendiri
    const landsA = await landRepository.getAll();
    assert.strictEqual(landsA.length, 1);
    assert.strictEqual(landsA[0].name, 'Petak Sawah Blok Timur Milik Pak Sutrisno');

    // Verifikasi outbox sinkronisasi terisi di partisi Petani A
    const outboxA = await outboxRepository.getPending();
    assert.ok(outboxA.length >= 1);
    assert.strictEqual(outboxA[0].entityId, 'land-a-101');

    // =========================================================================
    // 2. Ganti Akun ke Petani B: Beralih partisi ke FARMER_B_ID
    // =========================================================================
    setActiveFarmerDb(FARMER_B_ID);

    // Petani B membuka daftar lahan -> HARUS KOSONG (Isolasi Mutlak!)
    const landsB = await landRepository.getAll();
    assert.strictEqual(landsB.length, 0);

    // Outbox Petani B juga harus bersih dari mutasi Petani A
    const outboxB = await outboxRepository.getPending();
    assert.strictEqual(outboxB.length, 0);

    // Petani B membuat petak lahan miliknya sendiri
    const landB: Land = {
      id: 'land-b-202',
      farmerId: FARMER_B_ID,
      name: 'Petak Sawah Blok Barat Milik Pak Joko',
      areaHa: 1.2,
      landType: 'RAINFED_PADDY',
      waterSource: 'RAIN_FED',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await landRepository.create(landB);

    const landsBAfter = await landRepository.getAll();
    assert.strictEqual(landsBAfter.length, 1);
    assert.strictEqual(landsBAfter[0].name, 'Petak Sawah Blok Barat Milik Pak Joko');

    // =========================================================================
    // 3. Login Kembali sebagai Petani A: Data Petani A tetap utuh dan aman
    // =========================================================================
    setActiveFarmerDb(FARMER_A_ID);

    const landsAResumed = await landRepository.getAll();
    assert.strictEqual(landsAResumed.length, 1);
    assert.strictEqual(landsAResumed[0].id, 'land-a-101');
    assert.strictEqual(landsAResumed[0].name, 'Petak Sawah Blok Timur Milik Pak Sutrisno');

    // Pastikan tidak ada data Petani B yang bocor ke Petani A
    const containsB = landsAResumed.some((l) => l.id === 'land-b-202');
    assert.strictEqual(containsB, false);

    // Outbox Petani A tetap utuh siap disinkronkan saat online
    const outboxAResumed = await outboxRepository.getPending();
    assert.ok(outboxAResumed.length >= 1);
    assert.strictEqual(outboxAResumed[0].entityId, 'land-a-101');
  });

  it('Master Data Agronomi otomatis tersedia di setiap partisi farmer secara offline', async () => {
    setActiveFarmerDb(FARMER_A_ID);
    const fertsA = await db.fertilizers.toArray();
    const optsA = await db.opts.toArray();
    assert.ok(fertsA.length > 0);
    assert.ok(optsA.length > 0);

    setActiveFarmerDb(FARMER_B_ID);
    const fertsB = await db.fertilizers.toArray();
    const optsB = await db.opts.toArray();
    assert.ok(fertsB.length > 0);
    assert.ok(optsB.length > 0);
  });
});
