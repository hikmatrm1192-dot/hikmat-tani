/**
 * HIKMAT TANI — Non-mutating Live Production Smoke Test
 *
 * Purpose: prove that the public Cloudflare deployment is reachable from CI.
 * This test intentionally performs GET-only requests and never creates or
 * modifies farmer/admin data.
 *
 * CI may provide PROD_IP when the runner's recursive DNS resolver cannot
 * resolve the custom domain. HTTPS still uses the production hostname for
 * SNI/Host/certificate validation while the socket is pinned to that IP.
 */

import https from 'node:https';

const PROD_URL = process.env.PROD_URL || 'https://app.hikmattani.id';
const PROD_IP = process.env.PROD_IP?.trim() || '';

function getUrl(path: string) {
  return new URL(path, PROD_URL);
}

async function get(path: string, accept: string): Promise<Response> {
  const url = getUrl(path);

  if (!PROD_IP) {
    return fetch(url, {
      method: 'GET',
      headers: { Accept: accept },
    });
  }

  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: 'GET',
      headers: { Accept: accept },
      servername: url.hostname,
      lookup: (_hostname, _options, callback) => callback(null, PROD_IP, 4),
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      response.on('end', () => {
        const responseHeaders = new Headers();
        for (const [name, value] of Object.entries(response.headers)) {
          if (value !== undefined) {
            responseHeaders.set(name, Array.isArray(value) ? value.join(', ') : value);
          }
        }
        resolve(new Response(Buffer.concat(chunks), {
          status: response.statusCode || 0,
          headers: responseHeaders,
        }));
      });
      response.on('error', reject);
    });

    request.on('error', reject);
    request.end();
  });
}

async function assertJsonHealth() {
  const response = await get('/api/v1/health', 'application/json');

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
  const response = await get('/', 'text/html');

  if (response.status !== 200) {
    throw new Error(`Live production SPA returned HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    throw new Error(`Live production SPA did not return HTML: ${contentType}`);
  }
}

async function run() {
  console.log(`\n=== LIVE PRODUCTION HEALTH SMOKE: ${PROD_URL}${PROD_IP ? ` (IP pin ${PROD_IP})` : ''} ===`);
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
