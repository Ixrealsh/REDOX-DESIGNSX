import type { WholesaleRule } from '@/types/product';

/**
 * Bulk pricing, in one place.
 *
 * The server prices every order through here, and the product page, the cart and
 * the admin's in-person order screen all read the same functions. That is
 * deliberate: a customer who is told "buy 5 and pay GH₵200 each" must be charged
 * exactly that, and the only way to guarantee it is to have one implementation.
 *
 * The server is still the authority — a browser holding a stale rule simply gets
 * re-priced at checkout — but the two should never visibly disagree.
 */

/** A threshold of 1 is not bulk pricing, it is just a lower price. */
export const MIN_WHOLESALE_QUANTITY = 2;

/** Anything priceable: a catalogue product, or a line already in a basket. */
export interface WholesalePriceable {
  price: number;
  wholesale?: WholesaleRule | null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Whether a rule is complete enough to charge money by.
 *
 * A half-filled form is not a deal, and neither is a "wholesale" price at or
 * above the normal one — that would quietly charge bulk buyers *more*, which is
 * the single worst way this feature could fail.
 */
export function isWholesaleRuleUsable(
  rule: WholesaleRule | null | undefined,
  basePrice: number
): boolean {
  if (!rule) return false;

  const minQuantity = Number(rule.minQuantity);
  const unitPrice = Number(rule.unitPrice);

  return (
    Number.isFinite(minQuantity) &&
    minQuantity >= MIN_WHOLESALE_QUANTITY &&
    Number.isFinite(unitPrice) &&
    unitPrice > 0 &&
    Number.isFinite(basePrice) &&
    unitPrice < basePrice
  );
}

/** The rule to actually price by, or null when there is nothing usable. */
export function getWholesaleRule(item: WholesalePriceable): WholesaleRule | null {
  if (!isWholesaleRuleUsable(item.wholesale, item.price)) return null;

  return {
    minQuantity: Math.floor(Number(item.wholesale!.minQuantity)),
    unitPrice: round2(Number(item.wholesale!.unitPrice))
  };
}

export function hasWholesale(item: WholesalePriceable): boolean {
  return getWholesaleRule(item) !== null;
}

/**
 * Totals a basket by product, which is the number every rule is tested against.
 *
 * Sizes and colours of the same product add together — five shirts are five
 * shirts however they are split.
 */
export function quantityByProduct(
  lines: { productSlug: string; quantity: number }[]
): Map<string, number> {
  const totals = new Map<string, number>();

  for (const line of lines) {
    const quantity = Math.max(0, Math.floor(Number(line.quantity) || 0));
    totals.set(line.productSlug, (totals.get(line.productSlug) || 0) + quantity);
  }

  return totals;
}

/** What one piece costs, given how many of that product are being bought. */
export function effectiveUnitPrice(item: WholesalePriceable, productQuantity: number): number {
  const rule = getWholesaleRule(item);
  if (!rule) return item.price;
  return productQuantity >= rule.minQuantity ? rule.unitPrice : item.price;
}

/** True once the basket holds enough of this product to unlock the rule. */
export function isWholesaleApplied(item: WholesalePriceable, productQuantity: number): boolean {
  const rule = getWholesaleRule(item);
  return rule !== null && productQuantity >= rule.minQuantity;
}

/** How much comes off each piece once the rule applies. */
export function savingPerUnit(item: WholesalePriceable): number {
  const rule = getWholesaleRule(item);
  return rule ? round2(item.price - rule.unitPrice) : 0;
}

/** The same saving as a whole-number percentage, for a headline. */
export function savingPercent(item: WholesalePriceable): number {
  const rule = getWholesaleRule(item);
  if (!rule || item.price <= 0) return 0;
  return Math.round(((item.price - rule.unitPrice) / item.price) * 100);
}

/** How many more pieces unlock the rule. 0 when already unlocked, or no rule. */
export function unitsUntilWholesale(item: WholesalePriceable, productQuantity: number): number {
  const rule = getWholesaleRule(item);
  if (!rule) return 0;
  return Math.max(0, rule.minQuantity - Math.max(0, Math.floor(productQuantity)));
}

/**
 * What the customer would save in total by topping up to the threshold — the
 * figure that makes "add 2 more" worth doing.
 */
export function savingIfUnlocked(item: WholesalePriceable, productQuantity: number): number {
  const rule = getWholesaleRule(item);
  if (!rule || productQuantity >= rule.minQuantity) return 0;
  return round2(savingPerUnit(item) * rule.minQuantity);
}

/** What the customer is saving right now, across every qualifying line. */
export function basketWholesaleSaving(
  lines: (WholesalePriceable & { productSlug: string; quantity: number })[]
): number {
  const totals = quantityByProduct(lines);

  const saving = lines.reduce((sum, line) => {
    if (!isWholesaleApplied(line, totals.get(line.productSlug) || 0)) return sum;
    return sum + savingPerUnit(line) * line.quantity;
  }, 0);

  return round2(saving);
}

/** Reads a rule off arbitrary input (a form body, a database row). */
export function normalizeWholesaleRule(
  input: { minQuantity?: unknown; unitPrice?: unknown } | null | undefined,
  basePrice: number
): WholesaleRule | null {
  if (!input) return null;

  const candidate = {
    minQuantity: Math.floor(Number(input.minQuantity)),
    unitPrice: round2(Number(input.unitPrice))
  };

  return isWholesaleRuleUsable(candidate, basePrice) ? candidate : null;
}
