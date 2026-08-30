import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { hashPasswordForWorker, verifyPasswordForWorker, isCanonicalSuperAdminSecretMatch } from '../server/services/workerAdminAuth.ts';

const password = 'TestWorkerSecret!2026';
const salt = '00112233445566778899aabbccddeeff';
const expectedHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');

const actualHash = await hashPasswordForWorker(password, salt);
assert.equal(actualHash, expectedHash, 'Worker PBKDF2 must remain compatible with the existing D1 password hashes');

assert.equal(await verifyPasswordForWorker(password, expectedHash, salt), true);
assert.equal(await verifyPasswordForWorker('wrong-password', expectedHash, salt), false);

assert.equal(isCanonicalSuperAdminSecretMatch('admin_super_pappizee', password, password), true);
assert.equal(isCanonicalSuperAdminSecretMatch('admin_mgr_01', password, password), false);
assert.equal(isCanonicalSuperAdminSecretMatch('admin_super_pappizee', 'wrong-password', password), false);

// Regression test: authenticateAdminOnWorker inserts audit log with NOT NULL entity_type = 'AUTH'
const { createTestD1Database } = await import('../server/db/d1/testD1.ts');
const { ensureD1CanonicalSchema } = await import('../server/db/d1/ensureCanonical.ts');
const { authenticateAdminOnWorker } = await import('../server/services/workerAdminAuth.ts');

const d1 = createTestD1Database();
await ensureD1CanonicalSchema(d1 as any, true);

const authRes = await authenticateAdminOnWorker(
  d1 as any,
  { SUPER_ADMIN_PASSWORD: password },
  'pappizee',
  password,
  '127.0.0.1'
);
assert.equal(authRes.success, true, 'Super Admin login must succeed');

const logs = await d1.prepare(`SELECT * FROM admin_audit_logs WHERE action = 'LOGIN'`).all();
assert.equal(logs.results.length, 1, 'Exactly one login audit log must be recorded');
assert.equal(logs.results[0].entity_type, 'AUTH', 'Audit log entity_type must be AUTH and not null');
assert.equal(logs.results[0].actor_id, 'admin_super_pappizee');

console.log('✓ Worker admin secret and audit log entity_type regression tests passed.');
