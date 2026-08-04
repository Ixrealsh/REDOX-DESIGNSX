import {
  annotateDbOrderPayment,
  claimDbOrderSms,
  claimDbOrderStockRelease,
  getDbOrderById,
  listDbOrdersAwaitingPayment,
  listDbOrdersMissingSms,
  markDbOrderPaid,
  markDbOrderUnsuccessful,
  reclaimDbOrderStockReservation,
  releaseDbOrderSmsClaim,
  touchDbOrderVerification,
  unclaimDbOrderStockRelease
} from '@/lib/catalog-db';
import { releaseOrderStock, reserveStockForDraft } from '@/lib/order-pricing';
import { adjudicatePayment, verifyPaystackTransaction } from '@/lib/paystack-server';
import { sendOrderSms, type SmsResult } from '@/lib/sms';
import type { Order, PaymentVerificationSource } from '@/types/product';

/**
 * The one function that decides whether an order has been paid for.
 *
 * Four independent callers reach it — the browser callback, the Paystack
 * webhook, the reconciliation sweep and the admin panel — and all four ask
 * Paystack directly rather than believing whatever they were handed. That is
 * what makes a dropped connection after payment survivable: the order row
 * already exists, and any one of the four is enough to settle it.
 */

/**
 * Grace period before an unsettled order's stock goes back on sale. Mobile-money
 * authorisations in Ghana routinely take several minutes (the customer has to
 * leave the page, approve a USSD prompt, and come back), so releasing early
 * would cancel real, in-flight purchases.
 */
export const STOCK_RELEASE_GRACE_SECONDS = 30 * 60;

/** How long after creation the sweep starts checking on an order. */
export const SWEEP_MIN_AGE_SECONDS = 5 * 60;

export type SettlementOutcome =
  /** Money confirmed and the order is now live. */
  | 'paid'
  /** Paystack declined the charge. */
  | 'failed'
  /** The customer never completed (or never started) the charge. */
  | 'abandoned'
  /** Paystack is still processing — check again shortly. */
  | 'pending'
  /** Money moved, but not for this order's amount or currency. Needs a human. */
  | 'mismatch'
  /** We could not reach Paystack. Nothing was changed. */
  | 'unverifiable';

export interface SettlementResult {
  outcome: SettlementOutcome;
  /** True when this call is the one that changed the order's payment state. */
  transitioned: boolean;
  order: Order;
  message: string;
  /** Present when this call also released the reservation back to inventory. */
  stockReleased?: boolean;
  /** Present when this call sent the confirmation SMS. */
  smsSent?: boolean;
}

export interface SettleOptions {
  source: PaymentVerificationSource;
  /**
   * Set false to leave inventory reserved no matter the verdict — used by the
   * customer-facing paths, where a "not paid yet" answer is often just a slow
   * mobile-money confirmation.
   */
  allowStockRelease?: boolean;
  /** Overrides the default grace period before stock is handed back. */
  releaseGraceSeconds?: number;
  /** Skips the SMS (the caller has already notified, or is a dry run). */
  skipSms?: boolean;
}

function ageSeconds(order: Order): number {
  const created = new Date(order.createdAt).getTime();
  if (Number.isNaN(created)) return Number.POSITIVE_INFINITY;
  return (Date.now() - created) / 1000;
}

/**
 * Hands an unpaid order's reservation back to inventory, exactly once.
 * A partial failure keeps the claim held on purpose — retrying would credit the
 * slugs that already succeeded a second time.
 */
async function releaseReservationOnce(order: Order): Promise<boolean> {
  const claimed = await claimDbOrderStockRelease(order.id);
  if (!claimed) return false;

  const report = await releaseOrderStock(claimed);

  if (report.failed.length > 0) {
    if (report.restored.length === 0) {
      // Nothing was credited, so it is safe to let a later run try again.
      await unclaimDbOrderStockRelease(order.id);
      return false;
    }
    console.error(
      `[payments] Order #${order.id}: stock released for ${report.restored.join(', ')} but NOT for ` +
        `${report.failed.join(', ')}. Adjust those variants by hand in the admin panel.`
    );
  }

  return report.restored.length > 0;
}

/**
 * A payment can land after we already handed the reservation back — a customer
 * closes the popup, we release the units, and their mobile-money authorisation
 * completes a minute later. Take the stock out again and leave a note on the
 * order so the merchant knows the sequence was unusual.
 */
async function restockAfterLatePayment(order: Order): Promise<void> {
  const lines = order.items
    .filter((item) => item.productSlug)
    .map((item) => ({
      productSlug: item.productSlug,
      color: item.color,
      size: item.size,
      quantity: item.quantity
    }));

  if (lines.length === 0) return;

  const draft = {
    items: order.items,
    lines,
    uniqueSlugs: Array.from(new Set(lines.map((line) => line.productSlug))),
    subtotal: order.subtotal,
    serviceCharge: order.serviceCharge,
    grandTotal: order.price,
    totalQuantity: order.totalQuantity,
    summaryColor: order.selectedColor,
    summarySize: order.selectedSize
  };

  const result = await reserveStockForDraft(draft);

  if (result.ok) {
    await reclaimDbOrderStockReservation(order.id);
    console.warn(`[payments] Order #${order.id} paid late; its released stock was taken back out.`);
    return;
  }

  console.error(
    `[payments] Order #${order.id} was paid after its stock had been released, and the units could ` +
      `not be re-reserved (${result.error}). Check inventory for this order by hand.`
  );
  await annotateDbOrderPayment(
    order.id,
    'Paid after the reservation was released — inventory could not be re-reserved automatically. Please verify stock.'
  );
}

/** Sends the confirmation SMS once per order, freeing the claim if it fails. */
export async function notifyOrderOnce(order: Order): Promise<boolean> {
  const claimed = await claimDbOrderSms(order.id);
  if (!claimed) return false;

  try {
    const result = await sendOrderSms(order);
    if (!result.sent) {
      console.error(`[payments] Order #RD-${order.id} is paid but the SMS failed (${result.reason}).`);
      await releaseDbOrderSmsClaim(order.id);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[payments] Order #RD-${order.id} SMS threw:`, error);
    await releaseDbOrderSmsClaim(order.id);
    return false;
  }
}

/**
 * Sends an order's confirmation again, on purpose, ignoring the once-only claim.
 *
 * The claim exists to stop the automatic paths from texting a customer twice; a
 * merchant pressing "Resend" has decided the first attempt did not arrive, so it
 * is deliberately bypassed. The claim is then left in the state that matches
 * reality, which keeps the reconciliation sweep's retry pass correct: held on
 * success, free again on failure.
 */
export async function resendOrderSms(order: Order): Promise<SmsResult> {
  try {
    const result = await sendOrderSms(order);

    if (result.sent) {
      await claimDbOrderSms(order.id);
    } else {
      await releaseDbOrderSmsClaim(order.id);
    }

    return result;
  } catch (error) {
    console.error(`[payments] Manual SMS resend for order #RD-${order.id} threw:`, error);
    await releaseDbOrderSmsClaim(order.id);
    return { sent: false, recipients: [], deliveries: [], reason: 'send_failed' };
  }
}

/**
 * Verifies one order against Paystack and moves it to its true state.
 * Safe to call repeatedly and concurrently.
 */
export async function settleOrderPayment(
  order: Order,
  options: SettleOptions
): Promise<SettlementResult> {
  const allowStockRelease = options.allowStockRelease !== false;
  const graceSeconds = options.releaseGraceSeconds ?? STOCK_RELEASE_GRACE_SECONDS;

  // Already settled: report it and stop. Never re-verify a paid order into a
  // different state, and never charge the customer's inventory a second time.
  if (order.paymentStatus === 'paid') {
    return {
      outcome: 'paid',
      transitioned: false,
      order,
      message: 'Payment was already confirmed for this order.'
    };
  }

  if (order.paymentStatus === 'refunded') {
    return {
      outcome: 'failed',
      transitioned: false,
      order,
      message: 'This order was refunded.'
    };
  }

  const reference = order.paymentReference || order.momoNumber;
  if (!reference) {
    return {
      outcome: 'unverifiable',
      transitioned: false,
      order,
      message: 'This order has no payment reference to verify.'
    };
  }

  const verification = await verifyPaystackTransaction(reference);

  if (!verification.ok) {
    // "Paystack has never seen this reference" is a definitive answer: the
    // customer closed checkout before the charge was ever created.
    if (verification.reason === 'transaction_not_found') {
      const transition = await markDbOrderUnsuccessful(order.id, {
        status: 'abandoned',
        gatewayResponse: 'No transaction was ever started for this reference.',
        source: options.source
      });

      const current = transition.order || order;
      let stockReleased = false;
      if (allowStockRelease && ageSeconds(current) >= graceSeconds) {
        stockReleased = await releaseReservationOnce(current);
      }

      return {
        outcome: 'abandoned',
        transitioned: transition.transitioned,
        order: (await getDbOrderById(order.id)) || current,
        message: 'Checkout was never completed — no payment was started.',
        stockReleased
      };
    }

    // Anything else means we could not get an answer. Change nothing: the money
    // may well be there, and guessing is how orders get lost.
    await touchDbOrderVerification(order.id);
    return {
      outcome: 'unverifiable',
      transitioned: false,
      order,
      message:
        verification.reason === 'gateway_not_configured'
          ? 'The Paystack secret key is not configured on the server.'
          : 'Paystack could not be reached. The order is untouched — try verifying again shortly.'
    };
  }

  const verdict = adjudicatePayment(verification.transaction, order.price);

  if (verdict.outcome === 'paid') {
    const transition = await markDbOrderPaid(order.id, {
      amountPaid: verdict.amountPaid,
      paidAt: verdict.paidAt,
      channel: verdict.channel,
      transactionId: verdict.transactionId,
      gatewayResponse: verdict.gatewayResponse,
      source: options.source
    });

    const current = transition.order || order;

    // Money arrived after we had already put the units back on sale.
    if (transition.transitioned && order.stockReleased) {
      await restockAfterLatePayment(current);
    }

    let smsSent: boolean | undefined;

    if (!options.skipSms) {
      smsSent = await notifyOrderOnce(current);
    }

    return {
      outcome: 'paid',
      transitioned: transition.transitioned,
      order: current,
      message: transition.transitioned
        ? `Payment of GH₵${verdict.amountPaid.toFixed(2)} confirmed via ${verdict.channel || 'Paystack'}.`
        : 'Payment was already confirmed for this order.',
      smsSent
    };
  }

  if (verdict.outcome === 'mismatch') {
    // Money moved but it does not match this order. Leave it unpaid and leave
    // the stock reserved — this needs a person, not an automatic decision.
    await touchDbOrderVerification(order.id, verdict.reason);
    console.error(`[payments] Order #${order.id} amount/currency mismatch: ${verdict.reason}`);
    return {
      outcome: 'mismatch',
      transitioned: false,
      order: (await getDbOrderById(order.id)) || order,
      message: `Payment mismatch — needs review. ${verdict.reason}`
    };
  }

  if (verdict.outcome === 'pending') {
    await touchDbOrderVerification(order.id, verdict.reason);
    return {
      outcome: 'pending',
      transitioned: false,
      order,
      message: 'Paystack has not finalised this payment yet. It will be confirmed automatically.'
    };
  }

  // failed | abandoned
  const transition = await markDbOrderUnsuccessful(order.id, {
    status: verdict.outcome,
    gatewayResponse: verdict.outcome === 'failed' ? verdict.gatewayResponse || verdict.reason : verdict.reason,
    source: options.source
  });

  const current = transition.order || order;
  let stockReleased = false;
  if (allowStockRelease && ageSeconds(current) >= graceSeconds) {
    stockReleased = await releaseReservationOnce(current);
  }

  return {
    outcome: verdict.outcome,
    transitioned: transition.transitioned,
    order: (await getDbOrderById(order.id)) || current,
    message:
      verdict.outcome === 'failed'
        ? `Paystack declined this payment: ${verdict.reason}`
        : 'Checkout was abandoned before payment completed.',
    stockReleased
  };
}

// ----------------------------------------------------------------
// Reconciliation sweep
// ----------------------------------------------------------------

export interface ReconcileSummary {
  checked: number;
  rescued: number;
  failed: number;
  abandoned: number;
  pending: number;
  mismatched: number;
  unverifiable: number;
  smsResent: number;
  stockReleased: number;
}

export interface ReconcileOptions {
  limit?: number;
  minAgeSeconds?: number;
  releaseGraceSeconds?: number;
  source?: PaymentVerificationSource;
}

/**
 * The safety net. Walks every card order still waiting on money and settles it
 * against Paystack — rescuing payments whose browser callback *and* webhook
 * both failed to land, and returning genuinely abandoned reservations to stock.
 *
 * Also retries confirmation texts for orders that were paid but never notified.
 */
export async function reconcilePendingPayments(
  options: ReconcileOptions = {}
): Promise<ReconcileSummary> {
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
  const minAgeSeconds = options.minAgeSeconds ?? SWEEP_MIN_AGE_SECONDS;
  const source = options.source ?? 'sweep';

  const summary: ReconcileSummary = {
    checked: 0,
    rescued: 0,
    failed: 0,
    abandoned: 0,
    pending: 0,
    mismatched: 0,
    unverifiable: 0,
    smsResent: 0,
    stockReleased: 0
  };

  const pendingOrders = await listDbOrdersAwaitingPayment({ minAgeSeconds, limit });

  for (const order of pendingOrders) {
    summary.checked += 1;

    try {
      const result = await settleOrderPayment(order, {
        source,
        allowStockRelease: true,
        releaseGraceSeconds: options.releaseGraceSeconds
      });

      if (result.stockReleased) summary.stockReleased += 1;

      switch (result.outcome) {
        case 'paid':
          if (result.transitioned) summary.rescued += 1;
          if (result.smsSent) summary.smsResent += 1;
          break;
        case 'failed':
          summary.failed += 1;
          break;
        case 'abandoned':
          summary.abandoned += 1;
          break;
        case 'pending':
          summary.pending += 1;
          break;
        case 'mismatch':
          summary.mismatched += 1;
          break;
        default:
          summary.unverifiable += 1;
      }
    } catch (error) {
      summary.unverifiable += 1;
      console.error(`[payments] Reconciliation failed for order #${order.id}:`, error);
    }
  }

  // Paid orders whose SMS never went out get another attempt here.
  const missingSms = await listDbOrdersMissingSms(limit);
  for (const order of missingSms) {
    try {
      if (await notifyOrderOnce(order)) summary.smsResent += 1;
    } catch (error) {
      console.error(`[payments] SMS retry failed for order #${order.id}:`, error);
    }
  }

  if (summary.checked > 0 || summary.smsResent > 0) {
    console.log(
      `[payments] Reconciled ${summary.checked} order(s): ${summary.rescued} rescued, ` +
        `${summary.abandoned} abandoned, ${summary.failed} failed, ${summary.pending} still pending, ` +
        `${summary.mismatched} mismatched, ${summary.unverifiable} unverifiable, ` +
        `${summary.stockReleased} stock release(s), ${summary.smsResent} SMS re-sent.`
    );
  }

  return summary;
}
