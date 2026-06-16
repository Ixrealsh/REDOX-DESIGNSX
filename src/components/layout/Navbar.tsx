'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BagIcon, HeartIcon, MenuIcon, SearchIcon, UserIcon, XIcon } from '@/components/ui/Icons';
import { getCartTotals, useCartStore } from '@/store/cart.store';
import { useWishlistStore } from '@/store/wishlist.store';
import styles from './Navbar.module.css';

const NAV_LINKS = [
  { href: '/shop', label: 'Shop' },
  { href: '/collections', label: 'Collections' },
  { href: '/track-order', label: 'Track Order' },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const items = useCartStore((state) => state.items);
  const openCart = useCartStore((state) => state.openCart);
  const wishlistCount = useWishlistStore((state) => state.items.length);
  const { totalItems } = getCartTotals(items);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  return (
    <>
      <nav
        aria-label="Main navigation"
        className={`${styles.nav} ${scrolled ? styles.navScrolled : ''}`}
      >
        <div className={styles.inner}>
          {/* Left: hamburger (mobile) + links (desktop) */}
          <div className={styles.left}>
            <button
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              className={styles.menuButton}
              onClick={() => setMobileOpen((o) => !o)}
              type="button"
            >
              {mobileOpen ? <XIcon /> : <MenuIcon />}
            </button>

            <div className={styles.links}>
              {NAV_LINKS.map((link) => (
                <Link
                  className={`${styles.navLink} ${pathname.startsWith(link.href) ? styles.navLinkActive : ''}`}
                  href={link.href}
                  key={link.href}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Center: logo */}
          <Link aria-label="REDOXDESIGNX home" className={styles.logo} href="/">
            <img
              alt="REDOXDESIGNX"
              className={styles.logoImg}
              src="/assets/icons/redoxlogo.jpg"
            />
            <span className={styles.logoText}>REDOXDESIGNX</span>
          </Link>

          {/* Right: action icons */}
          <div className={styles.actions}>
            <Link aria-label="Search" className={`${styles.iconButton} ${styles.hideMobile}`} href="/search">
              <SearchIcon />
            </Link>
            <Link
              aria-label={`Wishlist: ${wishlistCount} saved`}
              className={styles.iconButton}
              href="/account/wishlist"
            >
              <HeartIcon />
              {wishlistCount > 0 && <span className={styles.count}>{wishlistCount}</span>}
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
              {totalItems > 0 && <span className={styles.count}>{totalItems}</span>}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile overlay */}
      <button
        aria-hidden="true"
        className={`${styles.mobileOverlay} ${mobileOpen ? styles.mobileOverlayOpen : ''}`}
        onClick={() => setMobileOpen(false)}
        tabIndex={-1}
        type="button"
      />

      {/* Mobile panel */}
      <div
        aria-hidden={!mobileOpen}
        className={`${styles.mobilePanel} ${mobileOpen ? styles.mobilePanelOpen : ''}`}
      >
        <div className={styles.mobilePanelInner}>
          {[...NAV_LINKS, { href: '/search', label: 'Search' }, { href: '/account', label: 'Account' }].map(
            (link) => (
              <Link
                className={`${styles.mobileLink} ${pathname.startsWith(link.href) ? styles.mobileLinkActive : ''}`}
                href={link.href}
                key={link.href}
              >
                {link.label}
                <span className={styles.mobileLinkArrow}>→</span>
              </Link>
            )
          )}
        </div>
      </div>
    </>
  );
}
