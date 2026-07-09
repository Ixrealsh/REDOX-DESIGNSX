import type { Order } from '@/types/product';
import { formatGhanaPhone, isValidGhanaPhone } from './phone';

const SMS_TIMEOUT_MS = 8_000;
const MAX_ITEM_LINES = 5;
const MAX_NAME_LENGTH = 28;

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

export interface SmsResult {
  sent: boolean;
  recipients: string[];
  reason?: string;
  response?: unknown;
}

/**
 * Sends the order confirmation to the customer and the admin.
 *
 * Awaited by the caller on purpose: a detached promise is not guaranteed to run
 * to completion once a serverless function has returned its response.
 */
export async function sendOrderSms(order: Order): Promise<SmsResult> {
  const apiKey = process.env.MNOTIFY_API_KEY;
  const senderId = (process.env.MNOTIFY_SENDER_ID || 'RedoxDesx').substring(0, 11);

  if (!apiKey || apiKey === 'your_mnotify_api_key_here') {
    console.warn('[SMS] MNOTIFY_API_KEY is not configured - skipping notification.');
    return { sent: false, recipients: [], reason: 'missing_api_key' };
  }

  const customerPhone = formatGhanaPhone(order.customerPhone || '');
  const adminPhone = formatGhanaPhone(process.env.ADMIN_PHONE_NUMBER || '');

  // Dedupe so an admin ordering from their own number is not billed twice.
  const recipients = Array.from(new Set([customerPhone, adminPhone])).filter(isValidGhanaPhone);

  if (recipients.length === 0) {
    console.warn('[SMS] No valid Ghanaian recipients resolved - skipping notification.');
    return { sent: false, recipients: [], reason: 'no_valid_recipients' };
  }

  const message = buildOrderSms(order);
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), SMS_TIMEOUT_MS);

  try {
    const res = await fetch(`https://api.mnotify.com/api/sms/quick?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: recipients,
        sender: senderId,
        message,
        is_schedule: false,
        schedule_date: ''
      }),
      signal: abort.signal
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data?.status === 'error') {
      console.error(`[SMS] mNotify rejected order #RD-${order.id}:`, JSON.stringify(data));
      return { sent: false, recipients, reason: 'mnotify_error', response: data };
    }

    const segments = countSmsSegments(message);
    console.log(
      `[SMS] Order #RD-${order.id} sent to ${recipients.length} recipient(s), ` +
        `${message.length} chars / ${segments} segment(s) each.`
    );
    return { sent: true, recipients, response: data };
  } catch (error: any) {
    const reason = error?.name === 'AbortError' ? 'timeout' : 'network_error';
    console.error(`[SMS] Failed to notify for order #RD-${order.id} (${reason}):`, error);
    return { sent: false, recipients, reason };
  } finally {
    clearTimeout(timer);
  }
}
