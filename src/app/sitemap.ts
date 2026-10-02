import type { MetadataRoute } from 'next';
import { getVisibleDbProducts, getDbLookbooks } from '@/lib/catalog-db';
import { siteMeta } from '@/lib/metadata';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes = [
    '',
    '/shop',
    '/drops',
    '/lookbook',
    '/about',
    '/sustainability',
    '/size-guide',
    '/contact',
    '/search'
  ];

  const products = await getVisibleDbProducts();
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
    ...lookbooks.map((issue) => ({
      url: `${siteMeta.siteUrl}/lookbook/${issue.slug}`,
      lastModified: now
    }))
  ];
}
