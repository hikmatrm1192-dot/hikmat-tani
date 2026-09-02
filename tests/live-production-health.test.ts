/**
 * HIKMAT TANI — Non-mutating Live Production Smoke Test
 *
 * Purpose: prove that the public Cloudflare deployment is reachable from CI.
 * This test intentionally performs GET-only requests and never creates or
 * modifies farmer/admin data.
 */

const PROD_URL = process.env.PROD_URL || 'https://app.hikmattani.id';

async function assertJsonHealth() {
  const response = await fetch(`${PROD_URL}/api/v1/health`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (response.status !== 200) {
    throw new Error(`Live production health returned HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Live production health did not return JSON: ${contentType}`);
  }

  const body = await response.json() as any;
  if (body?.status !== 'ok' || body?.app !== 'HIKMAT TANI') {
    throw new Error(`Unexpected live health payload: ${JSON.stringify(body)}`);
  }

  if (body?.runtime !== 'Cloudflare Workers (Edge)') {
    throw new Error(`Unexpected live runtime: ${body?.runtime}`);
  }

  if (body?.database?.configured !== true) {
    throw new Error('Live production health reports the D1 database as unconfigured');
  }
}

async function assertSpaGateway() {
  const response = await fetch(`${PROD_URL}/`, {
    method: 'GET',
    headers: { Accept: 'text/html' },
  });

  if (response.status !== 200) {
    throw new Error(`Live production SPA returned HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    throw new Error(`Live production SPA did not return HTML: ${contentType}`);
  }
}

async function run() {
  console.log(`\n=== LIVE PRODUCTION HEALTH SMOKE: ${PROD_URL} ===`);
  await assertJsonHealth();
  console.log('✓ GET /api/v1/health reachable and identifies the expected Worker runtime');
  await assertSpaGateway();
  console.log('✓ GET / serves the production SPA gateway');
  console.log('✓ Non-mutating live production smoke test passed.');
}

run().catch((error) => {
  console.error('✗ Live production smoke test failed:', error);
  process.exit(1);
});
