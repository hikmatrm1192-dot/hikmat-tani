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

console.log('✓ Worker admin secret compatibility tests passed.');
