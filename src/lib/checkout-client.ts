import { loadPaystackScript } from '@/lib/paystack';
import type { OrderItem } from '@/types/product';

/**
 * Browser side of the resilient checkout.
 *
 * The ordering here is the whole point: the order is recorded on the server
 * *before* Paystack opens. Everything that happens afterwards — the callback,
 * the confirmation, even this page staying alive — is an optimisation. If the
 * connection drops at any point past `startCheckout`, the sale is already safe
 * and the server settles it via the Paystack webhook or the reconciliation
 * sweep. Nothing here can lose an order.
 */

const PENDING_KEY = 'redox_pending_checkout';
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

export interface CheckoutCustomer {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
}

export interface CheckoutLine {
  productId?: string;
  productSlug: string;
  variantId?: string;
  color: string;
  size: string;
  quantity: number;
}

export interface CheckoutSession {
  orderId: number;
  orderNumber: string;
  reference: string;
  publicKey: string;
  email: string;
  /** Minor units (pesewas). */
  amount: number;
  currency: string;
  subtotal: number;
  serviceCharge: number;
  total: number;
  totalQuantity: number;
  items: OrderItem[];
  metadata: Record<string, any>;
}

export interface PendingCheckout {
  reference: string;
  orderId: number;
  orderNumber: string;
  savedAt: number;
}

export interface ConfirmResult {
  paid: boolean;
  settled: boolean;
  outcome: 'paid' | 'failed' | 'abandoned' | 'pending' | 'mismatch' | 'unverifiable' | 'unreachable';
  message: string;
  order?: any;
}

// ----------------------------------------------------------------
// Pending-checkout breadcrumb
// ----------------------------------------------------------------

/**
 * Remembers the in-flight reference so a reload, a crash or a closed tab can
 * pick the receipt back up instead of leaving the customer wondering.
 */
export function rememberPendingCheckout(session: CheckoutSession): void {
  try {
    const pending: PendingCheckout = {
      reference: session.reference,
      orderId: session.orderId,
      orderNumber: session.orderNumber,
      savedAt: Date.now()
    };
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    /* Private browsing / storage disabled — the server still has the order. */
  }
}

export function readPendingCheckout(): PendingCheckout | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PendingCheckout;
    if (!parsed?.reference) return null;

    if (Date.now() - (parsed.savedAt || 0) > PENDING_TTL_MS) {
      forgetPendingCheckout();
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function forgetPendingCheckout(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* no-op */
  }
}

let recoveryClaimed = false;

/**
 * Hands the interrupted checkout to whichever component asks first.
 *
 * The cart drawer and the product page both offer to recover one, and React's
 * strict mode runs effects twice — without this, a single interrupted payment
 * would be confirmed several times over and could render two receipts at once.
 */
export function claimPendingCheckoutRecovery(): PendingCheckout | null {
  if (recoveryClaimed) return null;

  const pending = readPendingCheckout();
  if (!pending) return null;

  recoveryClaimed = true;
  return pending;
}

// ----------------------------------------------------------------
// Server calls
// ----------------------------------------------------------------

/** Records the order server-side and returns everything Paystack needs. */
export async function startCheckout(
  customer: CheckoutCustomer,
  lines: CheckoutLine[]
): Promise<CheckoutSession> {
  const response = await fetch('/api/checkout/initialize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: customer.fullName,
      customerPhone: customer.phone,
      customerEmail: customer.email,
      shippingAddress: customer.address,
      shippingCity: customer.city,
      items: lines
    })
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.success) {
    throw new Error(data?.error || 'We could not start your checkout. Please try again.');
  }

  return data as CheckoutSession;
}

async function requestConfirmation(reference: string): Promise<ConfirmResult> {
  try {
    const response = await fetch('/api/checkout/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference })
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        paid: false,
        settled: false,
        outcome: 'unreachable',
        message: data?.error || 'Could not reach the server.'
      };
    }

    return {
      paid: Boolean(data.paid),
      settled: Boolean(data.settled),
      outcome: data.outcome || 'pending',
      message: data.message || '',
      order: data.order
    };
  } catch {
    return {
      paid: false,
      settled: false,
      outcome: 'unreachable',
      message: 'Your connection dropped before we could confirm.'
    };
  }
}

/**
 * Backoff schedule, in ms, for confirming a payment. Spread over ~90 seconds so
 * a mobile-money authorisation that settles slowly, or a connection that comes
 * back after a brief drop, is still caught while the customer is watching.
 */
const CONFIRM_DELAYS = [0, 1_500, 3_000, 5_000, 8_000, 12_000, 20_000, 30_000];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Confirms a payment, retrying while the answer is still "not yet".
 *
 * Giving up here is not a failure state — it only means the browser could not
 * get the good news in time. The order is on the server either way.
 */
export async function confirmPayment(
  reference: string,
  onAttempt?: (attempt: number, total: number) => void,
  maxAttempts = CONFIRM_DELAYS.length
): Promise<ConfirmResult> {
  const attempts = Math.min(Math.max(maxAttempts, 1), CONFIRM_DELAYS.length);

  let last: ConfirmResult = {
    paid: false,
    settled: false,
    outcome: 'unreachable',
    message: 'Confirmation has not completed yet.'
  };

  for (let index = 0; index < attempts; index += 1) {
    if (CONFIRM_DELAYS[index] > 0) await sleep(CONFIRM_DELAYS[index]);
    onAttempt?.(index + 1, attempts);

    last = await requestConfirmation(reference);

    // Paid, declined or abandoned are all final answers — stop asking.
    if (last.paid || last.settled) return last;
  }

  return last;
}

/** Tells the server the customer closed the payment window. Best effort. */
export function reportCheckoutClosed(reference: string): void {
  const body = JSON.stringify({ reference });

  try {
    // `keepalive` lets the request survive the page being navigated or closed.
    void fetch('/api/checkout/abandon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true
    }).catch(() => undefined);
  } catch {
    /* The reconciliation sweep tidies this up regardless. */
  }
}

// ----------------------------------------------------------------
// Gateway
// ----------------------------------------------------------------

export interface RunCheckoutHandlers {
  /** Paystack reported success; the reference is ready to confirm. */
  onPaid: (reference: string) => void;
  /** The customer closed the window without completing payment. */
  onCancelled: (reference: string) => void;
  /** The gateway could not be opened at all. */
  onError: (message: string) => void;
  /** The customer is being sent to Paystack's hosted page. */
  onRedirect?: () => void;
}

/**
 * Opens Paystack for an already-recorded order.
 *
 * The reference and amount both come from the server session, so the gateway is
 * driven by figures the browser cannot alter — and the full purchase metadata
 * rides along, which is what puts the items, sizes, delivery address and fee
 * breakdown onto the Paystack receipt and dashboard.
 */
export async function runPaystackCheckout(
  session: CheckoutSession,
  customer: CheckoutCustomer,
  handlers: RunCheckoutHandlers
): Promise<void> {
  rememberPendingCheckout(session);

  const paystack = await loadPaystackScript();

  // No inline script (ad-blocker, firewall, locked-down browser): send the
  // customer to Paystack's own page rather than dead-ending the checkout.
  if (!paystack || typeof paystack.setup !== 'function') {
    await redirectToHostedCheckout(session, handlers);
    return;
  }

  let settled = false;

  try {
    const handler = paystack.setup({
      key: session.publicKey,
      // Paystack's inline v1 reads `ref` — a `reference` key is silently ignored,
      // which would let the gateway mint its own reference and detach the
      // transaction from the order we just saved.
      ref: session.reference,
      email: session.email,
      amount: session.amount,
      currency: session.currency,
      firstname: customer.fullName,
      phone: customer.phone,
      metadata: session.metadata,
      callback: (response: any) => {
        settled = true;
        handlers.onPaid(response?.reference || session.reference);
      },
      onClose: () => {
        if (settled) return;
        settled = true;
        handlers.onCancelled(session.reference);
      }
    });

    handler.openIframe();
  } catch (error: any) {
    console.error('Paystack inline checkout failed to open:', error);
    await redirectToHostedCheckout(session, handlers);
  }
}

async function redirectToHostedCheckout(
  session: CheckoutSession,
  handlers: RunCheckoutHandlers
): Promise<void> {
  try {
    const response = await fetch('/api/checkout/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference: session.reference })
    });

    const data = await response.json().catch(() => null);

    if (response.ok && data?.alreadyPaid) {
      handlers.onPaid(session.reference);
      return;
    }

    if (response.ok && data?.authorizationUrl) {
      handlers.onRedirect?.();
      window.location.href = data.authorizationUrl;
      return;
    }

    handlers.onError(
      data?.error ||
        'Could not open the secure payment window. Please disable any ad-blocker and try again.'
    );
  } catch {
    handlers.onError(
      'Could not open the secure payment window. Please check your connection and try again.'
    );
  }
}
