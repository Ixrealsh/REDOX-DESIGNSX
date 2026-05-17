import type { MetadataRoute } from 'next';
import { collections, lookbooks, products } from '@/data/catalog';
import { siteMeta } from '@/lib/metadata';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes = [
    '',
    '/shop',
    '/collections',
    '/drops',
    '/lookbook',
    '/about',
    '/sustainability',
    '/track-order',
    '/contact',
    '/search'
  ];

  return [
    ...staticRoutes.map((route) => ({
      url: `${siteMeta.siteUrl}${route}`,
      lastModified: now
    })),
    ...products.map((product) => ({
      url: `${siteMeta.siteUrl}/products/${product.slug}`,
      lastModified: now
    })),
    ...collections.map((collection) => ({
      url: `${siteMeta.siteUrl}/collections/${collection.slug}`,
      lastModified: now
    })),
    ...lookbooks.map((issue) => ({
      url: `${siteMeta.siteUrl}/lookbook/${issue.slug}`,
      lastModified: now
    }))
  ];
}
