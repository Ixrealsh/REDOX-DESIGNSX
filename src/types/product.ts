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
  momoNumber?: string;
  status: string;
  createdAt: string;
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
