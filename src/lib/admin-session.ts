import crypto from 'crypto';

export const ADMIN_SESSION_SECONDS = 12 * 60 * 60;

function sign(email: string, secret: string, issuedAt: number): string {
  return crypto.createHmac('sha256', secret)
    .update(`v1:${email.trim().toLowerCase()}:${issuedAt}`)
    .digest('hex');
}

export function createAdminSessionToken(email: string, secret: string, now = Date.now()): string {
  const issuedAt = Math.floor(now / 1000);
  return `v1.${issuedAt}.${sign(email, secret, issuedAt)}`;
}

export function isAdminSessionTokenValid(token: string | undefined, email: string, secret: string, now = Date.now()): boolean {
  const match = /^v1\.(\d+)\.([a-f0-9]{64})$/.exec(token || '');
  if (!match) return false;

  const issuedAt = Number(match[1]);
  const age = Math.floor(now / 1000) - issuedAt;
  if (!Number.isSafeInteger(issuedAt) || age < 0 || age >= ADMIN_SESSION_SECONDS) return false;

  const actual = Buffer.from(match[2], 'hex');
  const expected = Buffer.from(sign(email, secret, issuedAt), 'hex');
  return crypto.timingSafeEqual(actual, expected);
}
