import { z } from 'zod';
import type { RequestedLine } from '@/lib/order-pricing';

/** Shared request validation for every route that can create an order. */

export const orderItemSchema = z.object({
  productId: z.string().optional(),
  productSlug: z.string().optional(),
  variantId: z.string().optional(),
  color: z.string().min(1).max(100),
  size: z.string().min(1).max(50),
  quantity: z.number().int().min(1).max(99)
});

export const customerSchema = z.object({
  customerName: z.string().trim().min(2).max(255),
  customerPhone: z.string().trim().min(8).max(100),
  customerEmail: z.string().trim().email().max(255),
  shippingAddress: z.string().trim().min(5).max(500),
  shippingCity: z.string().trim().min(2).max(255)
});

const basketShape = {
  // Legacy single-product form, still accepted so an already-open tab keeps working.
  productId: z.string().optional(),
  productName: z.string().optional(),
  productSlug: z.string().optional(),
  selectedColor: z.string().optional(),
  selectedSize: z.string().optional(),
  quantity: z.number().int().min(1).max(99).optional(),
  /** Client-supplied price is ignored; the server prices every line from the DB. */
  price: z.number().positive().optional(),
  items: z.array(orderItemSchema).min(1).max(50).optional()
};

function requireBasket(data: any, ctx: z.RefinementCtx) {
  if (data.items?.length) return;
  if (!data.productSlug || !data.selectedColor || !data.selectedSize) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide an items array, or productSlug + selectedColor + selectedSize.'
    });
  }
}

/** Body accepted by `POST /api/checkout/initialize`. */
export const checkoutInitSchema = customerSchema.extend(basketShape).superRefine(requireBasket);

/** Body accepted by `POST /api/orders` (COD / MOMO, plus the legacy card path). */
export const directOrderSchema = customerSchema
  .extend({
    ...basketShape,
    paymentMethod: z.enum(['COD', 'MOMO', 'PAYSTACK']),
    momoNetwork: z.enum(['MTN', 'Telecel', 'AT']).optional(),
    momoNumber: z.string().max(120).optional(),
    paymentReference: z.string().max(120).optional()
  })
  .superRefine(requireBasket);

/**
 * Body accepted by `POST /api/admin/orders/create` — an order the merchant
 * recorded by hand for someone standing in front of them.
 *
 * Deliberately looser than `customerSchema`: only a name and a phone are
 * required, because the point of this form is that it can be filled in during a
 * conversation. Everything else the order needs is defaulted server-side.
 *
 * The money fields are inputs to a calculation, never the calculation's result.
 * The server prices every line from the database and works the discount out
 * itself, exactly as it does for a customer's own checkout.
 */
export const adminOrderSchema = z.object({
  customerName: z.string().trim().min(2).max(255),
  customerPhone: z.string().trim().min(8).max(100),
  customerEmail: z.union([z.string().trim().email().max(255), z.literal('')]).optional(),
  shippingAddress: z.string().trim().max(500).optional(),
  shippingCity: z.string().trim().max(255).optional(),
  // Unlike the storefront, there is no single-product fallback shape here, so
  // every line must name its own product.
  items: z.array(orderItemSchema.extend({ productSlug: z.string().trim().min(1).max(255) })).min(1).max(50),

  /** True when the money is already in hand; false for pay-on-delivery. */
  paidNow: z.boolean(),
  paymentMethod: z.enum(['CASH', 'MOMO', 'BANK', 'COD']),
  momoNetwork: z.enum(['MTN', 'Telecel', 'AT']).optional(),

  discountType: z.enum(['amount', 'percent']).optional(),
  discountValue: z.number().nonnegative().max(1_000_000).optional(),

  /** Sells a variant the catalogue believes is sold out. */
  allowOutOfStock: z.boolean().optional(),
  fulfilmentStatus: z.enum(['Pending', 'Processing', 'Shipped', 'Delivered']).optional(),
  note: z.string().trim().max(400).optional(),

  /** Idempotency key. The same key can only ever produce one order. */
  clientRequestId: z.string().trim().min(8).max(80)
});

export type CheckoutInitInput = z.infer<typeof checkoutInitSchema>;
export type DirectOrderInput = z.infer<typeof directOrderSchema>;
export type AdminOrderInput = z.infer<typeof adminOrderSchema>;

/**
 * Works out what comes off an order total.
 *
 * Lives here, next to the schema, because it is part of validating the request:
 * a percentage is resolved against the server's own subtotal, and the result can
 * never exceed it — an order can be free, never negative.
 */
export function resolveDiscount(
  subtotal: number,
  type: 'amount' | 'percent' | undefined,
  value: number | undefined
): number {
  if (!value || value <= 0 || !Number.isFinite(value)) return 0;

  const raw = type === 'percent' ? (subtotal * Math.min(value, 100)) / 100 : value;
  const rounded = Math.round(raw * 100) / 100;

  return Math.min(Math.max(rounded, 0), subtotal);
}

/** Flattens either basket shape into the line list the pricing engine expects. */
export function toRequestedLines(data: {
  items?: { productSlug?: string; color: string; size: string; quantity: number }[];
  productSlug?: string;
  selectedColor?: string;
  selectedSize?: string;
  quantity?: number;
}): RequestedLine[] {
  if (data.items?.length) {
    return data.items.map((item) => ({
      productSlug: item.productSlug || data.productSlug || '',
      color: item.color,
      size: item.size,
      quantity: item.quantity
    }));
  }

  return [
    {
      productSlug: data.productSlug || '',
      color: (data.selectedColor || '').split(',')[0]!.trim(),
      size: data.selectedSize || '',
      quantity: data.quantity ?? 1
    }
  ];
}
