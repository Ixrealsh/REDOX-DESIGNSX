'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Product, Variant } from '@/types/product';
import { clamp, FREE_SHIPPING_THRESHOLD } from '@/lib/format';

export interface CartItem {
  productId: string;
  productSlug: string;
  name: string;
  image: string;
  price: number;
  variantId: string;
  size: string;
  color: string;
  sku: string;
  quantity: number;
}

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  hydrated: boolean;
  addItem: (product: Product, variant: Variant, quantity?: number) => void;
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
      addItem: (product, variant, quantity = 1) =>
        set((state) => {
          const existing = state.items.find((item) => item.variantId === variant.id);

          if (existing) {
            return {
              isOpen: true,
              items: state.items.map((item) =>
                item.variantId === variant.id
                  ? { ...item, quantity: clamp(item.quantity + quantity, 1, 99) }
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
                image: product.image,
                price: product.price,
                variantId: variant.id,
                size: variant.size,
                color: variant.color,
                sku: variant.sku,
                quantity
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
              ? { ...item, quantity: clamp(quantity, 1, 99) }
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
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const freeShippingProgress = clamp((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 0, 100);
  const remainingForFreeShipping = Math.max(FREE_SHIPPING_THRESHOLD - subtotal, 0);

  return {
    totalItems,
    subtotal,
    freeShippingProgress,
    remainingForFreeShipping
  };
}
