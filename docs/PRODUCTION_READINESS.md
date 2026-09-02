# HIKMAT TANI — Production Readiness Audit

**Audit date:** 2 September 2026  
**Target:** current production architecture — Cloudflare Worker + D1 + offline-first PWA  
**Production URL:** `https://app.hikmattani.id`

## Executive status

**Status: IN PROGRESS — not yet declared final.**

The automated regression, build, Wrangler validation, authentication, farmer-data isolation, sync, agronomy, OPT, weather fallback, PWA, and production-wiring suites have passed in the latest CI evidence available during this audit.

The remaining production gate is the live public smoke test. A previous run failed because the GitHub Actions runner could not resolve `app.hikmattani.id` (`ENOTFOUND`), not because the application returned an HTTP error. The live smoke job was rerun and the audit continues until the new run is verified.

## Verified areas

| Area | Status | Evidence |
|---|---|---|
| Type check | PASS | CI |
| Polygon tap regression | PASS | CI |
| Full regression suite | PASS | CI run 26 evidence |
| Production build | PASS | CI run 26 evidence |
| Wrangler dry-run | PASS | CI run 26 evidence |
| Farmer authentication | PASS | Regression + production-worker tests |
| Farmer identity/data isolation | PASS | 17-test isolation suite |
| D1 auth persistence | PASS | 12-test suite |
| Offline IndexedDB isolation | PASS | Account-switch suite |
| Two-way D1 sync | PASS | 15-test suite |
| Durable outbox/retry | PASS | 15-test suite |
| OPT correlation/PHT | PASS | 13-test suite |
| OPT photo integration | PASS | 14 scenarios |
| Knowledge sync/privacy | PASS | 12-test suite |
| Weather/fallback | PASS | 14-test suite |
| RBAC/admin | PASS | 21 checks |
| End-to-end farming flow | PASS | 16 checks |
| PWA/service worker | PASS | regression suite |
| Production wiring/scheduler | PASS | 12 checks |
| Custom domain behavior | PASS in application-level production tests | Live public HTTP gate still required |
| D1 health probe | PATCHED | Worker now executes `SELECT 1` |
| CORS trust boundary | PATCHED | Exact trusted origins only |
| BIG boundary upstream | SPECIALIZED / NON-BLOCKING | External service can timeout/return 5xx |
| Physical Android device | PENDING | Must be verified manually |

## Security fixes applied during this audit

### D1 health

The Worker health endpoint previously treated the presence of `env.DB` as equivalent to database connectivity. It now performs a bounded `SELECT 1` probe and returns HTTP 503/degraded when D1 cannot be reached.

### CORS

The Worker no longer automatically trusts arbitrary subdomains of `hikmattani.id` or arbitrary `workers.dev` origins. Production origins are matched explicitly.

## Live production gate

The live smoke test is deliberately non-mutating and performs only:

- `GET /api/v1/health`
- `GET /`

The test verifies HTTP 200, JSON/HTML contracts, Cloudflare Worker runtime identity, and D1 configuration.

A previous CI failure was:

```text
getaddrinfo ENOTFOUND app.hikmattani.id
```

This is a DNS-resolution failure at the CI runner layer. It must not be reclassified as an application success or failure without another live attempt.

## Physical-device gate

Automated CI cannot prove all Android/PWA behavior. Before wide farmer distribution, manually verify on a real Android phone:

1. production URL opens;
2. PWA can be installed;
3. cold start works;
4. login/register works;
5. land and crop-season data can be entered;
6. app remains usable offline;
7. local data survives restart;
8. reconnect triggers safe sync;
9. map/GPS/polygon interaction works;
10. camera/photo observation works;
11. no private farmer data appears in public/aggregated output.

Until this is performed, the correct status is **automated production readiness verified; physical-device verification pending**.

## Final gate

The audit will only be marked **TUNTAS** when the latest code passes:

```text
Type Check
→ Polygon Regression
→ Full Regression
→ Production Build
→ Wrangler Dry-Run
→ Live Production Smoke
```

BIG administrative-boundary tests remain a specialized external-upstream check and do not block unrelated production verification when the failure is demonstrably caused by BIG service instability.
