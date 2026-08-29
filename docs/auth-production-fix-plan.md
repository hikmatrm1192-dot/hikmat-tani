# Production Auth Fix Plan

This file documents the required minimal production authentication repair.

## Farmer authentication
- Persist farmer accounts in Cloudflare D1 (`auth_users` + `farmers`).
- Register and login must read/write D1 rather than relying on process memory Maps.
- Preserve existing NIK/phone + PIN behavior, PBKDF2, JWT, farmerId isolation, IndexedDB, SyncEngine, and API contracts.
- Never reset or truncate production data.

## Admin authentication
- Ensure `/api/v1/admin/auth/login` is wired to the admin service.
- Verify the production admin password configuration before changing credentials.
- Do not hard-code or expose a production password in source control.
- Preserve SUPER_ADMIN role and authorization behavior.

## Verification
- Register farmer -> logout -> cold start/reload -> login again.
- Verify farmer profile and land data remain available.
- Verify farmer A/B isolation.
- Verify duplicate NIK protection.
- Verify fake token rejection.
- Verify Super Admin login using the password configured in Cloudflare secrets.
- Run TypeScript check, production build, and existing tests before deployment.
