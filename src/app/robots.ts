import type { MetadataRoute } from 'next';
import { siteMeta } from '@/lib/metadata';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/account/']
      }
    ],
    sitemap: `${siteMeta.siteUrl}/sitemap.xml`
  };
}
