import type { Product, Variant } from '@/types/product';

export const DEFAULT_STOCK_LIMIT = 99;

export function isVariantInStock(variant: Variant) {
  if (variant.stockStatus === 'out_of_stock') return false;
  if (variant.inventory === 0) return false;
  return true;
}

export function getVariantStockLimit(variant: Variant, fallback = DEFAULT_STOCK_LIMIT) {
  if (!isVariantInStock(variant)) return 0;
  if (typeof variant.inventory === 'number' && Number.isFinite(variant.inventory) && variant.inventory > 0) {
    return variant.inventory;
  }
  return fallback;
}

export function getVariantStockLabel(variant: Variant) {
  if (!isVariantInStock(variant)) return 'Sold out';
  if (typeof variant.inventory === 'number' && Number.isFinite(variant.inventory) && variant.inventory > 0) {
    if (variant.inventory <= 3) return `Only ${variant.inventory} left`;
    return `${variant.inventory} in stock`;
  }
  return 'In stock';
}

export function getProductStockSummary(product: Product) {
  const variants = product.variants || [];
  const available = variants.filter(isVariantInStock);
  const finiteInventory = available
    .map((variant) => variant.inventory)
    .filter((inventory): inventory is number => typeof inventory === 'number' && Number.isFinite(inventory) && inventory > 0);

  return {
    availableCount: available.length,
    isSoldOut: available.length === 0,
    totalKnownStock: finiteInventory.reduce((sum, inventory) => sum + inventory, 0),
    hasUnlimitedStock: available.some((variant) => variant.inventory == null)
  };
}

export function normalizeVariantStock(variant: Variant): Variant {
  const inventory =
    typeof variant.inventory === 'number' && Number.isFinite(variant.inventory)
      ? Math.max(0, Math.floor(variant.inventory))
      : null;

  return {
    ...variant,
    inventory,
    stockStatus: variant.stockStatus || (inventory === 0 ? 'out_of_stock' : 'in_stock')
  };
}
