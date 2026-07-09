import { isDbConfigured, sql } from './db';
import { 
  products as mockProducts, 
  drops as mockDrops,
  collections as mockCollections,
  lookbooks as mockLookbooks
} from '@/data/catalog';
import { isVariantInStock, normalizeVariantStock } from '@/lib/inventory';
import { SERVICE_CHARGE_RATE } from '@/lib/format';
import type { Product, Drop, Collection, LookbookIssue, Order, OrderItem } from '@/types/product';

export interface WaitlistSignup {
  id: number;
  email: string;
  dropSlug: string;
  createdAt: string;
}

// ----------------------------------------------------
// Product Row Mapping
// ----------------------------------------------------
function mapProductRow(row: any): Product {
  const variants = typeof row.variants === 'string' ? JSON.parse(row.variants) : row.variants;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    collectionSlug: row.collection_slug,
    collectionName: row.collection_name,
    category: row.category,
    price: Number(row.price),
    badge: row.badge || undefined,
    image: row.image,
    secondaryImage: row.secondary_image || undefined,
    imageAlt: row.image_alt,
    colors: row.colors,
    colorHex: typeof row.color_hex === 'string' ? JSON.parse(row.color_hex) : row.color_hex,
    variants: Array.isArray(variants) ? variants.map(normalizeVariantStock) : [],
    description: row.description,
    story: row.story,
    details: row.details,
    care: row.care,
    material: row.material,
    fit: row.fit,
    rating: Number(row.rating),
    reviewCount: Number(row.review_count),
    colorImages: typeof row.color_images === 'string' ? JSON.parse(row.color_images) : (row.color_images || {})
  };
}

// ----------------------------------------------------
// Drop Row Mapping
// ----------------------------------------------------
function mapDropRow(row: any): Drop {
  return {
    slug: row.slug,
    name: row.name,
    status: row.status as 'live' | 'upcoming' | 'archive',
    releaseDate: new Date(row.release_date).toISOString(),
    itemCount: Number(row.item_count),
    summary: row.summary,
    image: row.image
  };
}

// ----------------------------------------------------
// Collection Row Mapping
// ----------------------------------------------------
function mapCollectionRow(row: any): Collection {
  return {
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    image: row.image,
    productSlugs: row.product_slugs || []
  };
}

// ----------------------------------------------------
// Lookbook Row Mapping
// ----------------------------------------------------
function mapLookbookRow(row: any): LookbookIssue {
  return {
    slug: row.slug,
    title: row.title,
    season: row.season,
    dek: row.dek,
    image: row.image,
    featuredProductSlugs: row.featured_product_slugs || []
  };
}

// ----------------------------------------------------
// Products Getters / Setters
// ----------------------------------------------------
export async function getDbProducts(): Promise<Product[]> {
  if (!isDbConfigured) return mockProducts;
  try {
    const rows = await sql`SELECT * FROM products ORDER BY created_at DESC`;
    return rows.map(mapProductRow);
  } catch (error) {
    console.error('Failed to fetch products from Neon Postgres, using fallback:', error);
    return mockProducts;
  }
}

export async function getDbProduct(slug: string): Promise<Product | undefined> {
  if (!isDbConfigured) return mockProducts.find((p) => p.slug === slug);
  try {
    const rows = await sql`SELECT * FROM products WHERE slug = ${slug} LIMIT 1`;
    if (!rows || rows.length === 0) return undefined;
    return mapProductRow(rows[0]);
  } catch (error) {
    console.error(`Failed to fetch product ${slug} from Neon Postgres, using fallback:`, error);
    return mockProducts.find((p) => p.slug === slug);
  }
}

export async function getDbCollectionProducts(collectionSlug: string): Promise<Product[]> {
  const allProducts = await getDbProducts();
  return allProducts.filter((p) => p.collectionSlug === collectionSlug);
}

export async function saveDbProduct(p: Product): Promise<boolean> {
  if (!isDbConfigured) return false;
  try {
    const normalizedProduct = {
      ...p,
      variants: (p.variants || []).map(normalizeVariantStock)
    };

    await sql`
      INSERT INTO products (
        id, slug, name, collection_slug, collection_name, category, price, badge, 
        image, secondary_image, image_alt, colors, color_hex, variants, 
        description, story, details, care, material, fit, rating, review_count, color_images
      ) VALUES (
        ${normalizedProduct.id}, ${normalizedProduct.slug}, ${normalizedProduct.name}, ${normalizedProduct.collectionSlug}, ${normalizedProduct.collectionName}, ${normalizedProduct.category}, 
        ${normalizedProduct.price}, ${normalizedProduct.badge || null}, ${normalizedProduct.image}, ${normalizedProduct.secondaryImage || null}, ${normalizedProduct.imageAlt}, 
        ${normalizedProduct.colors}, ${JSON.stringify(normalizedProduct.colorHex)}, ${JSON.stringify(normalizedProduct.variants)}, 
        ${normalizedProduct.description}, ${normalizedProduct.story}, ${normalizedProduct.details}, ${normalizedProduct.care}, ${normalizedProduct.material}, ${normalizedProduct.fit}, 
        ${normalizedProduct.rating}, ${normalizedProduct.reviewCount}, ${JSON.stringify(normalizedProduct.colorImages || {})}
      )
      ON CONFLICT (id) DO UPDATE SET
        slug = EXCLUDED.slug,
        name = EXCLUDED.name,
        collection_slug = EXCLUDED.collection_slug,
        collection_name = EXCLUDED.collection_name,
        category = EXCLUDED.category,
        price = EXCLUDED.price,
        badge = EXCLUDED.badge,
        image = EXCLUDED.image,
        secondary_image = EXCLUDED.secondary_image,
        image_alt = EXCLUDED.image_alt,
        colors = EXCLUDED.colors,
        color_hex = EXCLUDED.color_hex,
        variants = EXCLUDED.variants,
        description = EXCLUDED.description,
        story = EXCLUDED.story,
        details = EXCLUDED.details,
        care = EXCLUDED.care,
        material = EXCLUDED.material,
        fit = EXCLUDED.fit,
        rating = EXCLUDED.rating,
        review_count = EXCLUDED.review_count,
        color_images = EXCLUDED.color_images;
    `;
    return true;
  } catch (error) {
    console.error('Failed to save product to Neon Postgres:', error);
    throw error;
  }
}

export async function deleteDbProduct(productId: string): Promise<boolean> {
  if (!isDbConfigured) return false;
  try {
    await sql`
      DELETE FROM products
      WHERE id = ${productId} OR slug = ${productId}
    `;
    return true;
  } catch (error) {
    console.error('Failed to delete product from Neon Postgres:', error);
    throw error;
  }
}

export interface StockSelection {
  color: string;
  size: string;
  quantity: number;
}

async function persistProduct(product: Product, slug: string) {
  if (isDbConfigured) {
    await saveDbProduct(product);
    return;
  }
  const index = mockProducts.findIndex((candidate) => candidate.slug === slug || candidate.id === product.id);
  if (index > -1) mockProducts[index] = product;
}

/** Decrement stock for a purchase. Validates availability first and throws if short. */
export async function applyDbProductStockDelta(slug: string, selections: StockSelection[]): Promise<Product | undefined> {
  const product = await getDbProduct(slug);
  if (!product) return undefined;

  const normalizedSelections = selections.map((selection) => ({
    ...selection,
    quantity: Math.max(1, Math.floor(Number(selection.quantity) || 1))
  }));

  for (const selection of normalizedSelections) {
    const variant = product.variants.find(
      (candidate) => candidate.color === selection.color && candidate.size === selection.size
    );

    if (!variant || !isVariantInStock(variant)) {
      throw new Error(`${selection.color} / ${selection.size} is out of stock.`);
    }

    if (typeof variant.inventory === 'number' && variant.inventory < selection.quantity) {
      throw new Error(`Only ${variant.inventory} left for ${selection.color} / ${selection.size}.`);
    }
  }

  const nextProduct: Product = {
    ...product,
    variants: product.variants.map((variant) => {
      const orderedQuantity = normalizedSelections
        .filter((selection) => selection.color === variant.color && selection.size === variant.size)
        .reduce((sum, selection) => sum + selection.quantity, 0);

      if (!orderedQuantity || typeof variant.inventory !== 'number') {
        return variant;
      }

      const nextInventory = Math.max(variant.inventory - orderedQuantity, 0);
      return {
        ...variant,
        inventory: nextInventory,
        stockStatus: nextInventory === 0 ? 'out_of_stock' : 'in_stock'
      };
    })
  };

  await persistProduct(nextProduct, slug);
  return nextProduct;
}

/**
 * Give reserved stock back. Used to roll back a reservation when the order row
 * fails to persist, so a failed checkout never silently eats inventory.
 */
export async function restoreDbProductStock(slug: string, selections: StockSelection[]): Promise<void> {
  const product = await getDbProduct(slug);
  if (!product) return;

  const nextProduct: Product = {
    ...product,
    variants: product.variants.map((variant) => {
      const returnedQuantity = selections
        .filter((selection) => selection.color === variant.color && selection.size === variant.size)
        .reduce((sum, selection) => sum + Math.max(1, Math.floor(Number(selection.quantity) || 1)), 0);

      // Untracked variants (inventory === null) have nothing to give back.
      if (!returnedQuantity || typeof variant.inventory !== 'number') {
        return variant;
      }

      const nextInventory = variant.inventory + returnedQuantity;
      return {
        ...variant,
        inventory: nextInventory,
        stockStatus: nextInventory === 0 ? 'out_of_stock' : 'in_stock'
      };
    })
  };

  await persistProduct(nextProduct, slug);
}

// ----------------------------------------------------
// Drops Getters / Setters
// ----------------------------------------------------
export async function getDbDrops(): Promise<Drop[]> {
  if (!isDbConfigured) return mockDrops;
  try {
    const rows = await sql`SELECT * FROM drops ORDER BY release_date DESC`;
    return rows.map(mapDropRow);
  } catch (error) {
    console.error('Failed to fetch drops from Neon Postgres, using fallback:', error);
    return mockDrops;
  }
}

export async function getDbDrop(slug: string): Promise<Drop | undefined> {
  if (!isDbConfigured) return mockDrops.find((d) => d.slug === slug);
  try {
    const rows = await sql`SELECT * FROM drops WHERE slug = ${slug} LIMIT 1`;
    if (!rows || rows.length === 0) return undefined;
    return mapDropRow(rows[0]);
  } catch (error) {
    console.error(`Failed to fetch drop ${slug} from Neon Postgres, using fallback:`, error);
    return mockDrops.find((d) => d.slug === slug);
  }
}

export async function saveDbDrop(d: Drop): Promise<boolean> {
  if (!isDbConfigured) return false;
  try {
    const dropReleaseDate = new Date(d.releaseDate).toISOString();
    await sql`
      INSERT INTO drops (slug, name, status, release_date, item_count, summary, image)
      VALUES (${d.slug}, ${d.name}, ${d.status}, ${dropReleaseDate}, ${d.itemCount}, ${d.summary}, ${d.image})
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        status = EXCLUDED.status,
        release_date = EXCLUDED.release_date,
        item_count = EXCLUDED.item_count,
        summary = EXCLUDED.summary,
        image = EXCLUDED.image;
    `;
    return true;
  } catch (error) {
    console.error('Failed to save drop to Neon Postgres:', error);
    throw error;
  }
}

// ----------------------------------------------------
// Collections Getters / Setters
// ----------------------------------------------------
export async function getDbCollections(): Promise<Collection[]> {
  if (!isDbConfigured) return mockCollections;
  try {
    const rows = await sql`SELECT * FROM collections ORDER BY created_at DESC`;
    return rows.map(mapCollectionRow);
  } catch (error) {
    console.error('Failed to fetch collections from Neon Postgres, using fallback:', error);
    return mockCollections;
  }
}

export async function getDbCollection(slug: string): Promise<Collection | undefined> {
  if (!isDbConfigured) return mockCollections.find((c) => c.slug === slug);
  try {
    const rows = await sql`SELECT * FROM collections WHERE slug = ${slug} LIMIT 1`;
    if (!rows || rows.length === 0) return undefined;
    return mapCollectionRow(rows[0]);
  } catch (error) {
    console.error(`Failed to fetch collection ${slug} from Neon Postgres, using fallback:`, error);
    return mockCollections.find((c) => c.slug === slug);
  }
}

export async function saveDbCollection(c: Collection): Promise<boolean> {
  if (!isDbConfigured) return false;
  try {
    await sql`
      INSERT INTO collections (slug, name, tagline, description, image, product_slugs)
      VALUES (${c.slug}, ${c.name}, ${c.tagline}, ${c.description}, ${c.image}, ${c.productSlugs})
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        tagline = EXCLUDED.tagline,
        description = EXCLUDED.description,
        image = EXCLUDED.image,
        product_slugs = EXCLUDED.product_slugs;
    `;
    return true;
  } catch (error) {
    console.error('Failed to save collection to Neon Postgres:', error);
    throw error;
  }
}

// ----------------------------------------------------
// Lookbooks Getters / Setters
// ----------------------------------------------------
export async function getDbLookbooks(): Promise<LookbookIssue[]> {
  if (!isDbConfigured) return mockLookbooks;
  try {
    const rows = await sql`SELECT * FROM lookbooks ORDER BY created_at DESC`;
    return rows.map(mapLookbookRow);
  } catch (error) {
    console.error('Failed to fetch lookbooks from Neon Postgres, using fallback:', error);
    return mockLookbooks;
  }
}

export async function getDbLookbook(slug: string): Promise<LookbookIssue | undefined> {
  if (!isDbConfigured) return mockLookbooks.find((l) => l.slug === slug);
  try {
    const rows = await sql`SELECT * FROM lookbooks WHERE slug = ${slug} LIMIT 1`;
    if (!rows || rows.length === 0) return undefined;
    return mapLookbookRow(rows[0]);
  } catch (error) {
    console.error(`Failed to fetch lookbook ${slug} from Neon Postgres, using fallback:`, error);
    return mockLookbooks.find((l) => l.slug === slug);
  }
}

export async function saveDbLookbook(l: LookbookIssue): Promise<boolean> {
  if (!isDbConfigured) return false;
  try {
    await sql`
      INSERT INTO lookbooks (slug, title, season, dek, image, featured_product_slugs)
      VALUES (${l.slug}, ${l.title}, ${l.season}, ${l.dek}, ${l.image}, ${l.featuredProductSlugs})
      ON CONFLICT (slug) DO UPDATE SET
        title = EXCLUDED.title,
        season = EXCLUDED.season,
        dek = EXCLUDED.dek,
        image = EXCLUDED.image,
        featured_product_slugs = EXCLUDED.featured_product_slugs;
    `;
    return true;
  } catch (error) {
    console.error('Failed to save lookbook to Neon Postgres:', error);
    throw error;
  }
}

// ----------------------------------------------------
// Waitlist Getters / Setters
// ----------------------------------------------------
export async function getDbWaitlist(): Promise<WaitlistSignup[]> {
  if (!isDbConfigured) return [];
  try {
    const rows = await sql`SELECT * FROM waitlist ORDER BY created_at DESC`;
    return rows.map((row: any) => ({
      id: row.id,
      email: row.email,
      dropSlug: row.drop_slug,
      createdAt: new Date(row.created_at).toISOString()
    }));
  } catch (error) {
    console.error('Failed to fetch waitlist signups from Neon Postgres:', error);
    return [];
  }
}

export async function addWaitlistSignup(email: string, dropSlug: string): Promise<boolean> {
  if (!isDbConfigured) return false;
  try {
    await sql`
      INSERT INTO waitlist (email, drop_slug) VALUES (${email}, ${dropSlug});
    `;
    return true;
  } catch (error) {
    console.error('Failed to save waitlist signup to Neon Postgres:', error);
    return false;
  }
}

// In-memory fallback for sandbox orders
let sandboxOrders: Order[] = [];

/**
 * The original schema stored every purchased variant flattened into a single
 * `selected_size VARCHAR(50)`. Postgres rejects (never truncates) an oversized
 * value, so any order with three or more variants failed to insert outright.
 * This widens those columns and adds the real line-item columns. Idempotent, and
 * memoised so it costs one round trip per process rather than one per request.
 */
let ordersSchemaPromise: Promise<void> | null = null;

async function ensureOrdersSchema(): Promise<void> {
  if (!isDbConfigured) return;

  if (!ordersSchemaPromise) {
    ordersSchemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS orders (
          id SERIAL PRIMARY KEY,
          product_id VARCHAR(100) NOT NULL,
          product_name VARCHAR(255) NOT NULL,
          product_slug VARCHAR(255) NOT NULL,
          selected_color TEXT NOT NULL,
          selected_size TEXT NOT NULL,
          price NUMERIC NOT NULL,
          customer_name VARCHAR(255) NOT NULL,
          customer_phone VARCHAR(100) NOT NULL,
          customer_email VARCHAR(255) NOT NULL,
          shipping_address TEXT NOT NULL,
          shipping_city VARCHAR(255) NOT NULL,
          payment_method VARCHAR(100) NOT NULL,
          momo_network VARCHAR(100),
          momo_number VARCHAR(100),
          status VARCHAR(100) DEFAULT 'Pending',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;

      const narrowColumns = await sql`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'orders'
          AND column_name IN ('selected_color', 'selected_size')
          AND data_type <> 'text'
      `;

      if (narrowColumns.length > 0) {
        await sql`
          ALTER TABLE orders
            ALTER COLUMN selected_color TYPE TEXT,
            ALTER COLUMN selected_size TYPE TEXT
        `;
      }

      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb`;
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_quantity INTEGER NOT NULL DEFAULT 1`;
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC`;
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_charge NUMERIC`;
    })().catch((error) => {
      // Let the next caller retry rather than caching a permanent failure.
      ordersSchemaPromise = null;
      throw error;
    });
  }

  return ordersSchemaPromise;
}

/**
 * Reconstruct line items for rows written before `items` existed, where the
 * variants live in a string like "Obsidian Black / M (x2), Oxide Bone / L".
 */
export function parseLegacyOrderItems(row: any, grandTotal: number): OrderItem[] {
  const summary = String(row.selected_size || '').trim();
  if (!summary) return [];

  const fallbackColor = String(row.selected_color || '').split(',')[0]?.trim() || '';

  const parsed = summary
    .split(',')
    .map((part: string) => part.trim())
    .filter(Boolean)
    .map((part: string) => {
      const quantityMatch = part.match(/\(x(\d+)\)\s*$/i);
      const quantity = quantityMatch ? Number(quantityMatch[1]) : 1;
      const label = quantityMatch ? part.slice(0, quantityMatch.index).trim() : part;

      const [first, second] = label.split('/').map((segment) => segment.trim());
      return {
        color: second ? first : fallbackColor,
        size: second || first,
        quantity
      };
    });

  const totalQuantity = parsed.reduce((sum, item) => sum + item.quantity, 0) || 1;
  // Stored price includes the service charge; back it out to approximate unit price.
  const subtotal = grandTotal / (1 + SERVICE_CHARGE_RATE);
  const unitPrice = Math.round((subtotal / totalQuantity) * 100) / 100;

  return parsed.map((item) => ({
    productId: row.product_id,
    productSlug: row.product_slug,
    productName: row.product_name,
    color: item.color,
    size: item.size,
    sku: '',
    quantity: item.quantity,
    unitPrice,
    lineTotal: Math.round(unitPrice * item.quantity * 100) / 100
  }));
}

function mapOrderRow(row: any): Order {
  const price = Number(row.price);
  const rawItems = typeof row.items === 'string' ? JSON.parse(row.items) : row.items;

  const items: OrderItem[] =
    Array.isArray(rawItems) && rawItems.length > 0 ? rawItems : parseLegacyOrderItems(row, price);

  const totalQuantity =
    Number(row.total_quantity) || items.reduce((sum, item) => sum + item.quantity, 0) || 1;

  const subtotal =
    row.subtotal != null
      ? Number(row.subtotal)
      : Math.round((price / (1 + SERVICE_CHARGE_RATE)) * 100) / 100;

  const serviceCharge =
    row.service_charge != null ? Number(row.service_charge) : Math.round((price - subtotal) * 100) / 100;

  return {
    id: Number(row.id),
    productId: row.product_id,
    productName: row.product_name,
    productSlug: row.product_slug,
    selectedColor: row.selected_color,
    selectedSize: row.selected_size,
    items,
    totalQuantity,
    subtotal,
    serviceCharge,
    price,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    shippingAddress: row.shipping_address,
    shippingCity: row.shipping_city,
    paymentMethod: row.payment_method,
    momoNetwork: row.momo_network || undefined,
    momoNumber: row.momo_number || undefined,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString()
  };
}

export async function getDbOrders(): Promise<Order[]> {
  if (!isDbConfigured) return sandboxOrders;
  try {
    await ensureOrdersSchema();
    const rows = await sql`SELECT * FROM orders ORDER BY created_at DESC`;
    return rows.map(mapOrderRow);
  } catch (error) {
    console.error('Failed to fetch orders from Neon Postgres, using fallback:', error);
    return sandboxOrders;
  }
}

/** Guards against a Paystack reference being replayed into several orders. */
export async function findDbOrderByPaymentRef(reference: string): Promise<Order | undefined> {
  if (!reference) return undefined;

  if (!isDbConfigured) {
    return sandboxOrders.find((order) => order.momoNumber === reference);
  }

  try {
    await ensureOrdersSchema();
    const rows = await sql`SELECT * FROM orders WHERE momo_number = ${reference} LIMIT 1`;
    return rows.length > 0 ? mapOrderRow(rows[0]) : undefined;
  } catch (error) {
    console.error('Failed to look up order by payment reference:', error);
    return undefined;
  }
}

export async function addDbOrder(o: Omit<Order, 'id' | 'createdAt'>): Promise<Order> {
  if (!isDbConfigured) {
    const newOrder: Order = {
      ...o,
      id: Math.floor(Math.random() * 100000),
      createdAt: new Date().toISOString()
    };
    sandboxOrders.unshift(newOrder);
    return newOrder;
  }
  try {
    await ensureOrdersSchema();
    const rows = await sql`
      INSERT INTO orders (
        product_id, product_name, product_slug, selected_color, selected_size, price,
        customer_name, customer_phone, customer_email, shipping_address, shipping_city,
        payment_method, momo_network, momo_number, status,
        items, total_quantity, subtotal, service_charge
      ) VALUES (
        ${o.productId}, ${o.productName}, ${o.productSlug}, ${o.selectedColor}, ${o.selectedSize}, ${o.price},
        ${o.customerName}, ${o.customerPhone}, ${o.customerEmail}, ${o.shippingAddress}, ${o.shippingCity},
        ${o.paymentMethod}, ${o.momoNetwork || null}, ${o.momoNumber || null}, ${o.status || 'Pending'},
        ${JSON.stringify(o.items || [])}, ${o.totalQuantity}, ${o.subtotal}, ${o.serviceCharge}
      )
      RETURNING *;
    `;
    return mapOrderRow(rows[0]);
  } catch (error) {
    console.error('Failed to save order to Neon Postgres:', error);
    throw error;
  }
}

export async function deleteDbOrder(id: number): Promise<boolean> {
  if (!isDbConfigured) {
    const idx = sandboxOrders.findIndex((o) => o.id === id);
    if (idx !== -1) {
      sandboxOrders.splice(idx, 1);
      return true;
    }
    return false;
  }
  try {
    await sql`
      DELETE FROM orders
      WHERE id = ${id}
    `;
    return true;
  } catch (error) {
    console.error('Failed to delete order from Neon Postgres:', error);
    throw error;
  }
}
