import { NextResponse } from 'next/server';
import { findDbOrderByPaymentRef, markDbOrderRefunded } from '@/lib/catalog-db';
import { settleOrderPayment } from '@/lib/payment-service';
import { PAYSTACK_SIGNATURE_HEADER, isPaystackConfigured, verifyPaystackSignature } from '@/lib/paystack-server';

export const dynamic = 'force-dynamic';
// crypto.timingSafeEqual and the HMAC verification below need the Node runtime.
export const runtime = 'nodejs';

/**
 * Paystack's server-to-server notification.
 *
 * This is the path that makes a post-payment network failure harmless: it does
 * not involve the customer's browser at all, so it lands whether they closed
 * the tab, lost signal, or walked away. Paystack retries it for hours if we do
 * not answer.
 *
 * Two rules are load-bearing here:
 *
 *  1. The signature is checked against the *raw* body before anything is read
 *     from it. An unsigned request is rejected outright.
 *  2. The payload's own numbers are never trusted. The event only tells us
 *     *which* reference to look at; whether money actually moved is then
 *     re-established with an authenticated call back to Paystack.
 */
export async function POST(request: Request) {
  // The raw text — not the parsed object. Re-serialising JSON can reorder keys
  // or reformat numbers, which silently invalidates the HMAC.
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (error) {
    console.error('[webhook] Could not read the request body:', error);
    return NextResponse.json({ received: true });
  }

  if (!isPaystackConfigured()) {
    console.error('[webhook] Received a Paystack event but PAYSTACK_SECRET_KEY is not configured.');
    return NextResponse.json({ error: 'Gateway not configured.' }, { status: 503 });
  }

  const signature = request.headers.get(PAYSTACK_SIGNATURE_HEADER);
  if (!verifyPaystackSignature(rawBody, signature)) {
    console.warn('[webhook] Rejected an event with a missing or invalid signature.');
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Malformed payload.' }, { status: 400 });
  }

  const eventName = String(event?.event || '');
  const reference = String(event?.data?.reference || '').trim();

  // Acknowledge anything we do not act on, so Paystack stops retrying it.
  if (!reference) {
    return NextResponse.json({ received: true });
  }

  try {
    const order = await findDbOrderByPaymentRef(reference);

    if (!order) {
      // Not one of ours (or a transaction started outside this store). Ack it —
      // retrying will not make an order appear.
      console.warn(`[webhook] ${eventName} for unknown reference ${reference}.`);
      return NextResponse.json({ received: true });
    }

    if (eventName === 'charge.success' || eventName === 'charge.failed' || eventName === 'transaction.success') {
      const result = await settleOrderPayment(order, {
        source: 'webhook',
        // A webhook must never put stock back on sale: a `charge.failed` for one
        // attempt is routinely followed by a successful retry on the same
        // reference. The sweep releases stock, once, after the grace period.
        allowStockRelease: false
      });

      console.log(
        `[webhook] ${eventName} for order #RD-${order.id} (${reference}) → ${result.outcome}` +
          `${result.transitioned ? ' (state changed)' : ''}.`
      );

      return NextResponse.json({ received: true, outcome: result.outcome });
    }

    if (eventName === 'refund.processed' || eventName === 'refund.pending' || eventName === 'charge.dispute.create') {
      if (eventName === 'refund.processed') {
        await markDbOrderRefunded(order.id, 'Refund confirmed by Paystack.');
        console.log(`[webhook] Order #RD-${order.id} marked refunded.`);
      } else {
        console.warn(`[webhook] ${eventName} raised on order #RD-${order.id} — review it in the admin panel.`);
      }
      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`[webhook] Failed to process ${eventName} for ${reference}:`, error);
    // A 500 makes Paystack retry, which is exactly what we want after a
    // transient database failure.
    return NextResponse.json({ error: 'Processing failed.' }, { status: 500 });
  }
}

/** Paystack pings the URL on save; answer so the endpoint validates cleanly. */
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'paystack-webhook' });
}
