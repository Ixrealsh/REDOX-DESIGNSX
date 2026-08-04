import { NextResponse } from 'next/server';
import { rateLimit, requestKey } from '@/lib/rate-limit';
import { addDbOrder, findDbOrderByPaymentRef, type NewOrderInput } from '@/lib/catalog-db';
import { priceOrderDraft, reserveStockForDraft } from '@/lib/order-pricing';
import { directOrderSchema, toRequestedLines } from '@/lib/order-schema';
import { toCustomerReceipt } from '@/lib/order-receipt';
import { notifyOrderOnce, settleOrderPayment } from '@/lib/payment-service';
import { adjudicatePayment, verifyPaystackTransaction } from '@/lib/paystack-server';

export const dynamic = 'force-dynamic';

/**
 * Direct order placement.
 *
 * Card checkout now runs through `/api/checkout/initialize` → Paystack →
 * `/api/checkout/confirm`, which records the order *before* any money moves.
 * This route remains for:
 *
 *  - Cash-on-delivery and manual mobile-money orders, which have no gateway step.
 *  - Any browser tab that was already open on the previous build when it was
 *    deployed. Those post a Paystack reference here after paying, so the path is
 *    kept alive and routed into the same settlement logic rather than being
 *    allowed to 404 on a customer who has already been charged.
 */
export async function POST(request: Request) {
  const limit = rateLimit(`orders:${requestKey(request)}`, 25);

  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many order attempts. Please wait.' }, { status: 429 });
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = directOrderSchema.safeParse(body);

    if (!parsed.success) {
      console.error('Invalid order validation:', parsed.error.format());
      return NextResponse.json({ error: 'Invalid order input data.' }, { status: 400 });
    }

    const orderData = parsed.data;
    // Older clients passed the Paystack reference through `momoNumber`.
    const paymentReference = orderData.paymentReference || orderData.momoNumber;

    // ── Legacy card path ────────────────────────────────────────────
    // If this reference already has an order (the new flow created it before
    // payment), settle that order instead of minting a second one.
    if (orderData.paymentMethod === 'PAYSTACK') {
      if (!paymentReference) {
        return NextResponse.json({ error: 'Payment authorization reference is missing.' }, { status: 400 });
      }

      const existing = await findDbOrderByPaymentRef(paymentReference);
      if (existing) {
        const result = await settleOrderPayment(existing, { source: 'client', allowStockRelease: false });
        return NextResponse.json({
          success: true,
          paid: result.outcome === 'paid',
          outcome: result.outcome,
          message: result.outcome === 'paid' ? 'Order confirmed.' : result.message,
          order: toCustomerReceipt(result.order)
        });
      }
    }

    // 1. AUTHORITATIVE PRICING — the client's totals are never consulted.
    const pricing = await priceOrderDraft(toRequestedLines(orderData));
    if (!pricing.ok) {
      return NextResponse.json({ error: pricing.error }, { status: pricing.status });
    }

    const draft = pricing.draft;

    // 2. For a card order arriving here, confirm the money before recording it.
    let paymentFields: Partial<NewOrderInput> = {};

    if (orderData.paymentMethod === 'PAYSTACK') {
      const verification = await verifyPaystackTransaction(paymentReference!);

      if (!verification.ok) {
        const message =
          verification.reason === 'transaction_not_found'
            ? 'That payment reference is not recognised by Paystack.'
            : 'We could not reach Paystack to verify your payment. Please try again in a moment.';
        return NextResponse.json({ error: message }, { status: verification.retryable ? 504 : 400 });
      }

      const verdict = adjudicatePayment(verification.transaction, draft.grandTotal);
      if (verdict.outcome !== 'paid') {
        const reason =
          verdict.outcome === 'mismatch' || verdict.outcome === 'failed'
            ? verdict.reason
            : 'This payment has not completed yet.';
        return NextResponse.json({ error: reason }, { status: 400 });
      }

      paymentFields = {
        paymentStatus: 'paid',
        paymentReference,
        paidAt: verdict.paidAt || new Date().toISOString(),
        amountPaid: verdict.amountPaid,
        paymentChannel: verdict.channel,
        paystackTransactionId: verdict.transactionId,
        gatewayResponse: verdict.gatewayResponse,
        paymentVerifiedBy: 'client',
        lastVerifiedAt: new Date().toISOString()
      };
    }

    // 3. RESERVE STOCK (handed back below if the order row cannot be written).
    const reservation = await reserveStockForDraft(draft);
    if (!reservation.ok) {
      return NextResponse.json({ error: reservation.error }, { status: 400 });
    }

    // 4. PERSIST ONE ORDER HOLDING EVERY LINE.
    const primary = draft.items[0];

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
        customerName: orderData.customerName,
        customerPhone: orderData.customerPhone,
        customerEmail: orderData.customerEmail,
        shippingAddress: orderData.shippingAddress,
        shippingCity: orderData.shippingCity,
        paymentMethod: orderData.paymentMethod,
        momoNetwork: orderData.paymentMethod === 'MOMO' ? orderData.momoNetwork : undefined,
        momoNumber: paymentReference,
        status: 'Pending',
        stockReserved: true,
        stockReleased: false,
        smsSent: false,
        ...paymentFields
      });
    } catch (error: any) {
      await reservation.reservation.rollback();
      console.error('Order persistence failed, stock restored:', error);
      return NextResponse.json(
        { error: 'We could not record your order. Please contact support with your payment reference.' },
        { status: 500 }
      );
    }

    // The sale is committed. Nothing after this point may hand the stock back.

    // 5. CONFIRMATION SMS — awaited, because a detached promise is not guaranteed
    // to finish once a serverless function has already returned its response.
    const smsSent = await notifyOrderOnce(order);

    return NextResponse.json({
      success: true,
      paid: order.paymentStatus === 'paid',
      message: 'Order placed successfully!',
      smsSent,
      order: toCustomerReceipt(order)
    });
  } catch (error: any) {
    console.error('API orders POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to place order.' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('ref');

    if (!query) {
      return NextResponse.json({ error: 'Order reference query parameter is required.' }, { status: 400 });
    }

    const cleanQuery = query.replace('#RD-', '').replace('RD-', '').trim();
    const idNum = parseInt(cleanQuery, 10);

    const { getDbOrders } = await import('@/lib/catalog-db');
    const orders = await getDbOrders();

    const order = orders.find((o) => {
      if (!isNaN(idNum) && o.id === idNum) return true;
      const reference = (o.paymentReference || o.momoNumber || '').toLowerCase();
      if (reference && reference === query.toLowerCase()) return true;
      if (reference && reference === cleanQuery.toLowerCase()) return true;
      return false;
    });

    if (!order) {
      return NextResponse.json({ error: 'No active order found with this reference.' }, { status: 404 });
    }

    const { getDbProducts } = await import('@/lib/catalog-db');
    const products = await getDbProducts();

    const FALLBACK_IMAGE =
      'https://res.cloudinary.com/dti75gff0/image/upload/v1779032145/redox_designsx/redox_hero.png';

    // Resolve a thumbnail per line so multi-product orders render correctly.
    const itemsWithImages = order.items.map((item) => {
      const product = products.find((p) => p.id === item.productId || p.slug === item.productSlug);
      return {
        ...item,
        image: product?.colorImages?.[item.color]?.[0] || product?.image || FALLBACK_IMAGE
      };
    });

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        productName: order.productName,
        selectedColor: order.selectedColor,
        selectedSize: order.selectedSize,
        items: itemsWithImages,
        totalQuantity: order.totalQuantity,
        subtotal: order.subtotal,
        serviceCharge: order.serviceCharge,
        discount: order.discount,
        price: order.price,
        customerName: order.customerName,
        status: order.status || 'Pending',
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        paymentChannel: order.paymentChannel,
        paidAt: order.paidAt,
        reference: order.paymentReference || order.momoNumber,
        createdAt: order.createdAt,
        productImage: itemsWithImages[0]?.image || FALLBACK_IMAGE
      }
    });
  } catch (error: any) {
    console.error('API orders GET status tracking error:', error);
    return NextResponse.json({ error: 'Failed to search order.' }, { status: 500 });
  }
}
