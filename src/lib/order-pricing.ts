import {
  applyDbProductStockDelta,
  getDbProduct,
  restoreDbProductStock,
  type StockSelection
} from '@/lib/catalog-db';
import { getVariantStockLimit, isVariantInStock } from '@/lib/inventory';
import { calcOrderTotal, calcServiceCharge } from '@/lib/format';
import type { Order, OrderItem, Product } from '@/types/product';

/**
 * The single place where a basket becomes money.
 *
 * Both the pre-payment checkout route and the legacy direct-order route price
 * through here, so there is exactly one definition of what an order costs — and
 * the client's numbers are never part of it.
 */

export interface RequestedLine {
  productSlug: string;
  color: string;
  size: string;
  quantity: number;
}

export interface PricedOrderDraft {
  items: OrderItem[];
  lines: RequestedLine[];
  uniqueSlugs: string[];
  subtotal: number;
  serviceCharge: number;
  grandTotal: number;
  totalQuantity: number;
  /** Comma-joined summaries retained for legacy columns, SMS and track-order. */
  summaryColor: string;
  summarySize: string;
}

export type PricingResult =
  | { ok: true; draft: PricedOrderDraft }
  | { ok: false; status: number; error: string };

export interface PricingOptions {
  /**
   * Whether the 2% service charge applies. It covers the payment gateway's cut,
   * so an in-person sale settled in cash does not carry one. Defaults to true —
   * every customer-facing path prices exactly as it always has.
   */
  applyServiceCharge?: boolean;
  /**
   * Prices variants the catalogue believes are sold out. Admin-only: the
   * merchant is holding the piece and the recorded count is simply stale.
   */
  allowOutOfStock?: boolean;
}

/** Collapse duplicate variant lines so stock checks see the true total quantity. */
export function mergeLines(lines: RequestedLine[]): RequestedLine[] {
  const merged = new Map<string, RequestedLine>();

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

function buildOrderItems(lines: RequestedLine[], productsBySlug: Map<string, Product>): OrderItem[] {
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

/**
 * Resolves every requested line against the live catalogue, refuses anything
 * out of stock, and prices the basket from the database.
 */
export async function priceOrderDraft(
  requestedLines: RequestedLine[],
  options: PricingOptions = {}
): Promise<PricingResult> {
  if (requestedLines.some((line) => !line.productSlug)) {
    return { ok: false, status: 400, error: 'Every order item needs a product.' };
  }

  const lines = mergeLines(requestedLines);
  const uniqueSlugs = Array.from(new Set(lines.map((line) => line.productSlug)));
  const productsBySlug = new Map<string, Product>();

  for (const slug of uniqueSlugs) {
    const product = await getDbProduct(slug);
    if (!product) {
      return { ok: false, status: 404, error: `Product "${slug}" was not found.` };
    }
    productsBySlug.set(slug, product);
  }

  for (const line of lines) {
    const product = productsBySlug.get(line.productSlug)!;
    const variant = product.variants.find(
      (candidate) => candidate.color === line.color && candidate.size === line.size
    );

    if (!variant) {
      return {
        ok: false,
        status: 400,
        error: `${line.color} / ${line.size} is not available for ${product.name}.`
      };
    }

    // The override only forgives a stale count — the variant itself must exist,
    // which the check above has already established.
    if (options.allowOutOfStock) continue;

    if (!isVariantInStock(variant)) {
      return {
        ok: false,
        status: 400,
        error: `${product.name} - ${line.color} / ${line.size} is sold out.`
      };
    }

    const stockLimit = getVariantStockLimit(variant);
    if (line.quantity > stockLimit) {
      return {
        ok: false,
        status: 400,
        error: `Only ${stockLimit} left for ${product.name} - ${line.color} / ${line.size}.`
      };
    }
  }

  const items = buildOrderItems(lines, productsBySlug);
  const subtotal = Math.round(items.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100;
  const chargesFee = options.applyServiceCharge !== false;

  return {
    ok: true,
    draft: {
      items,
      lines,
      uniqueSlugs,
      subtotal,
      serviceCharge: chargesFee ? calcServiceCharge(subtotal) : 0,
      grandTotal: chargesFee ? calcOrderTotal(subtotal) : subtotal,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      summaryColor: Array.from(new Set(items.map((item) => item.color))).join(', '),
      summarySize: items
        .map((item) => `${item.color} / ${item.size}${item.quantity > 1 ? ` (x${item.quantity})` : ''}`)
        .join(', ')
    }
  };
}

export interface StockReservation {
  /** Hands every reserved unit back. Safe to call more than once. */
  rollback: () => Promise<void>;
}

export type ReservationResult =
  | { ok: true; reservation: StockReservation }
  | { ok: false; error: string };

/**
 * Takes the units out of inventory up front, so the customer who is on the
 * payment screen cannot be beaten to the last piece. Anything not paid for is
 * handed back by `releaseOrderStock` (on cancellation, failure, or the
 * reconciliation sweep).
 */
export async function reserveStockForDraft(
  draft: PricedOrderDraft,
  options: { allowShortfall?: boolean } = {}
): Promise<ReservationResult> {
  const reserved: { slug: string; selections: StockSelection[] }[] = [];

  const rollback = async () => {
    while (reserved.length > 0) {
      const entry = reserved.pop()!;
      try {
        await restoreDbProductStock(entry.slug, entry.selections);
      } catch (error) {
        console.error(`Failed to restore stock for ${entry.slug}:`, error);
      }
    }
  };

  for (const slug of draft.uniqueSlugs) {
    const selections: StockSelection[] = draft.lines
      .filter((line) => line.productSlug === slug)
      .map((line) => ({ color: line.color, size: line.size, quantity: line.quantity }));

    try {
      await applyDbProductStockDelta(slug, selections, { allowShortfall: options.allowShortfall });
      reserved.push({ slug, selections });
    } catch (error: any) {
      await rollback();
      return { ok: false, error: error?.message || 'Requested stock is unavailable.' };
    }
  }

  return { ok: true, reservation: { rollback } };
}

export interface StockReleaseReport {
  restored: string[];
  failed: string[];
}

/**
 * Credits an order's line items back to inventory. The caller must already hold
 * the release claim (`claimDbOrderStockRelease`) so this can never double-credit.
 *
 * The per-slug breakdown matters: if some slugs were credited and others were
 * not, the claim must stay held — retrying the whole order would hand back the
 * successful slugs a second time.
 */
export async function releaseOrderStock(order: Order): Promise<StockReleaseReport> {
  const bySlug = new Map<string, StockSelection[]>();

  for (const item of order.items) {
    if (!item.productSlug) continue;
    const selections = bySlug.get(item.productSlug) || [];
    selections.push({ color: item.color, size: item.size, quantity: item.quantity });
    bySlug.set(item.productSlug, selections);
  }

  const report: StockReleaseReport = { restored: [], failed: [] };

  for (const [slug, selections] of Array.from(bySlug.entries())) {
    try {
      await restoreDbProductStock(slug, selections);
      report.restored.push(slug);
    } catch (error) {
      report.failed.push(slug);
      console.error(`Failed to release reserved stock for ${slug} (order #${order.id}):`, error);
    }
  }

  return report;
}
