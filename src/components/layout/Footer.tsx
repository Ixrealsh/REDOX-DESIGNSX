import Link from 'next/link';
import styles from './Footer.module.css';

const columns = [
  {
    title: 'Shop',
    links: [
      { href: '/shop', label: 'All Products' },
      { href: '/collections', label: 'Collections' },
      { href: '/drops', label: 'Drops' },
      { href: '/size-guide', label: 'Size Guide' }
    ]
  },
  {
    title: 'Brand',
    links: [
      { href: '/about', label: 'About' },
      { href: '/lookbook', label: 'Lookbook' },
      { href: '/sustainability', label: 'Sustainability' },
      { href: '/contact', label: 'Contact' }
    ]
  },
  {
    title: 'Social',
    links: [
      { href: 'https://instagram.com', label: 'Instagram' },
      { href: 'https://tiktok.com', label: 'TikTok' },
      { href: 'https://x.com', label: 'X' },
      { href: 'https://pinterest.com', label: 'Pinterest' }
    ]
  }
];

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Link className={styles.logo} href="/" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <img 
              src="/assets/icons/redoxlogo.jpg" 
              alt="Redox Designsx" 
              style={{ 
                width: '36px', 
                height: '36px', 
                borderRadius: '50%', 
                objectFit: 'cover', 
                border: '1px solid var(--color-border)' 
              }} 
            />
            <span>Redox Designsx</span>
          </Link>
          <p className={styles.copy}>
            Chemical precision. Street tension. Limited apparel built for the people who dress
            with intention, not noise.
          </p>
        </div>

        {columns.map((column) => (
          <div key={column.title}>
            <h2 className={styles.columnTitle}>{column.title}</h2>
            <div className={styles.links}>
              {column.links.map((link) => (
                <Link className={styles.link} href={link.href} key={link.label}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className={styles.bottom}>
        <span>2026 Redox Designsx</span>
        <span>12 drops / 40,000+ units / zero restocks</span>
      </div>
    </footer>
  );
}
