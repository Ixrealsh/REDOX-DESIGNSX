import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit, requestKey } from '@/lib/rate-limit';
import { addDbOrder, applyDbProductStockDelta, getDbProduct } from '@/lib/catalog-db';
import { getVariantStockLimit, isVariantInStock } from '@/lib/inventory';
import { calcOrderTotal, calcServiceCharge } from '@/lib/format';

const orderItemSchema = z.object({
  productId: z.string().optional(),
  productSlug: z.string().optional(),
  variantId: z.string().optional(),
  color: z.string().min(1).max(100),
  size: z.string().min(1).max(50),
  quantity: z.number().int().min(1).max(99)
});

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
  momoNumber: z.string().max(100).optional(),
  items: z.array(orderItemSchema).min(1).max(25).optional(),
  skipSms: z.boolean().optional()
});

async function sendSmsNotification(order: any) {
  const apiKey = process.env.MNOTIFY_API_KEY;
  const senderId = process.env.MNOTIFY_SENDER_ID || 'RedoxDesx';
  
  if (!apiKey) {
    console.warn('mNotify API Key is not set in environment variables. Skipping SMS.');
    return;
  }

  // Format customer phone
  let rawPhone = order.customerPhone || '';
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

  // Deduplicate recipients: if admin number equals customer number, send only once
  const recipientSet = new Set<string>();
  if (cleanedPhone) recipientSet.add(cleanedPhone);
  if (cleanedAdminPhone) recipientSet.add(cleanedAdminPhone);

  if (recipientSet.size === 0) {
    console.warn('No recipients found for SMS notification.');
    return;
  }

  // Optimized single SMS message layout (Guaranteed under 160 characters to charge EXACTLY 1 credit per recipient!)
  const trackingRef = `RD-${order.id}`;
  const shortName = order.productName.length > 20 ? order.productName.substring(0, 17) + '...' : order.productName;
  const messageText = `REDOXDESIGNX\nOrder #${trackingRef} confirmed!\n\n${shortName} (${order.selectedColor}/${order.selectedSize})\nPrice: GH₵${order.price}\n\nTrack: https://redoxdesignx.com/track-order?ref=${trackingRef}`;

  try {
    const url = `https://api.mnotify.com/api/sms/quick?key=${apiKey}`;
    const payload = {
      recipient: Array.from(recipientSet),
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

    // 1. SECURE SERVER-SIDE PRICE LOOKUP & VERIFICATION
    const dbProduct = await getDbProduct(orderData.productSlug);
    if (!dbProduct) {
      return NextResponse.json({ error: 'Product manifest not found in database.' }, { status: 404 });
    }

    const requestedItems = (orderData.items?.length
      ? orderData.items
      : [{
          productId: orderData.productId,
          productSlug: orderData.productSlug,
          color: orderData.selectedColor.split(',')[0]?.trim() || orderData.selectedColor,
          size: orderData.selectedSize,
          quantity: Math.max(1, Math.round(orderData.price / dbProduct.price))
        }]
    ).map((item) => ({
      ...item,
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 1))
    }));

    let verifiedItems: { color: string; size: string; quantity: number }[];
    try {
      verifiedItems = requestedItems.map((item) => {
        if (item.productSlug && item.productSlug !== dbProduct.slug) {
          throw new Error('Order item does not match the selected product.');
        }

        const variant = dbProduct.variants.find(
          (candidate) => candidate.color === item.color && candidate.size === item.size
        );

        if (!variant) {
          throw new Error(`${item.color} / ${item.size} is not available for this product.`);
        }

        if (!isVariantInStock(variant)) {
          throw new Error(`${item.color} / ${item.size} is sold out.`);
        }

        const stockLimit = getVariantStockLimit(variant);
        if (item.quantity > stockLimit) {
          throw new Error(`Only ${stockLimit} left for ${item.color} / ${item.size}.`);
        }

        return {
          color: item.color,
          size: item.size,
          quantity: item.quantity
        };
      });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Requested stock is unavailable.' }, { status: 400 });
    }

    const verifiedTotalPrice = verifiedItems.reduce(
      (total, item) => total + dbProduct.price * item.quantity,
      0
    );

    // 2. SECURE PAYSTACK TRANSACTION REFERENCE VERIFICATION
    if (orderData.paymentMethod === 'PAYSTACK') {
      const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
      if (!paystackSecret || paystackSecret === 'your_paystack_secret_key_here') {
        return NextResponse.json({ error: 'System Configuration Error: Live payment gateway secret is missing.' }, { status: 500 });
      }

      const paymentRef = orderData.momoNumber; // Loaded from client callback reference
      if (!paymentRef) {
        return NextResponse.json({ error: 'Payment authorization reference is missing.' }, { status: 400 });
      }

      // Query the official Paystack Verification Endpoint securely from the server
      const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(paymentRef)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          'Content-Type': 'application/json'
        }
      });

      if (!verifyRes.ok) {
        return NextResponse.json({ error: 'Could not communicate with Paystack payment gateway.' }, { status: 400 });
      }

      const verifyData = await verifyRes.json();
      if (!verifyData.status || verifyData.data.status !== 'success') {
        return NextResponse.json({ error: 'Security breach: Transaction payment has not been successfully capture-verified.' }, { status: 400 });
      }

      // Check if the amount paid to Paystack matches our verified database price (in kobo/pesewas)
      // The amount includes the 2% service charge applied at checkout
      const amountPaidGhs = verifyData.data.amount / 100;
      const expectedTotal = calcOrderTotal(verifiedTotalPrice);
      if (amountPaidGhs < expectedTotal) {
        return NextResponse.json({
          error: `Security breach: The amount captured (GH₵${amountPaidGhs}) does not match the expected total (GH₵${expectedTotal}).`
        }, { status: 400 });
      }
    }

    // 3. OVERWRITE WITH AUTHORITATIVE DATA BEFORE WRITE
    // Force write actual verified product data to bypass local client edits.
    // Price stored includes the 2% service charge so receipts and SMS are accurate.
    orderData.price = calcOrderTotal(verifiedTotalPrice);
    orderData.productId = dbProduct.id;
    orderData.productName = dbProduct.name;
    orderData.productSlug = dbProduct.slug;
    orderData.selectedColor = Array.from(new Set(verifiedItems.map((item) => item.color))).join(', ');
    orderData.selectedSize = verifiedItems
      .map((item) => `${item.color} / ${item.size}${item.quantity > 1 ? ` (x${item.quantity})` : ''}`)
      .join(', ');

    try {
      await applyDbProductStockDelta(dbProduct.slug, verifiedItems);
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Requested stock is unavailable.' }, { status: 400 });
    }
    
    // Save order in database (or fallback sandbox orders list)
    const order = await addDbOrder({
      ...orderData,
      status: 'Pending'
    });

    // Send instant background SMS notification (unless skipped by cart checkout)
    if (!orderData.skipSms) {
      sendSmsNotification(order).catch((err) => {
        console.error('Background SMS worker failed:', err);
      });
    }

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
