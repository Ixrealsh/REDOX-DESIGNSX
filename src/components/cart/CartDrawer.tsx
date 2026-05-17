'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { MinusIcon, PlusIcon, TrashIcon, XIcon } from '@/components/ui/Icons';
import { LinkButton } from '@/components/ui/LinkButton';
import { formatCurrency } from '@/lib/format';
import { getCartTotals, useCartStore } from '@/store/cart.store';
import styles from './CartDrawer.module.css';

export function CartDrawer() {
  const items = useCartStore((state) => state.items);
  const isOpen = useCartStore((state) => state.isOpen);
  const closeCart = useCartStore((state) => state.closeCart);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQty = useCartStore((state) => state.updateQty);
  const { totalItems, subtotal, freeShippingProgress, remainingForFreeShipping } = getCartTotals(items);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeCart();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeCart, isOpen]);

  return (
    <>
      <button
        aria-hidden={!isOpen}
        className={`${styles.overlay} ${isOpen ? styles.overlayOpen : ''}`}
        onClick={closeCart}
        tabIndex={isOpen ? 0 : -1}
        type="button"
      />
      <aside
        aria-label="Shopping cart"
        aria-modal="true"
        className={`${styles.drawer} ${isOpen ? styles.drawerOpen : ''}`}
        role="dialog"
      >
        <div className={styles.header}>
          <h2 className={styles.title}>Bag / {totalItems}</h2>
          <button aria-label="Close cart" className={styles.closeButton} onClick={closeCart} type="button">
            <XIcon />
          </button>
        </div>

        <div className={styles.items}>
          {items.length === 0 ? (
            <div className={styles.empty}>
              <div>
                <h3>No pieces selected</h3>
                <p>Build the uniform. Limited runs move quickly and do not restock.</p>
                <LinkButton href="/shop">View shop</LinkButton>
              </div>
            </div>
          ) : (
            items.map((item) => (
              <article className={styles.item} key={item.variantId}>
                <Link className={styles.imageWrap} href={`/products/${item.productSlug}`} onClick={closeCart}>
                  <Image alt={item.name} className={styles.image} fill sizes="88px" src={item.image} />
                </Link>
                <div>
                  <div className={styles.itemTop}>
                    <div>
                      <Link href={`/products/${item.productSlug}`} onClick={closeCart}>
                        <h3 className={styles.itemName}>{item.name}</h3>
                      </Link>
                      <p className={styles.meta}>
                        {item.color} / {item.size}
                      </p>
                      <p className={styles.sku}>{item.sku}</p>
                    </div>
                    <button
                      aria-label={`Remove ${item.name}`}
                      className={styles.removeButton}
                      onClick={() => removeItem(item.variantId)}
                      type="button"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                  <p className={styles.price}>{formatCurrency(item.price)}</p>
                  <div aria-label={`Quantity for ${item.name}`} className={styles.quantity}>
                    <button
                      aria-label="Decrease quantity"
                      className={styles.qtyButton}
                      onClick={() => updateQty(item.variantId, item.quantity - 1)}
                      type="button"
                    >
                      <MinusIcon />
                    </button>
                    <span className={styles.qtyValue}>{item.quantity}</span>
                    <button
                      aria-label="Increase quantity"
                      className={styles.qtyButton}
                      onClick={() => updateQty(item.variantId, item.quantity + 1)}
                      type="button"
                    >
                      <PlusIcon />
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        <div className={styles.footer}>
          <p className={styles.progressText}>
            {remainingForFreeShipping > 0 ? (
              <>
                <span>Add {formatCurrency(remainingForFreeShipping)} more</span>
                <span>Free shipping</span>
              </>
            ) : (
              <>
                <span>Free shipping unlocked</span>
                <span>Ready</span>
              </>
            )}
          </p>
          <div aria-hidden="true" className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${freeShippingProgress}%` }} />
          </div>
          <p className={styles.subtotal}>
            <span>Subtotal</span>
            <strong>{formatCurrency(subtotal)}</strong>
          </p>
          <Button disabled={items.length === 0} fullWidth>
            Checkout
          </Button>
          <p className={styles.checkoutNote}>Shopify checkout wiring ready for Storefront API keys.</p>
        </div>
      </aside>
    </>
  );
}
