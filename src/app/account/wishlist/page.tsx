import { WishlistClient } from '@/components/commerce/WishlistClient';
import { buildMetadata } from '@/lib/metadata';
import styles from '../../pages.module.css';

export const metadata = buildMetadata({
  title: 'Wishlist',
  description: 'Saved REDOXDESIGNX apparel pieces.',
  path: '/account/wishlist'
});

export default function WishlistPage() {
  return (
    <>
      <header className="pageHeader">
        <div className="pageHeaderInner">
          <p className="eyebrow">Wishlist</p>
          <h1 className="pageTitle">Saved reactions.</h1>
          <p className="pageLead">Your locally saved products. Hearts persist across refreshes.</p>
        </div>
      </header>
      <section className={styles.section}>
        <div className={styles.inner}>
          <WishlistClient />
        </div>
      </section>
    </>
  );
}
