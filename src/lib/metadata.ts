import type { Metadata } from 'next';

export const siteMeta = {
  siteName: 'REDOXDESIGNX',
  siteUrl: 'https://redoxdesignx.com',
  defaultTitle: 'REDOXDESIGNX | Premium Streetwear & Contemporary Blanks',
  defaultDescription:
    'Chemical precision. Street tension. REDOXDESIGNX crafts premium limited-run 230gsm heavyweight blank tees and contemporary apparel. Engineered with intention, zero restocks.',
  defaultOgImage: 'https://redoxdesignx.com/assets/icons/redoxlogo.jpg',
  twitterHandle: '@redoxdesignsx'
};

export function buildMetadata({
  title,
  description,
  path = '/'
}: {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
} = {}): Metadata {
  const pageTitle = title ? `${title} | ${siteMeta.siteName}` : siteMeta.defaultTitle;
  const pageDescription = description || siteMeta.defaultDescription;
  const url = new URL(path, siteMeta.siteUrl).toString();
  const image = siteMeta.defaultOgImage; // Consistently enforce website logo as absolute preview image

  return {
    metadataBase: new URL(siteMeta.siteUrl),
    title: pageTitle,
    description: pageDescription,
    keywords: [
      'REDOXDESIGNX',
      'REDOXDESIGNXs',
      'Redox',
      'streetwear Ghana',
      'Accra clothing brand',
      '230gsm heavyweight blank tee',
      'premium blank t-shirt',
      'luxury apparel Accra',
      'minimalist blank tees',
      'limited streetwear drops',
      'contemporary clothing blanks'
    ],
    alternates: { canonical: url },
    icons: {
      icon: '/assets/icons/redoxlogo.jpg',
      apple: '/assets/icons/redoxlogo.jpg',
      shortcut: '/assets/icons/redoxlogo.jpg'
    },
    openGraph: {
      title: pageTitle,
      description: pageDescription,
      url,
      siteName: siteMeta.siteName,
      images: [{ url: image, width: 600, height: 600, alt: siteMeta.siteName }],
      type: 'website'
    },
    twitter: {
      card: 'summary',
      title: pageTitle,
      description: pageDescription,
      images: [image],
      creator: siteMeta.twitterHandle
    }
  };
}
