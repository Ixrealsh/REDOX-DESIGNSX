import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

function verifyShopifyHmac(rawBody: string, signature: string | null, secret: string) {
  if (!signature) {
    return false;
  }

  const digest = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  const received = Buffer.from(signature, 'base64');
  const expected = Buffer.from(digest, 'base64');

  if (received.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(received, expected);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

  if (secret && !verifyShopifyHmac(rawBody, request.headers.get('x-shopify-hmac-sha256'), secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  return NextResponse.json({ ok: true, revalidated: false, message: 'Webhook accepted' });
}
