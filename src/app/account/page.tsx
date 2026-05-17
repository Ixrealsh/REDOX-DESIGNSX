import { LinkButton } from '@/components/ui/LinkButton';
import { buildMetadata } from '@/lib/metadata';
import styles from '../pages.module.css';

export const metadata = buildMetadata({
  title: 'Account',
  description: 'Redox Designsx account dashboard for orders, profile, and wishlist.',
  path: '/account'
});

export default function AccountPage() {
  return (
    <>
      <header className="pageHeader">
        <div className="pageHeaderInner">
          <p className="eyebrow">Account</p>
          <h1 className="pageTitle">Your Redox file.</h1>
          <p className="pageLead">A ready-to-wire account surface for orders, profile details, and saved pieces.</p>
        </div>
      </header>
      <section className={styles.section}>
        <div className={`${styles.inner} ${styles.grid}`}>
          <article className={styles.panel}>
            <h2>Orders</h2>
            <p>Order history will sync here when Shopify customer accounts are connected.</p>
            <LinkButton href="/account/orders" variant="secondary">View orders</LinkButton>
          </article>
          <article className={styles.panel}>
            <h2>Wishlist</h2>
            <p>Saved products persist locally now and can sync to customer profiles later.</p>
            <LinkButton href="/account/wishlist" variant="secondary">View wishlist</LinkButton>
          </article>
          <article className={styles.panel}>
            <h2>Profile</h2>
            <p>Customer profile, addresses, and preferences are reserved for the Shopify customer API.</p>
            <LinkButton href="/contact" variant="secondary">Need support</LinkButton>
          </article>
        </div>
      </section>
    </>
  );
}
