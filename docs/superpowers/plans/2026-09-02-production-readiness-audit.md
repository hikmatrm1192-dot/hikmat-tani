# HIKMAT TANI Production Readiness Audit Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove and, where necessary, harden the current HIKMAT TANI release so the production build is safe for the farmer workflow, offline-first operation, synchronization, map/GPS, OPT capture, authentication, and Cloudflare deployment.

**Architecture:** Preserve the existing offline-first PWA architecture: React/Vite frontend with Dexie/IndexedDB farmer partitions, Cloudflare Worker API gateway, and Cloudflare D1 as the production database. Do not introduce new infrastructure or force future 3D functionality into this release.

**Tech Stack:** React 19, TypeScript, Vite, Dexie, Cloudflare Workers, D1, Wrangler, Node test runner via tsx.

**Spec:** Current repository requirements and the production-readiness definition agreed in the conversation: the current main version must be production-ready before being called complete.

## Global Constraints

- Preserve offline-first behavior.
- Preserve farmer data isolation by farmerId.
- Do not expose passwords, JWT secrets, or private farmer data.
- Do not replace Cloudflare/GitHub/Google AI Studio workflow with Replit.
- Do not add speculative future features during stabilization.
- Every production behavior change requires a failing regression test first (TDD).

---

### Task 1: Establish the audit baseline

**Files:**
- Read: `package.json`, `wrangler.toml`, `server/worker.ts`, `tests/*`, `docs/DEPLOYMENT.md`
- Test: existing production and regression suites

- [ ] Record current HEAD, build/typecheck status, and test inventory.
- [ ] Identify tests that are true runtime/E2E versus pure logic tests.
- [ ] Separate verified repository facts from unverified live-production claims.

### Task 2: Farmer authentication and data isolation E2E

**Files:**
- Inspect: `server/worker.ts`, auth services, farmer repositories, sync services
- Test: existing registration/auth/isolation tests; add regression tests only for uncovered behavior

- [ ] Verify register/login by supported identifiers.
- [ ] Verify session/me/logout/relogin.
- [ ] Verify duplicate identity rejection.
- [ ] Verify Farmer A cannot access Farmer B data server-side or in local partitions.
- [ ] Verify account switching while offline and after refresh.

### Task 3: Offline-first and synchronization audit

**Files:**
- Inspect: `src/sync/*`, repositories, outbox consumer, Worker sync routes
- Test: sync, replication, outbox, account-switch tests

- [ ] Verify create/update/delete operations are idempotent.
- [ ] Verify reconnect drains pending operations safely.
- [ ] Verify retry/failure does not duplicate records.
- [ ] Verify server errors do not destroy local farmer data.
- [ ] Add failing regression tests for any uncovered conflict/retry behavior before implementation changes.

### Task 4: Core agronomy workflow audit

**Files:**
- Inspect: land, crop-season, activity, expense, harvest, agronomy and recommendation modules
- Test: existing E2E/smoke/calculation tests

- [ ] Verify Lahan → Musim Tanam → Aktivitas → Biaya → Panen.
- [ ] Verify HST/growth phase calculations.
- [ ] Verify fertilizer/nutrient calculations.
- [ ] Verify economics accepts real user values including zero where valid.
- [ ] Verify empty/error states do not produce blank screens.

### Task 5: OPT + photo + recommendation audit

**Files:**
- Inspect: `src/types/opt.ts`, OPT repositories, photo/AI services, recommendation/context engine
- Test: `tests/opt-correlation.test.ts`, `tests/opt-photo-integration.test.ts` and related tests

- [ ] Verify OPT observation stores name, quantity and contextual data.
- [ ] Verify photo capture failure/empty photo fallback.
- [ ] Verify analysis failure has safe fallback.
- [ ] Verify recommendation remains advisory and actual farmer action is separately recorded.
- [ ] Verify offline observation remains usable and syncable.

### Task 6: GPS/map/polygon production audit

**Files:**
- Inspect: map components/services and BIG boundary loaders
- Test: map/polygon/admin-boundary regression tests

- [ ] Verify map loads without boundary service failure causing a blank screen.
- [ ] Verify progressive LOD and retries.
- [ ] Verify GPS permission denied/failure handling.
- [ ] Verify polygon tap/drawing/capture.
- [ ] Verify land geometry persists and remains associated with the correct farmer.

### Task 7: Weather and regional alerts

**Files:**
- Inspect: `server/services/weatherService.ts`, regional alerts, frontend weather modules
- Test: weather and weather-agri tests

- [ ] Verify coordinate validation.
- [ ] Verify provider failure fallback/error state.
- [ ] Verify weather does not block the core offline farmer workflow.

### Task 8: Security and production configuration

**Files:**
- Inspect: `server/worker.ts`, auth services, `wrangler.toml`, deployment docs
- Test: security/auth/config regression tests

- [ ] Review CORS behavior and avoid permissive production behavior where unnecessary.
- [ ] Verify secrets are read only from Worker bindings and never returned/logged.
- [ ] Verify token validation and expiry.
- [ ] Verify admin authorization boundaries.
- [ ] Verify production configuration matches D1/custom-domain architecture.
- [ ] Update stale deployment documentation only after source behavior is confirmed.

### Task 9: PWA and production startup

**Files:**
- Inspect: Vite/PWA assets, routing, service worker, startup/deployment configuration
- Test: production startup/custom-domain tests

- [ ] Verify production build.
- [ ] Verify SPA direct routes.
- [ ] Verify manifest and service worker.
- [ ] Verify static asset fallback.
- [ ] Verify Worker health endpoint and D1 binding checks.

### Task 10: Full verification gate

**Files:**
- No production code unless a discovered blocker requires it.

- [ ] Run typecheck.
- [ ] Run build.
- [ ] Run full automated regression suite.
- [ ] Run map regression suite.
- [ ] Run production/custom-domain checks.
- [ ] If live production access is available, run live tests against `app.hikmattani.id`; otherwise explicitly mark live verification as unverified.
- [ ] Verify final git diff and commit only intentional changes.
- [ ] Do not declare production-ready until all required gates are evidenced.
