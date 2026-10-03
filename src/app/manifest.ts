import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'REDOXDESIGNX',
    short_name: 'REDOX',
    description: 'Shop REDOXDESIGNX apparel and track your orders.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#080808',
    theme_color: '#080808',
    icons: [
      { src: '/icon1?brand=2', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon?brand=2', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon?brand=2', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };
}
