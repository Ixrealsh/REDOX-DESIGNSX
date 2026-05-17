import { LinkButton } from '@/components/ui/LinkButton';
import { buildMetadata } from '@/lib/metadata';
import styles from '../../pages.module.css';

export const metadata = buildMetadata({
  title: 'Orders',
  description: 'REDOXDESIGNX order history.',
  path: '/account/orders'
});

export default function OrdersPage() {
  return (
    <>
      <header className="pageHeader">
        <div className="pageHeaderInner">
          <p className="eyebrow">Orders</p>
          <h1 className="pageTitle">No orders loaded.</h1>
          <p className="pageLead">Connect Shopify customer accounts to hydrate order history.</p>
        </div>
      </header>
      <section className={styles.section}>
        <div className={styles.tight}>
          <div className={styles.panel}>
            <h2>Commerce integration placeholder</h2>
            <p>
              This page is ready for authenticated customer order data. For now, use the shop to
              test cart and checkout flow behavior.
            </p>
            <LinkButton href="/shop">Continue shopping</LinkButton>
          </div>
        </div>
      </section>
    </>
  );
}
