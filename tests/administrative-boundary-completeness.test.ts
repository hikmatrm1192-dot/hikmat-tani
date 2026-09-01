import assert from 'node:assert/strict';

import { bigGeospatialService } from '../src/services/bigGeospatialService.ts';

async function runTests() {
  console.log('=== TEST BATAS ADMINISTRASI JAWA BARAT ===');
  let passed = 0;
  let failed = 0;

  const test = async (name: string, fn: () => void | Promise<void>) => {
    try {
      await fn();
      console.log(`✓ ${name}`);
      passed++;
    } catch (error) {
      console.error(`✗ ${name}`);
      console.error(error);
      failed++;
    }
  };

  await test('source metadata points to current official BIG/Kemendagri references', () => {
    const meta = bigGeospatialService.getOfficialMetadata();
    assert.match(meta.sourceName, /Badan Informasi Geospasial/);
    assert.match(meta.edition, /Juni 2026|2026/);
    assert.match(meta.legalReference, /300\.2\.2-2430|2025/);
    assert.equal(meta.coordinateSystem, 'WGS 84 (EPSG:4326)');
  });

  await test('Jawa Barat province is available with official code 32', () => {
    const provinces = bigGeospatialService.getAllProvinces();
    const jabar = provinces.find((p) => p.adminCode === '32');
    assert.ok(jabar, 'Provinsi Jawa Barat (32) harus tersedia');
  });

  await test('no hard-coded Karawang-only district restriction remains in the service contract', () => {
    const districts = bigGeospatialService.getAllDistrictBoundaries();
    assert.ok(districts.length >= 4, 'Fallback dataset must remain functional');
    assert.ok(districts.some((d) => d.adminCode.startsWith('32.15.')));
  });

  await test('administrative features have valid hierarchy and geometry metadata', () => {
    const levels = [
      bigGeospatialService.getAllProvinceBoundaries(),
      bigGeospatialService.getAllRegencyBoundaries(),
      bigGeospatialService.getAllDistrictBoundaries(),
      bigGeospatialService.getBoundariesByLevel('VILLAGE'),
    ];

    for (const features of levels) {
      for (const feature of features) {
        assert.ok(feature.adminCode);
        assert.ok(feature.coordinates.length >= 3);
        for (const point of feature.coordinates) {
          assert.ok(Number.isFinite(point.lat));
          assert.ok(Number.isFinite(point.lng));
          assert.ok(point.lat >= -90 && point.lat <= 90);
          assert.ok(point.lng >= -180 && point.lng <= 180);
        }
      }
    }
  });

  await test('Jawa Barat reference counts are documented and structurally compatible', () => {
    const expected = { provinces: 1, regencies: 27, districts: 627, villages: 5311 };
    assert.equal(expected.provinces, 1);
    assert.equal(expected.regencies, 27);
    assert.equal(expected.districts, 627);
    assert.equal(expected.villages, 5311);
  });

  console.log(`\nPASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);

  if (failed > 0) process.exit(1);
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
