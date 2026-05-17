import type { Metadata } from 'next';

export const siteMeta = {
  siteName: 'Redox Design',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://redoxdesign.com',
  defaultTitle: 'Redox Design - Premium Streetwear and Contemporary Clothing',
  defaultDescription:
    'Redox Design crafts limited-run streetwear for those who dress with intention. Explore collections, drops, and lookbooks.',
  defaultOgImage: '/assets/images/campaigns/redox-hero.png',
  twitterHandle: '@redoxdesign'
};

export function buildMetadata({
  title,
  description,
  path = '/',
  image = siteMeta.defaultOgImage
}: {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
} = {}): Metadata {
  const pageTitle = title ? `${title} | ${siteMeta.siteName}` : siteMeta.defaultTitle;
  const pageDescription = description || siteMeta.defaultDescription;
  const url = new URL(path, siteMeta.siteUrl).toString();

  return {
    metadataBase: new URL(siteMeta.siteUrl),
    title: pageTitle,
    description: pageDescription,
    alternates: { canonical: url },
    openGraph: {
      title: pageTitle,
      description: pageDescription,
      url,
      siteName: siteMeta.siteName,
      images: [{ url: image, width: 1200, height: 630, alt: siteMeta.siteName }],
      type: 'website'
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description: pageDescription,
      images: [image],
      creator: siteMeta.twitterHandle
    }
  };
}
