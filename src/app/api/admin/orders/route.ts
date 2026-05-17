import { NextResponse } from 'next/server';
import { getDbOrders } from '@/lib/catalog-db';

export async function GET() {
  try {
    const orders = await getDbOrders();
    return NextResponse.json({ success: true, orders });
  } catch (error: any) {
    console.error('API admin orders GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch customer orders.' },
      { status: 500 }
    );
  }
}
