'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Product } from '@/types/product';

export interface WishlistItem {
  productId: string;
  productSlug: string;
  name: string;
  image: string;
  price: number;
}

interface WishlistStore {
  items: WishlistItem[];
  hydrated: boolean;
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  toggleItem: (product: Product) => void;
  isWishlisted: (productId: string) => boolean;
  clear: () => void;
  setHydrated: (hydrated: boolean) => void;
}

export const useWishlistStore = create<WishlistStore>()(
  persist(
    (set, get) => ({
      items: [],
      hydrated: false,
      addItem: (product) =>
        set((state) => {
          if (state.items.some((item) => item.productId === product.id)) {
            return state;
          }

          return {
            items: [
              ...state.items,
              {
                productId: product.id,
                productSlug: product.slug,
                name: product.name,
                image: product.image,
                price: product.price
              }
            ]
          };
        }),
      removeItem: (productId) =>
        set((state) => ({ items: state.items.filter((item) => item.productId !== productId) })),
      toggleItem: (product) => {
        if (get().isWishlisted(product.id)) {
          get().removeItem(product.id);
          return;
        }

        get().addItem(product);
      },
      isWishlisted: (productId) => get().items.some((item) => item.productId === productId),
      clear: () => set({ items: [] }),
      setHydrated: (hydrated) => set({ hydrated })
    }),
    {
      name: 'redox-wishlist',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      }
    }
  )
);
