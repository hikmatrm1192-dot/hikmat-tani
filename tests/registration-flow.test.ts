/**
 * HIKMAT TANI - Registration & Auth Flow End-to-End Test Suite
 * 
 * Verifikasi:
 * 1. Endpoint POST /api/v1/auth/register mengembalikan struktur respons yang diharapkan.
 * 2. authClientService.register mem-parsing token dan data petani dengan benar.
 * 3. authClientService.register tidak pernah crash (Cannot read properties of undefined reading 'token') saat server mengembalikan variasi payload.
 * 4. Penanganan error duplikasi NIK/No HP mengembalikan pesan yang user-friendly.
 * 5. Sesi yang dibuat mengikat farmerId dan token yang valid untuk akses dashboard.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import "fake-indexeddb/auto";

// Polyfill localStorage in Node.js test environment if not present
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] || null,
    get length() {
      return store.size;
    },
  } as any;
}

import { authService } from '../server/services/authService.ts';
import { authClientService } from '../src/services/authClientService.ts';

describe('HIKMAT TANI — Registration Flow & Robust Response Handling', () => {
  beforeEach(() => {
    authService.resetStore();
    localStorage.clear();
  });

  it('1. Server registerFarmer mengembalikan { success, token, user, farmer }', () => {
    const res = authService.registerFarmer({
      name: 'Pak Sugeng',
      nik: '3210010101900099',
      phoneNumber: '081234567811',
      pin: '123456',
      village: 'Desa Mandiri',
      district: 'Kecamatan Makmur',
      regency: 'Majalengka',
      farmerGroupName: 'Poktan Makmur',
    });

    assert.strictEqual(res.success, true);
    assert.ok(res.token, 'Token JWT harus dikembalikan');
    assert.ok(res.user, 'User object harus dikembalikan');
    assert.ok(res.farmer, 'Farmer object harus dikembalikan');
    assert.match(res.farmer.id, /^farmer_/);
    assert.strictEqual(res.farmer.name, 'Pak Sugeng');
  });

  it('2. authClientService.register menangani payload standar server { success, data: { token, user, farmer } }', async () => {
    // Mock fetch to return server payload
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: any, opts: any) => {
      const body = JSON.parse(opts.body);
      const serverRes = authService.registerFarmer(body);
      return {
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          message: 'Pendaftaran identitas petani berhasil',
          data: serverRes,
        }),
      } as any;
    };

    try {
      const res = await authClientService.register({
        name: 'Pak Sugeng',
        nik: '3210010101900098',
        phoneNumber: '081234567812',
        pin: '123456',
      });

      assert.strictEqual(res.success, true);
      assert.ok(res.session);
      assert.ok(res.session.token);
      assert.strictEqual(res.session.farmer.name, 'Pak Sugeng');
      assert.ok(authClientService.isAuthenticated());
      assert.strictEqual(authClientService.getCurrentFarmerId(), res.session.farmer.id);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('3. authClientService.register menangani payload flat { success, token, user, farmer } tanpa crash', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          token: 'mock.jwt.token',
          user: { id: 'usr_test', role: 'farmer', isAnonymous: false },
          farmer: {
            id: 'farmer_usr_test',
            name: 'Pak Joko',
            nikMasked: '3210********1234',
            phoneNumber: '081234567899',
            role: 'farmer',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      } as any;
    };

    try {
      const res = await authClientService.register({
        name: 'Pak Joko',
        nik: '3210010101900097',
        phoneNumber: '081234567813',
        pin: '123456',
      });

      assert.strictEqual(res.success, true);
      assert.ok(res.session);
      assert.strictEqual(res.session.token, 'mock.jwt.token');
      assert.strictEqual(res.session.farmer.name, 'Pak Joko');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('4. authClientService.register TIDAK CRASH saat server mengembalikan respons tak terduga (misal Worker placeholder)', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: 'HIKMAT TANI Cloudflare Worker API Ready',
          path: '/api/v1/auth/register',
        }),
      } as any;
    };

    try {
      const res = await authClientService.register({
        name: 'Pak Test',
        nik: '3210010101900096',
        phoneNumber: '081234567814',
        pin: '123456',
      });

      assert.strictEqual(res.success, false);
      assert.ok(res.error, 'Harus mengembalikan pesan error yang jelas');
      assert.doesNotMatch(res.error, /Cannot read properties of undefined/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('5. authClientService.register menangani error HTTP 409 (Duplikasi NIK) secara elegan', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return {
        ok: false,
        status: 409,
        json: async () => ({
          success: false,
          error: {
            code: 'DUPLICATE_NIK',
            message: 'NIK KTP ini sudah terdaftar. Silakan gunakan menu Masuk / Login.',
          },
        }),
      } as any;
    };

    try {
      const res = await authClientService.register({
        name: 'Pak Duplicate',
        nik: '3210010101750001',
        phoneNumber: '081234567815',
        pin: '123456',
      });

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error, 'NIK KTP ini sudah terdaftar. Silakan gunakan menu Masuk / Login.');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('6. authClientService.login menangani payload dengan tangguh tanpa crash', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            token: 'valid.login.jwt',
            user: { id: 'usr_login', role: 'farmer', isAnonymous: false },
            farmer: {
              id: 'farmer_usr_login',
              name: 'Pak Login',
              nikMasked: '3210********9999',
              phoneNumber: '081234567890',
              role: 'farmer',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          },
        }),
      } as any;
    };

    try {
      const res = await authClientService.login({
        identifier: '3210010101750001',
        pin: '123456',
      });

      assert.strictEqual(res.success, true);
      assert.ok(res.session);
      assert.strictEqual(res.session.token, 'valid.login.jwt');
      assert.strictEqual(res.session.farmer.name, 'Pak Login');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
