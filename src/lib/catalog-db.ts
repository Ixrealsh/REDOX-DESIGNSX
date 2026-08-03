import { isDbConfigured, sql } from './db';
import { 
  products as mockProducts, 
  drops as mockDrops,
  collections as mockCollections,
  lookbooks as mockLookbooks
} from '@/data/catalog';
import { isVariantInStock, normalizeVariantStock } from '@/lib/inventory';
import { SERVICE_CHARGE_RATE } from '@/lib/format';
import type {
  Product,
  Drop,
  Collection,
  LookbookIssue,
  Order,
  OrderItem,
  PaymentStatus,
  PaymentVerificationSource
} from '@/types/product';

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
 * This widens those columns, adds the real line-item columns, and adds the
 * payment ledger. Idempotent, and memoised so it costs one round trip per
 * process rather than one per request.
 */
let ordersSchemaPromise: Promise<void> | null = null;

/** Applied exactly once across every instance, guarded by `schema_migrations`. */
const PAYMENT_LEDGER_MIGRATION = 'orders_payment_ledger_v1';

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

      // One ALTER, not seventeen: this runs on every cold start, and each Neon
      // round trip is latency a waiting customer pays for.
      await sql`
        ALTER TABLE orders
          ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb,
          ADD COLUMN IF NOT EXISTS total_quantity INTEGER NOT NULL DEFAULT 1,
          ADD COLUMN IF NOT EXISTS subtotal NUMERIC,
          ADD COLUMN IF NOT EXISTS service_charge NUMERIC,
          ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
          ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(120),
          ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE,
          ADD COLUMN IF NOT EXISTS amount_paid NUMERIC,
          ADD COLUMN IF NOT EXISTS payment_channel VARCHAR(60),
          ADD COLUMN IF NOT EXISTS paystack_transaction_id VARCHAR(64),
          ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMP WITH TIME ZONE,
          ADD COLUMN IF NOT EXISTS payment_verified_by VARCHAR(20),
          ADD COLUMN IF NOT EXISTS gateway_response TEXT,
          ADD COLUMN IF NOT EXISTS payment_note TEXT,
          ADD COLUMN IF NOT EXISTS stock_reserved BOOLEAN NOT NULL DEFAULT TRUE,
          ADD COLUMN IF NOT EXISTS stock_released BOOLEAN NOT NULL DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS sms_sent BOOLEAN NOT NULL DEFAULT FALSE
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          name VARCHAR(160) PRIMARY KEY,
          applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;

      /**
       * Rows written by the old flow only ever existed *after* Paystack had
       * verified the charge, so they are genuinely paid and must not surface as
       * "unpaid" in the new admin view.
       *
       * The claim and the backfill share one statement on purpose: only the
       * instance that wins the INSERT sees a row from `claim`, and the UPDATE
       * runs against that statement's snapshot, so an order inserted by another
       * instance a millisecond later can never be swept up by it.
       */
      await sql`
        WITH claim AS (
          INSERT INTO schema_migrations (name)
          VALUES (${PAYMENT_LEDGER_MIGRATION})
          ON CONFLICT (name) DO NOTHING
          RETURNING name
        )
        UPDATE orders SET
          payment_status = 'paid',
          payment_reference = COALESCE(payment_reference, momo_number),
          paid_at = COALESCE(paid_at, created_at),
          amount_paid = COALESCE(amount_paid, price),
          payment_verified_by = COALESCE(payment_verified_by, 'legacy'),
          last_verified_at = COALESCE(last_verified_at, created_at),
          sms_sent = TRUE,
          stock_reserved = TRUE,
          stock_released = FALSE
        WHERE EXISTS (SELECT 1 FROM claim)
          AND payment_method = 'PAYSTACK'
          AND payment_status = 'unpaid';
      `;

      // Non-Paystack legacy rows keep their fulfilment status but are marked as
      // notified, so reconciliation never re-sends their confirmation SMS.
      await sql`
        UPDATE orders SET sms_sent = TRUE
        WHERE sms_sent = FALSE
          AND payment_method <> 'PAYSTACK'
          AND created_at < (SELECT COALESCE(applied_at, NOW()) FROM schema_migrations WHERE name = ${PAYMENT_LEDGER_MIGRATION});
      `;

      // Indexes are an optimisation, not a correctness requirement: a duplicate
      // left behind by an older build must not take checkout down with it.
      try {
        await sql`
          CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_reference_uidx
          ON orders (payment_reference) WHERE payment_reference IS NOT NULL
        `;
      } catch (error) {
        console.error('[orders] Could not create the unique payment_reference index:', error);
      }

      try {
        await sql`
          CREATE INDEX IF NOT EXISTS orders_payment_status_idx
          ON orders (payment_status, created_at DESC)
        `;
      } catch (error) {
        console.error('[orders] Could not create the payment_status index:', error);
      }
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

function toIso(value: any): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
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
    createdAt: new Date(row.created_at).toISOString(),

    paymentStatus: (row.payment_status as PaymentStatus) || 'unpaid',
    paymentReference: row.payment_reference || row.momo_number || undefined,
    paidAt: toIso(row.paid_at),
    amountPaid: row.amount_paid != null ? Number(row.amount_paid) : undefined,
    paymentChannel: row.payment_channel || undefined,
    paystackTransactionId: row.paystack_transaction_id || undefined,
    lastVerifiedAt: toIso(row.last_verified_at),
    paymentVerifiedBy: (row.payment_verified_by as PaymentVerificationSource) || undefined,
    gatewayResponse: row.gateway_response || undefined,
    paymentNote: row.payment_note || undefined,
    stockReserved: row.stock_reserved !== false,
    stockReleased: row.stock_released === true,
    smsSent: row.sms_sent === true
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

/**
 * Guards against a Paystack reference being replayed into several orders, and
 * is the lookup every post-payment path uses. `momo_number` is still consulted
 * because rows written before the dedicated column existed stored it there.
 */
export async function findDbOrderByPaymentRef(reference: string): Promise<Order | undefined> {
  if (!reference) return undefined;

  if (!isDbConfigured) {
    return sandboxOrders.find(
      (order) => order.paymentReference === reference || order.momoNumber === reference
    );
  }

  try {
    await ensureOrdersSchema();
    const rows = await sql`
      SELECT * FROM orders
      WHERE payment_reference = ${reference} OR momo_number = ${reference}
      ORDER BY id DESC
      LIMIT 1
    `;
    return rows.length > 0 ? mapOrderRow(rows[0]) : undefined;
  } catch (error) {
    console.error('Failed to look up order by payment reference:', error);
    return undefined;
  }
}

export async function getDbOrderById(id: number): Promise<Order | undefined> {
  if (!Number.isFinite(id)) return undefined;

  if (!isDbConfigured) {
    return sandboxOrders.find((order) => order.id === id);
  }

  try {
    await ensureOrdersSchema();
    const rows = await sql`SELECT * FROM orders WHERE id = ${id} LIMIT 1`;
    return rows.length > 0 ? mapOrderRow(rows[0]) : undefined;
  } catch (error) {
    console.error(`Failed to load order #${id}:`, error);
    return undefined;
  }
}

export type NewOrderInput = Omit<Order, 'id' | 'createdAt' | 'paymentStatus' | 'stockReserved' | 'stockReleased' | 'smsSent'> &
  Partial<Pick<Order, 'paymentStatus' | 'stockReserved' | 'stockReleased' | 'smsSent'>>;

export async function addDbOrder(o: NewOrderInput): Promise<Order> {
  const defaults = {
    paymentStatus: o.paymentStatus || ('unpaid' as PaymentStatus),
    stockReserved: o.stockReserved !== false,
    stockReleased: o.stockReleased === true,
    smsSent: o.smsSent === true
  };

  if (!isDbConfigured) {
    const newOrder: Order = {
      ...o,
      ...defaults,
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
        items, total_quantity, subtotal, service_charge,
        payment_status, payment_reference, paid_at, amount_paid, payment_channel,
        paystack_transaction_id, last_verified_at, payment_verified_by, gateway_response,
        stock_reserved, stock_released, sms_sent
      ) VALUES (
        ${o.productId}, ${o.productName}, ${o.productSlug}, ${o.selectedColor}, ${o.selectedSize}, ${o.price},
        ${o.customerName}, ${o.customerPhone}, ${o.customerEmail}, ${o.shippingAddress}, ${o.shippingCity},
        ${o.paymentMethod}, ${o.momoNetwork || null}, ${o.momoNumber || o.paymentReference || null}, ${o.status || 'Pending'},
        ${JSON.stringify(o.items || [])}, ${o.totalQuantity}, ${o.subtotal}, ${o.serviceCharge},
        ${defaults.paymentStatus}, ${o.paymentReference || null}, ${o.paidAt || null}, ${o.amountPaid ?? null},
        ${o.paymentChannel || null}, ${o.paystackTransactionId || null}, ${o.lastVerifiedAt || null},
        ${o.paymentVerifiedBy || null}, ${o.gatewayResponse || null},
        ${defaults.stockReserved}, ${defaults.stockReleased}, ${defaults.smsSent}
      )
      RETURNING *;
    `;
    return mapOrderRow(rows[0]);
  } catch (error) {
    console.error('Failed to save order to Neon Postgres:', error);
    throw error;
  }
}

/**
 * Rewrites a freshly created order's reference so it carries the order number
 * (`RDX-1042-9F3A21`), which makes the Paystack dashboard readable without a
 * lookup. Best-effort: the temporary reference is already unique and valid, so
 * a failure here must not fail the checkout.
 */
export async function rebrandDbOrderReference(id: number, reference: string): Promise<boolean> {
  if (!isDbConfigured) {
    const order = sandboxOrders.find((candidate) => candidate.id === id);
    if (!order) return false;
    order.paymentReference = reference;
    order.momoNumber = reference;
    return true;
  }

  try {
    const rows = await sql`
      UPDATE orders
      SET payment_reference = ${reference}, momo_number = ${reference}
      WHERE id = ${id} AND payment_status = 'unpaid'
      RETURNING id
    `;
    return rows.length > 0;
  } catch (error) {
    console.error(`Could not upgrade the payment reference for order #${id}:`, error);
    return false;
  }
}

// ----------------------------------------------------------------
// Payment ledger transitions
//
// Every transition below is expressed as a conditional UPDATE that returns the
// row only when *this* caller actually changed it. The client callback, the
// Paystack webhook, the reconciliation sweep and the admin panel all race each
// other by design; `transitioned` tells the winner it owns the side effects
// (SMS, stock) so they happen exactly once.
// ----------------------------------------------------------------

export interface LedgerTransition {
  transitioned: boolean;
  order?: Order;
}

export interface MarkPaidInput {
  amountPaid: number;
  paidAt?: string;
  channel?: string;
  transactionId?: string;
  gatewayResponse?: string;
  note?: string;
  source: PaymentVerificationSource;
}

export async function markDbOrderPaid(id: number, input: MarkPaidInput): Promise<LedgerTransition> {
  const paidAt = input.paidAt || new Date().toISOString();

  if (!isDbConfigured) {
    const order = sandboxOrders.find((candidate) => candidate.id === id);
    if (!order) return { transitioned: false };
    if (order.paymentStatus === 'paid') return { transitioned: false, order };

    order.paymentStatus = 'paid';
    order.paidAt = order.paidAt || paidAt;
    order.amountPaid = input.amountPaid;
    order.paymentChannel = input.channel || order.paymentChannel;
    order.paystackTransactionId = input.transactionId || order.paystackTransactionId;
    order.gatewayResponse = input.gatewayResponse || order.gatewayResponse;
    order.paymentNote = input.note || order.paymentNote;
    order.paymentVerifiedBy = input.source;
    order.lastVerifiedAt = new Date().toISOString();
    if (order.status === 'Awaiting Payment' || order.status === 'Payment Failed') order.status = 'Pending';
    return { transitioned: true, order };
  }

  await ensureOrdersSchema();
  const rows = await sql`
    UPDATE orders SET
      payment_status = 'paid',
      status = CASE WHEN status IN ('Awaiting Payment', 'Payment Failed') THEN 'Pending' ELSE status END,
      paid_at = COALESCE(paid_at, ${paidAt}),
      amount_paid = ${input.amountPaid},
      payment_channel = COALESCE(${input.channel || null}, payment_channel),
      paystack_transaction_id = COALESCE(${input.transactionId || null}, paystack_transaction_id),
      gateway_response = COALESCE(${input.gatewayResponse || null}, gateway_response),
      payment_note = COALESCE(${input.note || null}, payment_note),
      payment_verified_by = ${input.source},
      last_verified_at = NOW()
    WHERE id = ${id} AND payment_status <> 'paid'
    RETURNING *;
  `;

  if (rows.length > 0) {
    return { transitioned: true, order: mapOrderRow(rows[0]) };
  }
  return { transitioned: false, order: await getDbOrderById(id) };
}

export interface MarkUnsuccessfulInput {
  status: Extract<PaymentStatus, 'failed' | 'abandoned'>;
  gatewayResponse?: string;
  note?: string;
  source: PaymentVerificationSource;
}

/**
 * Records a non-payment. Paid and refunded orders are deliberately untouchable
 * here — a late "abandoned" event must never un-pay a settled order.
 */
export async function markDbOrderUnsuccessful(
  id: number,
  input: MarkUnsuccessfulInput
): Promise<LedgerTransition> {
  if (!isDbConfigured) {
    const order = sandboxOrders.find((candidate) => candidate.id === id);
    if (!order || order.paymentStatus === 'paid' || order.paymentStatus === 'refunded') {
      return { transitioned: false, order };
    }
    const changed = order.paymentStatus !== input.status;
    order.paymentStatus = input.status;
    order.gatewayResponse = input.gatewayResponse || order.gatewayResponse;
    order.paymentNote = input.note || order.paymentNote;
    order.paymentVerifiedBy = input.source;
    order.lastVerifiedAt = new Date().toISOString();
    if (order.status === 'Awaiting Payment') order.status = 'Payment Failed';
    return { transitioned: changed, order };
  }

  await ensureOrdersSchema();
  const rows = await sql`
    UPDATE orders SET
      payment_status = ${input.status},
      status = CASE WHEN status = 'Awaiting Payment' THEN 'Payment Failed' ELSE status END,
      gateway_response = COALESCE(${input.gatewayResponse || null}, gateway_response),
      payment_note = COALESCE(${input.note || null}, payment_note),
      payment_verified_by = ${input.source},
      last_verified_at = NOW()
    WHERE id = ${id}
      AND payment_status NOT IN ('paid', 'refunded')
      AND payment_status <> ${input.status}
    RETURNING *;
  `;

  if (rows.length > 0) {
    return { transitioned: true, order: mapOrderRow(rows[0]) };
  }
  return { transitioned: false, order: await getDbOrderById(id) };
}

/** Records that the gateway (or the merchant) sent the money back. */
export async function markDbOrderRefunded(id: number, note?: string): Promise<LedgerTransition> {
  if (!isDbConfigured) {
    const order = sandboxOrders.find((candidate) => candidate.id === id);
    if (!order || order.paymentStatus === 'refunded') return { transitioned: false, order };
    order.paymentStatus = 'refunded';
    order.paymentNote = note || order.paymentNote;
    order.lastVerifiedAt = new Date().toISOString();
    return { transitioned: true, order };
  }

  await ensureOrdersSchema();
  const rows = await sql`
    UPDATE orders SET
      payment_status = 'refunded',
      payment_note = COALESCE(${note || null}, payment_note),
      last_verified_at = NOW()
    WHERE id = ${id} AND payment_status <> 'refunded'
    RETURNING *;
  `;

  if (rows.length > 0) return { transitioned: true, order: mapOrderRow(rows[0]) };
  return { transitioned: false, order: await getDbOrderById(id) };
}

/** Marks an order unpaid again — the admin's undo for a manual confirmation. */
export async function revertDbOrderToUnpaid(id: number, note?: string): Promise<LedgerTransition> {
  if (!isDbConfigured) {
    const order = sandboxOrders.find((candidate) => candidate.id === id);
    if (!order) return { transitioned: false };
    order.paymentStatus = 'unpaid';
    order.paidAt = undefined;
    order.amountPaid = undefined;
    order.paymentNote = note || order.paymentNote;
    order.paymentVerifiedBy = 'admin';
    return { transitioned: true, order };
  }

  await ensureOrdersSchema();
  const rows = await sql`
    UPDATE orders SET
      payment_status = 'unpaid',
      paid_at = NULL,
      amount_paid = NULL,
      payment_note = COALESCE(${note || null}, payment_note),
      payment_verified_by = 'admin',
      last_verified_at = NOW()
    WHERE id = ${id} AND payment_status <> 'unpaid'
    RETURNING *;
  `;

  if (rows.length > 0) return { transitioned: true, order: mapOrderRow(rows[0]) };
  return { transitioned: false, order: await getDbOrderById(id) };
}

/** Stamps a verification attempt that produced no state change, for the audit trail. */
export async function touchDbOrderVerification(id: number, gatewayResponse?: string): Promise<void> {
  if (!isDbConfigured) {
    const order = sandboxOrders.find((candidate) => candidate.id === id);
    if (order) {
      order.lastVerifiedAt = new Date().toISOString();
      if (gatewayResponse) order.gatewayResponse = gatewayResponse;
    }
    return;
  }

  try {
    await sql`
      UPDATE orders
      SET last_verified_at = NOW(), gateway_response = COALESCE(${gatewayResponse || null}, gateway_response)
      WHERE id = ${id}
    `;
  } catch (error) {
    console.error(`Could not stamp verification on order #${id}:`, error);
  }
}

/**
 * Claims the right to hand this order's reserved stock back. Returns the order
 * only to the single caller that wins, so inventory can never be credited twice
 * — and never for an order that has been paid.
 */
export async function claimDbOrderStockRelease(id: number): Promise<Order | undefined> {
  if (!isDbConfigured) {
    const order = sandboxOrders.find((candidate) => candidate.id === id);
    if (!order || !order.stockReserved || order.stockReleased || order.paymentStatus === 'paid') {
      return undefined;
    }
    order.stockReleased = true;
    return order;
  }

  await ensureOrdersSchema();
  const rows = await sql`
    UPDATE orders SET stock_released = TRUE
    WHERE id = ${id}
      AND stock_reserved = TRUE
      AND stock_released = FALSE
      AND payment_status <> 'paid'
    RETURNING *;
  `;
  return rows.length > 0 ? mapOrderRow(rows[0]) : undefined;
}

/** Undoes a stock-release claim when the inventory write itself failed. */
export async function unclaimDbOrderStockRelease(id: number): Promise<void> {
  if (!isDbConfigured) {
    const order = sandboxOrders.find((candidate) => candidate.id === id);
    if (order) order.stockReleased = false;
    return;
  }

  try {
    await sql`UPDATE orders SET stock_released = FALSE WHERE id = ${id}`;
  } catch (error) {
    console.error(`Could not roll back the stock-release claim on order #${id}:`, error);
  }
}

/**
 * Flips a released reservation back to held, after a late payment forced us to
 * take the units out of inventory a second time.
 */
export async function reclaimDbOrderStockReservation(id: number): Promise<void> {
  if (!isDbConfigured) {
    const order = sandboxOrders.find((candidate) => candidate.id === id);
    if (order) order.stockReleased = false;
    return;
  }

  try {
    await sql`UPDATE orders SET stock_reserved = TRUE, stock_released = FALSE WHERE id = ${id}`;
  } catch (error) {
    console.error(`Could not re-hold the stock reservation on order #${id}:`, error);
  }
}

/** Appends an operational note to an order without touching its payment state. */
export async function annotateDbOrderPayment(id: number, note: string): Promise<void> {
  if (!isDbConfigured) {
    const order = sandboxOrders.find((candidate) => candidate.id === id);
    if (order) order.paymentNote = order.paymentNote ? `${order.paymentNote} | ${note}` : note;
    return;
  }

  try {
    await sql`
      UPDATE orders
      SET payment_note = CASE
        WHEN payment_note IS NULL OR payment_note = '' THEN ${note}
        WHEN payment_note LIKE ${'%' + note + '%'} THEN payment_note
        ELSE payment_note || ' | ' || ${note}
      END
      WHERE id = ${id}
    `;
  } catch (error) {
    console.error(`Could not annotate order #${id}:`, error);
  }
}

/** Claims the right to send this order's confirmation SMS, exactly once. */
export async function claimDbOrderSms(id: number): Promise<boolean> {
  if (!isDbConfigured) {
    const order = sandboxOrders.find((candidate) => candidate.id === id);
    if (!order || order.smsSent) return false;
    order.smsSent = true;
    return true;
  }

  try {
    await ensureOrdersSchema();
    const rows = await sql`
      UPDATE orders SET sms_sent = TRUE
      WHERE id = ${id} AND sms_sent = FALSE
      RETURNING id
    `;
    return rows.length > 0;
  } catch (error) {
    console.error(`Could not claim the SMS slot for order #${id}:`, error);
    return false;
  }
}

/** Releases the SMS claim so a later run can retry after a delivery failure. */
export async function releaseDbOrderSmsClaim(id: number): Promise<void> {
  if (!isDbConfigured) {
    const order = sandboxOrders.find((candidate) => candidate.id === id);
    if (order) order.smsSent = false;
    return;
  }

  try {
    await sql`UPDATE orders SET sms_sent = FALSE WHERE id = ${id}`;
  } catch (error) {
    console.error(`Could not release the SMS claim on order #${id}:`, error);
  }
}

/**
 * Card orders still waiting on money, oldest first. `minAgeSeconds` keeps the
 * sweep away from customers who are mid-flow on a mobile-money OTP prompt.
 */
export async function listDbOrdersAwaitingPayment(options: {
  minAgeSeconds: number;
  limit: number;
}): Promise<Order[]> {
  const cutoff = Date.now() - options.minAgeSeconds * 1000;

  if (!isDbConfigured) {
    return sandboxOrders
      .filter(
        (order) =>
          order.paymentMethod === 'PAYSTACK' &&
          order.paymentStatus === 'unpaid' &&
          new Date(order.createdAt).getTime() <= cutoff
      )
      .slice(0, options.limit);
  }

  try {
    await ensureOrdersSchema();
    const rows = await sql`
      SELECT * FROM orders
      WHERE payment_method = 'PAYSTACK'
        AND payment_status = 'unpaid'
        AND created_at <= ${new Date(cutoff).toISOString()}
      ORDER BY created_at ASC
      LIMIT ${options.limit}
    `;
    return rows.map(mapOrderRow);
  } catch (error) {
    console.error('Failed to list orders awaiting payment:', error);
    return [];
  }
}

/**
 * Paid orders whose confirmation SMS never went out — because the gateway was
 * down, or the process died between the payment and the send. The sweep retries
 * these so a paying customer is never left without their tracking reference.
 */
export async function listDbOrdersMissingSms(limit: number): Promise<Order[]> {
  if (!isDbConfigured) {
    return sandboxOrders.filter((order) => order.paymentStatus === 'paid' && !order.smsSent).slice(0, limit);
  }

  try {
    await ensureOrdersSchema();
    const rows = await sql`
      SELECT * FROM orders
      WHERE payment_status = 'paid' AND sms_sent = FALSE
      ORDER BY created_at ASC
      LIMIT ${limit}
    `;
    return rows.map(mapOrderRow);
  } catch (error) {
    console.error('Failed to list orders missing their confirmation SMS:', error);
    return [];
  }
}

/** Updates fulfilment status only. Payment state is never touched from here. */
export async function setDbOrderStatus(id: number, status: string): Promise<Order | undefined> {
  if (!isDbConfigured) {
    const order = sandboxOrders.find((candidate) => candidate.id === id);
    if (!order) return undefined;
    order.status = status;
    return order;
  }

  await ensureOrdersSchema();
  const rows = await sql`
    UPDATE orders SET status = ${status} WHERE id = ${id} RETURNING *;
  `;
  return rows.length > 0 ? mapOrderRow(rows[0]) : undefined;
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
