import type { MetadataRoute } from 'next';
import { getDbProducts, getDbCollections, getDbLookbooks } from '@/lib/catalog-db';
import { siteMeta } from '@/lib/metadata';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes = [
    '',
    '/shop',
    '/collections',
    '/drops',
    '/lookbook',
    '/about',
    '/sustainability',
    '/size-guide',
    '/contact',
    '/search'
  ];

  const products = await getDbProducts();
  const collections = await getDbCollections();
  const lookbooks = await getDbLookbooks();

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
