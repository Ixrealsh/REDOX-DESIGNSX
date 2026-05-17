import { NextResponse } from 'next/server';
import { getDbOrders } from '@/lib/catalog-db';

async function sendUnifiedSms(orders: any[]) {
  const apiKey = process.env.MNOTIFY_API_KEY;
  const senderId = process.env.MNOTIFY_SENDER_ID || 'RedoxDesx';
  
  if (!apiKey) {
    console.warn('mNotify API Key is not set. Skipping SMS summary.');
    return;
  }

  const primaryOrder = orders[0];
  if (!primaryOrder) return;

  // Format customer phone
  let rawPhone = primaryOrder.customerPhone || '';
  let cleanedPhone = rawPhone.replace(/\D/g, '');
  if (cleanedPhone.startsWith('0') && cleanedPhone.length === 10) {
    cleanedPhone = '233' + cleanedPhone.substring(1);
  } else if (cleanedPhone.length === 9 && !cleanedPhone.startsWith('0')) {
    cleanedPhone = '233' + cleanedPhone;
  }

  // Format admin phone from environment
  let rawAdminPhone = process.env.ADMIN_PHONE_NUMBER || '';
  let cleanedAdminPhone = rawAdminPhone.replace(/\D/g, '');
  if (cleanedAdminPhone.startsWith('0') && cleanedAdminPhone.length === 10) {
    cleanedAdminPhone = '233' + cleanedAdminPhone.substring(1);
  } else if (cleanedAdminPhone.length === 9 && !cleanedAdminPhone.startsWith('0')) {
    cleanedAdminPhone = '233' + cleanedAdminPhone;
  }

  // Deduplicate recipients
  const recipientSet = new Set<string>();
  if (cleanedPhone) recipientSet.add(cleanedPhone);
  if (cleanedAdminPhone) recipientSet.add(cleanedAdminPhone);

  if (recipientSet.size === 0) {
    console.warn('No recipients found for SMS summary.');
    return;
  }

  // Build a highly compact list of items to keep SMS character count minimal and save credits
  let itemsSummary = '';
  let totalPrice = 0;
  
  orders.forEach((o) => {
    totalPrice += o.price;
    // Shorten product name to keep it super concise
    const shortName = o.productName.length > 15 ? o.productName.substring(0, 12) + '..' : o.productName;
    itemsSummary += `• ${shortName} (${o.selectedColor}/${o.selectedSize})\n`;
  });

  // Shorten track link prefix
  const trackingRef = `RD-${primaryOrder.id}`;
  const messageText = `REDOXDESIGNX\nOrder #${trackingRef} confirmed!\n\n${itemsSummary}Total: GH₵${totalPrice}\n\nTrack: https://redoxdesignx.com/track-order?ref=${trackingRef}`;

  try {
    const url = `https://api.mnotify.com/api/sms/quick?key=${apiKey}`;
    const payload = {
      recipient: Array.from(recipientSet),
      sender: senderId.substring(0, 11),
      message: messageText,
      is_schedule: false,
      schedule_date: ''
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const resData = await res.json();
    console.log('mNotify Summary API send log:', resData);
  } catch (err) {
    console.error('mNotify Summary SMS system error:', err);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const { orderIds } = body || {};

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'Valid orderIds array is required.' }, { status: 400 });
    }

    const allOrders = await getDbOrders();
    const matchingOrders = allOrders.filter((o: any) => orderIds.includes(o.id));

    if (matchingOrders.length === 0) {
      return NextResponse.json({ error: 'No matching orders found.' }, { status: 404 });
    }

    // Trigger unified single SMS summary
    await sendUnifiedSms(matchingOrders);

    return NextResponse.json({ success: true, message: 'Unified SMS summary triggered.' });
  } catch (error: any) {
    console.error('SMS summary POST error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
