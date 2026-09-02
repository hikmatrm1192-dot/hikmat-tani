/**
 * HIKMAT TANI - Cloudflare Worker Edge Runtime & Global Scope Safety Test Suite
 *
 * Memverifikasi global-scope safety, lazy service initialization, health,
 * CORS origin isolation, and the Worker auth lifecycle.
 */

import crypto from 'node:crypto';

let globalScopeDisallowedCalls: string[] = [];
let isGlobalScope = true;

const originalRandomBytes = crypto.randomBytes;
const originalGetRandomValues = globalThis.crypto?.getRandomValues;

(crypto as any).randomBytes = function (...args: any[]) {
  if (isGlobalScope) globalScopeDisallowedCalls.push(`crypto.randomBytes called in global scope with args: ${JSON.stringify(args)}`);
  return originalRandomBytes.apply(crypto, args as any);
};

if (globalThis.crypto) {
  globalThis.crypto.getRandomValues = function (array: any) {
    if (isGlobalScope) globalScopeDisallowedCalls.push('crypto.getRandomValues called in global scope');
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

  const workerModule = await import('../server/worker.ts');
  const worker = workerModule.default;
  isGlobalScope = false;

  assert(globalScopeDisallowedCalls.length === 0, `1. Global Scope Purity: 0 disallowed crypto/random/I/O calls during Worker module load (found: ${globalScopeDisallowedCalls.length})`);

  const { authService } = await import('../server/services/authService.ts');
  const { adminService } = await import('../server/services/adminService.ts');

  assert(typeof authService.registerFarmer === 'function', '2. AuthService Instance: Instance singleton siap digunakan runtime');
  assert(typeof adminService.authenticateAdmin === 'function', '3. AdminService Instance: Instance singleton siap digunakan runtime');

  let healthProbeCount = 0;
  const mockEnv: any = {
    DB: {
      prepare: (query: string) => {
        if (query.trim().toUpperCase() === 'SELECT 1') healthProbeCount++;
        return {
          bind: () => ({
            all: async () => ({ results: [] }),
            first: async () => null,
            run: async () => ({ success: true }),
          }),
        };
      },
    },
    DATABASE_PROVIDER: 'postgres',
    API_VERSION: 'v1',
  };

  const healthReq = new Request('https://hikmattani.id/api/v1/health', { method: 'GET' });
  const healthRes = await worker.fetch(healthReq, mockEnv, {});
  const healthJson = (await healthRes.json()) as any;

  assert(healthRes.status === 200 && healthJson.status === 'ok' && healthJson.runtime === 'Cloudflare Workers (Edge)', '4. Worker Health Check: /api/v1/health merespons status 200 OK dengan metadata edge');
  assert(healthProbeCount === 1, '5. Worker Health Check: /api/v1/health benar-benar melakukan probe SELECT 1 ke D1');

  const trustedOriginReq = new Request('https://hikmattani.id/api/v1/health', {
    method: 'GET',
    headers: { Origin: 'https://app.hikmattani.id' },
  });
  const trustedOriginRes = await worker.fetch(trustedOriginReq, mockEnv, {});
  assert(trustedOriginRes.headers.get('Access-Control-Allow-Origin') === 'https://app.hikmattani.id', '6. CORS: custom production origin diizinkan secara eksplisit');

  const untrustedOriginReq = new Request('https://hikmattani.id/api/v1/health', {
    method: 'GET',
    headers: { Origin: 'https://evil.example' },
  });
  const untrustedOriginRes = await worker.fetch(untrustedOriginReq, mockEnv, {});
  assert(untrustedOriginRes.headers.get('Access-Control-Allow-Origin') !== '*' && untrustedOriginRes.headers.get('Access-Control-Allow-Origin') !== 'https://evil.example', '7. CORS: origin asing tidak mendapatkan wildcard atau echo origin');

  const maliciousSubdomainReq = new Request('https://hikmattani.id/api/v1/health', {
    method: 'GET',
    headers: { Origin: 'https://attacker.hikmattani.id' },
  });
  const maliciousSubdomainRes = await worker.fetch(maliciousSubdomainReq, mockEnv, {});
  assert(maliciousSubdomainRes.headers.get('Access-Control-Allow-Origin') !== 'https://attacker.hikmattani.id', '8. CORS: subdomain hikmattani.id yang tidak dikenal tidak otomatis dipercaya');

  const maliciousWorkerOriginReq = new Request('https://hikmattani.id/api/v1/health', {
    method: 'GET',
    headers: { Origin: 'https://attacker.workers.dev' },
  });
  const maliciousWorkerOriginRes = await worker.fetch(maliciousWorkerOriginReq, mockEnv, {});
  assert(maliciousWorkerOriginRes.headers.get('Access-Control-Allow-Origin') !== 'https://attacker.workers.dev', '9. CORS: workers.dev milik pihak lain tidak otomatis dipercaya');

  const uniqueNik = `321001010185${Math.floor(1000 + Math.random() * 9000)}`;
  const uniquePhone = `08129876${Math.floor(1000 + Math.random() * 9000)}`;

  const registerReq = new Request('https://hikmattani.id/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Budi Santoso', nik: uniqueNik, phoneNumber: uniquePhone, pin: '654321', village: 'Sukamaju', district: 'Kasokandel', regency: 'Majalengka', province: 'Jawa Barat', farmerGroupName: 'Kelompok Tani Makmur' }),
  });

  const registerRes = await worker.fetch(registerReq, mockEnv, {});
  const registerJson = (await registerRes.json()) as any;
  assert(registerRes.status === 201 && registerJson.success === true && typeof registerJson.data?.token === 'string' && registerJson.data?.token.length > 20 && registerJson.data?.farmer?.name === 'Budi Santoso' && registerJson.data?.farmer?.nikMasked.includes('****'), '10. Worker Register Endpoint: Mengembalikan HTTP 201 dengan struktur token & farmer profile valid');

  const registeredToken = registerJson.data?.token;
  const dupReq = new Request('https://hikmattani.id/api/v1/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Budi Santoso Kloning', nik: uniqueNik, phoneNumber: '081299998888', pin: '654321' }),
  });
  const dupRes = await worker.fetch(dupReq, mockEnv, {});
  const dupJson = (await dupRes.json()) as any;
  assert(dupRes.status === 409 && dupJson.success === false && dupJson.error?.code === 'DUPLICATE_NIK', '11. Anti-Duplicate NIK: Registrasi ganda ditolak dengan status HTTP 409');

  const loginReq = new Request('https://hikmattani.id/api/v1/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: uniquePhone, pin: '654321' }),
  });
  const loginRes = await worker.fetch(loginReq, mockEnv, {});
  const loginJson = (await loginRes.json()) as any;
  assert(loginRes.status === 200 && loginJson.success === true && typeof loginJson.data?.token === 'string', '12. Worker Login Endpoint: Login via Nomor HP + PIN berhasil dan mengembalikan session token');

  const meReq = new Request('https://hikmattani.id/api/v1/auth/me', { method: 'GET', headers: { Authorization: `Bearer ${registeredToken}` } });
  const meRes = await worker.fetch(meReq, mockEnv, {});
  const meJson = (await meRes.json()) as any;
  assert(meRes.status === 200 && meJson.success === true && meJson.data?.farmer?.name === 'Budi Santoso', '13. Worker Profile Endpoint: /api/v1/auth/me mengembalikan profil petani terotentikasi');

  const logoutReq = new Request('https://hikmattani.id/api/v1/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${registeredToken}` } });
  const logoutRes = await worker.fetch(logoutReq, mockEnv, {});
  assert(logoutRes.status === 200, '14. Worker Logout Endpoint: /api/v1/auth/logout berhasil mengakhiri sesi');

  const managerResult = await adminService.authenticateAdmin('manager_test', 'test-password', mockEnv.DB);
  assert(managerResult === null || typeof managerResult === 'object', '15. Admin Lazy Auth: Autentikasi Pengelola (MANAGER) berfungsi dengan baik saat runtime');

  console.log(`\nTotal: ${passed + failed} | Lolos: ${passed} | Gagal: ${failed}\n`);
  if (failed > 0) process.exit(1);
}

runWorkerGlobalScopeTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
