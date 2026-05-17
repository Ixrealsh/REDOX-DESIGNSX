'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { BagIcon, HeartIcon, MenuIcon, SearchIcon, UserIcon, XIcon } from '@/components/ui/Icons';
import { getCartTotals, useCartStore } from '@/store/cart.store';
import { useWishlistStore } from '@/store/wishlist.store';
import styles from './Navbar.module.css';

const primaryLinks = [
  { href: '/shop', label: 'Shop' },
  { href: '/collections', label: 'Collections' },
  { href: '/drops', label: 'Drops' },
  { href: '/lookbook', label: 'Lookbook' },
  { href: '/about', label: 'About' }
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = useCartStore((state) => state.items);
  const openCart = useCartStore((state) => state.openCart);
  const wishlistCount = useWishlistStore((state) => state.items.length);
  const { totalItems } = getCartTotals(items);

  const closeMobile = () => setMobileOpen(false);

  return (
    <nav aria-label="Main navigation" className={styles.nav}>
      <div className={styles.inner}>
        <button
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          className={styles.menuButton}
          onClick={() => setMobileOpen((open) => !open)}
          type="button"
        >
          {mobileOpen ? <XIcon /> : <MenuIcon />}
        </button>

        <div className={styles.links}>
          {primaryLinks.slice(0, 4).map((link) => (
            <Link
              className={`${styles.navLink} ${pathname.startsWith(link.href) ? styles.navLinkActive : ''}`}
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <Link aria-label="Redox Designsx home" className={styles.logo} href="/">
          <img 
            src="/assets/icons/redoxlogo.jpg" 
            alt="Redox Designsx" 
            style={{ 
              width: '42px', 
              height: '42px', 
              borderRadius: '50%', 
              objectFit: 'cover', 
              border: '1.5px solid var(--color-border)',
              display: 'block',
              transition: 'border-color 0.2s, transform 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-red)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          />
        </Link>

        <div className={styles.actions}>
          <Link aria-label="Search" className={`${styles.iconButton} ${styles.hideMobile}`} href="/search">
            <SearchIcon />
          </Link>
          <Link aria-label={`Wishlist: ${wishlistCount} items`} className={styles.iconButton} href="/account/wishlist">
            <HeartIcon />
            {wishlistCount > 0 ? <span className={styles.count}>{wishlistCount}</span> : null}
          </Link>
          <Link aria-label="Account" className={`${styles.iconButton} ${styles.hideMobile}`} href="/account">
            <UserIcon />
          </Link>
          <button
            aria-label={`Cart: ${totalItems} items`}
            className={styles.iconButton}
            onClick={openCart}
            type="button"
          >
            <BagIcon />
            {totalItems > 0 ? <span className={styles.count}>{totalItems}</span> : null}
          </button>
        </div>
      </div>

      <div className={`${styles.mobilePanel} ${mobileOpen ? styles.mobileOpen : ''}`}>
        {[...primaryLinks, { href: '/search', label: 'Search' }, { href: '/account', label: 'Account' }].map(
          (link) => (
            <Link
              className={`${styles.navLink} ${pathname.startsWith(link.href) ? styles.navLinkActive : ''}`}
              href={link.href}
              key={link.href}
              onClick={closeMobile}
            >
              {link.label}
            </Link>
          )
        )}
      </div>
    </nav>
  );
}
