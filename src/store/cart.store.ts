'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Product, Variant, WholesaleRule } from '@/types/product';
import { calcOrderTotal, calcServiceCharge, clamp, FREE_SHIPPING_THRESHOLD } from '@/lib/format';
import { getVariantStockLimit, UNTRACKED_STOCK_LIMIT } from '@/lib/inventory';
import {
  basketWholesaleSaving,
  effectiveUnitPrice,
  quantityByProduct
} from '@/lib/wholesale';

export interface CartItem {
  productId: string;
  productSlug: string;
  name: string;
  image: string;
  /** The normal price, captured when the piece was added. */
  price: number;
  variantId: string;
  size: string;
  color: string;
  sku: string;
  quantity: number;
  stockLimit?: number;
  /**
   * The product's bulk rule, captured alongside the price. A rule the merchant
   * changes afterwards will not reach an already-open bag until checkout, where
   * the server re-prices from the catalogue — the same way `price` already works.
   */
  wholesale?: WholesaleRule | null;
}

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  hydrated: boolean;
  addItem: (product: Product, variant: Variant, quantity?: number, selectedColorImage?: string) => void;
  removeItem: (variantId: string) => void;
  updateQty: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  setHydrated: (hydrated: boolean) => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set) => ({
      items: [],
      isOpen: false,
      hydrated: false,
      addItem: (product, variant, quantity = 1, selectedColorImage) =>
        set((state) => {
          const compositeId = `${variant.id}-${variant.color}`;
          const stockLimit = getVariantStockLimit(variant);
          const existing = state.items.find((item) => item.variantId === compositeId);

          if (existing) {
            return {
              isOpen: true,
              items: state.items.map((item) =>
                item.variantId === compositeId
                  ? { ...item, stockLimit, quantity: clamp(item.quantity + quantity, 1, stockLimit) }
                  : item
              )
            };
          }

          return {
            isOpen: true,
            items: [
              ...state.items,
              {
                productId: product.id,
                productSlug: product.slug,
                name: product.name,
                image: selectedColorImage || product.image,
                price: product.price,
                variantId: compositeId,
                size: variant.size,
                color: variant.color,
                sku: variant.sku,
                quantity: clamp(quantity, 1, stockLimit),
                stockLimit,
                wholesale: product.wholesale ?? null
              }
            ]
          };
        }),
      removeItem: (variantId) =>
        set((state) => ({ items: state.items.filter((item) => item.variantId !== variantId) })),
      updateQty: (variantId, quantity) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.variantId === variantId
              ? { ...item, quantity: clamp(quantity, 1, item.stockLimit || UNTRACKED_STOCK_LIMIT) }
              : item
          )
        })),
      clearCart: () => set({ items: [] }),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      setHydrated: (hydrated) => set({ hydrated })
    }),
    {
      name: 'redox-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      }
    }
  )
);

export function getCartTotals(items: CartItem[]) {
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  // Bulk pricing is per product across its sizes and colours, so the quantities
  // have to be totalled before anything is priced.
  const quantities = quantityByProduct(items);

  const subtotal =
    Math.round(
      items.reduce(
        (sum, item) =>
          sum + effectiveUnitPrice(item, quantities.get(item.productSlug) || 0) * item.quantity,
        0
      ) * 100
    ) / 100;

  const serviceCharge = calcServiceCharge(subtotal);
  const orderTotal = calcOrderTotal(subtotal);
  const freeShippingProgress = clamp((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 0, 100);
  const remainingForFreeShipping = Math.max(FREE_SHIPPING_THRESHOLD - subtotal, 0);

  return {
    totalItems,
    subtotal,
    serviceCharge,
    orderTotal,
    freeShippingProgress,
    remainingForFreeShipping,
    /** What bulk pricing is taking off this bag right now. */
    wholesaleSaving: basketWholesaleSaving(items),
    /** Per-product totals, so the drawer can show which lines qualified. */
    quantityByProductSlug: quantities
  };
}
