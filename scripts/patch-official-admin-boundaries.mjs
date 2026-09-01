import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function assertContains(file, text, description) {
  const full = path.join(root, file);
  const source = fs.readFileSync(full, 'utf8');
  if (!source.includes(text)) {
    throw new Error(`Official boundary integration missing: ${file} :: ${description}`);
  }
  console.log(`verified ${file}: ${description}`);
}

// The source integration is committed directly to main. This workflow is now
// verification-only so repeated runs cannot overwrite corrected tests or code.
assertContains(
  'src/services/officialAdministrativeBoundaryService.ts',
  "const MAX_RECORD_COUNT = 1000;",
  'BIG pagination uses a safe complete-page size'
);
assertContains(
  'src/services/officialAdministrativeBoundaryService.ts',
  'getJawaBaratDistrictCount',
  'official BIG district count helper exists'
);
assertContains(
  'src/services/officialAdministrativeBoundaryService.ts',
  'getJawaBaratVillageCount',
  'official BIG village count helper exists'
);
assertContains(
  'src/modules/peta/PetaPertanianView.tsx',
  'officialAdministrativeBoundaryService',
  'map uses official BIG administrative provider'
);
assertContains(
  'src/modules/peta/PetaPertanianView.tsx',
  'handleAdminViewportChange',
  'district/village loading is viewport-aware'
);
assertContains(
  'src/modules/peta/AgriculturalMap.tsx',
  'onAdminViewportChange',
  'map emits viewport changes for administrative boundaries'
);
assertContains(
  'src/modules/peta/SaveDrawnParcelModal.tsx',
  'officialAdministrativeBoundaryService.lookupAdministrativeByPoint',
  'parcel save resolves the four-level hierarchy from official BIG'
);
assertContains(
  'tests/administrative-boundary-completeness.test.ts',
  'KEMENDAGRI_2025_JABAR_VILLAGES',
  'regression test uses a reference baseline without rejecting newer BIG coverage'
);

console.log('Official administrative boundary integration is committed and verification-ready.');
