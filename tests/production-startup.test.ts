/**
 * HIKMAT TANI - PRODUCTION STARTUP & HEALTH CHECK TEST
 * Slogan Resmi: "Bijak Bertani, Cerdas Bertani"
 */

import { createApp } from '../server/server.ts';

export async function testProductionStartup(): Promise<boolean> {
  console.log('\n=== UJI STARTUP PRODUCTION & HEALTH CHECK ENDPOINT ===');
  
  // 1. Inisialisasi aplikasi Express
  const app = await createApp();
  if (!app) {
    throw new Error('Gagal menginisialisasi Express app instance');
  }
  console.log('✓ Express App berhasil diinisialisasi untuk production');

  // 2. Inisialisasi listener port sementara
  const testPort = 3099;
  const server = app.listen(testPort, '127.0.0.1');

  try {
    // 3. Test Endpoint GET /api/v1/health
    const res1 = await fetch(`http://127.0.0.1:${testPort}/api/v1/health`);
    if (!res1.ok) {
      throw new Error(`Endpoint /api/v1/health mengembalikan HTTP status ${res1.status}`);
    }
    const data1 = await res1.json();
    if (data1.app !== 'HIKMAT TANI' || data1.status !== 'ok' || !data1.database) {
      throw new Error(`Payload /api/v1/health tidak valid: ${JSON.stringify(data1)}`);
    }
    console.log('✓ Health check /api/v1/health merespons status OK dengan informasi database terisolasi');

    // 4. Test Endpoint GET /api/health
    const res2 = await fetch(`http://127.0.0.1:${testPort}/api/health`);
    if (!res2.ok) {
      throw new Error(`Endpoint /api/health mengembalikan HTTP status ${res2.status}`);
    }
    const data2 = await res2.json();
    if (data2.app !== 'HIKMAT TANI' || data2.status !== 'ok') {
      throw new Error(`Payload /api/health tidak valid: ${JSON.stringify(data2)}`);
    }
    console.log('✓ Backward-compatible health check /api/health merespons status OK');

    return true;
  } finally {
    server.close();
  }
}

if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('production-startup.test.ts')) {
  testProductionStartup().then(() => {
    console.log('✓ Seluruh pengujian startup production & health check LOLOS.\n');
    process.exit(0);
  }).catch((err) => {
    console.error('✗ Uji startup production gagal:', err);
    process.exit(1);
  });
}
