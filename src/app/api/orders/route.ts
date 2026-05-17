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
  paymentMethod: z.enum(['COD', 'MOMO', 'PAYSTACK']),
  momoNetwork: z.enum(['MTN', 'Telecel', 'AT']).optional(),
  momoNumber: z.string().max(100).optional()
});

async function sendSmsNotification(order: any) {
  const apiKey = process.env.MNOTIFY_API_KEY;
  const senderId = process.env.MNOTIFY_SENDER_ID || 'RedoxDesx';
  
  if (!apiKey) {
    console.warn('mNotify API Key is not set in environment variables. Skipping SMS.');
    return;
  }

  let rawPhone = order.customerPhone || '';
  let cleanedPhone = rawPhone.replace(/\D/g, '');
  
  // Format to standard 233 Ghana international code
  if (cleanedPhone.startsWith('0') && cleanedPhone.length === 10) {
    cleanedPhone = '233' + cleanedPhone.substring(1);
  } else if (cleanedPhone.length === 9 && !cleanedPhone.startsWith('0')) {
    cleanedPhone = '233' + cleanedPhone;
  }

  const messageText = `REDOX DESIGNSX\nOrder #RD-${order.id} verified!\n\nItem: ${order.productName}\nSpecs: ${order.selectedColor} - Size ${order.selectedSize}\nPrice: GH₵${order.price}\n\nTrack status: https://redox-designsx.vercel.app/track-order?ref=RD-${order.id}`;

  try {
    const url = `https://api.mnotify.com/api/sms/quick?key=${apiKey}`;
    const payload = {
      recipient: [cleanedPhone],
      sender: senderId.substring(0, 11), // Max 11 chars required by mNotify
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
    console.log('mNotify API send log:', resData);
  } catch (err) {
    console.error('mNotify SMS system error:', err);
  }
}

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

    // Send instant background SMS notification
    sendSmsNotification(order).catch((err) => {
      console.error('Background SMS worker failed:', err);
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('ref');

    if (!query) {
      return NextResponse.json({ error: 'Order reference query parameter is required.' }, { status: 400 });
    }

    const cleanQuery = query.replace('#RD-', '').replace('RD-', '').trim();
    const idNum = parseInt(cleanQuery, 10);

    const { getDbOrders } = require('@/lib/catalog-db');
    const orders = await getDbOrders();
    
    const order = orders.find((o: any) => {
      if (!isNaN(idNum) && o.id === idNum) return true;
      if (o.momoNumber && o.momoNumber.toLowerCase() === query.toLowerCase()) return true;
      if (o.momoNumber && o.momoNumber.toLowerCase() === cleanQuery.toLowerCase()) return true;
      return false;
    });

    if (!order) {
      return NextResponse.json({ error: 'No active order found with this reference.' }, { status: 404 });
    }

    const { getDbProducts } = require('@/lib/catalog-db');
    const products = await getDbProducts();
    const product = products.find((p: any) => p.id === order.productId || p.slug === order.productSlug);
    
    // Parse color name by stripping out sizes or slash separators if any
    const rawColor = order.selectedColor.split('/')[0].trim();
    const productImage = product
      ? (product.colorImages?.[rawColor]?.[0] || product.image)
      : 'https://res.cloudinary.com/dti75gff0/image/upload/v1779032145/redox_designsx/redox_hero.png';

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        productName: order.productName,
        selectedColor: order.selectedColor,
        selectedSize: order.selectedSize,
        price: order.price,
        customerName: order.customerName,
        status: order.status || 'Pending',
        createdAt: order.createdAt,
        productImage
      }
    });
  } catch (error: any) {
    console.error('API orders GET status tracking error:', error);
    return NextResponse.json({ error: 'Failed to search order.' }, { status: 500 });
  }
}
