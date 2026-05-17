import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit, requestKey } from '@/lib/rate-limit';
import { addDbOrder } from '@/lib/catalog-db';

const orderSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  productSlug: z.string().min(1),
  selectedColor: z.string().min(1),
  selectedSize: z.string().min(1),
  price: z.number().positive(),
  customerName: z.string().min(2).max(255),
  customerPhone: z.string().min(8).max(100),
  customerEmail: z.string().email().max(255),
  shippingAddress: z.string().min(5),
  shippingCity: z.string().min(2).max(255),
  paymentMethod: z.enum(['COD', 'MOMO']),
  momoNetwork: z.enum(['MTN', 'Telecel', 'AT']).optional(),
  momoNumber: z.string().max(100).optional()
});

export async function POST(request: Request) {
  const limit = rateLimit(`orders:${requestKey(request)}`, 10);

  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many order attempts. Please wait.' }, { status: 429 });
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = orderSchema.safeParse(body);

    if (!parsed.success) {
      console.error('Invalid order validation:', parsed.error.format());
      return NextResponse.json({ error: 'Invalid order input data.' }, { status: 400 });
    }

    const orderData = parsed.data;
    
    // Save order in database (or fallback sandbox orders list)
    const order = await addDbOrder({
      ...orderData,
      status: 'Pending'
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Order placed successfully!', 
      order 
    });
  } catch (error: any) {
    console.error('API orders POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to place order.' },
      { status: 500 }
    );
  }
}
