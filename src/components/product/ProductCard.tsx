'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { HeartIcon } from '@/components/ui/Icons';
import { formatCurrency } from '@/lib/format';
import { useCartStore } from '@/store/cart.store';
import { useWishlistStore } from '@/store/wishlist.store';
import type { Product } from '@/types/product';
import styles from './ProductCard.module.css';

interface ProductCardProps {
  product: Product;
  priority?: boolean;
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const [sizesOpen, setSizesOpen] = useState(false);
  const addItem = useCartStore((state) => state.addItem);
  const toggleWishlist = useWishlistStore((state) => state.toggleItem);
  const isWishlisted = useWishlistStore((state) => state.isWishlisted(product.id));
  const uniqueSizes = useMemo(
    () => Array.from(new Set(product.variants.map((variant) => variant.size))),
    [product.variants]
  );

  const handleQuickAdd = (size: string) => {
    const variant = product.variants.find((item) => item.size === size && item.inventory > 0);

    if (variant) {
      addItem(product, variant, 1);
      setSizesOpen(false);
    }
  };

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

      {product.badge ? (
        <span className={styles.badge}>
          <Badge label={product.badge} />
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

      <div className={styles.quickAdd}>
        <button className={styles.quickButton} onClick={() => setSizesOpen((open) => !open)} type="button">
          Quick add
        </button>
        {sizesOpen ? (
          <div aria-label={`Select size for ${product.name}`} className={styles.sizes} role="group">
            {uniqueSizes.map((size) => {
              const variant = product.variants.find((item) => item.size === size);
              const disabled = !variant || variant.inventory <= 0 || product.badge === 'COMING SOON';

              return (
                <button
                  className={styles.sizeButton}
                  disabled={disabled}
                  key={size}
                  onClick={() => handleQuickAdd(size)}
                  type="button"
                >
                  {size}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className={styles.meta}>
        <div>
          <Link href={`/products/${product.slug}`}>
            <h3 className={styles.name}>{product.name}</h3>
          </Link>
          <p className={styles.collection}>{product.collectionName}</p>
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
