/**
 * HIKMAT TANI - Production Worker Live E2E Verification Suite
 * 
 * Target: https://hikmat-tani.curse-crowley.workers.dev
 * 
 * Verifikasi langsung ke endpoint Edge Production:
 * 1. Health check (/api/v1/health & /api/health)
 * 2. Auth Register (/api/v1/auth/register) -> Token, Farmer Profile, NIK Masked
 * 3. Auth Login Seeded Farmer via NIK (/api/v1/auth/login)
 * 4. Auth Login Seeded Farmer via Nomor HP (/api/v1/auth/login)
 * 5. Registrasi Petani B (Ibu Siti Majalengka)
 * 6. Auth Me Protected Profile Petani A (/api/v1/auth/me) -> Data Isolation
 * 7. Auth Me Protected Profile Petani B (/api/v1/auth/me) -> Data Isolation
 * 8. Anti-Duplicate NIK Prevention (HTTP 409 DUPLICATE_NIK)
 * 9. Token Security Protection (HTTP 401 on forged/invalid token)
 * 10. Auth Logout (/api/v1/auth/logout)
 * 11. Public Config & Frontend Asset Gateway (/)
 */

const PROD_URL = 'https://hikmat-tani.curse-crowley.workers.dev';

async function runLiveProductionVerification() {
  console.log(`\n=== UJI LIVE VERIFIKASI PRODUCTION WORKER HIKMAT TANI ===`);
  console.log(`Endpoint Target: ${PROD_URL}\n`);

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

  // 1. Health Check
  try {
    const res = await fetch(`${PROD_URL}/api/v1/health`);
    const data = await res.json() as any;
    assert(
      res.status === 200 && data.status === 'ok' && data.runtime.includes('Cloudflare Workers'),
      '1. Health Check: /api/v1/health merespons 200 OK dengan status runtime Cloudflare Workers (Edge)',
      data
    );
  } catch (err: any) {
    assert(false, `1. Health Check Failed: ${err.message}`);
  }

  // 2. Registrasi Petani A (Pak Wahyu dari Subang)
  const uniqueA = Date.now().toString().slice(-4);
  const nikA = `321301010180${uniqueA}`;
  const phoneA = `08121111${uniqueA}`;
  let tokenA = '';
  let farmerIdA = '';

  try {
    const res = await fetch(`${PROD_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Pak Wahyu Subang',
        nik: nikA,
        phoneNumber: phoneA,
        pin: '123456',
        village: 'Sukamulya',
        district: 'Pagaden',
        regency: 'Subang',
        province: 'Jawa Barat',
        farmerGroupName: 'Kelompok Tani Berkah Subang',
      }),
    });
    const data = await res.json() as any;
    tokenA = data.data?.token;
    farmerIdA = data.data?.farmer?.id;

    assert(
      res.status === 201 &&
        data.success === true &&
        typeof tokenA === 'string' &&
        tokenA.length > 20 &&
        data.data?.farmer?.name === 'Pak Wahyu Subang' &&
        data.data?.farmer?.nikMasked.includes('****') &&
        data.data?.user?.role === 'farmer',
      '2. Production Register (Petani A): Menerbitkan token & profil tersanitasi valid',
      data
    );
  } catch (err: any) {
    assert(false, `2. Production Register Failed: ${err.message}`);
  }

  // 3. Login Petani Terverifikasi via NIK (Akun Seed Pak Sutrisno)
  try {
    const res = await fetch(`${PROD_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: '3210010101750001',
        pin: '123456',
      }),
    });
    const data = await res.json() as any;
    assert(
      res.status === 200 &&
        data.success === true &&
        typeof data.data?.token === 'string' &&
        data.data?.farmer?.name === 'Pak Sutrisno',
      '3. Production Login via NIK: Autentikasi NIK + PIN berhasil mengembalikan token',
      data
    );
  } catch (err: any) {
    assert(false, `3. Login via NIK Failed: ${err.message}`);
  }

  // 4. Login Petani Terverifikasi via Nomor HP (Akun Seed Pak Sutrisno)
  try {
    const res = await fetch(`${PROD_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: '081234567890',
        pin: '123456',
      }),
    });
    const data = await res.json() as any;
    assert(
      res.status === 200 &&
        data.success === true &&
        typeof data.data?.token === 'string' &&
        data.data?.farmer?.name === 'Pak Sutrisno',
      '4. Production Login via Nomor HP: Autentikasi Nomor HP + PIN berhasil',
      data
    );
  } catch (err: any) {
    assert(false, `4. Login via Phone Failed: ${err.message}`);
  }

  // 5. Registrasi Petani B (Ibu Siti dari Majalengka)
  const uniqueB = (Date.now() + 5).toString().slice(-4);
  const nikB = `321001010185${uniqueB}`;
  const phoneB = `08132222${uniqueB}`;
  let tokenB = '';
  let farmerIdB = '';

  try {
    const res = await fetch(`${PROD_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ibu Siti Majalengka',
        nik: nikB,
        phoneNumber: phoneB,
        pin: '654321',
        village: 'Sukamaju',
        district: 'Kasokandel',
        regency: 'Majalengka',
        province: 'Jawa Barat',
        farmerGroupName: 'Kelompok Tani Sri Rejeki',
      }),
    });
    const data = await res.json() as any;
    tokenB = data.data?.token;
    farmerIdB = data.data?.farmer?.id;

    assert(
      res.status === 201 &&
        data.success === true &&
        typeof tokenB === 'string' &&
        data.data?.farmer?.name === 'Ibu Siti Majalengka' &&
        farmerIdA !== farmerIdB,
      '5. Production Register (Petani B): Menerbitkan token unik terpisah dari Petani A',
      data
    );
  } catch (err: any) {
    assert(false, `5. Production Register B Failed: ${err.message}`);
  }

  // 6. Data Isolation Check: Petani A mengakses /api/v1/auth/me
  try {
    const res = await fetch(`${PROD_URL}/api/v1/auth/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const data = await res.json() as any;
    assert(
      res.status === 200 &&
        data.success === true &&
        data.data?.farmer?.name === 'Pak Wahyu Subang' &&
        data.data?.farmer?.id === farmerIdA,
      '6. Data Isolation Petani A: Hanya melihat identitas & data milik Pak Wahyu',
      data
    );
  } catch (err: any) {
    assert(false, `6. Auth Me Petani A Failed: ${err.message}`);
  }

  // 7. Data Isolation Check: Petani B mengakses /api/v1/auth/me
  try {
    const res = await fetch(`${PROD_URL}/api/v1/auth/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const data = await res.json() as any;
    assert(
      res.status === 200 &&
        data.success === true &&
        data.data?.farmer?.name === 'Ibu Siti Majalengka' &&
        data.data?.farmer?.id === farmerIdB &&
        data.data?.farmer?.id !== farmerIdA,
      '7. Data Isolation Petani B: Hanya melihat identitas & data milik Ibu Siti (terisolasi penuh)',
      data
    );
  } catch (err: any) {
    assert(false, `7. Auth Me Petani B Failed: ${err.message}`);
  }

  // 8. Anti-Duplicate NIK Prevention (Mencoba mendaftar ulang NIK default Pak Sutrisno)
  try {
    const res = await fetch(`${PROD_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Pak Sutrisno Palsu',
        nik: '3210010101750001',
        phoneNumber: '081299991111',
        pin: '123456',
      }),
    });
    const data = await res.json() as any;
    assert(
      res.status === 409 && data.success === false && data.error?.code === 'DUPLICATE_NIK',
      '8. Production Anti-Duplicate NIK: Registrasi NIK yang sudah ada ditolak (HTTP 409 DUPLICATE_NIK)',
      data
    );
  } catch (err: any) {
    assert(false, `8. Anti-Duplicate NIK Failed: ${err.message}`);
  }

  // 9. Unauthorized / Fake Token Protection
  try {
    const res = await fetch(`${PROD_URL}/api/v1/auth/me`, {
      method: 'GET',
      headers: { Authorization: 'Bearer token_palsu_tidak_terdaftar_123' },
    });
    const data = await res.json() as any;
    assert(
      res.status === 401 && data.success === false,
      '9. Token Security Protection: Akses dengan token palsu ditolak (HTTP 401)',
      data
    );
  } catch (err: any) {
    assert(false, `9. Token Security Protection Failed: ${err.message}`);
  }

  // 10. Logout Endpoint
  try {
    const res = await fetch(`${PROD_URL}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const data = await res.json() as any;
    assert(
      res.status === 200 && data.success === true,
      '10. Production Logout: /api/v1/auth/logout berhasil mengakhiri sesi',
      data
    );
  } catch (err: any) {
    assert(false, `10. Logout Failed: ${err.message}`);
  }

  // 11. Static Frontend Asset Gateway Check
  try {
    const res = await fetch(PROD_URL);
    const htmlText = await res.text();
    assert(
      res.status === 200 && htmlText.includes('HIKMAT TANI'),
      '11. Frontend SPA Asset Gateway: Halaman utama Web PWA HIKMAT TANI disajikan langsung oleh Edge'
    );
  } catch (err: any) {
    assert(false, `11. Frontend Asset Gateway Failed: ${err.message}`);
  }

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
