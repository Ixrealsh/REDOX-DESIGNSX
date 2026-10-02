import { NextResponse } from 'next/server';
import { rateLimit, requestKey } from '@/lib/rate-limit';
import { createDbOrderWithStock, findDbOrderByClientRequestId, rebrandDbOrderReference } from '@/lib/catalog-db';
import { isDbConfigured } from '@/lib/db';
import { priceOrderDraft } from '@/lib/order-pricing';
import { checkoutInitSchema, toRequestedLines } from '@/lib/order-schema';
import {
  buildOrderMetadataFromOrder,
  buildPaymentReference,
  getPaystackPublicKey,
  isPaystackConfigured
} from '@/lib/paystack-server';
import { resolveSiteUrl } from '@/lib/site-url';
import type { Order } from '@/types/product';

export const dynamic = 'force-dynamic';

function checkoutResponse(order: Order, reference: string, publicKey: string, request: Request) {
  return NextResponse.json({
    success: true,
    orderId: order.id,
    orderNumber: `RD-${order.id}`,
    reference,
    publicKey,
    email: order.customerEmail,
    currency: 'GHS',
    amount: Math.round(order.price * 100),
    subtotal: order.subtotal,
    serviceCharge: order.serviceCharge,
    total: order.price,
    totalQuantity: order.totalQuantity,
    items: order.items,
    metadata: buildOrderMetadataFromOrder({ ...order, paymentReference: reference }, resolveSiteUrl(request))
  });
}

/**
 * Step 1 of checkout: record the order, then hand the browser what it needs to
 * pay for it.
 *
 * The order row is written to the database *before* Paystack is ever opened.
 * From this point on the sale exists, priced and reserved, with a unique
 * reference the gateway will echo back. If the customer's connection dies at
 * any later moment — mid-payment, on the callback, or after closing the tab —
 * nothing is lost: the webhook and the reconciliation sweep settle it against
 * the row that is already there.
 */
export async function POST(request: Request) {
  // Mobile carriers here NAT many customers behind one address, so this counts
  // shoppers, not attackers. Kept high enough that a busy drop cannot lock real
  // buyers out of checkout.
  const limit = rateLimit(`checkout-init:${requestKey(request)}`, 40);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many checkout attempts. Please wait a moment and try again.' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = checkoutInitSchema.safeParse(body);

    if (!parsed.success) {
      console.error('Invalid checkout initialisation payload:', parsed.error.format());
      return NextResponse.json({ error: 'Please check your details and try again.' }, { status: 400 });
    }

    const input = parsed.data;

    if (!isDbConfigured) {
      return NextResponse.json({ error: 'Checkout is temporarily unavailable. Please try again later.' }, { status: 503 });
    }

    // Both keys must be present before we reserve anything: a customer should
    // never end up with a reserved order they have no way to pay for.
    const publicKey = getPaystackPublicKey();
    if (!publicKey || !isPaystackConfigured()) {
      return NextResponse.json(
        { error: 'Card checkout is temporarily unavailable. Please contact us to complete your order.' },
        { status: 503 }
      );
    }

    if (input.clientRequestId) {
      const existing = await findDbOrderByClientRequestId(input.clientRequestId);
      if (existing) {
        if (existing.customerEmail !== input.customerEmail || existing.customerPhone !== input.customerPhone) {
          return NextResponse.json({ error: 'This checkout request belongs to another order.' }, { status: 409 });
        }
        if (existing.paymentStatus !== 'unpaid' || existing.stockReleased) {
          return NextResponse.json({ error: 'This checkout has already finished. Please check your order status.' }, { status: 409 });
        }
        return checkoutResponse(existing, existing.paymentReference || existing.momoNumber || '', publicKey, request);
      }
    }

    // 1. AUTHORITATIVE PRICING — the client's totals are never consulted.
    const pricing = await priceOrderDraft(toRequestedLines(input));
    if (!pricing.ok) {
      return NextResponse.json({ error: pricing.error }, { status: pricing.status });
    }

    const draft = pricing.draft;

    // 2. Reserve stock and persist the unpaid order in one database transaction.
    const primary = draft.items[0];
    const provisionalReference = buildPaymentReference();

    let order;
    try {
      order = await createDbOrderWithStock({
        productId: primary.productId,
        productName: primary.productName,
        productSlug: primary.productSlug,
        selectedColor: draft.summaryColor,
        selectedSize: draft.summarySize,
        items: draft.items,
        totalQuantity: draft.totalQuantity,
        subtotal: draft.subtotal,
        serviceCharge: draft.serviceCharge,
        price: draft.grandTotal,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail,
        shippingAddress: input.shippingAddress,
        shippingCity: input.shippingCity,
        paymentMethod: 'PAYSTACK',
        momoNumber: provisionalReference,
        paymentReference: provisionalReference,
        clientRequestId: input.clientRequestId,
        status: 'Awaiting Payment',
        paymentStatus: 'unpaid',
        stockReserved: true,
        stockReleased: false,
        smsSent: false
      }, draft.lines);
    } catch (error: any) {
      if (error?.code === '23505' && input.clientRequestId) {
        const existing = await findDbOrderByClientRequestId(input.clientRequestId);
        if (existing && existing.customerEmail === input.customerEmail && existing.customerPhone === input.customerPhone && existing.paymentStatus === 'unpaid' && !existing.stockReleased) {
          return checkoutResponse(existing, existing.paymentReference || existing.momoNumber || '', publicKey, request);
        }
      }
      if (error?.code === 'P0001') {
        return NextResponse.json({ error: error.message || 'Requested stock is unavailable.' }, { status: 400 });
      }
      console.error('Could not create the pre-payment order:', error);
      return NextResponse.json(
        { error: 'We could not start your checkout. Please try again in a moment.' },
        { status: 500 }
      );
    }

    // 4. Upgrade the reference so it carries the order number. Best effort — the
    //    provisional reference is already unique and perfectly usable.
    let reference = provisionalReference;
    const branded = buildPaymentReference(order.id);
    if (await rebrandDbOrderReference(order.id, branded)) {
      reference = branded;
    }

    // 5. The purchase, attached to the transaction itself: Paystack renders these
    //    custom fields on the dashboard and in the receipt email.
    console.log(
      `[checkout] Order #RD-${order.id} recorded before payment (${reference}), GH₵${draft.grandTotal.toFixed(2)}.`
    );

    return checkoutResponse(order, reference, publicKey, request);
  } catch (error: any) {
    console.error('API checkout initialize error:', error);
    return NextResponse.json(
      { error: 'Checkout is temporarily unavailable. Please try again in a moment.' },
      { status: 503 }
    );
  }
}
