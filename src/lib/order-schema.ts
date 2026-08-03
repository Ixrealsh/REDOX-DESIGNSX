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

export type CheckoutInitInput = z.infer<typeof checkoutInitSchema>;
export type DirectOrderInput = z.infer<typeof directOrderSchema>;

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
