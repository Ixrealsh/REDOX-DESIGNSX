import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit, requestKey } from '@/lib/rate-limit';

const schema = z.object({
  email: z.string().email().max(180)
});

export async function POST(request: Request) {
  const limit = rateLimit(`newsletter:${requestKey(request)}`, 10);

  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, message: 'Newsletter signup accepted' });
}
