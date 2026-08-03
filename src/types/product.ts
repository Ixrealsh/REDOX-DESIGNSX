export type ProductCategory = string;

export interface Variant {
  id: string;
  size: string;
  color: string;
  inventory?: number | null;
  stockStatus?: 'in_stock' | 'out_of_stock';
  sku: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  collectionSlug: string;
  collectionName: string;
  category: ProductCategory;
  price: number;
  compareAtPrice?: number;
  badge?: 'NEW' | 'SALE' | 'LIMITED' | 'SOLD OUT' | 'COMING SOON';
  image: string;
  secondaryImage: string;
  imageAlt: string;
  colors: string[];
  colorHex: Record<string, string>;
  variants: Variant[];
  description: string;
  story: string;
  details: string[];
  care: string[];
  material: string;
  fit: string;
  rating: number;
  reviewCount: number;
  colorImages?: Record<string, string[]>;
}

/** One purchased line: a specific product + colour + size, and how many of it. */
export interface OrderItem {
  productId: string;
  productSlug: string;
  productName: string;
  color: string;
  size: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

/**
 * Money state, tracked separately from fulfilment `status` so a network drop
 * after payment can never be confused with an unfulfilled order.
 *
 * - `unpaid`    — order recorded, payment not (yet) confirmed by Paystack.
 * - `paid`      — confirmed by client callback, webhook, reconciliation or admin.
 * - `failed`    — the gateway explicitly declined the charge.
 * - `abandoned` — the customer never completed (or never started) the charge.
 * - `refunded`  — money returned to the customer.
 */
export type PaymentStatus = 'unpaid' | 'paid' | 'failed' | 'abandoned' | 'refunded';

/** Which channel proved the payment. Kept for the admin audit trail. */
export type PaymentVerificationSource = 'client' | 'webhook' | 'sweep' | 'admin' | 'legacy';

/** Fulfilment states. `Awaiting Payment` is the entry state for card orders. */
export const ORDER_STATUSES = [
  'Awaiting Payment',
  'Pending',
  'Processing',
  'Shipped',
  'Delivered',
  'Cancelled',
  'Payment Failed'
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface Order {
  id: number;
  /** Primary (first) line's product. `items` is the authoritative record. */
  productId: string;
  productName: string;
  productSlug: string;
  /** Human-readable summaries kept for legacy rows and SMS/track-order text. */
  selectedColor: string;
  selectedSize: string;
  items: OrderItem[];
  totalQuantity: number;
  subtotal: number;
  serviceCharge: number;
  /** Grand total actually charged (subtotal + service charge). */
  price: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  shippingAddress: string;
  shippingCity: string;
  paymentMethod: string;
  momoNetwork?: string;
  /** Legacy mirror of `paymentReference`, kept so old track-order links resolve. */
  momoNumber?: string;
  status: string;
  createdAt: string;

  // ── Payment ledger ─────────────────────────────────────────────
  paymentStatus: PaymentStatus;
  /** Gateway reference. Server-generated before the charge, unique per order. */
  paymentReference?: string;
  paidAt?: string;
  /** Amount Paystack actually captured, in GHS. */
  amountPaid?: number;
  /** card | mobile_money | bank | ussd | … */
  paymentChannel?: string;
  paystackTransactionId?: string;
  lastVerifiedAt?: string;
  paymentVerifiedBy?: PaymentVerificationSource;
  /** Raw `gateway_response` from Paystack, e.g. "Successful", "Declined". */
  gatewayResponse?: string;
  /** Free text an admin can attach when confirming payment by hand. */
  paymentNote?: string;

  // ── Inventory + notification bookkeeping ───────────────────────
  stockReserved: boolean;
  stockReleased: boolean;
  smsSent: boolean;
}

export interface Collection {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  image: string;
  productSlugs: string[];
}

export interface Drop {
  slug: string;
  name: string;
  status: 'live' | 'upcoming' | 'archive';
  releaseDate: string;
  itemCount: number;
  summary: string;
  image: string;
}

export interface LookbookIssue {
  slug: string;
  title: string;
  season: string;
  dek: string;
  image: string;
  featuredProductSlugs: string[];
}
