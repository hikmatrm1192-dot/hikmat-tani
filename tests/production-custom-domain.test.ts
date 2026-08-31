/**
 * HIKMAT TANI - Production Custom Domain Migration Test Suite
 *
 * Target Domain: https://app.hikmattani.id
 * Fallback Domain: https://hikmat-tani.hikmat-rm1192.workers.dev
 * Target Worker: hikmat-tani (Cloudflare Worker Edge Runtime)
 * Database: hikmat-tani-db (Cloudflare D1 SQLite: dea96ce1-84ab-49a5-9ea9-92d4fa45d55b)
 */

import fs from 'fs';
import path from 'path';
import worker from '../server/worker.ts';
import { InMemoryD1Database } from '../server/db/d1/testD1.ts';
import { authService } from '../server/services/authService.ts';

const CUSTOM_DOMAIN_URL = 'https://app.hikmattani.id';
const FALLBACK_DOMAIN_URL = 'https://hikmat-tani.hikmat-rm1192.workers.dev';
const D1_DATABASE_ID = 'dea96ce1-84ab-49a5-9ea9-92d4fa45d55b';

async function runCustomDomainMigrationTests() {
  console.log('\n=============================================================');
  console.log('=== UJI MIGRASI DOMAIN PRODUKSI: https://app.hikmattani.id ===');
  console.log('=============================================================');
  console.log(`Domain Utama: ${CUSTOM_DOMAIN_URL}`);
  console.log(`Fallback Domain: ${FALLBACK_DOMAIN_URL}`);
  console.log(`Cloudflare Worker: hikmat-tani`);
  console.log(`Cloudflare D1: hikmat-tani-db (${D1_DATABASE_ID})\n`);

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

  const d1MockInstance = new InMemoryD1Database();
  const mockEnv: any = {
    DB: d1MockInstance,
    DATABASE_PROVIDER: 'd1',
    API_VERSION: 'v1',
    NODE_ENV: 'production',
    JWT_SECRET: 'hikmat-tani-prod-custom-domain-secret-2026',
    SUPER_ADMIN_PASSWORD: 'SuperAdminSecretPassword123!',
    ASSETS: {
      fetch: async (request: Request) => {
        const url = new URL(request.url);
        if (url.pathname === '/' || url.pathname === '/index.html') {
          return new Response('<!doctype html><html><head><title>HIKMAT TANI</title></head><body><div id="root"></div></body></html>', {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
          });
        }
        if (url.pathname === '/manifest.json') {
          return new Response(fs.readFileSync(path.join(process.cwd(), 'public/manifest.json'), 'utf-8'), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.pathname === '/sw.js') {
          return new Response(fs.readFileSync(path.join(process.cwd(), 'public/sw.js'), 'utf-8'), {
            status: 200,
            headers: { 'Content-Type': 'application/javascript' },
          });
        }
        return new Response('Not Found', { status: 404 });
      },
    },
  };

  async function executeRequest(urlStr: string, options: { method?: string; headers?: Record<string, string>; body?: any } = {}) {
    const req = new Request(urlStr, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const res = await worker.fetch(req, mockEnv, {});
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      // Non-JSON response
    }
    return { status: res.status, headers: res.headers, json, text };
  }

  // 1. Validasi Konfigurasi wrangler.toml untuk Custom Domain & Fallback workers.dev
  const wranglerContent = fs.readFileSync(path.join(process.cwd(), 'wrangler.toml'), 'utf-8');
  assert(
    wranglerContent.includes('name = "hikmat-tani"') &&
    wranglerContent.includes('database_name = "hikmat-tani-db"') &&
    wranglerContent.includes('database_id = "dea96ce1-84ab-49a5-9ea9-92d4fa45d55b"') &&
    wranglerContent.includes('app.hikmattani.id') &&
    wranglerContent.includes('workers_dev = true'),
    '1. Validasi wrangler.toml: Custom domain app.hikmattani.id terpasang dan workers.dev dipertahankan sebagai fallback'
  );

  // 2. Health check via https://app.hikmattani.id
  const healthCustomRes = await executeRequest(`${CUSTOM_DOMAIN_URL}/api/v1/health`);
  assert(
    healthCustomRes.status === 200 &&
    healthCustomRes.json?.status === 'ok' &&
    healthCustomRes.json?.runtime?.includes('Cloudflare Workers'),
    '2. Health Check Domain Utama: https://app.hikmattani.id/api/v1/health merespons 200 OK'
  );

  // 3. Health check via Fallback https://hikmat-tani.hikmat-rm1192.workers.dev
  const healthFallbackRes = await executeRequest(`${FALLBACK_DOMAIN_URL}/api/v1/health`);
  assert(
    healthFallbackRes.status === 200 &&
    healthFallbackRes.json?.status === 'ok' &&
    healthFallbackRes.json?.runtime?.includes('Cloudflare Workers'),
    '3. Health Check Fallback Domain: https://hikmat-tani.hikmat-rm1192.workers.dev/api/v1/health tetap aktif 200 OK'
  );

  // 4. CORS verification for https://app.hikmattani.id
  const corsCustomRes = await executeRequest(`${CUSTOM_DOMAIN_URL}/api/v1/health`, {
    headers: { Origin: 'https://app.hikmattani.id' },
  });
  const allowOriginCustom = corsCustomRes.headers.get('access-control-allow-origin');
  assert(
    allowOriginCustom === 'https://app.hikmattani.id' || allowOriginCustom === '*',
    `4. CORS Domain Utama: Origin https://app.hikmattani.id diizinkan (Allow-Origin: ${allowOriginCustom})`
  );

  // 5. CORS verification for Fallback workers.dev
  const corsFallbackRes = await executeRequest(`${CUSTOM_DOMAIN_URL}/api/v1/health`, {
    headers: { Origin: 'https://hikmat-tani.hikmat-rm1192.workers.dev' },
  });
  const allowOriginFallback = corsFallbackRes.headers.get('access-control-allow-origin');
  assert(
    allowOriginFallback === 'https://hikmat-tani.hikmat-rm1192.workers.dev' || allowOriginFallback === '*',
    `5. CORS Fallback Domain: Origin workers.dev diizinkan (Allow-Origin: ${allowOriginFallback})`
  );

  // 6. Registrasi Petani Baru pada https://app.hikmattani.id
  const uniqueId = Date.now().toString().slice(-4);
  const testNik = `321301010190${uniqueId}`;
  const testPhone = `08123499${uniqueId}`;
  const testPin = '123456';
  let token = '';
  let farmerId = '';

  const regRes = await executeRequest(`${CUSTOM_DOMAIN_URL}/api/v1/auth/register`, {
    method: 'POST',
    body: {
      name: 'Pak Ahmad Subang',
      nik: testNik,
      phoneNumber: testPhone,
      pin: testPin,
      village: 'Cisaga',
      district: 'Pagaden Barat',
      regency: 'Subang',
      province: 'Jawa Barat',
      farmerGroupName: 'Tani Makmur',
    },
  });

  token = regRes.json?.data?.token;
  farmerId = regRes.json?.data?.farmer?.id;

  assert(
    regRes.status === 201 &&
    regRes.json?.success === true &&
    typeof token === 'string' &&
    token.length > 20 &&
    regRes.json?.data?.farmer?.name === 'Pak Ahmad Subang' &&
    regRes.json?.data?.farmer?.nikMasked?.includes('****'),
    '6. Registrasi Petani pada app.hikmattani.id: Berhasil menerbitkan JWT & profil tersanitasi'
  );

  // 7. Login Petani via NIK pada https://app.hikmattani.id
  const loginNikRes = await executeRequest(`${CUSTOM_DOMAIN_URL}/api/v1/auth/login`, {
    method: 'POST',
    body: {
      identifier: testNik,
      pin: testPin,
    },
  });

  assert(
    loginNikRes.status === 200 &&
    loginNikRes.json?.success === true &&
    loginNikRes.json?.data?.farmer?.id === farmerId &&
    loginNikRes.json?.data?.farmer?.name === 'Pak Ahmad Subang',
    '7. Login via NIK pada app.hikmattani.id: Autentikasi NIK + PIN berhasil'
  );

  // 8. Login Petani via Nomor HP pada https://app.hikmattani.id
  const loginPhoneRes = await executeRequest(`${CUSTOM_DOMAIN_URL}/api/v1/auth/login`, {
    method: 'POST',
    body: {
      identifier: testPhone,
      pin: testPin,
    },
  });

  assert(
    loginPhoneRes.status === 200 &&
    loginPhoneRes.json?.success === true &&
    loginPhoneRes.json?.data?.farmer?.id === farmerId,
    '8. Login via Nomor HP pada app.hikmattani.id: Autentikasi Nomor HP + PIN berhasil'
  );

  // 9. Akses Protected Route (/api/v1/auth/me) menggunakan Token
  const meRes = await executeRequest(`${CUSTOM_DOMAIN_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert(
    meRes.status === 200 &&
    meRes.json?.success === true &&
    meRes.json?.data?.farmer?.name === 'Pak Ahmad Subang' &&
    meRes.json?.data?.farmer?.id === farmerId,
    '9. Sesi Petani (/api/v1/auth/me): Terverifikasi dengan isolasi identitas yang tepat'
  );

  // 10. Logout & Login Ulang
  const logoutRes = await executeRequest(`${CUSTOM_DOMAIN_URL}/api/v1/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  const reloginRes = await executeRequest(`${CUSTOM_DOMAIN_URL}/api/v1/auth/login`, {
    method: 'POST',
    body: {
      identifier: testPhone,
      pin: testPin,
    },
  });

  assert(
    logoutRes.status === 200 &&
    reloginRes.status === 200 &&
    reloginRes.json?.success === true &&
    typeof reloginRes.json?.data?.token === 'string',
    '10. Logout & Login Ulang: Berhasil tanpa redirect loop atau auth failure'
  );

  // 11. SPA Route Resolution (Mencegah 404 saat refresh langsung di browser)
  const spaRoutes = ['/', '/login', '/register', '/beranda', '/lahan', '/saya'];
  let allSpaOk = true;
  for (const route of spaRoutes) {
    const spaRes = await executeRequest(`${CUSTOM_DOMAIN_URL}${route}`);
    if (spaRes.status !== 200 || !spaRes.text.includes('HIKMAT TANI')) {
      allSpaOk = false;
    }
  }
  assert(
    allSpaOk,
    '11. SPA Deep Link Navigation: Direct access ke /, /login, /register, /beranda, /lahan, /saya disajikan mulus tanpa 404'
  );

  // 12. PWA Manifest & Service Worker Verification
  const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/manifest.json'), 'utf-8'));
  const swContent = fs.readFileSync(path.join(process.cwd(), 'public/sw.js'), 'utf-8');
  assert(
    manifest.start_url === '/' &&
    manifest.scope === '/' &&
    manifest.display === 'standalone' &&
    swContent.includes('CACHE_NAME') &&
    swContent.includes('caches.match'),
    '12. PWA Integrity: Manifest & Service Worker siap untuk standalone PWA pada app.hikmattani.id'
  );

  console.log('\n=============================================================');
  console.log(`=== HASIL AKHIR: ${passed} Lolos | ${failed} Gagal ===`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCustomDomainMigrationTests().catch((err) => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
