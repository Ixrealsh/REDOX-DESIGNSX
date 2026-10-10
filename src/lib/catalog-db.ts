import { isDbConfigured, sql } from './db';
import { cache } from 'react';
import { parsePublicOrderId } from './order-reference';
import { 
  products as mockProducts, 
  drops as mockDrops,
  collections as mockCollections,
  lookbooks as mockLookbooks
} from '@/data/catalog';
import {
  isProductVisible,
  isVariantInStock,
  normalizeVariantStock,
  visibleProducts
} from '@/lib/inventory';
import { SERVICE_CHARGE_RATE } from '@/lib/format';
import { normalizeWholesaleRule } from '@/lib/wholesale';
import type {
  Product,
  Drop,
  Collection,
  LookbookIssue,
  Order,
  OrderExtra,
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
// Product Row Mapping Helpers
// ----------------------------------------------------
function safeParseJson<T>(val: any, fallback: T): T {
  if (val == null) return fallback;
  if (typeof val === 'object') return val as T;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function safeStringArray(val: any, fallback: string[] = []): string[] {
  if (Array.isArray(val)) return val.map((x) => String(x || '').trim()).filter(Boolean);
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map((x) => String(x || '').trim()).filter(Boolean);
      } catch {}
    }
    // Postgres array format "{item1,item2}"
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return trimmed
        .slice(1, -1)
        .split(',')
        .map((s) => s.replace(/^"|"$/g, '').trim())
        .filter(Boolean);
    }
    return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return fallback;
}

function mapProductRow(row: any): Product {
  const parsedVariants = safeParseJson<any[]>(row.variants, []);
  const variants = Array.isArray(parsedVariants) ? parsedVariants.map(normalizeVariantStock) : [];
  const price = Number(row.price) || 0;

  return {
    id: String(row.id || ''),
    slug: String(row.slug || ''),
    name: String(row.name || ''),
    collectionSlug: String(row.collection_slug || ''),
    collectionName: String(row.collection_name || ''),
    category: String(row.category || ''),
    price,
    visibility: row.visibility === 'hidden' ? 'hidden' : 'visible',
    wholesale: normalizeWholesaleRule(
      { minQuantity: row.wholesale_min_quantity, unitPrice: row.wholesale_price },
      price
    ),
    badge: row.badge || undefined,
    image: String(row.image || ''),
    secondaryImage: row.secondary_image || undefined,
    imageAlt: String(row.image_alt || row.name || ''),
    colors: safeStringArray(row.colors, ['Obsidian Black']),
    colorHex: safeParseJson<Record<string, string>>(row.color_hex, { 'Obsidian Black': '#090909' }),
    variants,
    description: String(row.description || ''),
    story: String(row.story || ''),
    details: safeStringArray(row.details, []),
    care: safeStringArray(row.care, []),
    material: String(row.material || '100% Cotton'),
    fit: String(row.fit || 'True to size'),
    rating: Number(row.rating) || 5.0,
    reviewCount: Number(row.review_count) || 0,
    colorImages: safeParseJson<Record<string, string[]>>(row.color_images, {})
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

/**
 * Brings the products table up to date. Mirrors `ensureOrdersSchema`: additive,
 * idempotent, and memoised so it costs one round trip per process rather than
 * one per request.
 *
 * The table itself is created by the admin panel's "Initialize Database" button,
 * so this only ever adds what a later build needs — it must never be the thing
 * that creates the table, or a fresh deploy would race the seeder.
 */
let productsSchemaPromise: Promise<void> | null = null;

async function ensureProductsSchema(): Promise<void> {
  if (!isDbConfigured) return;

  if (!productsSchemaPromise) {
    productsSchemaPromise = (async () => {
      await sql`
        ALTER TABLE products
          ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'visible',
          ADD COLUMN IF NOT EXISTS wholesale_min_quantity INTEGER,
          ADD COLUMN IF NOT EXISTS wholesale_price NUMERIC
      `;
    })().catch((error) => {
      // Let the next caller retry rather than caching a permanent failure.
      productsSchemaPromise = null;
      throw error;
    });
  }

  return productsSchemaPromise;
}

export const getDbProducts = cache(async (): Promise<Product[]> => {
  if (!isDbConfigured) return mockProducts;
  try {
    await ensureProductsSchema();
    const rows = await sql`SELECT * FROM products ORDER BY created_at DESC`;
    return rows.map(mapProductRow);
  } catch (error) {
    console.error('Failed to fetch products from Neon Postgres:', error);
    throw error;
  }
});

export const getDbProduct = cache(async (slug: string): Promise<Product | undefined> => {
  if (!slug) return undefined;
  const decoded = decodeURIComponent(slug).trim();
  const raw = slug.trim();

  const findInMock = () =>
    mockProducts.find(
      (p) =>
        p.slug === decoded ||
        p.slug === raw ||
        p.id === decoded ||
        p.id === raw ||
        p.slug.toLowerCase() === decoded.toLowerCase()
    );

  if (!isDbConfigured) return findInMock();

  try {
    await ensureProductsSchema();
    const rows = await sql`
      SELECT * FROM products 
      WHERE slug = ${decoded} 
         OR slug = ${raw} 
         OR id = ${decoded} 
         OR id = ${raw} 
         OR LOWER(slug) = LOWER(${decoded})
      LIMIT 1
    `;
    if (!rows || rows.length === 0) return undefined;
    return mapProductRow(rows[0]);
  } catch (error) {
    console.error(`Failed to fetch product ${slug} from Neon Postgres:`, error);
    throw error;
  }
});

/** Checkout must never price a demo fallback or a stale product on DB failure. */
export async function getDbProductForSale(slug: string): Promise<Product | undefined> {
  if (!isDbConfigured) throw new Error('The database is unavailable. Please try again later.');
  await ensureProductsSchema();
  const rows = await sql`
    SELECT * FROM products
    WHERE slug = ${slug} OR id = ${slug} OR LOWER(slug) = LOWER(${slug})
    LIMIT 1
  `;
  return rows[0] ? mapProductRow(rows[0]) : undefined;
}

/**
 * Everything a customer is allowed to see.
 *
 * Storefront pages must read through here rather than `getDbProducts`, which
 * deliberately returns hidden products too — the admin panel needs them, and so
 * does anything resolving a past order's line items.
 */
export async function getVisibleDbProducts(): Promise<Product[]> {
  return visibleProducts(await getDbProducts());
}

export async function getDbCollectionProducts(collectionSlug: string): Promise<Product[]> {
  const allProducts = await getVisibleDbProducts();
  return allProducts.filter((p) => p.collectionSlug === collectionSlug);
}

export async function saveDbProduct(p: Product): Promise<boolean> {
  if (!isDbConfigured) return false;
  try {
    await ensureProductsSchema();

    const wholesale = normalizeWholesaleRule(p.wholesale, Number(p.price));

    const normalizedProduct = {
      ...p,
      visibility: p.visibility === 'hidden' ? 'hidden' : 'visible',
      variants: (p.variants || []).map(normalizeVariantStock)
    };

    await sql`
      INSERT INTO products (
        id, slug, name, collection_slug, collection_name, category, price, badge,
        image, secondary_image, image_alt, colors, color_hex, variants,
        description, story, details, care, material, fit, rating, review_count, color_images,
        visibility, wholesale_min_quantity, wholesale_price
      ) VALUES (
        ${normalizedProduct.id}, ${normalizedProduct.slug}, ${normalizedProduct.name}, ${normalizedProduct.collectionSlug}, ${normalizedProduct.collectionName}, ${normalizedProduct.category},
        ${normalizedProduct.price}, ${normalizedProduct.badge || null}, ${normalizedProduct.image}, ${normalizedProduct.secondaryImage || null}, ${normalizedProduct.imageAlt},
        ${normalizedProduct.colors}, ${JSON.stringify(normalizedProduct.colorHex)}, ${JSON.stringify(normalizedProduct.variants)},
        ${normalizedProduct.description}, ${normalizedProduct.story}, ${normalizedProduct.details}, ${normalizedProduct.care}, ${normalizedProduct.material}, ${normalizedProduct.fit},
        ${normalizedProduct.rating}, ${normalizedProduct.reviewCount}, ${JSON.stringify(normalizedProduct.colorImages || {})},
        ${normalizedProduct.visibility}, ${wholesale?.minQuantity ?? null}, ${wholesale?.unitPrice ?? null}
      )
      ON CONFLICT (id) DO UPDATE SET
        visibility = EXCLUDED.visibility,
        wholesale_min_quantity = EXCLUDED.wholesale_min_quantity,
        wholesale_price = EXCLUDED.wholesale_price,
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

export interface StockDeltaOptions {
  /**
   * Lets the sale go through even when the recorded stock does not cover it.
   *
   * Only ever set by the admin panel, where the merchant is holding the garment
   * and the database is simply behind. The decrement below already floors at
   * zero, so inventory can never go negative.
   */
  allowShortfall?: boolean;
}

/** Decrement stock for a purchase. Validates availability first and throws if short. */
export async function applyDbProductStockDelta(
  slug: string,
  selections: StockSelection[],
  options: StockDeltaOptions = {}
): Promise<Product | undefined> {
  if (isDbConfigured) {
    const requested = JSON.stringify(selections);
    const allowShortfall = options.allowShortfall === true;
    const rows = await sql`
      UPDATE products AS p SET variants = (
        SELECT COALESCE(jsonb_agg(
          CASE WHEN q.quantity > 0 AND jsonb_typeof(v.value->'inventory') = 'number' THEN
            jsonb_set(
              jsonb_set(v.value, '{inventory}',
                to_jsonb(GREATEST((v.value->>'inventory')::INTEGER - q.quantity, 0))),
              '{stockStatus}', to_jsonb(
                CASE WHEN (v.value->>'inventory')::INTEGER - q.quantity <= 0
                  THEN 'out_of_stock' ELSE 'in_stock' END
              )
            )
          ELSE v.value END ORDER BY v.position
        ), '[]'::jsonb)
        FROM jsonb_array_elements(p.variants) WITH ORDINALITY AS v(value, position)
        LEFT JOIN (
          SELECT x.color, x.size, SUM(x.quantity)::INTEGER AS quantity
          FROM jsonb_to_recordset(${requested}::jsonb) AS x(color TEXT, size TEXT, quantity INTEGER)
          GROUP BY x.color, x.size
        ) AS q ON q.color = v.value->>'color' AND q.size = v.value->>'size'
      )
      WHERE p.slug = ${slug}
        AND (${allowShortfall} OR p.visibility <> 'hidden')
        AND NOT EXISTS (
          SELECT 1 FROM (
            SELECT x.color, x.size, SUM(x.quantity)::INTEGER AS quantity
            FROM jsonb_to_recordset(${requested}::jsonb) AS x(color TEXT, size TEXT, quantity INTEGER)
            GROUP BY x.color, x.size
          ) AS q
          WHERE q.quantity < 1 OR NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(p.variants) AS v(value)
            WHERE v.value->>'color' = q.color AND v.value->>'size' = q.size
              AND (${allowShortfall} OR (
                v.value->>'stockStatus' <> 'out_of_stock' AND
                (jsonb_typeof(v.value->'inventory') <> 'number' OR
                  (v.value->>'inventory')::INTEGER >= q.quantity)
              ))
          )
        )
      RETURNING *
    `;
    if (!rows[0]) throw new Error('Requested stock is unavailable.');
    return mapProductRow(rows[0]);
  }

  const product = await getDbProduct(slug);
  if (!product) return undefined;

  // The last gate before inventory moves. A product taken off the site is not
  // something a customer can be holding a checkout for.
  if (!options.allowShortfall && !isProductVisible(product)) {
    throw new Error(`${product.name} is not available.`);
  }

  const normalizedSelections = selections.map((selection) => ({
    ...selection,
    quantity: Math.max(1, Math.floor(Number(selection.quantity) || 1))
  }));

  for (const selection of normalizedSelections) {
    const variant = product.variants.find(
      (candidate) => candidate.color === selection.color && candidate.size === selection.size
    );

    // A colour/size that was never made is refused whatever the caller asks for
    // — an override covers "the count is wrong", not "this product doesn't exist".
    if (!variant) {
      throw new Error(`${selection.color} / ${selection.size} is out of stock.`);
    }

    if (options.allowShortfall) continue;

    if (!isVariantInStock(variant)) {
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
  if (isDbConfigured) {
    // PostgreSQL evaluates this UPDATE under the product row lock. A concurrent
    // checkout cannot have its new stock count overwritten by a stale read.
    await sql`
      UPDATE products AS p
      SET variants = (
        SELECT COALESCE(jsonb_agg(
          CASE
            WHEN q.quantity > 0 AND jsonb_typeof(v.value->'inventory') = 'number' THEN
              jsonb_set(
                jsonb_set(v.value, '{inventory}',
                  to_jsonb((v.value->>'inventory')::INTEGER + q.quantity)),
                '{stockStatus}', to_jsonb('in_stock'::TEXT)
              )
            ELSE v.value
          END ORDER BY v.position
        ), '[]'::jsonb)
        FROM jsonb_array_elements(p.variants) WITH ORDINALITY AS v(value, position)
        LEFT JOIN (
          SELECT x.color, x.size, SUM(x.quantity)::INTEGER AS quantity
          FROM jsonb_to_recordset(${JSON.stringify(selections)}::jsonb)
            AS x(color TEXT, size TEXT, quantity INTEGER)
          GROUP BY x.color, x.size
        ) AS q ON q.color = v.value->>'color' AND q.size = v.value->>'size'
      )
      WHERE p.slug = ${slug}
    `;
    return;
  }

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
    console.error('Failed to fetch drops from Neon Postgres:', error);
    throw error;
  }
}

export async function getDbDrop(slug: string): Promise<Drop | undefined> {
  if (!isDbConfigured) return mockDrops.find((d) => d.slug === slug);
  try {
    const rows = await sql`SELECT * FROM drops WHERE slug = ${slug} LIMIT 1`;
    if (!rows || rows.length === 0) return undefined;
    return mapDropRow(rows[0]);
  } catch (error) {
    console.error(`Failed to fetch drop ${slug} from Neon Postgres:`, error);
    throw error;
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
export const getDbCollections = cache(async (): Promise<Collection[]> => {
  if (!isDbConfigured) return mockCollections;
  try {
    const rows = await sql`SELECT * FROM collections ORDER BY created_at DESC`;
    return rows.map(mapCollectionRow);
  } catch (error) {
    console.error('Failed to fetch collections from Neon Postgres:', error);
    throw error;
  }
});

export const getDbCollection = cache(async (slug: string): Promise<Collection | undefined> => {
  if (!isDbConfigured) return mockCollections.find((c) => c.slug === slug);
  try {
    const rows = await sql`SELECT * FROM collections WHERE slug = ${slug} LIMIT 1`;
    if (!rows || rows.length === 0) return undefined;
    return mapCollectionRow(rows[0]);
  } catch (error) {
    console.error(`Failed to fetch collection ${slug} from Neon Postgres:`, error);
    throw error;
  }
});

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
export const getDbLookbooks = cache(async (): Promise<LookbookIssue[]> => {
  if (!isDbConfigured) return mockLookbooks;
  try {
    const rows = await sql`SELECT * FROM lookbooks ORDER BY created_at DESC`;
    return rows.map(mapLookbookRow);
  } catch (error) {
    console.error('Failed to fetch lookbooks from Neon Postgres:', error);
    throw error;
  }
});

export const getDbLookbook = cache(async (slug: string): Promise<LookbookIssue | undefined> => {
  if (!isDbConfigured) return mockLookbooks.find((l) => l.slug === slug);
  try {
    const rows = await sql`SELECT * FROM lookbooks WHERE slug = ${slug} LIMIT 1`;
    if (!rows || rows.length === 0) return undefined;
    return mapLookbookRow(rows[0]);
  } catch (error) {
    console.error(`Failed to fetch lookbook ${slug} from Neon Postgres:`, error);
    throw error;
  }
});

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
          ADD COLUMN IF NOT EXISTS sms_sent BOOLEAN NOT NULL DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS sms_deferred BOOLEAN NOT NULL DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS shipped_sms_sent BOOLEAN NOT NULL DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS discount NUMERIC NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'web',
          ADD COLUMN IF NOT EXISTS client_request_id VARCHAR(80),
          ADD COLUMN IF NOT EXISTS extras JSONB NOT NULL DEFAULT '[]'::jsonb
      `;

      await sql`
        ALTER TABLE orders
          ADD COLUMN IF NOT EXISTS delivery_method VARCHAR(20) NOT NULL DEFAULT 'none',
          ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0
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

      await sql`
        CREATE INDEX IF NOT EXISTS orders_momo_number_idx
        ON orders (momo_number) WHERE momo_number IS NOT NULL
      `;

      // The guard that makes admin order creation idempotent: a retried or
      // double-tapped request carrying the same key cannot insert twice.
      try {
        await sql`
          CREATE UNIQUE INDEX IF NOT EXISTS orders_client_request_id_uidx
          ON orders (client_request_id) WHERE client_request_id IS NOT NULL
        `;
      } catch (error) {
        console.error('[orders] Could not create the unique client_request_id index:', error);
      }

      // One database statement owns the stock and order row. Row locks serialize
      // shoppers competing for the same variant; an INSERT error rolls back every
      // stock change made by this function, including multi-product baskets.
      await sql`
        CREATE OR REPLACE FUNCTION create_order_with_reservation(
          p_order JSONB, p_lines JSONB, p_allow_shortfall BOOLEAN DEFAULT FALSE
        ) RETURNS SETOF orders LANGUAGE plpgsql AS $fn$
        DECLARE
          item RECORD;
          selection RECORD;
          product_row products%ROWTYPE;
          variant JSONB;
          updated_variants JSONB;
          requested INTEGER;
          remaining INTEGER;
        BEGIN
          IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
            RAISE EXCEPTION 'The basket is empty.' USING ERRCODE = 'P0001';
          END IF;

          IF NULLIF(p_order->>'paymentReference', '') IS NOT NULL THEN
            PERFORM pg_advisory_xact_lock(hashtext('payment:' || (p_order->>'paymentReference')));
            IF EXISTS (SELECT 1 FROM orders WHERE payment_reference = p_order->>'paymentReference') THEN
              RAISE EXCEPTION 'Payment reference already has an order.' USING ERRCODE = '23505';
            END IF;
          END IF;
          IF NULLIF(p_order->>'clientRequestId', '') IS NOT NULL THEN
            PERFORM pg_advisory_xact_lock(hashtext('order:' || (p_order->>'clientRequestId')));
            IF EXISTS (SELECT 1 FROM orders WHERE client_request_id = p_order->>'clientRequestId') THEN
              RAISE EXCEPTION 'This order was already created.' USING ERRCODE = '23505';
            END IF;
          END IF;

          FOR item IN
            SELECT DISTINCT x."productSlug" AS slug
            FROM jsonb_to_recordset(p_lines) AS x("productSlug" TEXT, color TEXT, size TEXT, quantity INTEGER)
            ORDER BY slug
          LOOP
            SELECT * INTO product_row FROM products WHERE slug = item.slug FOR UPDATE;
            IF NOT FOUND THEN
              RAISE EXCEPTION 'A product is no longer available.' USING ERRCODE = 'P0001';
            END IF;
            IF NOT p_allow_shortfall AND product_row.visibility = 'hidden' THEN
              RAISE EXCEPTION 'A product is no longer available.' USING ERRCODE = 'P0001';
            END IF;

            FOR selection IN
              SELECT x.color, x.size, SUM(x.quantity)::INTEGER AS quantity
              FROM jsonb_to_recordset(p_lines) AS x("productSlug" TEXT, color TEXT, size TEXT, quantity INTEGER)
              WHERE x."productSlug" = item.slug
              GROUP BY x.color, x.size
            LOOP
              IF selection.quantity IS NULL OR selection.quantity < 1 THEN
                RAISE EXCEPTION 'Invalid quantity.' USING ERRCODE = 'P0001';
              END IF;
              SELECT value INTO variant FROM jsonb_array_elements(product_row.variants)
              WHERE value->>'color' = selection.color AND value->>'size' = selection.size LIMIT 1;
              IF variant IS NULL THEN
                RAISE EXCEPTION 'A selected size or color is unavailable.' USING ERRCODE = 'P0001';
              END IF;
              IF NOT p_allow_shortfall AND (
                variant->>'stockStatus' = 'out_of_stock' OR
                (jsonb_typeof(variant->'inventory') = 'number' AND
                  (variant->>'inventory')::INTEGER < selection.quantity)
              ) THEN
                RAISE EXCEPTION 'Requested stock is unavailable.' USING ERRCODE = 'P0001';
              END IF;
            END LOOP;

            IF p_order->>'paymentStatus' = 'paid' THEN
              updated_variants := '[]'::jsonb;
              FOR variant IN SELECT value FROM jsonb_array_elements(product_row.variants)
              LOOP
                SELECT COALESCE(SUM(x.quantity), 0)::INTEGER INTO requested
                FROM jsonb_to_recordset(p_lines) AS x("productSlug" TEXT, color TEXT, size TEXT, quantity INTEGER)
                WHERE x."productSlug" = item.slug
                  AND x.color = variant->>'color' AND x.size = variant->>'size';
                IF requested > 0 AND jsonb_typeof(variant->'inventory') = 'number' THEN
                  remaining := GREATEST((variant->>'inventory')::INTEGER - requested, 0);
                  variant := jsonb_set(variant, '{inventory}', to_jsonb(remaining));
                  variant := jsonb_set(variant, '{stockStatus}', to_jsonb(
                    CASE WHEN remaining = 0 THEN 'out_of_stock' ELSE 'in_stock' END
                  ));
                END IF;
                updated_variants := updated_variants || jsonb_build_array(variant);
              END LOOP;
              UPDATE products SET variants = updated_variants WHERE id = product_row.id;
            END IF;
          END LOOP;

          RETURN QUERY INSERT INTO orders (
            product_id, product_name, product_slug, selected_color, selected_size, price,
            customer_name, customer_phone, customer_email, shipping_address, shipping_city,
            payment_method, momo_network, momo_number, status, items, total_quantity,
            subtotal, service_charge, payment_status, payment_reference, paid_at,
            amount_paid, payment_channel, paystack_transaction_id, last_verified_at,
            payment_verified_by, gateway_response, stock_reserved, stock_released,
            sms_sent, sms_deferred, discount, source, client_request_id, payment_note, extras,
            delivery_method, delivery_fee
          ) VALUES (
            p_order->>'productId', p_order->>'productName', p_order->>'productSlug',
            p_order->>'selectedColor', p_order->>'selectedSize', (p_order->>'price')::NUMERIC,
            p_order->>'customerName', p_order->>'customerPhone', p_order->>'customerEmail',
            p_order->>'shippingAddress', p_order->>'shippingCity', p_order->>'paymentMethod',
            p_order->>'momoNetwork', COALESCE(p_order->>'momoNumber', p_order->>'paymentReference'),
            COALESCE(p_order->>'status', 'Pending'), COALESCE(p_order->'items', '[]'::jsonb),
            (p_order->>'totalQuantity')::INTEGER, (p_order->>'subtotal')::NUMERIC,
            (p_order->>'serviceCharge')::NUMERIC, COALESCE(p_order->>'paymentStatus', 'unpaid'),
            p_order->>'paymentReference', (p_order->>'paidAt')::TIMESTAMPTZ,
            (p_order->>'amountPaid')::NUMERIC, p_order->>'paymentChannel',
            p_order->>'paystackTransactionId', (p_order->>'lastVerifiedAt')::TIMESTAMPTZ,
            p_order->>'paymentVerifiedBy', p_order->>'gatewayResponse',
            p_order->>'paymentStatus' = 'paid', FALSE,
            FALSE, COALESCE((p_order->>'smsDeferred')::BOOLEAN, FALSE),
            COALESCE((p_order->>'discount')::NUMERIC, 0),
            COALESCE(p_order->>'source', 'web'), p_order->>'clientRequestId',
            p_order->>'paymentNote', COALESCE(p_order->'extras', '[]'::jsonb),
            COALESCE(p_order->>'deliveryMethod', 'none'), COALESCE((p_order->>'deliveryFee')::NUMERIC, 0)
          ) RETURNING *;
        END;
        $fn$;
      `;

      // Payment and the first stock deduction are one transaction. A retry of a
      // webhook or an admin click sees the paid row and cannot deduct twice.
      await sql`
        CREATE OR REPLACE FUNCTION confirm_order_payment(
          p_id INTEGER, p_paid_at TIMESTAMPTZ, p_amount NUMERIC,
          p_channel TEXT, p_transaction TEXT, p_response TEXT,
          p_note TEXT, p_source TEXT
        ) RETURNS SETOF orders LANGUAGE plpgsql AS $fn$
        DECLARE
          order_row orders%ROWTYPE;
          product_row products%ROWTYPE;
          item RECORD;
          variant JSONB;
          updated_variants JSONB;
          requested INTEGER;
          remaining INTEGER;
        BEGIN
          SELECT * INTO order_row FROM orders WHERE id = p_id FOR UPDATE;
          IF NOT FOUND OR order_row.payment_status = 'paid' THEN RETURN; END IF;

          IF NOT order_row.stock_reserved OR order_row.stock_released THEN
            FOR item IN
              SELECT DISTINCT x."productSlug" AS slug
              FROM jsonb_to_recordset(order_row.items) AS x("productSlug" TEXT)
              ORDER BY slug
            LOOP
              SELECT * INTO product_row FROM products WHERE slug = item.slug FOR UPDATE;
              IF NOT FOUND THEN CONTINUE; END IF;
              updated_variants := '[]'::jsonb;
              FOR variant IN SELECT value FROM jsonb_array_elements(product_row.variants)
              LOOP
                SELECT COALESCE(SUM(x.quantity), 0)::INTEGER INTO requested
                FROM jsonb_to_recordset(order_row.items) AS x("productSlug" TEXT, color TEXT, size TEXT, quantity INTEGER)
                WHERE x."productSlug" = item.slug AND x.color = variant->>'color' AND x.size = variant->>'size';
                IF requested > 0 AND jsonb_typeof(variant->'inventory') = 'number' THEN
                  remaining := (variant->>'inventory')::INTEGER - requested;
                  remaining := GREATEST(remaining, 0);
                  variant := jsonb_set(variant, '{inventory}', to_jsonb(remaining));
                  variant := jsonb_set(variant, '{stockStatus}', to_jsonb(
                    CASE WHEN remaining = 0 THEN 'out_of_stock' ELSE 'in_stock' END
                  ));
                END IF;
                updated_variants := updated_variants || jsonb_build_array(variant);
              END LOOP;
              UPDATE products SET variants = updated_variants WHERE id = product_row.id;
            END LOOP;
          END IF;

          RETURN QUERY UPDATE orders SET
            payment_status = 'paid',
            status = CASE WHEN status IN ('Awaiting Payment', 'Payment Failed') THEN 'Pending' ELSE status END,
            paid_at = COALESCE(orders.paid_at, p_paid_at),
            amount_paid = p_amount,
            payment_channel = COALESCE(p_channel, orders.payment_channel),
            paystack_transaction_id = COALESCE(p_transaction, orders.paystack_transaction_id),
            gateway_response = COALESCE(p_response, orders.gateway_response),
            payment_note = COALESCE(p_note, orders.payment_note),
            payment_verified_by = p_source,
            last_verified_at = NOW(),
            stock_reserved = TRUE,
            stock_released = FALSE
          WHERE id = p_id RETURNING *;
        END;
        $fn$;
      `;

      await sql`
        CREATE OR REPLACE FUNCTION edit_in_person_order(
          p_id INTEGER, p_order JSONB, p_allow_shortfall BOOLEAN DEFAULT FALSE
        ) RETURNS SETOF orders LANGUAGE plpgsql AS $fn$
        DECLARE
          order_row orders%ROWTYPE;
          product_row products%ROWTYPE;
          item RECORD;
          variant JSONB;
          updated_variants JSONB;
          old_quantity INTEGER;
          new_quantity INTEGER;
          delta INTEGER;
          remaining INTEGER;
        BEGIN
          SELECT * INTO order_row FROM orders WHERE id = p_id FOR UPDATE;
          IF NOT FOUND OR order_row.source <> 'admin' THEN
            RAISE EXCEPTION 'This in-person order no longer exists.' USING ERRCODE = 'P0001';
          END IF;
          IF order_row.payment_status NOT IN ('paid', 'unpaid') THEN
            RAISE EXCEPTION 'This payment state cannot be edited.' USING ERRCODE = 'P0001';
          END IF;

          FOR item IN
            SELECT slug FROM (
              SELECT DISTINCT x."productSlug" AS slug FROM jsonb_to_recordset(order_row.items) AS x("productSlug" TEXT)
              UNION
              SELECT DISTINCT x."productSlug" AS slug FROM jsonb_to_recordset(p_order->'items') AS x("productSlug" TEXT)
            ) AS slugs ORDER BY slug
          LOOP
            SELECT * INTO product_row FROM products WHERE slug = item.slug FOR UPDATE;
            IF NOT FOUND THEN
              RAISE EXCEPTION 'A product in this order no longer exists.' USING ERRCODE = 'P0001';
            END IF;
            updated_variants := '[]'::jsonb;
            FOR variant IN SELECT value FROM jsonb_array_elements(product_row.variants)
            LOOP
              SELECT COALESCE(SUM(x.quantity), 0)::INTEGER INTO old_quantity
              FROM jsonb_to_recordset(order_row.items) AS x("productSlug" TEXT, color TEXT, size TEXT, quantity INTEGER)
              WHERE x."productSlug" = item.slug AND x.color = variant->>'color' AND x.size = variant->>'size';
              SELECT COALESCE(SUM(x.quantity), 0)::INTEGER INTO new_quantity
              FROM jsonb_to_recordset(p_order->'items') AS x("productSlug" TEXT, color TEXT, size TEXT, quantity INTEGER)
              WHERE x."productSlug" = item.slug AND x.color = variant->>'color' AND x.size = variant->>'size';
              delta := CASE WHEN order_row.payment_status = 'paid' THEN new_quantity ELSE 0 END
                - CASE WHEN order_row.stock_reserved AND NOT order_row.stock_released THEN old_quantity ELSE 0 END;
              IF delta <> 0 AND jsonb_typeof(variant->'inventory') = 'number' THEN
                remaining := (variant->>'inventory')::INTEGER - delta;
                IF remaining < 0 AND NOT p_allow_shortfall THEN
                  RAISE EXCEPTION 'Requested stock is unavailable.' USING ERRCODE = 'P0001';
                END IF;
                remaining := GREATEST(remaining, 0);
                variant := jsonb_set(variant, '{inventory}', to_jsonb(remaining));
                variant := jsonb_set(variant, '{stockStatus}', to_jsonb(
                  CASE WHEN remaining = 0 THEN 'out_of_stock' ELSE 'in_stock' END
                ));
              END IF;
              updated_variants := updated_variants || jsonb_build_array(variant);
            END LOOP;
            UPDATE products SET variants = updated_variants WHERE id = product_row.id;
          END LOOP;

          RETURN QUERY UPDATE orders SET
            product_id = p_order->>'productId', product_name = p_order->>'productName',
            product_slug = p_order->>'productSlug', selected_color = p_order->>'selectedColor',
            selected_size = p_order->>'selectedSize', items = p_order->'items',
            total_quantity = (p_order->>'totalQuantity')::INTEGER,
            subtotal = (p_order->>'subtotal')::NUMERIC,
            extras = COALESCE(p_order->'extras', '[]'::jsonb),
            discount = (p_order->>'discount')::NUMERIC, price = (p_order->>'price')::NUMERIC,
            amount_paid = COALESCE((p_order->>'amountPaid')::NUMERIC, orders.amount_paid),
            customer_name = p_order->>'customerName', customer_phone = p_order->>'customerPhone',
            customer_email = p_order->>'customerEmail', shipping_address = p_order->>'shippingAddress',
            shipping_city = p_order->>'shippingCity',
            payment_note = p_order->>'paymentNote',
            sms_sent = CASE WHEN customer_phone = p_order->>'customerPhone' THEN sms_sent ELSE FALSE END,
            sms_deferred = CASE WHEN customer_phone = p_order->>'customerPhone' THEN sms_deferred ELSE TRUE END,
            stock_reserved = payment_status = 'paid', stock_released = FALSE
          WHERE id = p_id RETURNING *;
        END;
        $fn$;
      `;

      await sql`
        CREATE OR REPLACE FUNCTION undo_order_payment(p_id INTEGER, p_note TEXT)
        RETURNS SETOF orders LANGUAGE plpgsql AS $fn$
        DECLARE
          order_row orders%ROWTYPE;
          product_row products%ROWTYPE;
          item RECORD;
          variant JSONB;
          updated_variants JSONB;
          quantity_to_return INTEGER;
          remaining INTEGER;
        BEGIN
          SELECT * INTO order_row FROM orders WHERE id = p_id FOR UPDATE;
          IF NOT FOUND OR order_row.payment_status = 'unpaid' THEN RETURN; END IF;
          IF order_row.stock_reserved AND NOT order_row.stock_released THEN
            FOR item IN
              SELECT DISTINCT x."productSlug" AS slug
              FROM jsonb_to_recordset(order_row.items) AS x("productSlug" TEXT)
              ORDER BY slug
            LOOP
              SELECT * INTO product_row FROM products WHERE slug = item.slug FOR UPDATE;
              IF NOT FOUND THEN CONTINUE; END IF;
              updated_variants := '[]'::jsonb;
              FOR variant IN SELECT value FROM jsonb_array_elements(product_row.variants)
              LOOP
                SELECT COALESCE(SUM(x.quantity), 0)::INTEGER INTO quantity_to_return
                FROM jsonb_to_recordset(order_row.items) AS x("productSlug" TEXT, color TEXT, size TEXT, quantity INTEGER)
                WHERE x."productSlug" = item.slug AND x.color = variant->>'color' AND x.size = variant->>'size';
                IF quantity_to_return > 0 AND jsonb_typeof(variant->'inventory') = 'number' THEN
                  remaining := (variant->>'inventory')::INTEGER + quantity_to_return;
                  variant := jsonb_set(variant, '{inventory}', to_jsonb(remaining));
                  variant := jsonb_set(variant, '{stockStatus}', '"in_stock"'::jsonb);
                END IF;
                updated_variants := updated_variants || jsonb_build_array(variant);
              END LOOP;
              UPDATE products SET variants = updated_variants WHERE id = product_row.id;
            END LOOP;
          END IF;

          RETURN QUERY UPDATE orders SET payment_status = 'unpaid', paid_at = NULL,
            amount_paid = NULL, payment_note = COALESCE(p_note, orders.payment_note),
            payment_verified_by = 'admin', last_verified_at = NOW(),
            stock_reserved = FALSE, stock_released = FALSE
          WHERE id = p_id RETURNING *;
        END;
        $fn$;
      `;
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

/** Reads the extras column defensively — a malformed value must not break an order. */
function parseOrderExtras(value: any): OrderExtra[] {
  const raw = typeof value === 'string' ? safeJsonParse(value) : value;
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry: any) => ({
      label: String(entry?.label ?? '').trim(),
      amount: Number(entry?.amount)
    }))
    .filter((extra) => extra.label.length > 0 && Number.isFinite(extra.amount) && extra.amount > 0);
}

function safeJsonParse(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
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
    deliveryMethod: row.delivery_method === 'urgent' || row.delivery_method === 'standard' ? row.delivery_method : 'none',
    deliveryFee: Number(row.delivery_fee) || 0,
    extras: parseOrderExtras(row.extras),
    discount: row.discount != null ? Number(row.discount) : 0,
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
    source: row.source === 'admin' ? 'admin' : 'web',
    clientRequestId: row.client_request_id || undefined,

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
    smsSent: row.sms_sent === true,
    shippedSmsSent: row.shipped_sms_sent === true,
    smsDeferred: row.sms_deferred === true
  };
}

export async function getDbOrders(): Promise<Order[]> {
  if (!isDbConfigured) return sandboxOrders;
  try {
    await ensureOrdersSchema();
    const rows = await sql`SELECT * FROM orders ORDER BY created_at DESC`;
    return rows.map(mapOrderRow);
  } catch (error) {
    console.error('Failed to fetch orders from Neon Postgres:', error);
    throw error;
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
    throw error;
  }
}

/**
 * Looks an order up by the key its creator supplied, which is what makes admin
 * order creation idempotent. A merchant double-tapping "Create order" on a phone
 * with poor signal sends the same key twice; the second request finds this row
 * and returns it instead of minting a second order and deducting stock again.
 */
export async function findDbOrderByClientRequestId(
  clientRequestId: string
): Promise<Order | undefined> {
  if (!clientRequestId) return undefined;

  if (!isDbConfigured) {
    return sandboxOrders.find((order) => order.clientRequestId === clientRequestId);
  }

  try {
    await ensureOrdersSchema();
    const rows = await sql`
      SELECT * FROM orders WHERE client_request_id = ${clientRequestId} LIMIT 1
    `;
    return rows.length > 0 ? mapOrderRow(rows[0]) : undefined;
  } catch (error) {
    console.error('Failed to look up order by client request id:', error);
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

/** Exact lookup for customer tracking; never scans the full orders table. */
export async function getDbOrderByPublicReference(reference: string): Promise<Order | undefined> {
  if (!isDbConfigured) throw new Error('Order tracking is temporarily unavailable.');
  await ensureOrdersSchema();
  const trimmed = reference.trim();
  const id = parsePublicOrderId(trimmed);
  const rows = await sql`
    SELECT * FROM orders
    WHERE (${id}::INTEGER IS NOT NULL AND id = ${id}::INTEGER)
       OR payment_reference = ${trimmed}
       OR momo_number = ${trimmed}
    ORDER BY id DESC LIMIT 1
  `;
  return rows[0] ? mapOrderRow(rows[0]) : undefined;
}

/** Small image lookup for tracking one order, without loading the whole catalog. */
export async function getDbOrderProductImages(keys: string[]): Promise<{
  id: string;
  slug: string;
  image: string;
  colorImages: Record<string, string[]>;
}[]> {
  if (!isDbConfigured || keys.length === 0) return [];
  const values = JSON.stringify(Array.from(new Set(keys.filter(Boolean))));
  const rows = await sql`
    SELECT id, slug, image, color_images FROM products
    WHERE slug IN (SELECT jsonb_array_elements_text(${values}::jsonb))
       OR id IN (SELECT jsonb_array_elements_text(${values}::jsonb))
  `;
  return rows.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    slug: String(row.slug),
    image: String(row.image || ''),
    colorImages: safeParseJson<Record<string, string[]>>(row.color_images, {})
  }));
}

export type NewOrderInput = Omit<
  Order,
  | 'id'
  | 'createdAt'
  | 'paymentStatus'
  | 'stockReserved'
  | 'stockReleased'
  | 'smsSent'
  | 'smsDeferred'
  | 'shippedSmsSent'
  | 'discount'
  | 'source'
  | 'extras'
> &
  Partial<
    Pick<
      Order,
      'paymentStatus' | 'stockReserved' | 'stockReleased' | 'smsSent' | 'smsDeferred' | 'discount' | 'source' | 'extras'
    >
  >;

export async function addDbOrder(o: NewOrderInput): Promise<Order> {
  const defaults = {
    paymentStatus: o.paymentStatus || ('unpaid' as PaymentStatus),
    stockReserved: o.stockReserved !== false,
    stockReleased: o.stockReleased === true,
    smsSent: o.smsSent === true,
    smsDeferred: o.smsDeferred === true,
    shippedSmsSent: false,
    discount: Number.isFinite(o.discount) ? Math.max(0, Number(o.discount)) : 0,
    source: o.source === 'admin' ? ('admin' as const) : ('web' as const),
    extras: parseOrderExtras(o.extras),
    deliveryMethod: o.deliveryMethod || 'none',
    deliveryFee: Number(o.deliveryFee) || 0
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
        stock_reserved, stock_released, sms_sent, sms_deferred,
        discount, source, client_request_id, payment_note, extras,
        delivery_method, delivery_fee
      ) VALUES (
        ${o.productId}, ${o.productName}, ${o.productSlug}, ${o.selectedColor}, ${o.selectedSize}, ${o.price},
        ${o.customerName}, ${o.customerPhone}, ${o.customerEmail}, ${o.shippingAddress}, ${o.shippingCity},
        ${o.paymentMethod}, ${o.momoNetwork || null}, ${o.momoNumber || o.paymentReference || null}, ${o.status || 'Pending'},
        ${JSON.stringify(o.items || [])}, ${o.totalQuantity}, ${o.subtotal}, ${o.serviceCharge},
        ${defaults.paymentStatus}, ${o.paymentReference || null}, ${o.paidAt || null}, ${o.amountPaid ?? null},
        ${o.paymentChannel || null}, ${o.paystackTransactionId || null}, ${o.lastVerifiedAt || null},
        ${o.paymentVerifiedBy || null}, ${o.gatewayResponse || null},
        ${defaults.stockReserved}, ${defaults.stockReleased}, ${defaults.smsSent}, ${defaults.smsDeferred},
        ${defaults.discount}, ${defaults.source}, ${o.clientRequestId || null}, ${o.paymentNote || null},
        ${JSON.stringify(defaults.extras)}, ${defaults.deliveryMethod}, ${defaults.deliveryFee}
      )
      RETURNING *;
    `;
    return mapOrderRow(rows[0]);
  } catch (error) {
    console.error('Failed to save order to Neon Postgres:', error);
    throw error;
  }
}

/** Atomically reserves all tracked variants and records the order. */
export async function createDbOrderWithStock(
  order: NewOrderInput,
  lines: StockSelectionWithSlug[],
  allowShortfall = false
): Promise<Order> {
  if (!isDbConfigured) {
    throw new Error('Checkout is temporarily unavailable. Please try again later.');
  }
  await ensureProductsSchema();
  await ensureOrdersSchema();
  const rows = await sql`
    SELECT * FROM create_order_with_reservation(
      ${JSON.stringify(order)}::jsonb,
      ${JSON.stringify(lines)}::jsonb,
      ${allowShortfall}
    )
  `;
  if (!rows[0]) throw new Error('The order could not be saved. Please try again.');
  return mapOrderRow(rows[0]);
}

export async function editDbInPersonOrder(
  id: number,
  changes: Pick<NewOrderInput,
    'productId' | 'productName' | 'productSlug' | 'selectedColor' | 'selectedSize' |
    'items' | 'totalQuantity' | 'subtotal' | 'extras' | 'discount' | 'price' |
    'customerName' | 'customerPhone' | 'customerEmail' | 'shippingAddress' |
    'shippingCity' | 'paymentNote' | 'amountPaid'>,
  allowShortfall = false
): Promise<Order> {
  await ensureProductsSchema();
  await ensureOrdersSchema();
  const rows = await sql`
    SELECT * FROM edit_in_person_order(${id}, ${JSON.stringify(changes)}::jsonb, ${allowShortfall})
  `;
  if (!rows[0]) throw new Error('That order could not be updated.');
  return mapOrderRow(rows[0]);
}

export interface StockSelectionWithSlug extends StockSelection {
  productSlug: string;
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
    SELECT * FROM confirm_order_payment(
      ${id}, ${paidAt}::timestamptz, ${input.amountPaid},
      ${input.channel || null}, ${input.transactionId || null},
      ${input.gatewayResponse || null}, ${input.note || null}, ${input.source}
    )
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
    order.stockReserved = false;
    order.stockReleased = false;
    order.paymentNote = note || order.paymentNote;
    order.paymentVerifiedBy = 'admin';
    return { transitioned: true, order };
  }

  await ensureOrdersSchema();
  const rows = await sql`SELECT * FROM undo_order_payment(${id}, ${note || null})`;

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
    if (!order || order.smsSent || order.smsDeferred) return false;
    order.smsSent = true;
    return true;
  }

  try {
    await ensureOrdersSchema();
    const rows = await sql`
      UPDATE orders SET sms_sent = TRUE
      WHERE id = ${id} AND sms_sent = FALSE AND sms_deferred = FALSE
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

/** Save the SMS number and hold or release an in-person order's confirmation. */
export async function updateDbOrderSmsDetails(id: number, phone: string, sendNow: boolean): Promise<Order | undefined> {
  if (!isDbConfigured) {
    const order = sandboxOrders.find((candidate) => candidate.id === id);
    if (!order) return undefined;
    const changed = order.customerPhone !== phone;
    if (changed) order.smsSent = false;
    order.smsDeferred = order.smsSent && !changed ? false : !sendNow;
    order.customerPhone = phone;
    return order;
  }

  await ensureOrdersSchema();
  const rows = await sql`
    UPDATE orders SET
      customer_phone = ${phone},
      sms_sent = CASE WHEN customer_phone = ${phone} THEN sms_sent ELSE FALSE END,
      sms_deferred = CASE WHEN customer_phone = ${phone} AND sms_sent = TRUE THEN FALSE ELSE ${!sendNow} END
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] ? mapOrderRow(rows[0]) : undefined;
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
    return sandboxOrders.filter((order) => order.paymentStatus === 'paid' && !order.smsSent && !order.smsDeferred).slice(0, limit);
  }

  try {
    await ensureOrdersSchema();
    const rows = await sql`
      SELECT * FROM orders
      WHERE payment_status = 'paid' AND sms_sent = FALSE AND sms_deferred = FALSE
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

/** Atomically claims one shipping SMS while the order is still shipped. */
export async function claimDbOrderShippedSms(id: number): Promise<boolean> {
  if (!isDbConfigured) {
    const order = sandboxOrders.find((candidate) => candidate.id === id);
    if (!order || order.status !== 'Shipped' || order.shippedSmsSent) return false;
    order.shippedSmsSent = true;
    return true;
  }

  await ensureOrdersSchema();
  const rows = await sql`
    UPDATE orders SET shipped_sms_sent = TRUE
    WHERE id = ${id} AND status = 'Shipped' AND shipped_sms_sent = FALSE
    RETURNING id
  `;
  return rows.length > 0;
}

export async function releaseDbOrderShippedSmsClaim(id: number): Promise<void> {
  if (!isDbConfigured) {
    const order = sandboxOrders.find((candidate) => candidate.id === id);
    if (order) order.shippedSmsSent = false;
    return;
  }

  await ensureOrdersSchema();
  await sql`UPDATE orders SET shipped_sms_sent = FALSE WHERE id = ${id}`;
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
