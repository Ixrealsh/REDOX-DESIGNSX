import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit, requestKey } from '@/lib/rate-limit';

const schema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(180),
  topic: z.string().min(2).max(80),
  message: z.string().min(10).max(2000)
});

export async function POST(request: Request) {
  const limit = rateLimit(`contact:${requestKey(request)}`, 5);

  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid contact payload' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, message: 'Contact request accepted', data: parsed.data });
}
