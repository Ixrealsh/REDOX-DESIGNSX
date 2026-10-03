import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/admin-auth';
import { GHANA_REGIONS } from '@/lib/delivery';
import { getDeliverySettings, saveDeliverySettings } from '@/lib/delivery-settings-db';

export const dynamic = 'force-dynamic';

const settingsSchema = z.object({
  eligibleRegions: z.array(z.enum(GHANA_REGIONS)).max(GHANA_REGIONS.length),
  urgentFee: z.number().finite().min(0).max(10000).multipleOf(0.01)
});

export async function GET() {
  const authError = await requireAdminSession();
  if (authError) return authError;
  try {
    return NextResponse.json(await getDeliverySettings());
  } catch {
    return NextResponse.json({ error: 'Could not load delivery settings.' }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const authError = await requireAdminSession();
  if (authError) return authError;
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Choose valid regions and an urgent fee between GH₵0 and GH₵10,000.' }, { status: 400 });
  }
  try {
    return NextResponse.json(await saveDeliverySettings(parsed.data));
  } catch (error) {
    console.error('Could not save delivery settings:', error);
    return NextResponse.json({ error: 'Could not save delivery settings.' }, { status: 503 });
  }
}
