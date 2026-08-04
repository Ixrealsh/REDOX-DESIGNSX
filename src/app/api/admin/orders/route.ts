import { NextResponse } from 'next/server';
import {
  deleteDbOrder,
  getDbOrderById,
  getDbOrders,
  markDbOrderPaid,
  markDbOrderRefunded,
  revertDbOrderToUnpaid,
  setDbOrderStatus
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

export const dynamic = 'force-dynamic';

const allowedOrderStatuses = new Set<string>(ORDER_STATUSES);

export async function GET() {
  const authError = requireAdminSession();
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
  const authError = requireAdminSession();
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
    if (action === 'resendSms') {
      // The message reads "Order confirmed!". Sending that to someone whose
      // payment failed, or who walked away from checkout, would be false — and
      // it is billable. Guarded here as well as in the UI.
      const confirmable = order.paymentStatus === 'paid' || order.source === 'admin';

      if (!confirmable) {
        return NextResponse.json(
          {
            error:
              `Order #RD-${orderId} has not been paid for, so a confirmation text would be misleading. ` +
              'Confirm the payment first, then send it.'
          },
          { status: 400 }
        );
      }

      const result = await resendOrderSms(order);

      const reasons: Record<string, string> = {
        not_configured: 'SMS is not configured on the server (check the Hubtel credentials).',
        no_valid_recipients: `"${order.customerPhone}" is not a valid Ghanaian number, so no text could be sent.`,
        customer_phone_invalid: `"${order.customerPhone}" is not a valid Ghanaian number, so no text could be sent.`,
        timeout: 'The SMS gateway did not respond in time. Try again in a moment.',
        network_error: 'Could not reach the SMS gateway. Try again in a moment.'
      };

      return NextResponse.json({
        success: true,
        smsSent: result.sent,
        recipients: result.recipients,
        message: result.sent
          ? `Confirmation re-sent to ${result.recipients.join(', ')}.`
          : reasons[result.reason || ''] || 'The confirmation text could not be delivered.',
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

      return NextResponse.json({
        success: true,
        message: 'Order status updated successfully!',
        order: updated
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
  const authError = requireAdminSession();
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
