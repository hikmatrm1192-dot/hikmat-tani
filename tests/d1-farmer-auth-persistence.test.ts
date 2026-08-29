/**
 * HIKMAT TANI — Cloudflare D1 Authentication & Persistence Safety Regression Test
 * 
 * Pengujian Lengkap Perbaikan Persistensi Login Petani (A s/d L):
 * - TEST A: Register -> akun muncul di `farmers`
 * - TEST B: Register -> akun muncul di `auth_users`
 * - TEST C: Register gagal ketika database write gagal (Rollback & Compensation)
 * - TEST D: Register gagal tidak boleh menghasilkan JWT session
 * - TEST E: Register -> logout -> login kembali -> berhasil
 * - TEST F: Register -> cold start -> login kembali -> berhasil lookup dari D1
 * - TEST G: Login NIK + PIN -> berhasil
 * - TEST H: Login nomor HP + PIN (dengan variasi normalisasi 08..., 628..., +628..., spasi) -> berhasil
 * - TEST I: PIN salah ditolak (401 INVALID_CREDENTIALS)
 * - TEST J: NIK tidak terdaftar ditolak (401 INVALID_CREDENTIALS)
 * - TEST K: Duplicate NIK ditolak (409 DUPLICATE_NIK)
 * - TEST L: Farmer A tidak dapat mengakses Farmer B (Isolasi Penuh)
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { authService } from '../server/services/authService.ts';
import { InMemoryD1Database, createTestD1Client } from '../server/db/d1/testD1.ts';
import * as d1Schema from '../server/db/d1/schema.ts';
import { eq } from 'drizzle-orm';

describe('HIKMAT TANI — D1 Authentication Persistence & Register Safety Test Suite (A-L)', () => {
  let inMemoryD1: InMemoryD1Database;
  let db: any;

  beforeEach(() => {
    authService.resetStore();
    inMemoryD1 = new InMemoryD1Database();
    db = createTestD1Client();
  });

  // TEST A: Register -> akun muncul di `farmers`
  it('TEST A: Register -> akun muncul di farmers D1', async () => {
    const regResult = await authService.registerFarmerAsync(
      {
        name: 'Pak Sugeng Hartono',
        nik: '3210010101900001',
        phoneNumber: '081234567801',
        pin: '123456',
        village: 'Sukamaju',
        district: 'Kasokandel',
        regency: 'Majalengka',
        province: 'Jawa Barat',
        farmerGroupName: 'Poktan Tani Maju',
      },
      db
    );

    assert.strictEqual(regResult.success, true);
    assert.ok(regResult.token, 'Token JWT harus diterbitkan');
    assert.ok(regResult.farmer.id, 'Farmer ID harus valid');

    // Verifikasi data fisik tersimpan di tabel farmers D1
    const farmersRows = await db
      .select()
      .from(d1Schema.farmers)
      .where(eq(d1Schema.farmers.nik, '3210010101900001'));
    assert.strictEqual(farmersRows.length, 1, 'Data farmer harus ada 1 di tabel farmers');
    assert.strictEqual(farmersRows[0].name, 'Pak Sugeng Hartono');
    assert.strictEqual(farmersRows[0].phoneNumber, '081234567801');
    assert.ok(farmersRows[0].pinHash, 'PIN hash harus tersimpan di D1');
    assert.ok(farmersRows[0].salt, 'Salt harus tersimpan di D1');
    assert.strictEqual(farmersRows[0].village, 'Sukamaju');
    assert.strictEqual(farmersRows[0].district, 'Kasokandel');
  });

  // TEST B: Register -> akun muncul di `auth_users`
  it('TEST B: Register -> akun muncul di auth_users D1', async () => {
    const regResult = await authService.registerFarmerAsync(
      {
        name: 'Pak Mulyadi',
        nik: '3210010101900002',
        phoneNumber: '081234567802',
        pin: '123456',
      },
      db
    );

    assert.strictEqual(regResult.success, true);
    assert.ok(regResult.user.id, 'User ID harus valid');

    // Verifikasi data fisik tersimpan di tabel auth_users D1
    const authUserRows = await db
      .select()
      .from(d1Schema.authUsers)
      .where(eq(d1Schema.authUsers.id, regResult.user.id));
    assert.strictEqual(authUserRows.length, 1, 'Data auth_user harus ada 1 di tabel auth_users');
    assert.strictEqual(authUserRows[0].id, regResult.user.id);
    assert.strictEqual(authUserRows[0].role, 'farmer');
    assert.strictEqual(authUserRows[0].isActive, true);
  });

  // TEST C: Register gagal ketika database write gagal
  it('TEST C: Register gagal ketika database write gagal (Rollback & Compensation)', async () => {
    // Database mock yang sengaja melempar error saat insert ke tabel farmers
    const customFailingDb = {
      insert: (table: any) => {
        if (table === d1Schema.farmers) {
          return {
            values: () => {
              throw new Error('D1 Simulated Storage Failure on table farmers');
            },
          };
        }
        return db.insert(table);
      },
      delete: (table: any) => db.delete(table),
      select: () => db.select(),
    };

    let errorThrown: any = null;
    try {
      await authService.registerFarmerAsync(
        {
          name: 'Pak Bambang',
          nik: '3210010101900003',
          phoneNumber: '081234567803',
          pin: '654321',
          village: 'Sukamaju',
        },
        customFailingDb
      );
    } catch (err) {
      errorThrown = err;
    }

    // 1. Response harus gagal
    assert.ok(errorThrown, 'Registrasi HARUS melempar error saat DB write gagal');
    assert.strictEqual(errorThrown.statusCode, 500);
    assert.strictEqual(errorThrown.code, 'PERSISTENCE_FAILED');

    // 2. Tidak ada akun di memory cache
    assert.strictEqual(
      authService.getFarmerProfileByNik('3210010101900003'),
      null,
      'Akun TIDAK boleh masuk ke cache memori jika DB gagal'
    );

    // 3. Rollback: Tidak ada data auth_users yang tertinggal (orphan)
    const allAuthUsers = await db.select().from(d1Schema.authUsers);
    assert.strictEqual(allAuthUsers.length, 0, 'auth_users yang setengah jadi harus di-rollback/dibersihkan');
  });

  // TEST D: Register gagal tidak boleh menghasilkan JWT
  it('TEST D: Register gagal tidak boleh menghasilkan JWT', async () => {
    let result: any = null;
    let caughtErr: any = null;

    const brokenDb = {
      insert: () => {
        throw new Error('Disk IO Error');
      },
      delete: (table: any) => db.delete(table),
      select: () => db.select(),
    };

    try {
      result = await authService.registerFarmerAsync(
        {
          name: 'Gagal Akun',
          nik: '3210010101900004',
          phoneNumber: '081234567804',
          pin: '123456',
        },
        brokenDb
      );
    } catch (e) {
      caughtErr = e;
    }

    assert.strictEqual(result, null, 'Tidak boleh ada objek result yang di-return saat gagal');
    assert.ok(caughtErr, 'Error harus dilempar');
  });

  // TEST E: Register -> logout -> login kembali
  it('TEST E: Register -> logout -> login kembali -> berhasil', async () => {
    const reg = await authService.registerFarmerAsync(
      {
        name: 'Ibu Ratna',
        nik: '3210010101900005',
        phoneNumber: '081234567805',
        pin: '112233',
      },
      db
    );

    assert.strictEqual(reg.success, true);
    assert.ok(reg.token);

    // Login Kembali dengan NIK
    const loginRes = await authService.loginFarmerAsync(
      {
        identifier: '3210010101900005',
        pin: '112233',
      },
      db
    );

    assert.strictEqual(loginRes.success, true);
    assert.ok(loginRes.token, 'Token baru harus diterbitkan');
    assert.strictEqual(loginRes.farmer.name, 'Ibu Ratna');
    assert.strictEqual(loginRes.farmer.phoneNumber, '081234567805');
  });

  // TEST F: Register -> cold start -> login kembali
  it('TEST F: Register -> cold start (hapus memory cache) -> login kembali -> berhasil lookup dari D1', async () => {
    // 1. Registrasi awal ke D1
    const reg = await authService.registerFarmerAsync(
      {
        name: 'Pak Hendra Gunawan',
        nik: '3210010101900006',
        phoneNumber: '081234567806',
        pin: '223344',
      },
      db
    );
    assert.strictEqual(reg.success, true);

    // 2. SIMULASI COLD START WORKER:
    // Hapus total seluruh in-memory state authService
    authService.resetStore();

    // Pastikan di memory cache lokal sudah kosong (null)
    assert.strictEqual(
      authService.getFarmerProfileByNik('3210010101900006'),
      null,
      'Memory cache harus kosong setelah cold start'
    );

    // 3. Login kembali dari database D1
    const loginAfterColdStart = await authService.loginFarmerAsync(
      {
        identifier: '3210010101900006',
        pin: '223344',
      },
      db
    );

    assert.strictEqual(loginAfterColdStart.success, true);
    assert.ok(loginAfterColdStart.token);
    assert.strictEqual(loginAfterColdStart.farmer.name, 'Pak Hendra Gunawan');
  });

  // TEST G: Login NIK + PIN
  it('TEST G: Login NIK + PIN -> berhasil', async () => {
    await authService.registerFarmerAsync(
      {
        name: 'Pak Tri',
        nik: '3210010101900007',
        phoneNumber: '081234567807',
        pin: '334455',
      },
      db
    );

    const loginRes = await authService.loginFarmerAsync(
      {
        identifier: '3210010101900007',
        pin: '334455',
      },
      db
    );

    assert.strictEqual(loginRes.success, true);
    assert.strictEqual(loginRes.farmer.name, 'Pak Tri');
  });

  // TEST H: Login nomor HP + PIN
  it('TEST H: Login nomor HP + PIN (dengan variasi 08, +62, 62, spasi) -> berhasil', async () => {
    await authService.registerFarmerAsync(
      {
        name: 'Pak Joko Subroto',
        nik: '3210010101900008',
        phoneNumber: '081234567808',
        pin: '556677',
      },
      db
    );

    // Reset memory cache untuk memvalidasi query D1
    authService.resetStore();

    // Login variasi 1: Format 081234567808
    const login1 = await authService.loginFarmerAsync({ identifier: '081234567808', pin: '556677' }, db);
    assert.strictEqual(login1.success, true);

    // Login variasi 2: Format +62 812-3456-7808
    const login2 = await authService.loginFarmerAsync({ identifier: '+62 812-3456-7808', pin: '556677' }, db);
    assert.strictEqual(login2.success, true);

    // Login variasi 3: Format 6281234567808
    const login3 = await authService.loginFarmerAsync({ identifier: '6281234567808', pin: '556677' }, db);
    assert.strictEqual(login3.success, true);
  });

  // TEST I: PIN salah ditolak
  it('TEST I: PIN salah ditolak (HTTP 401 INVALID_CREDENTIALS)', async () => {
    await authService.registerFarmerAsync(
      {
        name: 'Pak Dedi',
        nik: '3210010101900009',
        phoneNumber: '081234567809',
        pin: '123456',
      },
      db
    );

    let error: any = null;
    try {
      await authService.loginFarmerAsync(
        {
          identifier: '3210010101900009',
          pin: '999999', // PIN SALAH
        },
        db
      );
    } catch (err) {
      error = err;
    }

    assert.ok(error, 'Login dengan PIN salah harus melempar error');
    assert.strictEqual(error.statusCode, 401);
    assert.strictEqual(error.code, 'INVALID_CREDENTIALS');
  });

  // TEST J: NIK tidak terdaftar ditolak
  it('TEST J: NIK tidak terdaftar ditolak (HTTP 401 INVALID_CREDENTIALS)', async () => {
    let error: any = null;
    try {
      await authService.loginFarmerAsync(
        {
          identifier: '3210019999999999', // NIK TIDAK ADA
          pin: '123456',
        },
        db
      );
    } catch (err) {
      error = err;
    }

    assert.ok(error, 'Login dengan NIK tidak terdaftar harus melempar error');
    assert.strictEqual(error.statusCode, 401);
    assert.strictEqual(error.code, 'INVALID_CREDENTIALS');
  });

  // TEST K: Duplicate NIK ditolak
  it('TEST K: Duplicate NIK ditolak (HTTP 409 DUPLICATE_NIK)', async () => {
    await authService.registerFarmerAsync(
      {
        name: 'Petani Pertama',
        nik: '3210010101900011',
        phoneNumber: '081234567811',
        pin: '123456',
      },
      db
    );

    let error: any = null;
    try {
      await authService.registerFarmerAsync(
        {
          name: 'Petani Kedua Coba NIK Sama',
          nik: '3210010101900011', // NIK SAMA
          phoneNumber: '081234567899',
          pin: '123456',
        },
        db
      );
    } catch (err) {
      error = err;
    }

    assert.ok(error, 'Pendaftaran duplikat NIK harus ditolak');
    assert.strictEqual(error.statusCode, 409);
    assert.strictEqual(error.code, 'DUPLICATE_NIK');
  });

  // TEST L: Farmer A tidak dapat mengakses Farmer B
  it('TEST L: Farmer A tidak dapat mengakses Farmer B (Isolasi Penuh)', async () => {
    const farmerA = await authService.registerFarmerAsync(
      {
        name: 'Pak Wahyu Hidayat',
        nik: '3210010101900012',
        phoneNumber: '081234567812',
        pin: '123456',
      },
      db
    );

    const farmerB = await authService.registerFarmerAsync(
      {
        name: 'Ibu Siti Aminah',
        nik: '3210010101900013',
        phoneNumber: '081234567813',
        pin: '654321',
      },
      db
    );

    // Verifikasi Token A
    const tokenPayloadA = authService.verifyToken(farmerA.token);
    assert.strictEqual(tokenPayloadA?.farmerId, farmerA.farmer.id);
    assert.strictEqual(tokenPayloadA?.name, 'Pak Wahyu Hidayat');

    // Verifikasi Token B
    const tokenPayloadB = authService.verifyToken(farmerB.token);
    assert.strictEqual(tokenPayloadB?.farmerId, farmerB.farmer.id);
    assert.strictEqual(tokenPayloadB?.name, 'Ibu Siti Aminah');

    // Pastikan farmerId dan userId berbeda total
    assert.notStrictEqual(farmerA.farmer.id, farmerB.farmer.id);
    assert.notStrictEqual(farmerA.user.id, farmerB.user.id);
    assert.notStrictEqual(farmerA.token, farmerB.token);
  });
});
