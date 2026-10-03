import { NextResponse } from 'next/server';
import { getDeliverySettings } from '@/lib/delivery-settings-db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await getDeliverySettings(), {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    console.error('Could not load delivery settings:', error);
    return NextResponse.json({ error: 'Delivery options are temporarily unavailable.' }, { status: 503 });
  }
}
