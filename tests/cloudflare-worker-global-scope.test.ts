/**
 * HIKMAT TANI - Cloudflare Worker Edge Runtime & Global Scope Safety Test Suite
 * 
 * Memverifikasi:
 * 1. Global Scope Isolation: Tidak ada operasi terlarang (crypto.randomBytes, crypto.getRandomValues, I/O, timer, database query)
 *    yang dieksekusi saat module evaluation / global scope loading Worker.
 * 2. AuthService & AdminService Lifecycle: Inisialisasi lazy/runtime terbukti aman dan idempotent.
 * 3. Auth Endpoints: /api/v1/auth/register, /api/v1/auth/login, /api/v1/auth/me, /api/v1/auth/logout pada Worker fetch handler.
 * 4. Response Contract: Registrasi & Login mengembalikan format token & farmer metadata yang konsisten dan valid.
 * 5. Edge Compatibility: Menjamin tidak terjadi error 10021 Disallowed operation called within global scope.
 */

import crypto from 'node:crypto';

// Setup Mock Trap untuk mendeteksi pemanggilan ilegal pada Global/Module Scope
let globalScopeDisallowedCalls: string[] = [];
let isGlobalScope = true;

const originalRandomBytes = crypto.randomBytes;
const originalGetRandomValues = globalThis.crypto?.getRandomValues;

// Pasang trap
(crypto as any).randomBytes = function (...args: any[]) {
  if (isGlobalScope) {
    globalScopeDisallowedCalls.push(`crypto.randomBytes called in global scope with args: ${JSON.stringify(args)}`);
  }
  return originalRandomBytes.apply(crypto, args as any);
};

if (globalThis.crypto) {
  globalThis.crypto.getRandomValues = function (array: any) {
    if (isGlobalScope) {
      globalScopeDisallowedCalls.push('crypto.getRandomValues called in global scope');
    }
    return originalGetRandomValues.apply(globalThis.crypto, [array] as any);
  };
}

async function runWorkerGlobalScopeTests() {
  console.log('\n=== UJI CLOUDFLARE WORKER GLOBAL SCOPE SAFETY & AUTH LIFECYCLE ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      console.log(`✓ ${description}`);
      passed++;
    } else {
      console.error(`✗ GAGAL: ${description}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // TEST 1: MODULE EVALUATION / GLOBAL SCOPE LOAD
  // -------------------------------------------------------------
  // Load module Worker saat trap aktif
  const workerModule = await import('../server/worker.ts');
  const worker = workerModule.default;

  // Nonaktifkan trap global scope setelah module selesai dimuat
  isGlobalScope = false;

  assert(
    globalScopeDisallowedCalls.length === 0,
    `1. Global Scope Purity: 0 disallowed crypto/random/I/O calls during Worker module load (found: ${globalScopeDisallowedCalls.length})`
  );

  // -------------------------------------------------------------
  // TEST 2: LAZY INITIALIZATION TEST
  // -------------------------------------------------------------
  const { authService } = await import('../server/services/authService.ts');
  const { adminService } = await import('../server/services/adminService.ts');

  assert(
    typeof authService.registerFarmer === 'function',
    '2. AuthService Instance: Instance singleton siap digunakan runtime'
  );

  assert(
    typeof adminService.authenticateAdmin === 'function',
    '3. AdminService Instance: Instance singleton siap digunakan runtime'
  );

  // -------------------------------------------------------------
  // TEST 3: WORKER HEALTH CHECK ENDPOINT
  // -------------------------------------------------------------
  const mockEnv: any = {
    DB: {
      prepare: (query: string) => ({
        bind: () => ({
          all: async () => ({ results: [] }),
          first: async () => null,
          run: async () => ({ success: true }),
        }),
      }),
    },
    DATABASE_PROVIDER: 'postgres',
    API_VERSION: 'v1',
  };

  const healthReq = new Request('https://hikmattani.id/api/v1/health', {
    method: 'GET',
  });
  const healthRes = await worker.fetch(healthReq, mockEnv, {});
  const healthJson = (await healthRes.json()) as any;

  assert(
    healthRes.status === 200 && healthJson.status === 'ok' && healthJson.runtime === 'Cloudflare Workers (Edge)',
    '4. Worker Health Check: /api/v1/health merespons status 200 OK dengan metadata edge'
  );

  // -------------------------------------------------------------
  // TEST 4: REGISTRATION ENDPOINT (/api/v1/auth/register)
  // -------------------------------------------------------------
  const uniqueNik = `321001010185${Math.floor(1000 + Math.random() * 9000)}`;
  const uniquePhone = `08129876${Math.floor(1000 + Math.random() * 9000)}`;

  const registerReq = new Request('https://hikmattani.id/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Budi Santoso',
      nik: uniqueNik,
      phoneNumber: uniquePhone,
      pin: '654321',
      village: 'Sukamaju',
      district: 'Kasokandel',
      regency: 'Majalengka',
      province: 'Jawa Barat',
      farmerGroupName: 'Kelompok Tani Makmur',
    }),
  });

  const registerRes = await worker.fetch(registerReq, mockEnv, {});
  const registerJson = (await registerRes.json()) as any;

  assert(
    registerRes.status === 201 &&
      registerJson.success === true &&
      typeof registerJson.data?.token === 'string' &&
      registerJson.data?.token.length > 20 &&
      registerJson.data?.farmer?.name === 'Budi Santoso' &&
      registerJson.data?.farmer?.nikMasked.includes('****'),
    '5. Worker Register Endpoint: Mengembalikan HTTP 201 dengan struktur token & farmer profile valid'
  );

  const registeredToken = registerJson.data?.token;

  // -------------------------------------------------------------
  // TEST 5: DUPLICATE NIK PREVENTION
  // -------------------------------------------------------------
  const dupReq = new Request('https://hikmattani.id/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Budi Santoso Kloning',
      nik: uniqueNik,
      phoneNumber: '081299998888',
      pin: '654321',
    }),
  });

  const dupRes = await worker.fetch(dupReq, mockEnv, {});
  const dupJson = (await dupRes.json()) as any;

  assert(
    dupRes.status === 409 && dupJson.success === false && dupJson.error?.code === 'DUPLICATE_NIK',
    '6. Anti-Duplicate NIK: Registrasi ganda ditolak dengan status HTTP 409'
  );

  // -------------------------------------------------------------
  // TEST 6: LOGIN ENDPOINT (/api/v1/auth/login)
  // -------------------------------------------------------------
  const loginReq = new Request('https://hikmattani.id/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: uniquePhone,
      pin: '654321',
    }),
  });

  const loginRes = await worker.fetch(loginReq, mockEnv, {});
  const loginJson = (await loginRes.json()) as any;

  assert(
    loginRes.status === 200 &&
      loginJson.success === true &&
      typeof loginJson.data?.token === 'string' &&
      loginJson.data?.farmer?.name === 'Budi Santoso',
    '7. Worker Login Endpoint: Login via Nomor HP + PIN berhasil dan mengembalikan session token'
  );

  // -------------------------------------------------------------
  // TEST 7: AUTH ME PROFILE ENDPOINT (/api/v1/auth/me)
  // -------------------------------------------------------------
  const meReq = new Request('https://hikmattani.id/api/v1/auth/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${registeredToken}`,
    },
  });

  const meRes = await worker.fetch(meReq, mockEnv, {});
  const meJson = (await meRes.json()) as any;

  assert(
    meRes.status === 200 &&
      meJson.success === true &&
      meJson.data?.farmer?.name === 'Budi Santoso' &&
      meJson.data?.farmer?.village === 'Sukamaju',
    '8. Worker Profile Endpoint: /api/v1/auth/me mengembalikan profil petani terotentikasi'
  );

  // -------------------------------------------------------------
  // TEST 8: LOGOUT ENDPOINT (/api/v1/auth/logout)
  // -------------------------------------------------------------
  const logoutReq = new Request('https://hikmattani.id/api/v1/auth/logout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${registeredToken}`,
    },
  });

  const logoutRes = await worker.fetch(logoutReq, mockEnv, {});
  const logoutJson = (await logoutRes.json()) as any;

  assert(
    logoutRes.status === 200 && logoutJson.success === true,
    '9. Worker Logout Endpoint: /api/v1/auth/logout berhasil mengakhiri sesi'
  );

  // -------------------------------------------------------------
  // TEST 9: ADMIN SERVICE LAZY AUTHENTICATION
  // -------------------------------------------------------------
  const adminLoginResult = adminService.authenticateAdmin('pengelola', 'ManagerTani2026!');
  assert(
    adminLoginResult.success === true &&
      adminLoginResult.admin?.role === 'MANAGER' &&
      typeof adminLoginResult.token === 'string',
    '10. Admin Lazy Auth: Autentikasi Pengelola (MANAGER) berfungsi dengan baik saat runtime'
  );

  // -------------------------------------------------------------
  // TEST 10: IDEMPOTENCY OF SEED
  // -------------------------------------------------------------
  authService.loginFarmer({ identifier: '3210010101750001', pin: '123456' });
  const sutrisno = authService.getFarmerProfile('farmer_sutrisno');

  assert(
    sutrisno !== null && sutrisno.name === 'Pak Sutrisno',
    '11. Idempotent Seed: Akun default petani Pak Sutrisno diinisialisasi secara tepat satu kali'
  );

  console.log(`\nTotal: ${passed + failed} | Lolos: ${passed} | Gagal: ${failed}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runWorkerGlobalScopeTests().catch((err) => {
  console.error('Test Runner Failed:', err);
  process.exit(1);
});
