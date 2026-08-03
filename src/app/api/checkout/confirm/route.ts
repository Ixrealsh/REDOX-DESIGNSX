import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit, requestKey } from '@/lib/rate-limit';
import { findDbOrderByPaymentRef, getDbOrderById } from '@/lib/catalog-db';
import { toCustomerReceipt } from '@/lib/order-receipt';
import { settleOrderPayment } from '@/lib/payment-service';

export const dynamic = 'force-dynamic';

const confirmSchema = z.object({
  reference: z.string().trim().min(4).max(120).optional(),
  orderId: z.number().int().positive().optional()
});

/**
 * Step 2 of checkout: the browser reports back that Paystack said "done".
 *
 * This is only the *fastest* of the settlement paths, never the only one. The
 * server ignores what the browser claims and asks Paystack directly, so this
 * endpoint is safe to call from anywhere, any number of times — on the payment
 * callback, on a page reload, or from the hosted-checkout return page.
 */
export async function POST(request: Request) {
  // Deliberately generous. Mobile networks here put many customers behind one
  // NAT address, and this endpoint is the one a customer retries when their
  // connection is already struggling — throttling it is how orders get lost.
  const limit = rateLimit(`checkout-confirm:${requestKey(request)}`, 150);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many confirmation attempts. Please wait.' }, { status: 429 });
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = confirmSchema.safeParse(body);

    if (!parsed.success || (!parsed.data.reference && !parsed.data.orderId)) {
      return NextResponse.json({ error: 'A payment reference is required.' }, { status: 400 });
    }

    const order = parsed.data.reference
      ? await findDbOrderByPaymentRef(parsed.data.reference)
      : await getDbOrderById(parsed.data.orderId!);

    if (!order) {
      return NextResponse.json(
        {
          error:
            'We could not find an order for that reference. Please contact support and quote it — ' +
            'if you were charged, your payment is safe.'
        },
        { status: 404 }
      );
    }

    const result = await settleOrderPayment(order, {
      source: 'client',
      // A customer-triggered check must never put their basket back on sale;
      // that decision belongs to the reconciliation sweep alone.
      allowStockRelease: false
    });

    const paid = result.outcome === 'paid';

    return NextResponse.json({
      success: true,
      paid,
      /**
       * `settled` distinguishes "we know the answer" from "ask again shortly",
       * which is what the client uses to decide whether to keep retrying.
       */
      settled: paid || result.outcome === 'failed' || result.outcome === 'abandoned',
      outcome: result.outcome,
      message: paid ? 'Payment confirmed. Your order is on its way.' : result.message,
      order: toCustomerReceipt(result.order)
    });
  } catch (error: any) {
    console.error('API checkout confirm error:', error);
    return NextResponse.json(
      { error: 'We could not confirm this payment right now. Your order is saved — please try again.' },
      { status: 500 }
    );
  }
}
