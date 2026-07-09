import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit, requestKey } from '@/lib/rate-limit';
import {
  addDbOrder,
  applyDbProductStockDelta,
  findDbOrderByPaymentRef,
  getDbProduct,
  restoreDbProductStock,
  type StockSelection
} from '@/lib/catalog-db';
import { getVariantStockLimit, isVariantInStock } from '@/lib/inventory';
import { calcOrderTotal, calcServiceCharge } from '@/lib/format';
import { sendOrderSms } from '@/lib/sms';
import type { OrderItem, Product } from '@/types/product';

const orderItemSchema = z.object({
  productId: z.string().optional(),
  productSlug: z.string().optional(),
  variantId: z.string().optional(),
  color: z.string().min(1).max(100),
  size: z.string().min(1).max(50),
  quantity: z.number().int().min(1).max(99)
});

const orderSchema = z
  .object({
    productId: z.string().optional(),
    productName: z.string().optional(),
    productSlug: z.string().optional(),
    selectedColor: z.string().optional(),
    selectedSize: z.string().optional(),
    quantity: z.number().int().min(1).max(99).optional(),
    // Client-supplied price is ignored; the server prices every line from the DB.
    price: z.number().positive().optional(),
    customerName: z.string().min(2).max(255),
    customerPhone: z.string().min(8).max(100),
    customerEmail: z.string().email().max(255),
    shippingAddress: z.string().min(5).max(500),
    shippingCity: z.string().min(2).max(255),
    paymentMethod: z.enum(['COD', 'MOMO', 'PAYSTACK']),
    momoNetwork: z.enum(['MTN', 'Telecel', 'AT']).optional(),
    momoNumber: z.string().max(120).optional(),
    paymentReference: z.string().max(120).optional(),
    items: z.array(orderItemSchema).min(1).max(50).optional()
  })
  .superRefine((data, ctx) => {
    if (data.items?.length) return;
    if (!data.productSlug || !data.selectedColor || !data.selectedSize) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide an items array, or productSlug + selectedColor + selectedSize.'
      });
    }
  });

interface ResolvedLine {
  productSlug: string;
  color: string;
  size: string;
  quantity: number;
}

/** Collapse duplicate variant lines so stock checks see the true total quantity. */
function mergeLines(lines: ResolvedLine[]): ResolvedLine[] {
  const merged = new Map<string, ResolvedLine>();

  for (const line of lines) {
    const key = `${line.productSlug}::${line.color}::${line.size}`;
    const existing = merged.get(key);
    if (existing) {
      existing.quantity += line.quantity;
    } else {
      merged.set(key, { ...line });
    }
  }

  return Array.from(merged.values());
}

function buildOrderItems(lines: ResolvedLine[], productsBySlug: Map<string, Product>): OrderItem[] {
  return lines.map((line) => {
    const product = productsBySlug.get(line.productSlug)!;
    const variant = product.variants.find(
      (candidate) => candidate.color === line.color && candidate.size === line.size
    );

    return {
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      color: line.color,
      size: line.size,
      sku: variant?.sku || '',
      quantity: line.quantity,
      unitPrice: product.price,
      lineTotal: Math.round(product.price * line.quantity * 100) / 100
    };
  });
}

export async function POST(request: Request) {
  const limit = rateLimit(`orders:${requestKey(request)}`, 10);

  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many order attempts. Please wait.' }, { status: 429 });
  }

  // Stock reserved so far, so we can hand it back if a later step fails.
  const reserved: { slug: string; selections: StockSelection[] }[] = [];

  const rollbackReservedStock = async () => {
    for (const entry of reserved) {
      try {
        await restoreDbProductStock(entry.slug, entry.selections);
      } catch (error) {
        console.error(`Failed to restore stock for ${entry.slug}:`, error);
      }
    }
  };

  try {
    const body = await request.json().catch(() => null);
    const parsed = orderSchema.safeParse(body);

    if (!parsed.success) {
      console.error('Invalid order validation:', parsed.error.format());
      return NextResponse.json({ error: 'Invalid order input data.' }, { status: 400 });
    }

    const orderData = parsed.data;

    // 1. RESOLVE THE REQUESTED LINES
    const requestedLines: ResolvedLine[] = orderData.items?.length
      ? orderData.items.map((item) => ({
          productSlug: item.productSlug || orderData.productSlug!,
          color: item.color,
          size: item.size,
          quantity: item.quantity
        }))
      : [
          {
            productSlug: orderData.productSlug!,
            color: orderData.selectedColor!.split(',')[0]!.trim(),
            size: orderData.selectedSize!,
            quantity: orderData.quantity ?? 1
          }
        ];

    if (requestedLines.some((line) => !line.productSlug)) {
      return NextResponse.json({ error: 'Every order item needs a product.' }, { status: 400 });
    }

    const lines = mergeLines(requestedLines);

    // 2. SECURE SERVER-SIDE PRODUCT + STOCK VERIFICATION
    const uniqueSlugs = Array.from(new Set(lines.map((line) => line.productSlug)));
    const productsBySlug = new Map<string, Product>();

    for (const slug of uniqueSlugs) {
      const product = await getDbProduct(slug);
      if (!product) {
        return NextResponse.json({ error: `Product "${slug}" was not found.` }, { status: 404 });
      }
      productsBySlug.set(slug, product);
    }

    for (const line of lines) {
      const product = productsBySlug.get(line.productSlug)!;
      const variant = product.variants.find(
        (candidate) => candidate.color === line.color && candidate.size === line.size
      );

      if (!variant) {
        return NextResponse.json(
          { error: `${line.color} / ${line.size} is not available for ${product.name}.` },
          { status: 400 }
        );
      }

      if (!isVariantInStock(variant)) {
        return NextResponse.json(
          { error: `${product.name} - ${line.color} / ${line.size} is sold out.` },
          { status: 400 }
        );
      }

      const stockLimit = getVariantStockLimit(variant);
      if (line.quantity > stockLimit) {
        return NextResponse.json(
          { error: `Only ${stockLimit} left for ${product.name} - ${line.color} / ${line.size}.` },
          { status: 400 }
        );
      }
    }

    // 3. AUTHORITATIVE PRICING — never trust the client's totals
    const items = buildOrderItems(lines, productsBySlug);
    const subtotal = Math.round(items.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100;
    const serviceCharge = calcServiceCharge(subtotal);
    const grandTotal = calcOrderTotal(subtotal);
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

    // Paystack passes its reference through `momoNumber` on older clients.
    const paymentReference = orderData.paymentReference || orderData.momoNumber;

    // 4. SECURE PAYSTACK TRANSACTION VERIFICATION
    if (orderData.paymentMethod === 'PAYSTACK') {
      const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
      if (!paystackSecret || paystackSecret === 'your_paystack_secret_key_here') {
        return NextResponse.json(
          { error: 'System Configuration Error: Live payment gateway secret is missing.' },
          { status: 500 }
        );
      }

      if (!paymentReference) {
        return NextResponse.json({ error: 'Payment authorization reference is missing.' }, { status: 400 });
      }

      // A reference is one payment. Refuse to mint a second order from it.
      const existingOrder = await findDbOrderByPaymentRef(paymentReference);
      if (existingOrder) {
        if (existingOrder.customerEmail.toLowerCase() === orderData.customerEmail.toLowerCase()) {
          // Same buyer retrying after a dropped response — replay their receipt.
          return NextResponse.json({ success: true, message: 'Order already recorded.', order: existingOrder });
        }
        return NextResponse.json(
          { error: 'This payment reference has already been used for another order.' },
          { status: 409 }
        );
      }

      const paystackAbort = new AbortController();
      const paystackTimer = setTimeout(() => paystackAbort.abort(), 10_000);

      let verifyRes: Response;
      try {
        verifyRes = await fetch(
          `https://api.paystack.co/transaction/verify/${encodeURIComponent(paymentReference)}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${paystackSecret}`,
              'Content-Type': 'application/json'
            },
            signal: paystackAbort.signal
          }
        );
      } catch (fetchErr: any) {
        if (fetchErr.name === 'AbortError') {
          return NextResponse.json(
            { error: 'Payment verification timed out. Please contact support with your payment reference.' },
            { status: 504 }
          );
        }
        return NextResponse.json({ error: 'Could not communicate with Paystack payment gateway.' }, { status: 400 });
      } finally {
        clearTimeout(paystackTimer);
      }

      if (!verifyRes.ok) {
        return NextResponse.json({ error: 'Could not communicate with Paystack payment gateway.' }, { status: 400 });
      }

      const verifyData = await verifyRes.json();
      if (!verifyData.status || !verifyData.data || verifyData.data.status !== 'success') {
        return NextResponse.json(
          { error: 'Security breach: Transaction payment has not been successfully capture-verified.' },
          { status: 400 }
        );
      }

      if (verifyData.data.currency !== 'GHS') {
        return NextResponse.json({ error: 'Security breach: Payment currency mismatch.' }, { status: 400 });
      }

      // Compare in pesewas so floating point never decides a payment is short.
      const paidPesewas = Number(verifyData.data.amount);
      const expectedPesewas = Math.round(grandTotal * 100);
      if (paidPesewas < expectedPesewas) {
        return NextResponse.json(
          {
            error: `Security breach: The amount captured (GH₵${(paidPesewas / 100).toFixed(2)}) does not match the expected total (GH₵${grandTotal.toFixed(2)}).`
          },
          { status: 400 }
        );
      }
    }

    // 5. RESERVE STOCK (rolled back below if the order row cannot be written)
    for (const slug of uniqueSlugs) {
      const selections: StockSelection[] = lines
        .filter((line) => line.productSlug === slug)
        .map((line) => ({ color: line.color, size: line.size, quantity: line.quantity }));

      try {
        await applyDbProductStockDelta(slug, selections);
        reserved.push({ slug, selections });
      } catch (error: any) {
        await rollbackReservedStock();
        return NextResponse.json({ error: error.message || 'Requested stock is unavailable.' }, { status: 400 });
      }
    }

    // 6. PERSIST ONE ORDER HOLDING EVERY LINE
    const primary = items[0];
    const summarySize = items
      .map((item) => `${item.color} / ${item.size}${item.quantity > 1 ? ` (x${item.quantity})` : ''}`)
      .join(', ');

    let order;
    try {
      order = await addDbOrder({
        productId: primary.productId,
        productName: primary.productName,
        productSlug: primary.productSlug,
        selectedColor: Array.from(new Set(items.map((item) => item.color))).join(', '),
        selectedSize: summarySize,
        items,
        totalQuantity,
        subtotal,
        serviceCharge,
        price: grandTotal,
        customerName: orderData.customerName,
        customerPhone: orderData.customerPhone,
        customerEmail: orderData.customerEmail,
        shippingAddress: orderData.shippingAddress,
        shippingCity: orderData.shippingCity,
        paymentMethod: orderData.paymentMethod,
        momoNetwork: orderData.paymentMethod === 'MOMO' ? orderData.momoNetwork : undefined,
        momoNumber: paymentReference,
        status: 'Pending'
      });
    } catch (error: any) {
      await rollbackReservedStock();
      console.error('Order persistence failed, stock restored:', error);
      return NextResponse.json(
        { error: 'We could not record your order. Please contact support with your payment reference.' },
        { status: 500 }
      );
    }

    // The sale is committed. Nothing after this point may hand the stock back.
    reserved.length = 0;

    // 7. CONFIRMATION SMS — awaited, because a detached promise is not guaranteed
    // to finish once a serverless function has already returned its response.
    const sms = await sendOrderSms(order);
    if (!sms.sent) {
      console.error(`Order #RD-${order.id} saved but SMS was not delivered (${sms.reason}).`);
    }

    return NextResponse.json({
      success: true,
      message: 'Order placed successfully!',
      smsSent: sms.sent,
      order
    });
  } catch (error: any) {
    await rollbackReservedStock();
    console.error('API orders POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to place order.' }, { status: 500 });
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

    const { getDbOrders } = await import('@/lib/catalog-db');
    const orders = await getDbOrders();

    const order = orders.find((o) => {
      if (!isNaN(idNum) && o.id === idNum) return true;
      if (o.momoNumber && o.momoNumber.toLowerCase() === query.toLowerCase()) return true;
      if (o.momoNumber && o.momoNumber.toLowerCase() === cleanQuery.toLowerCase()) return true;
      return false;
    });

    if (!order) {
      return NextResponse.json({ error: 'No active order found with this reference.' }, { status: 404 });
    }

    const { getDbProducts } = await import('@/lib/catalog-db');
    const products = await getDbProducts();

    const FALLBACK_IMAGE =
      'https://res.cloudinary.com/dti75gff0/image/upload/v1779032145/redox_designsx/redox_hero.png';

    // Resolve a thumbnail per line so multi-product orders render correctly.
    const itemsWithImages = order.items.map((item) => {
      const product = products.find((p) => p.id === item.productId || p.slug === item.productSlug);
      return {
        ...item,
        image: product?.colorImages?.[item.color]?.[0] || product?.image || FALLBACK_IMAGE
      };
    });

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        productName: order.productName,
        selectedColor: order.selectedColor,
        selectedSize: order.selectedSize,
        items: itemsWithImages,
        totalQuantity: order.totalQuantity,
        subtotal: order.subtotal,
        serviceCharge: order.serviceCharge,
        price: order.price,
        customerName: order.customerName,
        status: order.status || 'Pending',
        createdAt: order.createdAt,
        productImage: itemsWithImages[0]?.image || FALLBACK_IMAGE
      }
    });
  } catch (error: any) {
    console.error('API orders GET status tracking error:', error);
    return NextResponse.json({ error: 'Failed to search order.' }, { status: 500 });
  }
}
