'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/Badge';
import { HeartIcon } from '@/components/ui/Icons';
import { formatCurrency } from '@/lib/format';
import { getProductStockSummary } from '@/lib/inventory';
import { getWholesaleRule } from '@/lib/wholesale';
import { useWishlistStore } from '@/store/wishlist.store';
import type { Product } from '@/types/product';
import styles from './ProductCard.module.css';

interface ProductCardProps {
  product: Product;
  priority?: boolean;
}

function displayProductName(name: string) {
  const tidy = name.trim().replace(/\s+/g, ' ');
  if (tidy !== tidy.toUpperCase()) return tidy;
  return tidy.toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    .replace(/(\d+)\s*gsm\b/gi, '$1 GSM')
    .replace(/\bRedox(?:designsx)?\b/gi, (brand) => brand.toUpperCase());
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const name = displayProductName(product.name);
  const toggleWishlist = useWishlistStore((state) => state.toggleItem);
  const isWishlisted = useWishlistStore((state) => state.isWishlisted(product.id));
  const stock = useMemo(() => getProductStockSummary(product), [product]);
  const bulkRule = useMemo(() => getWholesaleRule(product), [product]);
  const badgeLabel: Product['badge'] = stock.isSoldOut ? 'SOLD OUT' : product.badge;
  const defaultPhotos = product.colorImages?.[product.colors?.[0] || ''] || [];
  const primaryImage = defaultPhotos[0] || product.image;
  const secondaryImage = defaultPhotos[1] || product.secondaryImage;
  const hasAlternateImage = Boolean(secondaryImage && secondaryImage !== primaryImage);

  return (
    <article className={styles.card}>
      <Link className={`${styles.media} ${hasAlternateImage ? styles.hasAlternate : ''}`} href={`/products/${product.slug}`}>
        <Image
          alt={product.imageAlt || name}
          className={`${styles.image} ${styles.imagePrimary}`}
          fill
          key={primaryImage}
          priority={priority}
          sizes="(min-width: 1440px) 25vw, (min-width: 1024px) 33vw, (min-width: 600px) 50vw, 100vw"
          src={primaryImage}
        />
        {hasAlternateImage && (
          <Image
            alt=""
            aria-hidden="true"
            className={`${styles.image} ${styles.imageSecondary}`}
            fill
            sizes="(min-width: 1440px) 25vw, (min-width: 1024px) 33vw, (min-width: 600px) 50vw, 100vw"
            src={secondaryImage!}
          />
        )}
        <span className={styles.mediaAction}>View details <span aria-hidden="true">↗</span></span>
      </Link>

      {badgeLabel ? (
        <span className={styles.badge}>
          <Badge label={badgeLabel} />
        </span>
      ) : null}

      <button
        aria-label={isWishlisted ? `Remove ${name} from wishlist` : `Save ${name} to wishlist`}
        aria-pressed={isWishlisted}
        className={`${styles.wishlist} ${isWishlisted ? styles.wishlistActive : ''}`}
        onClick={() => toggleWishlist(product)}
        type="button"
      >
        <HeartIcon />
      </button>
      <div className={styles.meta}>
        <div className={styles.details}>
          {product.collectionName && <p className={styles.collection}>{product.collectionName}</p>}
          <Link href={`/products/${product.slug}`}>
            <h3 className={styles.name}>{name}</h3>
          </Link>
          {/* One short line — enough to make a browsing customer open the page. */}
          {bulkRule && !stock.isSoldOut && (
            <p className={styles.bulkHint}>
              {bulkRule.minQuantity}+ for {formatCurrency(bulkRule.unitPrice)} each
            </p>
          )}
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
