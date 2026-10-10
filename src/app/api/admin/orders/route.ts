import { NextResponse } from 'next/server';
import {
  claimDbOrderShippedSms,
  deleteDbOrder,
  editDbInPersonOrder,
  getDbOrderById,
  getDbOrders,
  markDbOrderPaid,
  markDbOrderRefunded,
  revertDbOrderToUnpaid,
  releaseDbOrderShippedSmsClaim,
  setDbOrderStatus,
  updateDbOrderSmsDetails
} from '@/lib/catalog-db';
import { requireAdminSession } from '@/lib/admin-auth';
import { summariseOrderPayments as summarise } from '@/lib/order-receipt';
import {
  notifyOrderOnce,
  reconcilePendingPayments,
  resendOrderSms,
  settleOrderPayment
} from '@/lib/payment-service';
import { ORDER_STATUSES } from '@/types/product';
import { formatGhanaPhone, isValidGhanaPhone } from '@/lib/phone';
import { sendShippedSms } from '@/lib/sms';
import { priceOrderDraft } from '@/lib/order-pricing';
import { adminOrderSchema, resolveDiscount, sumOrderExtras } from '@/lib/order-schema';

export const dynamic = 'force-dynamic';

const allowedOrderStatuses = new Set<string>(ORDER_STATUSES);

export async function GET() {
  const authError = await requireAdminSession();
  if (authError) return authError;

  try {
    const orders = await getDbOrders();
    return NextResponse.json({ success: true, orders, summary: summarise(orders) });
  } catch (error: any) {
    console.error('API admin orders GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch customer orders.' },
      { status: 500 }
    );
  }
}

/**
 * Order actions.
 *
 * `action` is optional so the original `{ orderId, status }` body keeps working.
 * The payment actions are what let the merchant settle anything the automatic
 * paths could not: re-ask Paystack, confirm an offline payment by hand, or undo
 * a mistake.
 */
export async function POST(request: Request) {
  const authError = await requireAdminSession();
  if (authError) return authError;

  try {
    const body = await request.json().catch(() => null);
    const action = String(body?.action || 'updateStatus');

    // ── Bulk reconciliation ───────────────────────────────────────
    if (action === 'reconcile') {
      const summary = await reconcilePendingPayments({
        limit: Number(body?.limit) || 50,
        // An admin pressing the button wants every pending order looked at now,
        // not only the ones past the automatic sweep's age threshold.
        minAgeSeconds: 0,
        source: 'admin'
      });

      const orders = await getDbOrders();
      return NextResponse.json({
        success: true,
        message:
          `Checked ${summary.checked} pending order(s): ${summary.rescued} newly confirmed as paid, ` +
          `${summary.abandoned} abandoned, ${summary.failed} declined, ${summary.pending} still processing.`,
        reconciliation: summary,
        orders,
        summary: summarise(orders)
      });
    }

    const orderId = Number(body?.orderId);
    if (!Number.isFinite(orderId) || orderId <= 0) {
      return NextResponse.json({ error: 'A valid orderId is required.' }, { status: 400 });
    }

    const order = await getDbOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: 'That order no longer exists.' }, { status: 404 });
    }

    if (action === 'editOrder') {
      if (order.source !== 'admin') {
        return NextResponse.json({ error: 'Only in-person orders can be edited here.' }, { status: 400 });
      }
      const parsed = adminOrderSchema.safeParse(body);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return NextResponse.json({ error: `${issue.path.join('.')}: ${issue.message}` }, { status: 400 });
      }
      const input = parsed.data;
      const pricing = await priceOrderDraft(input.items, {
        applyServiceCharge: false,
        // Existing paid units may already have brought the catalogue count to zero.
        // The database edit transaction checks only the additional units needed.
        allowOutOfStock: true
      });
      if (!pricing.ok) {
        return NextResponse.json({ error: pricing.error }, { status: pricing.status });
      }
      const draft = pricing.draft;
      const extras = (input.extras || []).map((extra) => ({
        label: extra.label.trim(), amount: Math.round(extra.amount * 100) / 100
      }));
      const bill = Math.round((draft.subtotal + sumOrderExtras(extras)) * 100) / 100;
      const discount = resolveDiscount(bill, input.discountType, input.discountValue);
      const primary = draft.items[0];
      const updated = await editDbInPersonOrder(orderId, {
        productId: primary.productId,
        productName: primary.productName,
        productSlug: primary.productSlug,
        selectedColor: draft.summaryColor,
        selectedSize: draft.summarySize,
        items: draft.items,
        totalQuantity: draft.totalQuantity,
        subtotal: draft.subtotal,
        extras,
        discount,
        price: Math.round((bill - discount) * 100) / 100,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail || order.customerEmail,
        shippingAddress: input.shippingAddress || order.shippingAddress,
        shippingCity: input.shippingCity || order.shippingCity,
        paymentNote: input.note || order.paymentNote
      }, input.allowOutOfStock === true);
      return NextResponse.json({ success: true, order: updated, message: `Order #RD-${orderId} updated.` });
    }

    // ── Ask Paystack again for this one order ─────────────────────
    if (action === 'verifyPayment') {
      const result = await settleOrderPayment(order, {
        source: 'admin',
        // Verifying from the panel must never silently return stock to sale.
        allowStockRelease: false
      });

      return NextResponse.json({
        success: true,
        outcome: result.outcome,
        changed: result.transitioned,
        message: result.message,
        order: result.order
      });
    }

    // ── Confirm an offline payment (cash, bank transfer, direct MoMo) ──
    if (action === 'markPaid') {
      const note = String(body?.note || '').trim().slice(0, 400) || 'Confirmed manually by an admin.';
      const amount = Number(body?.amountPaid);

      const transition = await markDbOrderPaid(orderId, {
        amountPaid: Number.isFinite(amount) && amount > 0 ? amount : order.price,
        paidAt: new Date().toISOString(),
        channel: String(body?.channel || 'manual'),
        note,
        source: 'admin'
      });

      let smsSent = false;
      if (transition.transitioned && transition.order && body?.notifyCustomer !== false) {
        smsSent = await notifyOrderOnce(transition.order);
      }

      return NextResponse.json({
        success: true,
        changed: transition.transitioned,
        smsSent,
        message: transition.transitioned
          ? `Order #RD-${orderId} marked as paid.`
          : 'That order was already marked as paid.',
        order: transition.order
      });
    }

    // ── Undo a manual confirmation ────────────────────────────────
    if (action === 'markUnpaid') {
      const note = String(body?.note || '').trim().slice(0, 400) || 'Reverted to unpaid by an admin.';
      const transition = await revertDbOrderToUnpaid(orderId, note);

      return NextResponse.json({
        success: true,
        changed: transition.transitioned,
        message: transition.transitioned
          ? `Order #RD-${orderId} is marked unpaid again.`
          : 'That order was already unpaid.',
        order: transition.order
      });
    }

    if (action === 'markRefunded') {
      const note = String(body?.note || '').trim().slice(0, 400) || 'Refunded by an admin.';
      const transition = await markDbOrderRefunded(orderId, note);

      return NextResponse.json({
        success: true,
        changed: transition.transitioned,
        message: transition.transitioned
          ? `Order #RD-${orderId} marked as refunded.`
          : 'That order was already refunded.',
        order: transition.order
      });
    }

    // ── Send the confirmation text again ──────────────────────────
    if (action === 'resendSms' || action === 'updateSms') {
      if (action === 'updateSms' && order.source !== 'admin') {
        return NextResponse.json({ error: 'SMS contact editing is available for in-person orders.' }, { status: 400 });
      }
      const sendNow = action === 'resendSms' || body?.sendSms === true;
      const phone = action === 'updateSms' ? String(body?.customerPhone || '').trim() : order.customerPhone;
      if (phone.length < 8 || phone.length > 100) {
        return NextResponse.json({ error: 'Enter a phone number with at least 8 characters.' }, { status: 400 });
      }
      if (sendNow && !isValidGhanaPhone(formatGhanaPhone(phone))) {
        return NextResponse.json({ error: 'Enter a valid Ghanaian phone number before sending SMS.' }, { status: 400 });
      }
      // The message reads "Order confirmed!". Sending that to someone whose
      // payment failed, or who walked away from checkout, would be false — and
      // it is billable. Guarded here as well as in the UI.
      const confirmable = order.paymentStatus === 'paid' || order.source === 'admin';

      if (sendNow && !confirmable) {
        return NextResponse.json(
          {
            error:
              `Order #RD-${orderId} has not been paid for, so a confirmation text would be misleading. ` +
              'Confirm the payment first, then send it.'
          },
          { status: 400 }
        );
      }

      const saved = await updateDbOrderSmsDetails(orderId, phone, sendNow);
      if (!saved) return NextResponse.json({ error: 'That order no longer exists.' }, { status: 404 });
      if (!sendNow) {
        return NextResponse.json({
          success: true,
          smsSent: saved.smsSent,
          message: saved.smsSent ? 'Phone number saved.' : 'Phone number saved. SMS is set for later.',
          order: saved
        });
      }

      const result = saved.smsSent ? await resendOrderSms(saved) : null;
      const smsSent = result ? result.sent : await notifyOrderOnce(saved);
      return NextResponse.json({
        success: true,
        smsSent,
        recipients: result?.recipients,
        message: smsSent
          ? `Confirmation SMS sent to ${formatGhanaPhone(phone)}.`
          : 'The number was saved, but the SMS was not delivered. Check the SMS gateway and try again.',
        order: await getDbOrderById(orderId)
      });
    }

    // ── Fulfilment status ─────────────────────────────────────────
    if (action === 'updateStatus') {
      const status = String(body?.status || '');

      if (!status) {
        return NextResponse.json({ error: 'orderId and status are required.' }, { status: 400 });
      }

      if (!allowedOrderStatuses.has(status)) {
        return NextResponse.json({ error: 'Unsupported order status.' }, { status: 400 });
      }

      const updated = await setDbOrderStatus(orderId, status);

      let shippedSmsSent: boolean | undefined;
      let shippedSmsReason: string | undefined;
      if (status === 'Shipped' && updated && !updated.shippedSmsSent) {
        const claimed = await claimDbOrderShippedSms(orderId);
        if (claimed) {
          try {
            const result = await sendShippedSms(updated);
            shippedSmsSent = result.sent;
            shippedSmsReason = result.reason;
            if (!result.sent) await releaseDbOrderShippedSmsClaim(orderId);
          } catch (error) {
            console.error(`[orders] Shipping SMS failed for #RD-${orderId}:`, error);
            shippedSmsSent = false;
            shippedSmsReason = 'send_failed';
            await releaseDbOrderShippedSmsClaim(orderId);
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: shippedSmsSent === false
          ? shippedSmsReason === 'not_configured'
            ? 'Order marked as shipped, but Hubtel SMS credentials are not configured. Add them, then retry the shipping SMS.'
            : shippedSmsReason === 'customer_phone_invalid'
              ? 'Order marked as shipped, but the customer phone number is invalid. Correct it, then retry the shipping SMS.'
              : 'Order marked as shipped, but the shipping SMS was not accepted. Check the SMS gateway and retry.'
          : shippedSmsSent === true
            ? 'Order marked as shipped. Shipping SMS accepted by the gateway.'
            : 'Order status updated successfully.',
        shippedSmsSent,
        shippedSmsReason,
        order: shippedSmsSent === undefined ? updated : await getDbOrderById(orderId)
      });
    }

    return NextResponse.json({ error: `Unknown action "${action}".` }, { status: 400 });
  } catch (error: any) {
    console.error('API admin orders POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update this order.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const authError = await requireAdminSession();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required.' }, { status: 400 });
    }

    // Deleting a paid order destroys the only record of a real payment, so it
    // has to be asked for explicitly.
    const existing = await getDbOrderById(Number(orderId));
    if (existing?.paymentStatus === 'paid' && searchParams.get('force') !== 'true') {
      return NextResponse.json(
        {
          error:
            'This order has been paid for. Deleting it removes the payment record — ' +
            'confirm again to proceed.',
          requiresForce: true
        },
        { status: 409 }
      );
    }

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
