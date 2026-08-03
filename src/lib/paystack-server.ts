import crypto from 'crypto';
import type { Order, OrderItem } from '@/types/product';

/**
 * Server-side Paystack gateway client.
 *
 * Every decision about whether money actually moved is taken here, from an
 * outbound authenticated call to `GET /transaction/verify/:reference`. Nothing
 * a browser (or an unsigned webhook body) claims is ever trusted on its own.
 */

const PAYSTACK_API = 'https://api.paystack.co';
const REQUEST_TIMEOUT_MS = 12_000;
const VERIFY_ATTEMPTS = 3;

/** Placeholder values shipped in `.env.example` — treated as "not configured". */
const PLACEHOLDER_SECRETS = new Set(['', 'your_paystack_secret_key_here', 'undefined', 'null']);

export function getPaystackSecret(): string | null {
  const secret = (process.env.PAYSTACK_SECRET_KEY || '').trim();
  if (PLACEHOLDER_SECRETS.has(secret)) return null;
  return secret;
}

export function isPaystackConfigured(): boolean {
  return getPaystackSecret() !== null;
}

export function getPaystackPublicKey(): string | null {
  const key = (process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '').trim();
  if (!key || key === 'your_paystack_public_key_here') return null;
  return key;
}

// ----------------------------------------------------------------
// Reference generation
// ----------------------------------------------------------------

/**
 * Paystack accepts alphanumerics plus `-`, `.` and `=` in a reference. The
 * order id is embedded so the merchant can read the Paystack dashboard and know
 * which order a transaction belongs to without any lookup.
 */
export function buildPaymentReference(orderId?: number): string {
  const entropy = crypto.randomBytes(4).toString('hex').toUpperCase();
  if (typeof orderId === 'number' && Number.isFinite(orderId)) {
    return `RDX-${orderId}-${entropy}`;
  }
  return `RDX-T${Date.now().toString(36).toUpperCase()}-${entropy}`;
}

// ----------------------------------------------------------------
// Transaction shapes
// ----------------------------------------------------------------

export interface PaystackTransaction {
  id?: number | string;
  /** success | failed | abandoned | reversed | ongoing | pending | queued */
  status?: string;
  reference?: string;
  /** Minor units (pesewas). */
  amount?: number;
  currency?: string;
  paid_at?: string | null;
  paidAt?: string | null;
  created_at?: string | null;
  channel?: string;
  gateway_response?: string;
  metadata?: any;
  customer?: { email?: string };
  authorization?: Record<string, any>;
}

export type PaystackVerifyResult =
  | { ok: true; transaction: PaystackTransaction }
  /**
   * `retryable` separates "Paystack could not be reached" (never touch the
   * order — the money may well be there) from "Paystack answered, and there is
   * no such transaction" (safe to treat as abandoned).
   */
  | { ok: false; retryable: boolean; reason: string; detail?: string };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function paystackFetch(
  path: string,
  init: RequestInit & { secret: string }
): Promise<{ ok: true; status: number; body: any } | { ok: false; retryable: boolean; reason: string }> {
  const { secret, ...rest } = init;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${PAYSTACK_API}${path}`, {
      ...rest,
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(rest.headers || {})
      },
      signal: abort.signal,
      cache: 'no-store'
    });

    const body = await response.json().catch(() => null);

    if (response.ok) {
      return { ok: true, status: response.status, body };
    }

    // 404 is a definitive answer: Paystack has never seen this reference.
    if (response.status === 404) {
      return { ok: false, retryable: false, reason: 'transaction_not_found' };
    }

    // 401/403 mean our key is wrong — retrying will not help, but this must never
    // be read as "the customer did not pay".
    if (response.status === 401 || response.status === 403) {
      console.error('[Paystack] Rejected our secret key. Check PAYSTACK_SECRET_KEY.');
      return { ok: false, retryable: true, reason: 'gateway_auth_failed' };
    }

    return {
      ok: false,
      retryable: response.status === 429 || response.status >= 500,
      reason: `gateway_http_${response.status}`
    };
  } catch (error: any) {
    return {
      ok: false,
      retryable: true,
      reason: error?.name === 'AbortError' ? 'gateway_timeout' : 'gateway_unreachable'
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Verifies a transaction, retrying transient failures with a short backoff.
 * A non-retryable answer is returned immediately.
 */
export async function verifyPaystackTransaction(reference: string): Promise<PaystackVerifyResult> {
  const secret = getPaystackSecret();
  if (!secret) {
    return { ok: false, retryable: true, reason: 'gateway_not_configured' };
  }
  if (!reference) {
    return { ok: false, retryable: false, reason: 'missing_reference' };
  }

  let last: PaystackVerifyResult = { ok: false, retryable: true, reason: 'gateway_unreachable' };

  for (let attempt = 1; attempt <= VERIFY_ATTEMPTS; attempt += 1) {
    const result = await paystackFetch(`/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      secret
    });

    if (result.ok) {
      const payload = result.body;
      if (!payload || payload.status !== true || !payload.data) {
        return { ok: false, retryable: false, reason: 'transaction_not_found' };
      }
      return { ok: true, transaction: payload.data as PaystackTransaction };
    }

    last = { ok: false, retryable: result.retryable, reason: result.reason };
    if (!result.retryable) return last;

    if (attempt < VERIFY_ATTEMPTS) await sleep(400 * attempt);
  }

  return last;
}

export interface InitializeTransactionInput {
  email: string;
  /** Minor units (pesewas). */
  amountPesewas: number;
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, any>;
}

export type PaystackInitializeResult =
  | { ok: true; authorizationUrl: string; accessCode: string; reference: string }
  | { ok: false; reason: string; duplicateReference?: boolean };

/**
 * Registers a transaction with Paystack up front. Used for the hosted-checkout
 * fallback (popup blocked / inline script unreachable), where the amount and
 * metadata must be fixed server-side before the customer is redirected.
 */
export async function initializePaystackTransaction(
  input: InitializeTransactionInput
): Promise<PaystackInitializeResult> {
  const secret = getPaystackSecret();
  if (!secret) return { ok: false, reason: 'gateway_not_configured' };

  const result = await paystackFetch('/transaction/initialize', {
    method: 'POST',
    secret,
    body: JSON.stringify({
      email: input.email,
      amount: input.amountPesewas,
      currency: 'GHS',
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata
    })
  });

  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }

  const payload = result.body;
  if (!payload || payload.status !== true || !payload.data?.authorization_url) {
    const message = String(payload?.message || '').toLowerCase();
    return {
      ok: false,
      reason: payload?.message || 'initialize_failed',
      duplicateReference: message.includes('duplicate')
    };
  }

  return {
    ok: true,
    authorizationUrl: payload.data.authorization_url,
    accessCode: payload.data.access_code,
    reference: payload.data.reference || input.reference
  };
}

// ----------------------------------------------------------------
// Payment adjudication
// ----------------------------------------------------------------

export type PaymentVerdict =
  | { outcome: 'paid'; amountPaid: number; channel?: string; paidAt?: string; transactionId?: string; gatewayResponse?: string }
  | { outcome: 'failed'; reason: string; gatewayResponse?: string }
  | { outcome: 'abandoned'; reason: string }
  /** Paystack is still working on it (mobile-money OTP in flight, etc.). */
  | { outcome: 'pending'; reason: string }
  /** Money moved but does not match this order — never auto-fulfil, flag it. */
  | { outcome: 'mismatch'; reason: string };

function toIsoOrUndefined(value: unknown): string | undefined {
  if (!value) return undefined;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/**
 * Turns a verified Paystack transaction into a decision about one order.
 *
 * Amounts are compared in pesewas so floating point never decides a payment is
 * short, and an overpayment is accepted (Paystack can add fees on the customer).
 */
export function adjudicatePayment(
  transaction: PaystackTransaction,
  expectedTotalGhs: number
): PaymentVerdict {
  const status = String(transaction.status || '').toLowerCase();
  const gatewayResponse = transaction.gateway_response || undefined;

  if (status === 'success') {
    const currency = String(transaction.currency || '').toUpperCase();
    if (currency && currency !== 'GHS') {
      return { outcome: 'mismatch', reason: `Payment currency was ${currency}, expected GHS.` };
    }

    const paidPesewas = Math.round(Number(transaction.amount) || 0);
    const expectedPesewas = Math.round(expectedTotalGhs * 100);

    if (paidPesewas < expectedPesewas) {
      return {
        outcome: 'mismatch',
        reason: `Captured GHS ${(paidPesewas / 100).toFixed(2)} but the order total is GHS ${expectedTotalGhs.toFixed(2)}.`
      };
    }

    return {
      outcome: 'paid',
      amountPaid: Math.round(paidPesewas) / 100,
      channel: transaction.channel || undefined,
      paidAt: toIsoOrUndefined(transaction.paid_at || transaction.paidAt || transaction.created_at),
      transactionId: transaction.id != null ? String(transaction.id) : undefined,
      gatewayResponse
    };
  }

  if (status === 'failed' || status === 'reversed') {
    return { outcome: 'failed', reason: gatewayResponse || 'The gateway declined this charge.', gatewayResponse };
  }

  if (status === 'abandoned') {
    return { outcome: 'abandoned', reason: 'The customer left checkout without completing payment.' };
  }

  // ongoing / pending / queued / processing
  return { outcome: 'pending', reason: gatewayResponse || `Paystack still reports "${status || 'pending'}".` };
}

// ----------------------------------------------------------------
// Metadata — what the merchant sees on the Paystack receipt
// ----------------------------------------------------------------

const MAX_CUSTOM_FIELD_LENGTH = 400;
const MAX_METADATA_ITEMS = 25;

function clip(value: unknown, max = MAX_CUSTOM_FIELD_LENGTH): string {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function ghs(amount: number): string {
  return `GHS ${Number(amount || 0).toFixed(2)}`;
}

export interface OrderMetadataInput {
  orderId: number;
  reference: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  shippingAddress: string;
  shippingCity: string;
  items: OrderItem[];
  totalQuantity: number;
  subtotal: number;
  serviceCharge: number;
  grandTotal: number;
  siteUrl?: string;
}

/**
 * Builds the `metadata` blob attached to the transaction.
 *
 * `custom_fields` is the part Paystack renders on the dashboard transaction page
 * and includes in the receipt email, so the whole purchase — items, sizes,
 * quantities, delivery address and the fee split — is readable there without
 * opening the admin panel. The remaining keys are structured duplicates for any
 * programmatic reconciliation later.
 */
export function buildOrderMetadata(input: OrderMetadataInput): Record<string, any> {
  const orderRef = `RD-${input.orderId}`;
  const itemLines = input.items
    .slice(0, MAX_METADATA_ITEMS)
    .map((item) => `${item.productName} — ${item.color}/${item.size} x${item.quantity} @ ${ghs(item.unitPrice)}`);

  if (input.items.length > MAX_METADATA_ITEMS) {
    itemLines.push(`+${input.items.length - MAX_METADATA_ITEMS} more line(s)`);
  }

  const trackUrl = input.siteUrl
    ? `${input.siteUrl.replace(/\/+$/, '')}/track-order?ref=${orderRef}`
    : `redoxdesignx.com/track-order?ref=${orderRef}`;

  const customFields = [
    { display_name: 'Order Number', variable_name: 'order_number', value: `#${orderRef}` },
    { display_name: 'Customer', variable_name: 'customer_name', value: clip(input.customerName, 120) },
    { display_name: 'Phone', variable_name: 'customer_phone', value: clip(input.customerPhone, 40) },
    {
      display_name: 'Delivery Address',
      variable_name: 'delivery_address',
      value: clip(`${input.shippingAddress}, ${input.shippingCity}`)
    },
    { display_name: 'Items Purchased', variable_name: 'items_purchased', value: clip(itemLines.join(' | ')) },
    { display_name: 'Total Quantity', variable_name: 'total_quantity', value: String(input.totalQuantity) },
    { display_name: 'Subtotal', variable_name: 'subtotal', value: ghs(input.subtotal) },
    { display_name: 'Service Fee (2%)', variable_name: 'service_charge', value: ghs(input.serviceCharge) },
    { display_name: 'Order Total', variable_name: 'order_total', value: ghs(input.grandTotal) },
    { display_name: 'Track Order', variable_name: 'track_url', value: clip(trackUrl) }
  ];

  return {
    order_id: input.orderId,
    order_number: `#${orderRef}`,
    order_reference: input.reference,
    store: 'RedoxDesignx',
    customer_name: clip(input.customerName, 120),
    customer_phone: clip(input.customerPhone, 40),
    customer_email: clip(input.customerEmail, 160),
    delivery_address: clip(input.shippingAddress),
    delivery_city: clip(input.shippingCity, 120),
    total_quantity: input.totalQuantity,
    subtotal_ghs: Number(input.subtotal.toFixed(2)),
    service_charge_ghs: Number(input.serviceCharge.toFixed(2)),
    total_ghs: Number(input.grandTotal.toFixed(2)),
    track_url: trackUrl,
    items: input.items.slice(0, MAX_METADATA_ITEMS).map((item) => ({
      name: clip(item.productName, 120),
      sku: item.sku || undefined,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      unit_price_ghs: item.unitPrice,
      line_total_ghs: item.lineTotal
    })),
    custom_fields: customFields
  };
}

/** Rebuilds the metadata for an existing order row (used by the hosted fallback). */
export function buildOrderMetadataFromOrder(order: Order, siteUrl?: string): Record<string, any> {
  return buildOrderMetadata({
    orderId: order.id,
    reference: order.paymentReference || order.momoNumber || '',
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
    shippingAddress: order.shippingAddress,
    shippingCity: order.shippingCity,
    items: order.items,
    totalQuantity: order.totalQuantity,
    subtotal: order.subtotal,
    serviceCharge: order.serviceCharge,
    grandTotal: order.price,
    siteUrl
  });
}

// ----------------------------------------------------------------
// Webhook signature
// ----------------------------------------------------------------

export const PAYSTACK_SIGNATURE_HEADER = 'x-paystack-signature';

/**
 * Paystack signs the webhook body with HMAC-SHA512 keyed on the secret key.
 * The hash must be taken over the *raw* body — re-serialising the parsed JSON
 * can reorder keys or change number formatting and silently break the compare.
 */
export function verifyPaystackSignature(rawBody: string, signature: string | null): boolean {
  const secret = getPaystackSecret();
  if (!secret || !signature) return false;

  const expected = crypto.createHmac('sha512', secret).update(rawBody, 'utf8').digest('hex');
  const provided = signature.trim().toLowerCase();

  if (provided.length !== expected.length) return false;

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
  } catch {
    return false;
  }
}
