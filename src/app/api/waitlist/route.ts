import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit, requestKey } from '@/lib/rate-limit';
import { addWaitlistSignup } from '@/lib/catalog-db';

const schema = z.object({
  email: z.string().email().max(180),
  drop: z.string().min(2).max(120)
});

export async function POST(request: Request) {
  const limit = rateLimit(`waitlist:${requestKey(request)}`, 10);

  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid waitlist payload' }, { status: 400 });
  }

  const { email, drop } = parsed.data;
  await addWaitlistSignup(email, drop);

  return NextResponse.json({ ok: true, message: 'Waitlist signup accepted', data: parsed.data });
}
