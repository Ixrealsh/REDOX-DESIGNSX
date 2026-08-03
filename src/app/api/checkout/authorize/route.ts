import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit, requestKey } from '@/lib/rate-limit';
import { findDbOrderByPaymentRef, rebrandDbOrderReference } from '@/lib/catalog-db';
import { toCustomerReceipt } from '@/lib/order-receipt';
import { settleOrderPayment } from '@/lib/payment-service';
import { buildOrderMetadataFromOrder, buildPaymentReference, initializePaystackTransaction } from '@/lib/paystack-server';
import { resolveSiteUrl } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

const authorizeSchema = z.object({
  reference: z.string().trim().min(4).max(120)
});

/**
 * Hosted-checkout fallback.
 *
 * When the inline popup cannot load at all — an aggressive ad-blocker, a
 * corporate firewall, a browser that blocks third-party iframes — the customer
 * is sent to Paystack's own page instead of being left stranded. The
 * transaction is registered server-side here, so the amount and the full
 * purchase metadata are fixed before the customer ever sees the payment form.
 */
export async function POST(request: Request) {
  const limit = rateLimit(`checkout-authorize:${requestKey(request)}`, 40);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = authorizeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'A payment reference is required.' }, { status: 400 });
    }

    const order = await findDbOrderByPaymentRef(parsed.data.reference);
    if (!order) {
      return NextResponse.json({ error: 'That checkout session could not be found.' }, { status: 404 });
    }

    if (order.paymentStatus === 'paid') {
      return NextResponse.json({
        success: true,
        alreadyPaid: true,
        order: toCustomerReceipt(order)
      });
    }

    const siteUrl = resolveSiteUrl(request);
    const callbackUrl = `${siteUrl}/checkout/complete`;
    const amountPesewas = Math.round(order.price * 100);

    const attempt = async (reference: string) =>
      initializePaystackTransaction({
        email: order.customerEmail,
        amountPesewas,
        reference,
        callbackUrl,
        metadata: buildOrderMetadataFromOrder({ ...order, paymentReference: reference }, siteUrl)
      });

    let reference = order.paymentReference || order.momoNumber || '';
    let result = await attempt(reference);

    if (!result.ok && result.duplicateReference) {
      // Paystack already holds a transaction under this reference. Settle against
      // it first — it may be a completed payment we have not recorded yet.
      const settlement = await settleOrderPayment(order, { source: 'client', allowStockRelease: false });

      if (settlement.outcome === 'paid') {
        return NextResponse.json({
          success: true,
          alreadyPaid: true,
          order: toCustomerReceipt(settlement.order)
        });
      }

      // The old reference is spent but unpaid, so move this order onto a fresh
      // one before trying again.
      const rotated = buildPaymentReference(order.id);
      if (await rebrandDbOrderReference(order.id, rotated)) {
        reference = rotated;
        result = await attempt(rotated);
      }
    }

    if (!result.ok) {
      console.error(`[checkout] Hosted checkout could not be started for order #${order.id}: ${result.reason}`);
      return NextResponse.json(
        { error: 'We could not open the secure payment page. Please try again in a moment.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      alreadyPaid: false,
      reference,
      authorizationUrl: result.authorizationUrl,
      accessCode: result.accessCode
    });
  } catch (error: any) {
    console.error('API checkout authorize error:', error);
    return NextResponse.json(
      { error: 'We could not open the secure payment page. Please try again in a moment.' },
      { status: 500 }
    );
  }
}
