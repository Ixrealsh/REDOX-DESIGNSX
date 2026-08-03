import { NextResponse } from 'next/server';
import { rateLimit, requestKey } from '@/lib/rate-limit';
import { addDbOrder, rebrandDbOrderReference } from '@/lib/catalog-db';
import { priceOrderDraft, reserveStockForDraft } from '@/lib/order-pricing';
import { checkoutInitSchema, toRequestedLines } from '@/lib/order-schema';
import {
  buildOrderMetadata,
  buildPaymentReference,
  getPaystackPublicKey,
  isPaystackConfigured
} from '@/lib/paystack-server';
import { resolveSiteUrl } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

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

    // Both keys must be present before we reserve anything: a customer should
    // never end up with a reserved order they have no way to pay for.
    const publicKey = getPaystackPublicKey();
    if (!publicKey || !isPaystackConfigured()) {
      return NextResponse.json(
        { error: 'Card checkout is temporarily unavailable. Please contact us to complete your order.' },
        { status: 503 }
      );
    }

    // 1. AUTHORITATIVE PRICING — the client's totals are never consulted.
    const pricing = await priceOrderDraft(toRequestedLines(input));
    if (!pricing.ok) {
      return NextResponse.json({ error: pricing.error }, { status: pricing.status });
    }

    const draft = pricing.draft;

    // 2. RESERVE STOCK so the customer on the payment screen cannot be outrun.
    const reservation = await reserveStockForDraft(draft);
    if (!reservation.ok) {
      return NextResponse.json({ error: reservation.error }, { status: 400 });
    }

    // 3. PERSIST THE ORDER, UNPAID. This is the durability guarantee.
    const primary = draft.items[0];
    const provisionalReference = buildPaymentReference();

    let order;
    try {
      order = await addDbOrder({
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
        status: 'Awaiting Payment',
        paymentStatus: 'unpaid',
        stockReserved: true,
        stockReleased: false,
        smsSent: false
      });
    } catch (error) {
      await reservation.reservation.rollback();
      console.error('Could not create the pre-payment order row, stock restored:', error);
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
    const siteUrl = resolveSiteUrl(request);
    const metadata = buildOrderMetadata({
      orderId: order.id,
      reference,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerEmail: order.customerEmail,
      shippingAddress: order.shippingAddress,
      shippingCity: order.shippingCity,
      items: draft.items,
      totalQuantity: draft.totalQuantity,
      subtotal: draft.subtotal,
      serviceCharge: draft.serviceCharge,
      grandTotal: draft.grandTotal,
      siteUrl
    });

    console.log(
      `[checkout] Order #RD-${order.id} recorded before payment (${reference}), GH₵${draft.grandTotal.toFixed(2)}.`
    );

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: `RD-${order.id}`,
      reference,
      publicKey,
      email: order.customerEmail,
      currency: 'GHS',
      /** Minor units. The server also re-checks this figure at confirmation. */
      amount: Math.round(draft.grandTotal * 100),
      subtotal: draft.subtotal,
      serviceCharge: draft.serviceCharge,
      total: draft.grandTotal,
      totalQuantity: draft.totalQuantity,
      items: draft.items,
      metadata
    });
  } catch (error: any) {
    console.error('API checkout initialize error:', error);
    return NextResponse.json(
      { error: 'We could not start your checkout. Please try again in a moment.' },
      { status: 500 }
    );
  }
}
