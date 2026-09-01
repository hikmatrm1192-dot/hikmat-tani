# Complete Jawa Barat Administrative Boundaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current partial/static administrative boundary seed with a complete, official-source-backed administrative hierarchy for Jawa Barat: Province → 18 Kabupaten/Kota → 627 Kecamatan → 5,311 Desa/Kelurahan, while preserving the tap-to-draw field polygon mode.

**Architecture:** Use BIG's current June 2026 administrative polygon services as the authoritative geometry source and Kemendagri's 2025 administrative code/nomenclature decision as the authority for hierarchy/code validation. The browser loads only the currently needed administrative features, caches successful responses in memory/IndexedDB where practical, and retains the existing small seed only as an explicit offline fallback; the map must never require all 5,311 village polygons to be rendered simultaneously.

**Tech Stack:** React 19, TypeScript, Leaflet 1.9, Vite, IndexedDB/Dexie, Cloudflare Worker/Express backend, BIG ArcGIS REST GeoJSON services.

**Spec:** Existing approved requirement in conversation: complete BIG/Kemendagri hierarchy, minimum Jawa Barat, and preserve tap/click polygon drawing.

## Global Constraints

- Minimum supported complete region: Jawa Barat (`32`).
- Target hierarchy: Province → Kabupaten/Kota → Kecamatan → Desa/Kelurahan.
- BIG geometry dataset: June 2026 edition where available.
- Kemendagri current code/nomenclature reference: Kepmendagri 300.2.2-2430 Tahun 2025.
- Map polygon drawing has absolute tap priority and must not be intercepted by administrative layers.
- Do not hard-code fabricated polygons as if they were official geometry.
- Do not render thousands of village polygons at once on mobile; use viewport/zoom-aware loading.
- Every successful implementation must pass TypeScript/build and focused geospatial regression tests before being called complete.

---

### Task 1: Replace partial administrative source metadata and define official BIG endpoints

**Files:**
- Modify: `src/services/bigGeospatialService.ts`
- Modify: `src/types/administrativeBoundary.ts` if endpoint/source metadata types require extension
- Test: `tests/administrative-boundary-completeness.test.ts`

**Interfaces:**
- Produces a single source-of-truth endpoint configuration for province, regency, district, and village polygon layers.
- Produces normalized conversion from BIG ArcGIS Feature/GeoJSON attributes to `AdministrativeFeature`.

- [ ] Step 1: Add failing tests asserting Jawa Barat source metadata uses BIG June 2026 geometry and Kemendagri 2025 code reference.
- [ ] Step 2: Add endpoint constants for BIG current polygon layers: province, `BATAS_KABKOTA_AR`, `BATAS_KECAMATAN_AR`, and `BATAS_DESAKEL_AR`.
- [ ] Step 3: Add a normalized attribute mapper using BIG fields such as `KDPPUM`, `KDPKAB`, `KDCPUM`, `KDEPUM`, `WADMPR`, `WADMKK`, `WADMKC`, and `WADMKD`.
- [ ] Step 4: Run the focused test and confirm the new metadata/mapping tests pass.
- [ ] Step 5: Commit the source/metadata change.

### Task 2: Implement paginated BIG feature loading for Jawa Barat

**Files:**
- Modify: `src/services/bigGeospatialService.ts`
- Test: `tests/administrative-boundary-completeness.test.ts`

**Interfaces:**
- `loadAdministrativeLevel(level, options)` returns normalized `AdministrativeFeature[]`.
- `loadJawaBaratAdministrativeData()` can load complete hierarchy metadata without requiring all village geometries to be rendered simultaneously.

- [ ] Step 1: Write failing tests for paginated loading, province-code filtering (`KDPPUM='32'`), and deduplication.
- [ ] Step 2: Implement ArcGIS REST query construction with `f=geojson`, `outSR=4326`, `returnGeometry=true`, and pagination using `resultOffset`/`resultRecordCount`.
- [ ] Step 3: Add request timeout/error handling and source metadata on each normalized feature.
- [ ] Step 4: Add memory caching keyed by level, province code, parent code, and viewport/zoom where applicable.
- [ ] Step 5: Run focused tests with mocked `fetch` responses and confirm pagination stops correctly.
- [ ] Step 6: Commit the loader implementation.

### Task 3: Make PetaPertanianView load all Jawa Barat hierarchy instead of only Karawang districts

**Files:**
- Modify: `src/modules/peta/PetaPertanianView.tsx`
- Test: `tests/administrative-boundary-completeness.test.ts`

**Interfaces:**
- UI state receives complete province/regency/district/village data for Jawa Barat through the geospatial service.
- Loading is asynchronous and exposes a safe loading/error state without breaking the map.

- [ ] Step 1: Write failing tests/assertions for the current hard-coded `32.15` district limitation and the required `32` province scope.
- [ ] Step 2: Replace the initialization effect so it requests the complete Jawa Barat hierarchy from the service instead of `getDistrictsByRegencyCode('32.15')` and instead of treating the partial village seed as complete.
- [ ] Step 3: Keep map startup responsive by loading province/regency/district first and loading village geometry according to current viewport/zoom.
- [ ] Step 4: Preserve existing layer toggles and selection callbacks.
- [ ] Step 5: Run focused tests and verify the map receives all four levels.
- [ ] Step 6: Commit the view integration.

### Task 4: Make administrative layer rendering viewport/zoom aware and preserve tap priority

**Files:**
- Modify: `src/modules/peta/AgriculturalMap.tsx`
- Modify: `src/modules/peta/drawingMapInteraction.ts` only if regression testing exposes an event-order issue
- Test: `tests/administrative-boundary-completeness.test.ts`

**Interfaces:**
- Administrative layers render only the currently loaded/visible features.
- Drawing mode remains capture-first regardless of administrative polygons, markers, or drought layers.

- [ ] Step 1: Add regression tests asserting administrative layer handlers cannot call selection callbacks while drawing mode is active.
- [ ] Step 2: Verify/adjust layer event propagation and map capture ordering only where needed.
- [ ] Step 3: Add zoom-aware village rendering threshold so thousands of polygons are not painted at low zoom.
- [ ] Step 4: Confirm province/regency/district boundaries remain visible at useful zoom levels.
- [ ] Step 5: Run focused drawing and boundary tests.
- [ ] Step 6: Commit rendering/event changes.

### Task 5: Make point-to-administration lookup complete and hierarchy-consistent

**Files:**
- Modify: `src/services/bigGeospatialService.ts`
- Modify: `src/modules/peta/SaveDrawnParcelModal.tsx` only if lookup display requires it
- Test: `tests/administrative-boundary-completeness.test.ts`

**Interfaces:**
- `lookupAdministrativeByPoint()` returns village, district, regency, and province from the same normalized hierarchy.

- [ ] Step 1: Add failing tests for representative Jawa Barat coordinates covering different Kabupaten/Kota and for missing village geometry.
- [ ] Step 2: Replace hard-coded fallback values such as Kabupaten Karawang / code `32.15` with hierarchy-derived values only.
- [ ] Step 3: Use the most specific loaded polygon first, then parent hierarchy, and mark unresolved levels as `NEEDS_VERIFICATION` rather than inventing a location.
- [ ] Step 4: Run focused lookup tests.
- [ ] Step 5: Commit the lookup correction.

### Task 6: Add completeness audit and regression test coverage

**Files:**
- Modify: `tests/administrative-boundary-completeness.test.ts`
- Create: `tests/map-drawing-boundary-regression.test.ts` if a dedicated drawing regression file is cleaner

**Interfaces:**
- Tests prove the supported Jawa Barat hierarchy has the expected official counts: 1 province, 18 regencies/cities, 627 districts, and 5,311 villages/kelurahan according to the current Kemendagri-backed reference dataset; geometry loading is tested independently from count metadata.

- [ ] Step 1: Add count assertions for the Jawa Barat hierarchy.
- [ ] Step 2: Add code uniqueness and parent-child integrity assertions.
- [ ] Step 3: Add geometry validity assertions: closed polygon, minimum 3 points, finite coordinates, EPSG:4326 range.
- [ ] Step 4: Add tap-drawing regression assertions with administrative layers enabled.
- [ ] Step 5: Run the complete focused test suite.
- [ ] Step 6: Commit tests.

### Task 7: Production verification and final build

**Files:**
- Modify only if verification finds a defect.

- [ ] Step 1: Run `npm run lint`.
- [ ] Step 2: Run `npm run build`.
- [ ] Step 3: Run `npm run test:smoke` and the administrative boundary test.
- [ ] Step 4: Run the production wiring/live worker tests when environment permits.
- [ ] Step 5: Inspect the final diff for accidental hard-coded partial datasets, fabricated official claims, or broken drawing event handling.
- [ ] Step 6: Commit only after all required checks pass.

## Source References

- BIG `BATAS_DESAKEL_AR` June 2026: https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH/BATAS_DESAKEL_AR/MapServer/0
- BIG `BATAS_KECAMATAN_AR` June 2026: https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH/BATAS_KECAMATAN_AR/MapServer/0
- BIG `BATAS_KABKOTA_AR`: https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH/BATAS_KABKOTA_AR/MapServer/0
- Kemendagri Kepmendagri 300.2.2-2430 Tahun 2025: https://ditjenbinaadwil.kemendagri.go.id/peraturan/keputusan-menteri-dalam-negeri-300.2.2-2430-2025-228
- Current codebase limitation: `PetaPertanianView.tsx` currently requests districts only for `32.15` (Kabupaten Karawang), so the map cannot represent all Jawa Barat districts from the existing seed.
