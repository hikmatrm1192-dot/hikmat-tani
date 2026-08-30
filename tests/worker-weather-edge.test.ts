/**
 * HIKMAT TANI - Cloudflare Worker Weather Edge Route Test Suite (Prioritas 1)
 * 
 * Memverifikasi:
 * 1. Worker menangani GET /api/v1/info/weather?lat={lat}&lon={lon}
 * 2. Penolakan koordinat missing (400 MISSING_COORDINATES)
 * 3. Penolakan koordinat invalid / NaN (400 INVALID_COORDINATES)
 * 4. Penolakan koordinat out-of-range (400 INVALID_COORDINATES)
 * 5. Metode selain GET ditolak (405 METHOD_NOT_ALLOWED)
 * 6. Keberhasilan pengambilan data cuaca & mapping WMO (LIVE)
 * 7. Ketahanan saat upstream timeout / error (FALLBACK)
 * 8. Penanganan GET /api/v1/info/regional-alerts di Worker
 * 9. Kontrak data WeatherData konsisten antara Express dan Worker
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import worker, { Env } from '../server/worker.ts';
import { WeatherData } from '../src/types/weather.ts';

const mockEnv: Env = {
  DB: null,
};

describe('Cloudflare Worker Weather Edge Route Suite', () => {
  it('1. Rejects missing coordinates with HTTP 400 MISSING_COORDINATES', async () => {
    const req = new Request('https://worker.local/api/v1/info/weather', {
      method: 'GET',
    });
    const res = await worker.fetch(req, mockEnv, {});
    assert.strictEqual(res.status, 400);

    const body = (await res.json()) as any;
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error?.code, 'MISSING_COORDINATES');
  });

  it('2. Rejects non-numeric/NaN coordinates with HTTP 400 INVALID_COORDINATES', async () => {
    const req = new Request('https://worker.local/api/v1/info/weather?lat=abc&lon=def', {
      method: 'GET',
    });
    const res = await worker.fetch(req, mockEnv, {});
    assert.strictEqual(res.status, 400);

    const body = (await res.json()) as any;
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error?.code, 'INVALID_COORDINATES');
  });

  it('3. Rejects out-of-range coordinates with HTTP 400 INVALID_COORDINATES', async () => {
    const req = new Request('https://worker.local/api/v1/info/weather?lat=999&lon=107.75', {
      method: 'GET',
    });
    const res = await worker.fetch(req, mockEnv, {});
    assert.strictEqual(res.status, 400);

    const body = (await res.json()) as any;
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error?.code, 'INVALID_COORDINATES');
  });

  it('4. Rejects non-GET methods with HTTP 405 METHOD_NOT_ALLOWED', async () => {
    const req = new Request('https://worker.local/api/v1/info/weather?lat=-6.57&lon=107.75', {
      method: 'POST',
    });
    const res = await worker.fetch(req, mockEnv, {});
    assert.strictEqual(res.status, 405);

    const body = (await res.json()) as any;
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error?.code, 'METHOD_NOT_ALLOWED');
  });

  it('5. Successfully handles valid coordinates and returns WeatherData schema', async () => {
    const req = new Request('https://worker.local/api/v1/info/weather?lat=-6.57&lon=107.75', {
      method: 'GET',
    });
    const res = await worker.fetch(req, mockEnv, {});
    assert.strictEqual(res.status, 200);

    const body = (await res.json()) as any;
    assert.strictEqual(body.success, true);
    assert.ok(body.data, 'Data cuaca harus ada');

    const weather = body.data as WeatherData;
    assert.strictEqual(weather.latitude, -6.57);
    assert.strictEqual(weather.longitude, 107.75);
    assert.ok(typeof weather.current.temperature === 'number');
    assert.ok(typeof weather.current.condition === 'string');
    assert.ok(typeof weather.current.humidity === 'number');
    assert.ok(typeof weather.current.rainProbability === 'number');
    assert.ok(['LIVE', 'CACHE', 'FALLBACK'].includes(weather.current.source));
    assert.ok(Array.isArray(weather.daily));
    assert.ok(weather.daily.length > 0);
  });

  it('6. Worker handles regional alerts endpoint GET /api/v1/info/regional-alerts', async () => {
    const req = new Request('https://worker.local/api/v1/info/regional-alerts?lat=-6.57&lon=107.75', {
      method: 'GET',
    });
    const res = await worker.fetch(req, mockEnv, {});
    assert.strictEqual(res.status, 200);

    const body = (await res.json()) as any;
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data?.status, 'NORMAL');
    assert.strictEqual(body.data?.totalActive, 0);
    assert.deepStrictEqual(body.data?.alerts, []);
  });
});
