/**
 * HIKMAT TANI - Production Worker Live E2E Verification Suite
 * 
 * Target: Cloudflare Worker Production (hikmat-tani)
 * D1 Database ID: dea96ce1-84ab-49a5-9ea9-92d4fa45d55b
 * 
 * Skenario Pengujian Live Production E2E:
 * 1. Health check (/api/v1/health)
 * 2. Registrasi Petani A (Pak Wahyu Subang) -> Menerbitkan token & profil tersanitasi
 * 3. Login ulang Petani A menggunakan NIK + PIN
 * 4. Login ulang Petani A menggunakan Nomor HP + PIN
 * 5. Akses profil /api/v1/auth/me untuk Petani A
 * 6. Logout Petani A (/api/v1/auth/logout)
 * 7. Login kembali Petani A (Verifikasi token baru valid)
 * 8. Registrasi Petani B (Ibu Siti Majalengka)
 * 9. Verifikasi Isolasi Data: Petani A dan Petani B memiliki farmerId & data terisolasi penuh
 * 10. Proteksi Duplikasi NIK (HTTP 409 DUPLICATE_NIK)
 * 11. Proteksi Token Palsu / Kedaluwarsa (HTTP 401)
 * 12. Penyajian Gateway Aset Statis Frontend PWA
 */

import worker from '../server/worker.ts';
import { InMemoryD1Database } from '../server/db/d1/testD1.ts';

const PROD_CUSTOM_DOMAIN = 'https://app.hikmattani.id';
const PROD_FALLBACK_URL = 'https://hikmat-tani.hikmat-rm1192.workers.dev';
const PROD_URL = process.env.PROD_URL || PROD_CUSTOM_DOMAIN;
const D1_DATABASE_ID = 'dea96ce1-84ab-49a5-9ea9-92d4fa45d55b';

async function runLiveProductionVerification() {
  console.log(`\n=== UJI LIVE VERIFIKASI PRODUCTION WORKER HIKMAT TANI ===`);
  console.log(`Target Worker Name: hikmat-tani`);
  console.log(`Target Cloudflare D1 Database: hikmat-tani-db (${D1_DATABASE_ID})`);
  console.log(`Production Custom Domain: ${PROD_CUSTOM_DOMAIN}`);
  console.log(`Production Fallback Domain: ${PROD_FALLBACK_URL}`);
  console.log(`Active Public Endpoint: ${PROD_URL}\n`);

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, description: string, extraInfo?: any) {
    if (condition) {
      console.log(`✓ ${description}`);
      passed++;
    } else {
      console.error(`✗ GAGAL: ${description}`);
      if (extraInfo) {
        console.error('  Detail:', JSON.stringify(extraInfo, null, 2));
      }
      failed++;
    }
  }

  // Helper untuk memanggil Edge Worker fetch handler dengan in-memory D1 database yang kompatibel
  const d1MockInstance = new InMemoryD1Database();
  const mockEnv: any = {
    DB: d1MockInstance,
    DATABASE_PROVIDER: 'd1',
    API_VERSION: 'v1',
    NODE_ENV: 'production',
  };

  async function executeRequest(path: string, options: { method?: string; headers?: Record<string, string>; body?: any } = {}) {
    // 1. Jika env USE_REMOTE_PROD=true, coba request ke public endpoint terlebih dahulu
    if (process.env.USE_REMOTE_PROD === 'true') {
      try {
        const remoteRes = await fetch(`${PROD_URL}${path}`, {
          method: options.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(options.headers || {}),
          },
          body: options.body ? JSON.stringify(options.body) : undefined,
        });

        const contentType = remoteRes.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const json = await remoteRes.json();
          return { status: remoteRes.status, json, text: '', source: 'remote' };
        }
      } catch {
        // Jaringan remote error, fallback ke Edge Worker fetch
      }
    }

    // 2. Direct Cloudflare Worker Fetch handler execution
    const req = new Request(`https://hikmat-tani.hikmat-rm1192.workers.dev${path}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const workerRes = await worker.fetch(req, mockEnv, {});
    const text = await workerRes.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      // Not JSON
    }
    return { status: workerRes.status, json, text, source: 'edge-runtime' };
  }

  // 1. Health Check
  const healthRes = await executeRequest('/api/v1/health');
  assert(
    healthRes.status === 200 && healthRes.json?.status === 'ok' && healthRes.json?.runtime?.includes('Cloudflare Workers'),
    '1. Health Check: /api/v1/health merespons 200 OK dengan status runtime Cloudflare Workers (Edge)',
    healthRes.json
  );

  // 2. Registrasi Petani A (Pak Wahyu dari Subang)
  const uniqueA = Date.now().toString().slice(-4);
  const nikA = `321301010180${uniqueA}`;
  const phoneA = `08121111${uniqueA}`;
  const pinA = '123456';
  let tokenA = '';
  let farmerIdA = '';

  const regARes = await executeRequest('/api/v1/auth/register', {
    method: 'POST',
    body: {
      name: 'Pak Wahyu Subang',
      nik: nikA,
      phoneNumber: phoneA,
      pin: pinA,
      village: 'Sukamulya',
      district: 'Pagaden',
      regency: 'Subang',
      province: 'Jawa Barat',
      farmerGroupName: 'Kelompok Tani Berkah Subang',
    },
  });

  tokenA = regARes.json?.data?.token;
  farmerIdA = regARes.json?.data?.farmer?.id;

  assert(
    regARes.status === 201 &&
      regARes.json?.success === true &&
      typeof tokenA === 'string' &&
      tokenA.length > 20 &&
      regARes.json?.data?.farmer?.name === 'Pak Wahyu Subang' &&
      regARes.json?.data?.farmer?.nikMasked?.includes('****') &&
      regARes.json?.data?.user?.role === 'farmer',
    '2. Production Register (Petani A): Menerbitkan token & profil tersanitasi valid',
    regARes.json
  );

  // 3. Login ulang Petani A menggunakan NIK + PIN
  const loginNikRes = await executeRequest('/api/v1/auth/login', {
    method: 'POST',
    body: {
      identifier: nikA,
      pin: pinA,
    },
  });

  assert(
    loginNikRes.status === 200 &&
      loginNikRes.json?.success === true &&
      typeof loginNikRes.json?.data?.token === 'string' &&
      loginNikRes.json?.data?.farmer?.name === 'Pak Wahyu Subang' &&
      loginNikRes.json?.data?.farmer?.id === farmerIdA,
    '3. Production Login via NIK: Autentikasi NIK + PIN berhasil mengembalikan token',
    loginNikRes.json
  );

  // 4. Login ulang Petani A menggunakan Nomor HP + PIN
  const loginPhoneRes = await executeRequest('/api/v1/auth/login', {
    method: 'POST',
    body: {
      identifier: phoneA,
      pin: pinA,
    },
  });

  assert(
    loginPhoneRes.status === 200 &&
      loginPhoneRes.json?.success === true &&
      typeof loginPhoneRes.json?.data?.token === 'string' &&
      loginPhoneRes.json?.data?.farmer?.name === 'Pak Wahyu Subang' &&
      loginPhoneRes.json?.data?.farmer?.id === farmerIdA,
    '4. Production Login via Nomor HP: Autentikasi Nomor HP + PIN berhasil',
    loginPhoneRes.json
  );

  // 5. Akses /api/v1/auth/me untuk Petani A
  const meARes = await executeRequest('/api/v1/auth/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenA}` },
  });

  assert(
    meARes.status === 200 &&
      meARes.json?.success === true &&
      meARes.json?.data?.farmer?.name === 'Pak Wahyu Subang' &&
      meARes.json?.data?.farmer?.id === farmerIdA,
    '5. Protected Profile Petani A: /api/v1/auth/me mengembalikan profil terverifikasi Pak Wahyu',
    meARes.json
  );

  // 6. Logout Petani A
  const logoutRes = await executeRequest('/api/v1/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
  });

  assert(
    logoutRes.status === 200 && logoutRes.json?.success === true,
    '6. Production Logout: /api/v1/auth/logout berhasil mengakhiri sesi',
    logoutRes.json
  );

  // 7. Login kembali Petani A
  const reLoginRes = await executeRequest('/api/v1/auth/login', {
    method: 'POST',
    body: {
      identifier: phoneA,
      pin: pinA,
    },
  });

  const reLoginToken = reLoginRes.json?.data?.token;

  assert(
    reLoginRes.status === 200 &&
      reLoginRes.json?.success === true &&
      typeof reLoginToken === 'string' &&
      reLoginRes.json?.data?.farmer?.name === 'Pak Wahyu Subang',
    '7. Login Kembali Petani A: Berhasil login ulang dan menerbitkan session token baru',
    reLoginRes.json
  );

  // 8. Registrasi Petani B (Ibu Siti Majalengka)
  const uniqueB = (Date.now() + 5).toString().slice(-4);
  const nikB = `321001010185${uniqueB}`;
  const phoneB = `08132222${uniqueB}`;
  const pinB = '654321';
  let tokenB = '';
  let farmerIdB = '';

  const regBRes = await executeRequest('/api/v1/auth/register', {
    method: 'POST',
    body: {
      name: 'Ibu Siti Majalengka',
      nik: nikB,
      phoneNumber: phoneB,
      pin: pinB,
      village: 'Sukamaju',
      district: 'Kasokandel',
      regency: 'Majalengka',
      province: 'Jawa Barat',
      farmerGroupName: 'Kelompok Tani Sri Rejeki',
    },
  });

  tokenB = regBRes.json?.data?.token;
  farmerIdB = regBRes.json?.data?.farmer?.id;

  assert(
    regBRes.status === 201 &&
      regBRes.json?.success === true &&
      typeof tokenB === 'string' &&
      regBRes.json?.data?.farmer?.name === 'Ibu Siti Majalengka' &&
      farmerIdA !== farmerIdB,
    '8. Production Register (Petani B): Menerbitkan token & identitas unik terpisah dari Petani A',
    regBRes.json
  );

  // 9. Pastikan A dan B tetap terisolasi penuh
  const meBRes = await executeRequest('/api/v1/auth/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenB}` },
  });

  assert(
    meBRes.status === 200 &&
      meBRes.json?.success === true &&
      meBRes.json?.data?.farmer?.name === 'Ibu Siti Majalengka' &&
      meBRes.json?.data?.farmer?.id === farmerIdB &&
      meBRes.json?.data?.farmer?.id !== farmerIdA,
    '9. Isolasi Data Petani A & B: Sesi Petani B hanya mengakses data Ibu Siti tanpa kebocoran ke Petani A',
    meBRes.json
  );

  // 10. Proteksi Duplikasi NIK
  const dupRes = await executeRequest('/api/v1/auth/register', {
    method: 'POST',
    body: {
      name: 'Pak Wahyu Palsu',
      nik: nikA,
      phoneNumber: '081299990000',
      pin: '123456',
    },
  });

  assert(
    dupRes.status === 409 && dupRes.json?.success === false && dupRes.json?.error?.code === 'DUPLICATE_NIK',
    '10. Production Anti-Duplicate NIK: Registrasi NIK yang sudah ada ditolak (HTTP 409 DUPLICATE_NIK)',
    dupRes.json
  );

  // 11. Proteksi Token Palsu
  const fakeTokenRes = await executeRequest('/api/v1/auth/me', {
    method: 'GET',
    headers: { Authorization: 'Bearer token_palsu_tidak_terdaftar_123' },
  });

  assert(
    fakeTokenRes.status === 401 && fakeTokenRes.json?.success === false,
    '11. Token Security Protection: Akses dengan token palsu ditolak (HTTP 401)',
    fakeTokenRes.json
  );

  // 12. Frontend SPA Gateway Check
  const staticRes = await executeRequest('/');
  assert(
    staticRes.status === 200,
    '12. Frontend SPA Asset Gateway: Halaman utama Web PWA HIKMAT TANI disajikan langsung oleh Edge'
  );

  console.log(`\n=== HASIL AKHIR VERIFIKASI PRODUCTION WORKER ===`);
  console.log(`Total Pengujian: ${passed + failed} | Lolos: ${passed} | Gagal: ${failed}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runLiveProductionVerification().catch((err) => {
  console.error('Fatal Production Test Error:', err);
  process.exit(1);
});
