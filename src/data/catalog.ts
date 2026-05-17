import type { Collection, Drop, LookbookIssue, Product } from '@/types/product';

export const products: Product[] = [];
export const collections: Collection[] = [];
export const drops: Drop[] = [];
export const lookbooks: LookbookIssue[] = [];

export function getProduct(slug: string) {
  return products.find((product) => product.slug === slug);
}

export function getCollection(slug: string) {
  return collections.find((collection) => collection.slug === slug);
}

export function getCollectionProducts(slug: string) {
  return products.filter((product) => product.collectionSlug === slug);
}

export function getLookbook(slug: string) {
  return lookbooks.find((issue) => issue.slug === slug);
}
