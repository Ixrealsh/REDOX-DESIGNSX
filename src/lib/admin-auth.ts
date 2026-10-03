import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createAdminSessionToken, isAdminSessionTokenValid } from '@/lib/admin-session';

const fallbackSessionSecret = 'redox-secret-key-129847192';

export function getAdminEmail() {
  return process.env.ADMIN_EMAIL || 'admin@redoxdesignx.com';
}

function getAdminSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.NEXTAUTH_SECRET || fallbackSessionSecret;
}

export function createAdminSession(email = getAdminEmail()) {
  return createAdminSessionToken(email, getAdminSessionSecret());
}

export function isAdminSessionValid(token?: string) {
  return isAdminSessionTokenValid(token, getAdminEmail(), getAdminSessionSecret());
}

export async function getAdminSessionToken() {
  return (await cookies()).get('admin_session')?.value;
}

export async function requireAdminSession() {
  if (isAdminSessionValid(await getAdminSessionToken())) return null;
  return NextResponse.json({ error: 'Admin session required.' }, { status: 401 });
}
