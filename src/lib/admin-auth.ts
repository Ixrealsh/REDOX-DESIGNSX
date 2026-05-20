import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const fallbackSessionSecret = 'redox-secret-key-129847192';

export function getAdminEmail() {
  return process.env.ADMIN_EMAIL || 'admin@redoxdesignx.com';
}

export function createAdminSignature(email = getAdminEmail()) {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.NEXTAUTH_SECRET || fallbackSessionSecret;
  return crypto.createHmac('sha256', secret).update(email.trim().toLowerCase()).digest('hex');
}

export function isAdminSessionValid(token?: string) {
  if (!token) return false;

  const expected = createAdminSignature();
  const tokenBuffer = Buffer.from(token, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  if (tokenBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(tokenBuffer, expectedBuffer);
}

export function getAdminSessionToken() {
  return cookies().get('admin_session')?.value;
}

export function requireAdminSession() {
  if (isAdminSessionValid(getAdminSessionToken())) return null;
  return NextResponse.json({ error: 'Admin session required.' }, { status: 401 });
}
