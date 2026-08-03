import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit, requestKey } from '@/lib/rate-limit';
import { findDbOrderByPaymentRef } from '@/lib/catalog-db';
import { toCustomerReceipt } from '@/lib/order-receipt';
import { settleOrderPayment } from '@/lib/payment-service';

export const dynamic = 'force-dynamic';

const abandonSchema = z.object({
  reference: z.string().trim().min(4).max(120)
});

/**
 * The customer closed the payment window.
 *
 * This still asks Paystack what happened rather than assuming — closing the
 * popup after a successful mobile-money authorisation is common, and that case
 * must resolve to a paid order, not a cancelled one. Only when the gateway
 * itself reports the charge as failed, abandoned or never-created does the
 * reservation go straight back on sale; a payment still in flight keeps its
 * stock and is left to the sweep.
 */
export async function POST(request: Request) {
  const limit = rateLimit(`checkout-abandon:${requestKey(request)}`, 80);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = abandonSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'A payment reference is required.' }, { status: 400 });
    }

    const order = await findDbOrderByPaymentRef(parsed.data.reference);
    if (!order) {
      return NextResponse.json({ success: true, paid: false, outcome: 'unknown' });
    }

    const result = await settleOrderPayment(order, {
      source: 'client',
      allowStockRelease: true,
      // The gateway has given a definitive verdict, so there is nothing to wait
      // for — put the units back immediately rather than holding them for an hour.
      releaseGraceSeconds: 0
    });

    return NextResponse.json({
      success: true,
      paid: result.outcome === 'paid',
      outcome: result.outcome,
      message: result.message,
      order: toCustomerReceipt(result.order)
    });
  } catch (error: any) {
    console.error('API checkout abandon error:', error);
    // Never surface an error here: the sweep will tidy up regardless, and the
    // customer is already looking at a "payment cancelled" screen.
    return NextResponse.json({ success: true, paid: false, outcome: 'unknown' });
  }
}
