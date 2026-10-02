import { LinkButton } from '@/components/ui/LinkButton';
import { buildMetadata } from '@/lib/metadata';
import styles from '../pages.module.css';

export const metadata = buildMetadata({
  title: 'Account',
  description: 'Track an order, view saved pieces, or contact REDOXDESIGNX.',
  path: '/account'
});

export default function AccountPage() {
  return (
    <>
      <header className="pageHeader">
        <div className="pageHeaderInner">
          <p className="eyebrow">Account</p>
          <h1 className="pageTitle">Your Redox file.</h1>
          <p className="pageLead">Find an order or return to your saved pieces.</p>
        </div>
      </header>
      <section className={styles.section}>
        <div className={`${styles.inner} ${styles.grid}`}>
          <article className={styles.panel}>
            <h2>Track an order</h2>
            <p>Use the reference from your order confirmation to see its latest status.</p>
            <LinkButton href="/track-order" variant="secondary">Track order</LinkButton>
          </article>
          <article className={styles.panel}>
            <h2>Wishlist</h2>
            <p>View the pieces saved in this browser.</p>
            <LinkButton href="/account/wishlist" variant="secondary">View wishlist</LinkButton>
          </article>
          <article className={styles.panel}>
            <h2>Need help?</h2>
            <p>Contact us about an order, delivery, or a product.</p>
            <LinkButton href="/contact" variant="secondary">Need support</LinkButton>
          </article>
        </div>
      </section>
    </>
  );
}
