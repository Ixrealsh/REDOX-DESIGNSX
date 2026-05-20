import type { Product, Variant } from '@/types/product';

/** Max quantity per line when admin leaves stock untracked (optional qty). */
export const UNTRACKED_STOCK_LIMIT = 99;

export function hasTrackedInventory(variant: Variant) {
  return (
    typeof variant.inventory === 'number' &&
    Number.isFinite(variant.inventory) &&
    variant.inventory > 0
  );
}

export function isVariantInStock(variant: Variant) {
  if (variant.stockStatus === 'out_of_stock') return false;
  if (variant.inventory === 0) return false;
  return true;
}

export function getVariantStockLimit(variant: Variant) {
  if (!isVariantInStock(variant)) return 0;
  if (hasTrackedInventory(variant)) {
    return Math.floor(variant.inventory as number);
  }
  return UNTRACKED_STOCK_LIMIT;
}

export function getVariantStockLabel(variant: Variant) {
  if (!isVariantInStock(variant)) return 'Sold out';
  if (!hasTrackedInventory(variant)) return 'In stock';
  const inventory = Math.floor(variant.inventory as number);
  if (inventory <= 3) return `Only ${inventory} left`;
  return `${inventory} in stock`;
}

export function getProductStockSummary(product: Product) {
  const variants = product.variants || [];
  const available = variants.filter(isVariantInStock);
  const finiteInventory = available
    .filter(hasTrackedInventory)
    .map((variant) => Math.floor(variant.inventory as number));

  return {
    availableCount: available.length,
    isSoldOut: available.length === 0,
    totalKnownStock: finiteInventory.reduce((sum, inventory) => sum + inventory, 0),
    hasUnlimitedStock: available.some((variant) => variant.inventory == null)
  };
}

export function normalizeVariantStock(variant: Variant): Variant {
  if (variant.stockStatus === 'out_of_stock') {
    return { ...variant, inventory: 0, stockStatus: 'out_of_stock' };
  }

  const hasQuantity =
    typeof variant.inventory === 'number' && Number.isFinite(variant.inventory);

  if (!hasQuantity) {
    return { ...variant, inventory: null, stockStatus: 'in_stock' };
  }

  const inventory = Math.max(0, Math.floor(variant.inventory as number));

  return {
    ...variant,
    inventory,
    stockStatus: inventory === 0 ? 'out_of_stock' : 'in_stock'
  };
}
