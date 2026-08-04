import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';
import { addDbOrder, findDbOrderByClientRequestId } from '@/lib/catalog-db';
import { priceOrderDraft, reserveStockForDraft } from '@/lib/order-pricing';
import { adminOrderSchema, resolveDiscount } from '@/lib/order-schema';
import { notifyOrderOnce } from '@/lib/payment-service';
import { formatGhanaPhone, isValidGhanaPhone } from '@/lib/phone';

export const dynamic = 'force-dynamic';

/** Placeholders for the fields a walk-in customer is not asked for. */
const WALK_IN_EMAIL = 'walkin@redoxdesignx.com';
const WALK_IN_ADDRESS = 'In-person / walk-in';
const WALK_IN_CITY = 'Walk-in';

/** How the money arrived, in the vocabulary the rest of the panel already uses. */
const PAYMENT_CHANNELS: Record<string, string> = {
  CASH: 'cash',
  MOMO: 'mobile_money',
  BANK: 'bank_transfer',
  COD: 'cash_on_delivery'
};

/**
 * Postgres reports a violated unique constraint as SQLSTATE 23505. The message
 * is matched too, because driver error shapes are not guaranteed across versions
 * and getting this wrong would turn a duplicate into a phantom failure.
 */
function isUniqueViolation(error: any): boolean {
  if (error?.code === '23505') return true;
  const message = String(error?.message || '').toLowerCase();
  return message.includes('duplicate key') || message.includes('client_request_id');
}

/**
 * Creates an order the merchant took by hand.
 *
 * This is the same pipeline `/api/checkout/initialize` runs — price from the
 * database, reserve the stock, write the row — with the gateway step removed and
 * the confirmation SMS sent immediately instead of after a payment lands. The
 * resulting order is indistinguishable from a web order everywhere it is read:
 * the orders table, the printed slip, the track-order page.
 *
 * Two things are deliberately not trusted from the browser: the prices (every
 * line is priced from the catalogue) and the discount (a percentage is resolved
 * against the server's own subtotal and can never exceed it).
 */
export async function POST(request: Request) {
  // No rate limit: this sits behind the admin session, and a merchant serving a
  // queue of customers must never be throttled mid-sale.
  const authError = requireAdminSession();
  if (authError) return authError;

  try {
    const body = await request.json().catch(() => null);
    const parsed = adminOrderSchema.safeParse(body);

    if (!parsed.success) {
      console.error('Invalid admin order payload:', parsed.error.format());
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        {
          error: firstIssue
            ? `${firstIssue.path.join('.') || 'Request'}: ${firstIssue.message}`
            : 'Please check the order details and try again.'
        },
        { status: 400 }
      );
    }

    const input = parsed.data;

    // 1. IDEMPOTENCY. A double-tapped button, or a retry after the connection
    //    dropped mid-request, must never mint a second order or take the stock
    //    out twice. The unique index on client_request_id is the real guard;
    //    this lookup is what turns a duplicate into a friendly answer.
    const existing = await findDbOrderByClientRequestId(input.clientRequestId);
    if (existing) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        smsSent: existing.smsSent,
        message: `Order #RD-${existing.id} was already created.`,
        order: existing
      });
    }

    // 2. AUTHORITATIVE PRICING. No service charge: that 2% covers the payment
    //    gateway's cut, and there is no gateway in an in-person sale.
    const pricing = await priceOrderDraft(
      input.items.map((item) => ({
        productSlug: item.productSlug,
        color: item.color,
        size: item.size,
        quantity: item.quantity
      })),
      { applyServiceCharge: false, allowOutOfStock: input.allowOutOfStock === true }
    );

    if (!pricing.ok) {
      return NextResponse.json({ error: pricing.error }, { status: pricing.status });
    }

    const draft = pricing.draft;
    const discount = resolveDiscount(draft.subtotal, input.discountType, input.discountValue);
    const grandTotal = Math.round((draft.subtotal - discount) * 100) / 100;

    // 3. RESERVE STOCK, so the shop cannot sell online what was just handed over
    //    in person. `allowShortfall` mirrors the pricing override: the merchant
    //    is holding the piece and the recorded count is behind.
    const reservation = await reserveStockForDraft(draft, {
      allowShortfall: input.allowOutOfStock === true
    });

    if (!reservation.ok) {
      return NextResponse.json({ error: reservation.error }, { status: 400 });
    }

    // 4. PERSIST THE ORDER.
    const primary = draft.items[0];
    const paidNow = input.paidNow === true;
    const now = new Date().toISOString();

    const noteParts = [input.note?.trim(), input.allowOutOfStock ? 'Sold past the recorded stock level.' : '']
      .filter(Boolean)
      .join(' | ');

    // "Paid now" and "cash on delivery" are contradictory. Money in hand is cash,
    // so the method and the channel cannot disagree about which it was.
    const settledMethod = input.paymentMethod === 'COD' ? 'CASH' : input.paymentMethod;

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
        serviceCharge: 0,
        discount,
        price: grandTotal,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail?.trim() || WALK_IN_EMAIL,
        shippingAddress: input.shippingAddress?.trim() || WALK_IN_ADDRESS,
        shippingCity: input.shippingCity?.trim() || WALK_IN_CITY,
        source: 'admin',
        clientRequestId: input.clientRequestId,
        stockReserved: true,
        stockReleased: false,
        smsSent: false,

        ...(paidNow
          ? {
              paymentMethod: settledMethod,
              momoNetwork: settledMethod === 'MOMO' ? input.momoNetwork : undefined,
              status: input.fulfilmentStatus || 'Processing',
              paymentStatus: 'paid' as const,
              paidAt: now,
              amountPaid: grandTotal,
              paymentChannel: PAYMENT_CHANNELS[settledMethod] || 'manual',
              paymentVerifiedBy: 'admin' as const,
              lastVerifiedAt: now,
              paymentNote: noteParts || 'Recorded in person by an admin.'
            }
          : {
              // Nothing has been collected yet, so the order is cash on delivery
              // whatever the merchant intends to be paid with later.
              paymentMethod: 'COD',
              status: input.fulfilmentStatus || 'Pending',
              paymentStatus: 'unpaid' as const,
              paymentNote: noteParts || 'Created in person by an admin — payment on delivery.'
            })
      });
    } catch (error: any) {
      // Always hand the units back first: whatever happened, this request is not
      // the one that owns them.
      await reservation.reservation.rollback();

      // Two identical submissions can pass the lookup above at the same instant.
      // The unique index catches the loser, and that is a duplicate — not a
      // failure. Return the order the winner created.
      if (isUniqueViolation(error)) {
        const winner = await findDbOrderByClientRequestId(input.clientRequestId);
        if (winner) {
          return NextResponse.json({
            success: true,
            duplicate: true,
            smsSent: winner.smsSent,
            message: `Order #RD-${winner.id} was already created.`,
            order: winner
          });
        }
      }

      console.error('Could not record the admin-created order, stock restored:', error);
      return NextResponse.json(
        { error: 'We could not save that order. Nothing was changed — please try again.' },
        { status: 500 }
      );
    }

    // The sale is committed. Nothing past this point may hand the stock back.

    // 5. CONFIRMATION SMS — awaited, because a detached promise is not
    //    guaranteed to finish once a serverless function has already returned.
    //    A failure here is reported, never fatal: the order exists either way,
    //    and the panel offers a Resend button.
    const smsSent = await notifyOrderOnce(order);
    const msisdn = formatGhanaPhone(order.customerPhone);

    console.log(
      `[admin-order] Order #RD-${order.id} created in the panel — GH₵${grandTotal.toFixed(2)}` +
        `${discount > 0 ? ` (GH₵${discount.toFixed(2)} off)` : ''}, ` +
        `${paidNow ? 'paid' : 'unpaid'}, SMS ${smsSent ? 'sent' : 'not sent'}.`
    );

    return NextResponse.json({
      success: true,
      duplicate: false,
      smsSent,
      smsReason: smsSent
        ? undefined
        : isValidGhanaPhone(msisdn)
        ? 'The SMS gateway did not accept the message. You can resend it from the orders table.'
        : `"${order.customerPhone}" is not a valid Ghanaian number, so no text was sent.`,
      message: `Order #RD-${order.id} created.`,
      order
    });
  } catch (error: any) {
    console.error('API admin order create error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create that order.' },
      { status: 500 }
    );
  }
}
