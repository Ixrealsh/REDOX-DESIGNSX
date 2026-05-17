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

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const { orderId, status } = body || {};

    if (!orderId || !status) {
      return NextResponse.json({ error: 'orderId and status are required.' }, { status: 400 });
    }

    const { isDbConfigured, sql } = require('@/lib/db');
    if (isDbConfigured) {
      await sql`
        UPDATE orders
        SET status = ${status}
        WHERE id = ${Number(orderId)}
      `;
    } else {
      // Sandbox fallback update
      const orders = await getDbOrders();
      const order = orders.find((o: any) => o.id === Number(orderId));
      if (order) {
        order.status = status;
      }
    }

    return NextResponse.json({ success: true, message: 'Order status updated successfully!' });
  } catch (error: any) {
    console.error('API admin orders POST status error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update order status.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required.' }, { status: 400 });
    }

    const { deleteDbOrder } = require('@/lib/catalog-db');
    await deleteDbOrder(Number(orderId));

    return NextResponse.json({ success: true, message: 'Order deleted successfully!' });
  } catch (error: any) {
    console.error('API admin orders DELETE error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete order.' },
      { status: 500 }
    );
  }
}
