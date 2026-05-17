import type { Metadata } from 'next';
import { Archivo_Black, Barlow_Condensed, DM_Sans, IBM_Plex_Mono } from 'next/font/google';
import { Footer } from '@/components/layout/Footer';
import { Navbar } from '@/components/layout/Navbar';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { buildMetadata } from '@/lib/metadata';
import './globals.css';

const archivo = Archivo_Black({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-archivo',
  weight: '400'
});

const barlow = Barlow_Condensed({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-barlow',
  weight: ['600', '700']
});

const dmSans = DM_Sans({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['300', '400', '500', '700']
});

const plexMono = IBM_Plex_Mono({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-plex-mono',
  weight: ['400', '500', '700']
});

export const metadata: Metadata = buildMetadata();

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      className={`${archivo.variable} ${barlow.variable} ${dmSans.variable} ${plexMono.variable}`}
      lang="en"
    >
      <head>
        <script src="https://js.paystack.co/v1/inline.js" defer></script>
      </head>
      <body>
        <a className="skipLink" href="#main">
          Skip to main content
        </a>
        <Navbar />
        <main id="main">{children}</main>
        <Footer />
        <CartDrawer />
      </body>
    </html>
  );
}
