import { LinkButton } from '@/components/ui/LinkButton';
import { buildMetadata } from '@/lib/metadata';
import styles from '../../pages.module.css';

export const metadata = buildMetadata({
  title: 'Orders',
  description: 'Track a REDOXDESIGNX order using its reference.',
  path: '/account/orders'
});

export default function OrdersPage() {
  return (
    <>
      <header className="pageHeader">
        <div className="pageHeaderInner">
          <p className="eyebrow">Orders</p>
          <h1 className="pageTitle">Find your order.</h1>
          <p className="pageLead">Enter the reference from your order confirmation to check its status.</p>
        </div>
      </header>
      <section className={styles.section}>
        <div className={styles.tight}>
          <div className={styles.panel}>
            <h2>Order tracking</h2>
            <p>Your order reference is in the confirmation shown after checkout.</p>
            <LinkButton href="/track-order">Track an order</LinkButton>
          </div>
        </div>
      </section>
    </>
  );
}
