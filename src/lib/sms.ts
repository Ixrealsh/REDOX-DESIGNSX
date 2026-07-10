import type { Order } from '@/types/product';
import { formatGhanaPhone, isValidGhanaPhone } from './phone';

const HUBTEL_ENDPOINT = 'https://smsc.hubtel.com/v1/messages/send';
const SMS_TIMEOUT_MS = 8_000;
const MAX_ITEM_LINES = 5;
const MAX_NAME_LENGTH = 28;

/** Hard ceiling on billable segments per recipient, whatever the catalogue contains. */
const MAX_MESSAGE_LENGTH = 480;

/** GSM-7 fits 160 chars in one segment, or 153 each once a message is concatenated. */
export function countSmsSegments(message: string): number {
  return message.length <= 160 ? 1 : Math.ceil(message.length / 153);
}

/**
 * A single character outside GSM-7 silently downgrades the whole message to
 * UCS-2, halving the segment size from 160 to 70 chars and multiplying the
 * credits charged. `GH₵`, `•` and `—` are all outside GSM-7.
 *
 * Rather than enumerate GSM-7 (which includes accented and Greek letters), we
 * keep only printable ASCII and newline, minus the eight ASCII characters that
 * live in GSM-7's *extended* table and therefore cost two septets each.
 */
const NON_PRINTABLE_ASCII = /[^\n\x20-\x7E]/g;
const GSM7_EXTENDED_CHARS = /[\^{}\\\[\]~|`]/g;

const TRANSLITERATIONS: Record<string, string> = {
  '₵': '',
  '•': '-',
  '—': '-',
  '–': '-',
  '’': "'",
  '‘': "'",
  '“': '"',
  '”': '"',
  '…': '...'
};

/** Force a string into the GSM-7 alphabet so the message bills as 160-char segments. */
export function toGsm7(input: string): string {
  return input
    .replace(/[₵•—–’‘“”…]/g, (char) => TRANSLITERATIONS[char] ?? '')
    // NFKD splits "é" into "e" + a combining accent; the strip below drops the accent.
    .normalize('NFKD')
    .replace(NON_PRINTABLE_ASCII, '')
    .replace(GSM7_EXTENDED_CHARS, '');
}

function money(amount: number): string {
  return `GHS ${Number(amount).toFixed(2)}`;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

/**
 * Builds the confirmation body. Every variant and its quantity is listed, grouped
 * under its product so the name is not repeated per size. A typical single-variant
 * order lands under 160 chars and therefore bills as one credit.
 */
export function buildOrderSms(order: Order): string {
  const trackingRef = `RD-${order.id}`;

  // Group by product first: a cart can interleave products, and repeating the
  // product name on every size would waste characters.
  const byProduct = new Map<string, typeof order.items>();
  for (const item of order.items) {
    const group = byProduct.get(item.productName);
    if (group) group.push(item);
    else byProduct.set(item.productName, [item]);
  }

  const ordered = Array.from(byProduct.values()).flat();
  const shown = ordered.slice(0, MAX_ITEM_LINES);
  const hidden = ordered.length - shown.length;

  const lines: string[] = [];
  let currentProduct = '';

  for (const item of shown) {
    if (item.productName !== currentProduct) {
      currentProduct = item.productName;
      lines.push(truncate(currentProduct, MAX_NAME_LENGTH));
    }
    lines.push(`- ${item.color}/${item.size} x${item.quantity}`);
  }

  if (hidden > 0) {
    lines.push(`+${hidden} more item${hidden === 1 ? '' : 's'}`);
  }

  // The fee breakdown is deliberately omitted: it is on the receipt, the track-order
  // page and the admin panel, and those 14 characters push a typical single-variant
  // order over the 160-char boundary into a second billed segment.
  const message = [
    'REDOXDESIGNX',
    `Order #${trackingRef} confirmed!`,
    '',
    lines.join('\n'),
    `${order.totalQuantity} item${order.totalQuantity === 1 ? '' : 's'}. Total: ${money(order.price)}`,
    '',
    `Track: redoxdesignx.com/track-order?ref=${trackingRef}`
  ].join('\n');

  return toGsm7(message);
}

type RecipientRole = 'customer' | 'admin';

interface Recipient {
  role: RecipientRole;
  msisdn: string;
}

export interface SmsDelivery {
  role: RecipientRole;
  /** Masked for logs and API responses - never the full subscriber number. */
  msisdn: string;
  ok: boolean;
  reason?: string;
  messageId?: string;
}

export interface SmsResult {
  /** True only when the *customer* was notified. Admin delivery is best-effort. */
  sent: boolean;
  recipients: string[];
  deliveries: SmsDelivery[];
  reason?: string;
}

interface HubtelConfig {
  clientId: string;
  clientSecret: string;
  senderId: string;
}

const PLACEHOLDERS = new Set([
  '',
  'your_hubtel_client_id_here',
  'your_hubtel_client_secret_here'
]);

/**
 * Credentials are read from the server environment only. They are never sent as
 * query parameters (Hubtel's sample URL does exactly that, which writes the
 * secret into access logs, proxy logs and browser history) - we use HTTP Basic
 * auth over TLS instead.
 */
function readHubtelConfig(): HubtelConfig | null {
  const clientId = (process.env.HUBTEL_CLIENT_ID || '').trim();
  const clientSecret = (process.env.HUBTEL_CLIENT_SECRET || '').trim();

  if (PLACEHOLDERS.has(clientId) || PLACEHOLDERS.has(clientSecret)) return null;

  // Hubtel caps alphanumeric sender IDs at 11 characters, and it must be pre-approved.
  const senderId = toGsm7(process.env.HUBTEL_SENDER_ID || 'RedoxDesign').trim().slice(0, 11);
  if (!senderId) return null;

  return { clientId, clientSecret, senderId };
}

function basicAuthHeader({ clientId, clientSecret }: HubtelConfig): string {
  const raw = `${clientId}:${clientSecret}`;
  const encoded =
    typeof Buffer !== 'undefined' ? Buffer.from(raw, 'utf8').toString('base64') : btoa(raw);
  return `Basic ${encoded}`;
}

/** 233241234567 -> 233***4567. Keeps logs useful without spilling subscriber numbers. */
function maskPhone(msisdn: string): string {
  return msisdn.length <= 7 ? '***' : `${msisdn.slice(0, 3)}***${msisdn.slice(-4)}`;
}

/**
 * Hubtel accepts exactly one destination per request. Each recipient therefore
 * gets its own call, its own timeout and its own failure, so a bad admin number
 * can never suppress the customer's confirmation.
 */
async function sendToRecipient(
  config: HubtelConfig,
  recipient: Recipient,
  message: string
): Promise<SmsDelivery> {
  const masked = maskPhone(recipient.msisdn);
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), SMS_TIMEOUT_MS);

  try {
    const res = await fetch(HUBTEL_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(config),
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        From: config.senderId,
        To: recipient.msisdn,
        Content: message
      }),
      signal: abort.signal
    });

    const data: any = await res.json().catch(() => null);

    // Hubtel replies 201 with `status: 0` on acceptance. Field casing has varied
    // across their docs, so read both, and fall back to the HTTP status alone.
    const status = data?.status ?? data?.Status;
    const messageId = data?.messageId ?? data?.MessageId;
    const accepted = res.ok && (status === undefined || status === null || Number(status) === 0);

    if (!accepted) {
      const detail = data ? JSON.stringify(data) : `HTTP ${res.status}`;
      console.error(`[SMS] Hubtel rejected send to ${masked}: ${detail}`);
      return { role: recipient.role, msisdn: masked, ok: false, reason: `hubtel_error_${res.status}` };
    }

    return { role: recipient.role, msisdn: masked, ok: true, messageId };
  } catch (error: any) {
    const reason = error?.name === 'AbortError' ? 'timeout' : 'network_error';
    console.error(`[SMS] Delivery to ${masked} failed (${reason}).`);
    return { role: recipient.role, msisdn: masked, ok: false, reason };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sends the order confirmation to the customer and the admin via Hubtel.
 *
 * Awaited by the caller on purpose: a detached promise is not guaranteed to run
 * to completion once a serverless function has returned its response.
 */
export async function sendOrderSms(order: Order): Promise<SmsResult> {
  const config = readHubtelConfig();

  if (!config) {
    console.warn('[SMS] Hubtel credentials are not configured - skipping notification.');
    return { sent: false, recipients: [], deliveries: [], reason: 'not_configured' };
  }

  const customerMsisdn = formatGhanaPhone(order.customerPhone || '');
  const adminMsisdn = formatGhanaPhone(process.env.ADMIN_PHONE_NUMBER || '');

  // Only well-formed Ghanaian MSISDNs are ever dialled. This is the guard that
  // stops a crafted checkout phone number from directing paid SMS anywhere else.
  const recipients: Recipient[] = [];
  if (isValidGhanaPhone(customerMsisdn)) {
    recipients.push({ role: 'customer', msisdn: customerMsisdn });
  }
  // Dedupe so an admin ordering from their own number is not billed twice.
  if (isValidGhanaPhone(adminMsisdn) && adminMsisdn !== customerMsisdn) {
    recipients.push({ role: 'admin', msisdn: adminMsisdn });
  }

  if (recipients.length === 0) {
    console.warn('[SMS] No valid Ghanaian recipients resolved - skipping notification.');
    return { sent: false, recipients: [], deliveries: [], reason: 'no_valid_recipients' };
  }

  const message = buildOrderSms(order).slice(0, MAX_MESSAGE_LENGTH);
  const segments = countSmsSegments(message);

  const deliveries = await Promise.all(
    recipients.map((recipient) => sendToRecipient(config, recipient, message))
  );

  const customerDelivery = deliveries.find((delivery) => delivery.role === 'customer');
  const sent = Boolean(customerDelivery?.ok);

  console.log(
    `[SMS] Order #RD-${order.id}: ${deliveries.filter((d) => d.ok).length}/${deliveries.length} delivered, ` +
      `${message.length} chars / ${segments} segment(s) each.`
  );

  return {
    sent,
    recipients: recipients.map((recipient) => maskPhone(recipient.msisdn)),
    deliveries,
    reason: sent ? undefined : customerDelivery?.reason || 'customer_phone_invalid'
  };
}
