import Link from 'next/link';
import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer} style={{ background: '#050505', borderTop: '1px solid var(--color-border)', padding: '32px var(--section-x)' }}>
      <div className={styles.inner} style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', width: 'min(100%, var(--container-max))', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link className={styles.logo} href="/" style={{ display: 'flex', alignItems: 'center', marginBottom: 0 }}>
            <img 
              src="/assets/icons/redoxlogo.jpg" 
              alt="REDOXDESIGNX" 
              style={{ 
                width: '32px', 
                height: '32px', 
                borderRadius: '50%', 
                objectFit: 'cover', 
                border: '1px solid var(--color-border)' 
              }} 
            />
          </Link>
          <span style={{ fontSize: '0.72rem', letterSpacing: '0.06em', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontFamily: 'var(--font-mono), monospace' }}>
            © 2026 REDOXDESIGNX • ZERO RESTOCKS
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center', fontFamily: 'var(--font-mono), monospace', fontSize: '0.72rem', textTransform: 'uppercase' }}>
          <Link className={styles.link} href="/shop">Shop</Link>
          <Link className={styles.link} href="/collections">Collections</Link>
          <Link className={styles.link} href="/drops">Drops</Link>
          <Link className={styles.link} href="/track-order">Track Order</Link>
          <Link className={styles.link} href="/size-guide">Size Guide</Link>
          <Link className={styles.link} href="/contact">Contact</Link>
          <span style={{ color: '#333' }}>|</span>
          <a className={styles.link} href="https://wa.me/233558058348" target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <a className={styles.link} href="https://tiktok.com/@redoxdesignx" target="_blank" rel="noopener noreferrer">TikTok</a>
          <a className={styles.link} href="https://instagram.com/redoxdesignx" target="_blank" rel="noopener noreferrer">Instagram</a>
        </div>
      </div>
    </footer>
  );
}
