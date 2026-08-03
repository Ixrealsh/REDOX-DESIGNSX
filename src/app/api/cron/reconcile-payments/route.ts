import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { isAdminSessionValid, getAdminSessionToken } from '@/lib/admin-auth';
import { reconcilePendingPayments } from '@/lib/payment-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Scheduled reconciliation.
 *
 * Point a cron job at this (Vercel Cron, GitHub Actions, cron-job.org, …) every
 * 10–15 minutes with the `CRON_SECRET` in the Authorization header. It is the
 * last of the four settlement paths, and the one that runs even if nobody opens
 * the admin panel for a week.
 *
 *   Vercel — vercel.json:
 *   { "crons": [{ "path": "/api/cron/reconcile-payments", "schedule": "*\/10 * * * *" }] }
 */
function isAuthorized(request: Request): boolean {
  // A signed-in admin can always trigger it from the dashboard.
  if (isAdminSessionValid(getAdminSessionToken())) return true;

  const secret = (process.env.CRON_SECRET || '').trim();
  if (!secret) return false;

  const header = request.headers.get('authorization') || '';
  const provided = header.startsWith('Bearer ') ? header.slice(7).trim() : header.trim();
  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function run(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 });
  }

  try {
    const summary = await reconcilePendingPayments({ limit: 50 });
    return NextResponse.json({ success: true, summary });
  } catch (error: any) {
    console.error('Scheduled payment reconciliation failed:', error);
    return NextResponse.json({ error: 'Reconciliation failed.' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
