import assert from 'node:assert/strict';

import { officialAdministrativeBoundaryService } from '../src/services/officialAdministrativeBoundaryService.ts';

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
    const meta = officialAdministrativeBoundaryService.getOfficialMetadata();
    assert.match(meta.sourceName, /Badan Informasi Geospasial/);
    assert.match(meta.edition, /Juni 2026/);
    assert.match(meta.legalReference, /300\.2\.2-2430/);
    assert.equal(meta.coordinateSystem, 'WGS 84 (EPSG:4326)');
  });

  await test('Jawa Barat province 32 is available from BIG', async () => {
    const provinces = await officialAdministrativeBoundaryService.getJawaBaratProvinces();
    const jabar = provinces.find((p) => p.adminCode === '32');
    assert.ok(jabar, 'Provinsi Jawa Barat (32) harus tersedia');
  });

  await test('Jawa Barat regency/city hierarchy is complete', async () => {
    const regencies = await officialAdministrativeBoundaryService.getJawaBaratRegencies();
    assert.equal(regencies.length, 27, 'Jawa Barat harus memiliki 27 kabupaten/kota');
    assert.equal(new Set(regencies.map((r) => r.adminCode)).size, 27);
    assert.ok(regencies.every((r) => r.hierarchy.provinsiCode === '32'));
  });

  await test('Jawa Barat district hierarchy is complete', async () => {
    const districts = await officialAdministrativeBoundaryService.getJawaBaratDistricts();
    assert.equal(districts.length, 627, 'Jawa Barat harus memiliki 627 kecamatan');
    assert.equal(new Set(districts.map((d) => d.adminCode)).size, 627);
    assert.ok(districts.every((d) => d.adminCode.startsWith('32.')));
  });

  await test('sample village viewport returns valid official polygons', async () => {
    const villages = await officialAdministrativeBoundaryService.getJawaBaratVillages({
      minLat: -6.5,
      maxLat: -6.1,
      minLng: 107.0,
      maxLng: 107.7,
    });
    assert.ok(villages.length > 0, 'Viewport Jawa Barat harus mengembalikan desa/kelurahan');
    for (const feature of villages.slice(0, 50)) {
      assert.ok(feature.adminCode.startsWith('32.'));
      assert.ok(feature.coordinates.length >= 3);
      for (const point of feature.coordinates) {
        assert.ok(Number.isFinite(point.lat));
        assert.ok(Number.isFinite(point.lng));
        assert.ok(point.lat >= -90 && point.lat <= 90);
        assert.ok(point.lng >= -180 && point.lng <= 180);
      }
    }
  });

  await test('parcel spatial lookup returns a consistent four-level hierarchy', async () => {
    const result = await officialAdministrativeBoundaryService.lookupAdministrativeByPoint({ lat: -6.3039, lng: 107.3009 });
    if (result.matched) {
      assert.equal(result.hierarchy.provinsiCode, '32');
      assert.ok(result.hierarchy.kabupatenKotaCode);
      assert.ok(result.hierarchy.kecamatanCode);
      assert.ok(result.hierarchy.desaKelurahanCode);
    } else {
      assert.ok(result.status === 'NEEDS_VERIFICATION' || result.status === 'OUTSIDE_COVERAGE');
    }
  });

  console.log(`\nPASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  if (failed > 0) process.exit(1);
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
