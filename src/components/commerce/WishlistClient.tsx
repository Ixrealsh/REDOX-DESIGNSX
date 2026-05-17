'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { LinkButton } from '@/components/ui/LinkButton';
import { formatCurrency } from '@/lib/format';
import { useWishlistStore } from '@/store/wishlist.store';
import styles from '@/app/pages.module.css';

export function WishlistClient() {
  const items = useWishlistStore((state) => state.items);
  const removeItem = useWishlistStore((state) => state.removeItem);

  if (items.length === 0) {
    return (
      <div className={styles.panel}>
        <h2>No saved pieces yet</h2>
        <p>Use the heart on product cards to build a personal shortlist.</p>
        <LinkButton href="/shop">View shop</LinkButton>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {items.map((item) => (
        <article className={styles.panel} key={item.productId}>
          <Link className={styles.imageCard} href={`/products/${item.productSlug}`}>
            <Image alt={item.name} fill sizes="(min-width: 1040px) 33vw, 100vw" src={item.image} />
          </Link>
          <h2>{item.name}</h2>
          <p>{formatCurrency(item.price)}</p>
          <Button onClick={() => removeItem(item.productId)} variant="secondary">
            Remove
          </Button>
        </article>
      ))}
    </div>
  );
}
