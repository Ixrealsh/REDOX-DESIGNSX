import assert from 'node:assert/strict';
import test from 'node:test';
import { ADMIN_SESSION_SECONDS, createAdminSessionToken, isAdminSessionTokenValid } from '../src/lib/admin-session.ts';

test('admin session survives refreshes and expires after exactly twelve hours', () => {
  const issuedAt = Date.UTC(2026, 9, 3, 9, 0, 0);
  const token = createAdminSessionToken('Admin@Example.com', 'stable-secret', issuedAt);

  assert.equal(ADMIN_SESSION_SECONDS, 12 * 60 * 60);
  assert.equal(isAdminSessionTokenValid(token, 'admin@example.com', 'stable-secret', issuedAt), true);
  assert.equal(isAdminSessionTokenValid(token, 'admin@example.com', 'stable-secret', issuedAt + (ADMIN_SESSION_SECONDS - 1) * 1000), true);
  assert.equal(isAdminSessionTokenValid(token, 'admin@example.com', 'stable-secret', issuedAt + ADMIN_SESSION_SECONDS * 1000), false);
  assert.equal(isAdminSessionTokenValid(token, 'other@example.com', 'stable-secret', issuedAt), false);
  assert.equal(isAdminSessionTokenValid(token, 'admin@example.com', 'wrong-secret', issuedAt), false);
  assert.equal(isAdminSessionTokenValid(token, 'admin@example.com', 'stable-secret', issuedAt - 1000), false);
  assert.equal(isAdminSessionTokenValid('legacy-session-token', 'admin@example.com', 'stable-secret', issuedAt), false);
});
