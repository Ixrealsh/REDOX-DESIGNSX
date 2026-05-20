import type { Product, Variant } from '@/types/product';

export function isVariantInStock(variant: Variant) {
  if (variant.stockStatus === 'out_of_stock') return false;
  if (typeof variant.inventory !== 'number' || !Number.isFinite(variant.inventory)) return false;
  return variant.inventory > 0;
}

export function getVariantStockLimit(variant: Variant) {
  if (!isVariantInStock(variant)) return 0;
  return Math.max(1, Math.floor(variant.inventory as number));
}

export function getVariantStockLabel(variant: Variant) {
  if (!isVariantInStock(variant)) return 'Sold out';
  const inventory = Math.floor(variant.inventory as number);
  if (inventory <= 3) return `Only ${inventory} left`;
  return `${inventory} in stock`;
}

export function getProductStockSummary(product: Product) {
  const variants = product.variants || [];
  const available = variants.filter(isVariantInStock);
  const finiteInventory = available.map((variant) => Math.floor(variant.inventory as number));

  return {
    availableCount: available.length,
    isSoldOut: available.length === 0,
    totalKnownStock: finiteInventory.reduce((sum, inventory) => sum + inventory, 0),
    hasUnlimitedStock: false
  };
}

export function normalizeVariantStock(variant: Variant): Variant {
  const inventory =
    typeof variant.inventory === 'number' && Number.isFinite(variant.inventory)
      ? Math.max(0, Math.floor(variant.inventory))
      : null;
  const stockStatus =
    variant.stockStatus === 'out_of_stock' || inventory === 0 || inventory == null
      ? 'out_of_stock'
      : 'in_stock';

  return {
    ...variant,
    inventory,
    stockStatus
  };
}
