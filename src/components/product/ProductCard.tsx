'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/Badge';
import { HeartIcon } from '@/components/ui/Icons';
import { formatCurrency } from '@/lib/format';
import { getProductStockSummary } from '@/lib/inventory';
import { useWishlistStore } from '@/store/wishlist.store';
import type { Product } from '@/types/product';
import styles from './ProductCard.module.css';

interface ProductCardProps {
  product: Product;
  priority?: boolean;
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const toggleWishlist = useWishlistStore((state) => state.toggleItem);
  const isWishlisted = useWishlistStore((state) => state.isWishlisted(product.id));
  const stock = useMemo(() => getProductStockSummary(product), [product]);
  const badgeLabel: Product['badge'] = stock.isSoldOut ? 'SOLD OUT' : product.badge;

  return (
    <article className={styles.card}>
      <Link className={styles.media} href={`/products/${product.slug}`}>
        <Image
          alt={product.imageAlt}
          className={`${styles.image} ${styles.imagePrimary}`}
          fill
          priority={priority}
          sizes="(min-width: 1440px) 25vw, (min-width: 1024px) 33vw, (min-width: 600px) 50vw, 100vw"
          src={product.image}
        />
        <Image
          alt=""
          aria-hidden="true"
          className={`${styles.image} ${styles.imageSecondary}`}
          fill
          sizes="(min-width: 1440px) 25vw, (min-width: 1024px) 33vw, (min-width: 600px) 50vw, 100vw"
          src={product.secondaryImage}
        />
      </Link>

      {badgeLabel ? (
        <span className={styles.badge}>
          <Badge label={badgeLabel} />
        </span>
      ) : null}

      <button
        aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
        aria-pressed={isWishlisted}
        className={`${styles.wishlist} ${isWishlisted ? styles.wishlistActive : ''}`}
        onClick={() => toggleWishlist(product)}
        type="button"
      >
        <HeartIcon />
      </button>



      <div className={styles.meta}>
        <div>
          <Link href={`/products/${product.slug}`}>
            <h3 className={styles.name}>{product.name}</h3>
          </Link>
          <p className={styles.collection}>{product.collectionName}</p>
          <p className={stock.isSoldOut ? styles.stockOut : styles.stock}>
            {stock.isSoldOut ? 'Out of stock' : `${stock.totalKnownStock} available`}
          </p>
        </div>
        <div className={styles.priceWrap}>
          <span className={product.compareAtPrice ? styles.salePrice : styles.price}>
            {formatCurrency(product.price)}
          </span>
          {product.compareAtPrice ? (
            <span className={styles.comparePrice}>{formatCurrency(product.compareAtPrice)}</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
