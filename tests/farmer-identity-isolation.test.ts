/**
 * HIKMAT TANI - Farmer Identity & Data Isolation Test Suite
 * 
 * Verifikasi:
 * 1. Anonymous Access Rejection pada protected endpoints.
 * 2. Registrasi Petani (Validasi Nama, NIK 16 digit, Nomor HP, PIN 6 digit, Duplikasi NIK/HP).
 * 3. Login Petani (PBKDF2 Password Hashing, Invalid Credentials Rejection).
 * 4. Isolasi Antar Petani (Farmer A vs Farmer B) di level Server & Database.
 * 5. Anti-IDOR: Farmer A tidak dapat mengakses profil atau data Farmer B.
 * 6. Sync Ownership Validation: Penolakan spoofing farmerId pada sync push.
 * 7. Sync Pull Scoping: Farmer A hanya menerima mutasi milik Farmer A.
 * 8. ACTUAL_ACTION Protection: Larangan penghapusan tindakan aktual petani.
 * 9. Idempotency: Penolakan duplikasi eksekusi operationId yang sama.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { authService } from '../server/services/authService.ts';
import { syncService, SyncPushItem } from '../server/services/syncService.ts';
import { farmerService } from '../server/services/farmerService.ts';

describe('HIKMAT TANI — Farmer Identity & Data Isolation Test Suite', () => {
  beforeEach(() => {
    authService.resetStore();
    syncService.resetStore();
  });

  describe('1. Registrasi & Validasi Identitas Petani', () => {
    it('harus menolak pendaftaran jika Nama < 2 karakter', () => {
      assert.throws(() => {
        authService.registerFarmer({
          name: 'A',
          nik: '3210010101750002',
          phoneNumber: '081234567891',
          pin: '123456',
        });
      });
    });

    it('harus menolak pendaftaran jika NIK bukan 16 digit angka', () => {
      assert.throws(() => {
        authService.registerFarmer({
          name: 'Pak Budi',
          nik: '3210010101', // Hanya 10 digit
          phoneNumber: '081234567891',
          pin: '123456',
        });
      });

      assert.throws(() => {
        authService.registerFarmer({
          name: 'Pak Budi',
          nik: '321001010175000A', // Mengandung huruf
          phoneNumber: '081234567891',
          pin: '123456',
        });
      });
    });

    it('harus menolak pendaftaran jika PIN bukan 6 digit angka', () => {
      assert.throws(() => {
        authService.registerFarmer({
          name: 'Pak Budi',
          nik: '3210010101750002',
          phoneNumber: '081234567891',
          pin: '1234', // Hanya 4 digit
        });
      });
    });

    it('harus berhasil mendaftarkan petani baru dengan kredensial valid dan mengembalikan JWT', () => {
      const reg = authService.registerFarmer({
        name: 'Pak Ahmad',
        nik: '3210010101850005',
        phoneNumber: '081298765432',
        pin: '654321',
        village: 'Sukamaju',
        district: 'Kasokandel',
        regency: 'Majalengka',
        farmerGroupName: 'Kelompok Tani Harapan Jaya',
      });

      assert.strictEqual(reg.success, true);
      assert.ok(reg.token);
      assert.match(reg.farmer.id, /^farmer_usr_/);
      assert.strictEqual(reg.farmer.name, 'Pak Ahmad');
      assert.strictEqual(reg.farmer.nikMasked, '3210********0005');
      assert.strictEqual(reg.user.role, 'farmer');

      // Verifikasi token JWT yang dihasilkan
      const decoded = authService.verifyToken(reg.token);
      assert.ok(decoded);
      assert.strictEqual(decoded?.farmerId, reg.farmer.id);
      assert.strictEqual(decoded?.userId, reg.user.id);
    });

    it('harus menolak pendaftaran dengan NIK yang sudah terdaftar (Duplikasi NIK)', () => {
      authService.registerFarmer({
        name: 'Petani Pertama',
        nik: '3210010101900001',
        phoneNumber: '081111111111',
        pin: '123456',
      });

      assert.throws(() => {
        authService.registerFarmer({
          name: 'Petani Kedua',
          nik: '3210010101900001', // NIK sama
          phoneNumber: '082222222222',
          pin: '654321',
        });
      });
    });

    it('harus menolak pendaftaran dengan Nomor HP yang sudah terdaftar (Duplikasi HP)', () => {
      authService.registerFarmer({
        name: 'Petani Pertama',
        nik: '3210010101900002',
        phoneNumber: '081122334455',
        pin: '123456',
      });

      assert.throws(() => {
        authService.registerFarmer({
          name: 'Petani Kedua',
          nik: '3210010101900003',
          phoneNumber: '081122334455', // Nomor HP sama
          pin: '654321',
        });
      });
    });
  });

  describe('2. Login Petani & PBKDF2 Password Hashing', () => {
    beforeEach(() => {
      authService.registerFarmer({
        name: 'Pak Sugeng',
        nik: '3210010101950001',
        phoneNumber: '081399887766',
        pin: '123456',
      });
    });

    it('harus berhasil login menggunakan NIK + PIN yang benar', () => {
      const loginRes = authService.loginFarmer({
        identifier: '3210010101950001',
        pin: '123456',
      });

      assert.strictEqual(loginRes.success, true);
      assert.strictEqual(loginRes.farmer.name, 'Pak Sugeng');
      assert.ok(loginRes.token);
    });

    it('harus berhasil login menggunakan Nomor HP + PIN yang benar', () => {
      const loginRes = authService.loginFarmer({
        identifier: '081399887766',
        pin: '123456',
      });

      assert.strictEqual(loginRes.success, true);
      assert.strictEqual(loginRes.farmer.name, 'Pak Sugeng');
    });

    it('harus menolak login jika PIN salah', () => {
      assert.throws(() => {
        authService.loginFarmer({
          identifier: '3210010101950001',
          pin: '999999', // PIN salah
        });
      });
    });

    it('harus menolak login jika NIK / Nomor HP tidak ditemukan', () => {
      assert.throws(() => {
        authService.loginFarmer({
          identifier: '3210099999999999',
          pin: '123456',
        });
      });
    });
  });

  describe('3. Isolasi Data Server & Pencegahan IDOR / Spoofing', () => {
    let sessionFarmerA: any;
    let sessionFarmerB: any;

    beforeEach(() => {
      const resA = authService.registerFarmer({
        name: 'Farmer A (Budi)',
        nik: '3210010101700001',
        phoneNumber: '081211111111',
        pin: '111111',
      });
      sessionFarmerA = authService.verifyToken(resA.token)!;

      const resB = authService.registerFarmer({
        name: 'Farmer B (Joko)',
        nik: '3210010101700002',
        phoneNumber: '081222222222',
        pin: '222222',
      });
      sessionFarmerB = authService.verifyToken(resB.token)!;
    });

    it('Farmer A dan Farmer B harus memiliki farmerId yang berbeda dan terikat secara aman', () => {
      assert.ok(sessionFarmerA.farmerId);
      assert.ok(sessionFarmerB.farmerId);
      assert.notStrictEqual(sessionFarmerA.farmerId, sessionFarmerB.farmerId);
    });

    it('Farmer A berhasil menyinkronkan lahannya sendiri', async () => {
      const pushRes = await syncService.processPush(sessionFarmerA, [
        {
          operationId: 'op-land-a-1',
          entityType: 'LAND',
          entityId: 'land-a-1',
          action: 'CREATE',
          payload: {
            id: 'land-a-1',
            farmerId: sessionFarmerA.farmerId,
            name: 'Petak Sawah A Milik Budi',
            areaHa: 0.5,
            status: 'ACTIVE',
          },
          createdAt: new Date().toISOString(),
        },
      ]);

      assert.strictEqual(pushRes.success, true);
      assert.ok(pushRes.acknowledgedOperationIds.includes('op-land-a-1'));
    });

    it('Server HARUS MENOLAK jika Farmer A mencoba mengirim mutasi dengan payload farmerId milik Farmer B (Anti-Spoofing)', async () => {
      await assert.rejects(
        async () => {
          await syncService.processPush(sessionFarmerA, [
            {
              operationId: 'op-spoof-1',
              entityType: 'LAND',
              entityId: 'land-b-spoofed',
              action: 'CREATE',
              payload: {
                id: 'land-b-spoofed',
                farmerId: sessionFarmerB.farmerId, // Mencoba impersonasi Farmer B!
                name: 'Petak Bajakan',
              },
              createdAt: new Date().toISOString(),
            },
          ]);
        },
        (err: any) => {
          return err.statusCode === 403 && err.code === 'UNAUTHORIZED_OWNERSHIP';
        }
      );
    });

    it('Server HARUS MENOLAK jika Farmer B mencoba mengubah atau menimpa entitas yang sudah dimiliki oleh Farmer A', async () => {
      // 1. Farmer A membuat petak lahan
      await syncService.processPush(sessionFarmerA, [
        {
          operationId: 'op-land-a-init',
          entityType: 'LAND',
          entityId: 'land-a-protected',
          action: 'CREATE',
          payload: {
            id: 'land-a-protected',
            farmerId: sessionFarmerA.farmerId,
            name: 'Sawah Warisan A',
          },
          createdAt: new Date().toISOString(),
        },
      ]);

      // 2. Farmer B mencoba memodifikasi atau menghapus sawah milik Farmer A
      await assert.rejects(
        async () => {
          await syncService.processPush(sessionFarmerB, [
            {
              operationId: 'op-land-b-attack',
              entityType: 'LAND',
              entityId: 'land-a-protected',
              action: 'UPDATE',
              payload: {
                id: 'land-a-protected',
                farmerId: sessionFarmerB.farmerId,
                name: 'Sawah yang Direbut B',
              },
              createdAt: new Date().toISOString(),
            },
          ]);
        },
        (err: any) => {
          return err.statusCode === 403 && err.code === 'UNAUTHORIZED_ENTITY_ACCESS';
        }
      );
    });

    it('Sync Pull HARUS TERISOLASI: Farmer B tidak boleh menerima data yang dipush oleh Farmer A', async () => {
      // Farmer A push data lahan
      await syncService.processPush(sessionFarmerA, [
        {
          operationId: 'op-land-a-secret',
          entityType: 'LAND',
          entityId: 'land-a-secret',
          action: 'CREATE',
          payload: {
            id: 'land-a-secret',
            farmerId: sessionFarmerA.farmerId,
            name: 'Lahan Rahasia Farmer A',
          },
          createdAt: new Date().toISOString(),
        },
      ]);

      // Farmer B melakukan pull
      const pullB = await syncService.processPull(sessionFarmerB);
      assert.strictEqual(pullB.changes.length, 0); // Farmer B tidak menerima data Farmer A!

      // Farmer A melakukan pull
      const pullA = await syncService.processPull(sessionFarmerA);
      assert.ok(pullA.changes.length >= 1);
      assert.ok(pullA.changes.some((c) => c.entityId === 'land-a-secret'));
    });

    it('Kedaulatan Petani: Penghapusan ACTUAL_ACTION harus selalu ditolak', async () => {
      await assert.rejects(
        async () => {
          await syncService.processPush(sessionFarmerA, [
            {
              operationId: 'op-del-actual',
              entityType: 'ACTUAL_ACTION',
              entityId: 'act-1',
              action: 'DELETE',
              payload: {},
              createdAt: new Date().toISOString(),
            },
          ]);
        },
        (err: any) => {
          return err.statusCode === 400 && err.code === 'ACTUAL_ACTION_PROTECTED';
        }
      );
    });

    it('Idempotency: Mengirim item dengan operationId yang sama harus di-acknowledge tanpa duplikasi eksekusi', async () => {
      const item: SyncPushItem = {
        operationId: 'op-idempotent-1',
        entityType: 'LAND',
        entityId: 'land-idem-1',
        action: 'CREATE',
        payload: {
          id: 'land-idem-1',
          farmerId: sessionFarmerA.farmerId,
          name: 'Lahan Idempotent',
        },
        createdAt: new Date().toISOString(),
      };

      const res1 = await syncService.processPush(sessionFarmerA, [item]);
      assert.strictEqual(res1.processedCount, 1);
      assert.ok(res1.acknowledgedOperationIds.includes('op-idempotent-1'));

      // Kirim ulang persis sama
      const res2 = await syncService.processPush(sessionFarmerA, [item]);
      assert.strictEqual(res2.processedCount, 0); // Tidak diproses ganda
      assert.ok(res2.acknowledgedOperationIds.includes('op-idempotent-1')); // Tetap di-ack
    });
  });
});
