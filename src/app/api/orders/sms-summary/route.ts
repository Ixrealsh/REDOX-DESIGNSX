import { NextResponse } from 'next/server';
import { getDbOrders } from '@/lib/catalog-db';
import { rateLimit, requestKey } from '@/lib/rate-limit';

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length === 12) return digits;
  if (digits.startsWith('00233') && digits.length === 14) return digits.slice(2);
  if (digits.startsWith('0') && digits.length === 10) return '233' + digits.slice(1);
  if (digits.length === 9) return '233' + digits;
  return digits;
}

async function sendUnifiedSms(orders: any[]) {
  const apiKey = process.env.MNOTIFY_API_KEY;
  const senderId = (process.env.MNOTIFY_SENDER_ID || 'RedoxDesx').substring(0, 11);

  if (!apiKey) {
    console.warn('[SMS] MNOTIFY_API_KEY not set — skipping.');
    return { skipped: true };
  }

  const primary = orders[0];
  if (!primary) return { skipped: true };

  const customerPhone = formatPhone(primary.customerPhone || '');
  const adminPhone = formatPhone(process.env.ADMIN_PHONE_NUMBER || '');

  const recipients = [...new Set([customerPhone, adminPhone].filter(Boolean))];
  if (recipients.length === 0) {
    console.warn('[SMS] No valid recipients — skipping.');
    return { skipped: true };
  }

  // Build compact item list (prices already include 2% service charge)
  const itemLines = orders.map((o) => {
    const name = o.productName.length > 18 ? o.productName.slice(0, 15) + '...' : o.productName;
    return `• ${name} (${o.selectedSize}) — GH₵${Number(o.price).toFixed(2)}`;
  });

  const grandTotal = orders.reduce((sum, o) => sum + Number(o.price), 0);
  const trackRef = `RD-${primary.id}`;

  const message = [
    `REDOXDESIGNX — Order Confirmed!`,
    `Ref: #${trackRef}`,
    ``,
    itemLines.join('\n'),
    ``,
    `Total (incl. 2% fee): GH₵${grandTotal.toFixed(2)}`,
    `Ship to: ${primary.shippingAddress}, ${primary.shippingCity}`,
    ``,
    `Track: redoxdesignx.com/track-order?ref=${trackRef}`
  ].join('\n');

  console.log(`[SMS] Sending to ${recipients.length} recipient(s): ${recipients.join(', ')}`);
  console.log(`[SMS] Message:\n${message}`);

  const smsAbort = new AbortController();
  const smsTimer = setTimeout(() => smsAbort.abort(), 8_000);

  try {
    const res = await fetch(`https://api.mnotify.com/api/sms/quick?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: recipients,
        sender: senderId,
        message,
        is_schedule: false,
        schedule_date: ''
      }),
      signal: smsAbort.signal
    });

    const data = await res.json();
    console.log('[SMS] mNotify response:', JSON.stringify(data));

    if (!res.ok || data.status === 'error') {
      console.error('[SMS] mNotify returned error:', data);
      return { success: false, error: data };
    }

    return { success: true, data };
  } catch (err) {
    console.error('[SMS] Network error calling mNotify:', err);
    return { success: false, error: String(err) };
  } finally {
    clearTimeout(smsTimer);
  }
}

export async function POST(request: Request) {
  const limit = rateLimit(`sms-summary:${requestKey(request)}`, 4, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many SMS requests. Please wait.' }, { status: 429 });
  }

  try {
    const body = await request.json().catch(() => null);
    const { orderIds } = body || {};

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'Valid orderIds array is required.' }, { status: 400 });
    }

    const allOrders = await getDbOrders();
    const matching = allOrders.filter((o: any) => orderIds.includes(o.id));

    if (matching.length === 0) {
      return NextResponse.json({ error: 'No matching orders found.' }, { status: 404 });
    }

    const result = await sendUnifiedSms(matching);
    return NextResponse.json({ success: true, message: 'SMS summary triggered.', result });
  } catch (err: any) {
    console.error('[SMS] POST handler error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
