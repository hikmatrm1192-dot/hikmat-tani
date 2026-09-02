import assert from 'node:assert/strict';

import { officialAdministrativeBoundaryService } from '../src/services/officialAdministrativeBoundaryService.ts';

const KEMENDAGRI_2025_JABAR_DISTRICTS = 627;
const KEMENDAGRI_2025_JABAR_VILLAGES = 5311;
const REPRESENTATIVE_VIEWPORT = {
  minLat: -6.35,
  maxLat: -6.25,
  minLng: 107.20,
  maxLng: 107.40,
};

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

  await test('Jawa Barat district and village coverage meets official reference baseline', async () => {
    const districtCount = await officialAdministrativeBoundaryService.getJawaBaratDistrictCount();
    const villageCount = await officialAdministrativeBoundaryService.getJawaBaratVillageCount();

    assert.ok(districtCount >= KEMENDAGRI_2025_JABAR_DISTRICTS, `BIG harus menyediakan minimal ${KEMENDAGRI_2025_JABAR_DISTRICTS} kecamatan; diterima ${districtCount}`);
    assert.ok(villageCount >= KEMENDAGRI_2025_JABAR_VILLAGES, `BIG harus menyediakan minimal ${KEMENDAGRI_2025_JABAR_VILLAGES} desa/kelurahan; diterima ${villageCount}`);

    if (districtCount !== KEMENDAGRI_2025_JABAR_DISTRICTS) {
      console.warn(`DISCREPANCY: BIG kecamatan=${districtCount}, Kemendagri 2025=${KEMENDAGRI_2025_JABAR_DISTRICTS}. Data BIG tidak dipotong.`);
    }
    if (villageCount !== KEMENDAGRI_2025_JABAR_VILLAGES) {
      console.warn(`DISCREPANCY: BIG desa/kelurahan=${villageCount}, Kemendagri 2025=${KEMENDAGRI_2025_JABAR_VILLAGES}. Data BIG tidak dipotong.`);
    }
  });

  await test('district viewport loading returns unique official hierarchy codes', async () => {
    const districts = await officialAdministrativeBoundaryService.getJawaBaratDistrictsInBbox(REPRESENTATIVE_VIEWPORT);
    assert.ok(districts.length > 0, 'Viewport representatif harus mengembalikan kecamatan');
    assert.equal(new Set(districts.map((d) => d.adminCode)).size, districts.length);
    assert.ok(districts.every((d) => d.adminCode.startsWith('32.')));
    assert.ok(districts.every((d) => d.hierarchy.provinsiCode === '32'));
    assert.ok(districts.every((d) => d.coordinates.length >= 3));
  });

  await test('sample village viewport returns valid official polygons', async () => {
    const villages = await officialAdministrativeBoundaryService.getJawaBaratVillages(REPRESENTATIVE_VIEWPORT);
    assert.ok(villages.length > 0, 'Viewport representatif harus mengembalikan desa/kelurahan');
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
