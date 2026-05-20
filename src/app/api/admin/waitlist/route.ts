import { NextResponse } from 'next/server';
import { getDbWaitlist } from '@/lib/catalog-db';
import { requireAdminSession } from '@/lib/admin-auth';

export async function GET() {
  const authError = requireAdminSession();
  if (authError) return authError;

  try {
    const waitlist = await getDbWaitlist();
    return NextResponse.json({ success: true, waitlist });
  } catch (error: any) {
    console.error('API admin waitlist GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch waitlist signups.' },
      { status: 500 }
    );
  }
}
