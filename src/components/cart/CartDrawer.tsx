'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { MinusIcon, PlusIcon, TrashIcon, XIcon } from '@/components/ui/Icons';
import { LinkButton } from '@/components/ui/LinkButton';
import { formatCurrency } from '@/lib/format';
import { getCartTotals, useCartStore } from '@/store/cart.store';
import { loadPaystackScript } from '@/lib/paystack';
import styles from './CartDrawer.module.css';

export function CartDrawer() {
  const items = useCartStore((state) => state.items);
  const isOpen = useCartStore((state) => state.isOpen);
  const closeCart = useCartStore((state) => state.closeCart);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQty = useCartStore((state) => state.updateQty);
  const clearCart = useCartStore((state) => state.clearCart);

  const { totalItems, subtotal } = getCartTotals(items);

  // Checkout States
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkoutSuccess, setCheckoutSuccess] = useState<any[] | null>(null);

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    city: 'Greater Accra'
  });

  // Reset checkout states on close or open
  useEffect(() => {
    if (!isOpen) {
      setShowCheckout(false);
      setCheckoutSuccess(null);
      setError('');
    }
  }, [isOpen]);

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

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.phone || !formData.email || !formData.address) {
      setError('Please fill in all required shipping fields.');
      return;
    }

    setCheckoutLoading(true);
    setError('');

    const paystackKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;

    if (!paystackKey || paystackKey === 'your_paystack_public_key_here') {
      setError('Live checkout is currently disabled. Please configure your public key.');
      setCheckoutLoading(false);
      return;
    }

    try {
      const paystack = await loadPaystackScript();
      if (!paystack) {
        throw new Error('Paystack secure payment library failed to load. Please check your internet connection or disable ad-blockers.');
      }

      const handler = paystack.setup({
        key: paystackKey,
        email: formData.email,
        amount: subtotal * 100, // minor units
        currency: 'GHS',
        ref: 'RDX-CART-' + Math.floor(Math.random() * 1000000000 + 1),
        callback: async (response: any) => {
          await saveCartOrders(response.reference);
        },
        onClose: () => {
          setCheckoutLoading(false);
          setError('Paystack transaction was cancelled by the user.');
        }
      });

      handler.openIframe();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Paystack initialization failed. Please try again.');
      setCheckoutLoading(false);
    }
  };

  const saveCartOrders = async (paymentRef: string) => {
    try {
      const createdOrders: any[] = [];

      // Save each item as a distinct traceable order in database
      for (const item of items) {
        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: item.productId,
            productName: item.name,
            productSlug: item.productSlug,
            selectedColor: item.color,
            selectedSize: item.size,
            price: item.price * item.quantity,
            customerName: formData.fullName,
            customerPhone: formData.phone,
            customerEmail: formData.email,
            shippingAddress: formData.address,
            shippingCity: formData.city,
            paymentMethod: 'PAYSTACK',
            momoNumber: paymentRef
          })
        });

        const data = await response.json();
        if (response.ok) {
          createdOrders.push(data.order);
        } else {
          throw new Error(data.error || 'Failed to place order record.');
        }
      }

      setCheckoutSuccess(createdOrders);
      clearCart();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Payment processed but failed to record order details. Please contact support.');
    } finally {
      setCheckoutLoading(false);
    }
  };

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
          <h2 className={styles.title}>
            {checkoutSuccess ? 'Manifest Verified' : showCheckout ? 'Secure Checkout' : `Bag / ${totalItems}`}
          </h2>
          <button aria-label="Close cart" className={styles.closeButton} onClick={closeCart} type="button">
            <XIcon />
          </button>
        </div>

        {/* 1. SUCCESS STATE */}
        {checkoutSuccess ? (
          <div style={{ padding: '24px', textAlign: 'center', height: '80%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', fontFamily: 'monospace' }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '16px' }}>🛡️</span>
            <h3 style={{ color: '#fff', fontSize: '1rem', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
              TRANSACTION VERIFIED
            </h3>
            <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '24px', lineHeight: 1.5 }}>
              Your payment has been successfully captured and your order has been written to the Neon Postgres database.
            </p>

            <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px', width: '100%', marginBottom: '32px', textAlign: 'left' }}>
              <span style={{ color: '#666', fontSize: '0.7rem', display: 'block', marginBottom: '8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Your Tracking References:
              </span>
              {checkoutSuccess.map((order) => (
                <div key={order.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <span style={{ color: '#fff' }}>{order.productName} ({order.selectedSize})</span>
                  <strong style={{ color: '#10b981' }}>#RD-{order.id}</strong>
                </div>
              ))}
            </div>

            <Button onClick={closeCart} fullWidth>
              Return to Catalog
            </Button>
          </div>
        ) : showCheckout ? (
          /* 2. CHECKOUT STATE */
          <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 76px)', overflow: 'hidden' }}>
            <form onSubmit={handleCheckoutSubmit} style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'grid', gap: '16px', contentVisibility: 'auto' }}>
              {error && (
                <div style={{ color: '#ef4444', fontSize: '0.75rem', padding: '10px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '4px', fontFamily: 'monospace' }}>
                  ✕ {error}
                </div>
              )}

              <div style={{ display: 'grid', gap: '4px', fontFamily: 'monospace' }}>
                <label style={{ color: '#888', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>FULL NAME *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Musli Sabur"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  style={{ width: '100%', height: '40px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '4px', color: '#fff', padding: '0 12px', fontSize: '0.8rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gap: '4px', fontFamily: 'monospace' }}>
                <label style={{ color: '#888', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PHONE NUMBER *</label>
                <input
                  required
                  type="tel"
                  placeholder="e.g. +233 24 XXX XXXX"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  style={{ width: '100%', height: '40px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '4px', color: '#fff', padding: '0 12px', fontSize: '0.8rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gap: '4px', fontFamily: 'monospace' }}>
                <label style={{ color: '#888', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>EMAIL ADDRESS *</label>
                <input
                  required
                  type="email"
                  placeholder="e.g. info@redox.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{ width: '100%', height: '40px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '4px', color: '#fff', padding: '0 12px', fontSize: '0.8rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gap: '4px', fontFamily: 'monospace' }}>
                <label style={{ color: '#888', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>DELIVERY ADDRESS *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. House No. 44, Spintex Road"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  style={{ width: '100%', height: '40px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '4px', color: '#fff', padding: '0 12px', fontSize: '0.8rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gap: '4px', fontFamily: 'monospace' }}>
                <label style={{ color: '#888', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CITY / REGION *</label>
                <select
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  style={{ width: '100%', height: '40px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '4px', color: '#fff', padding: '0 12px', fontSize: '0.8rem', outline: 'none' }}
                >
                  <option value="Greater Accra">Greater Accra Region</option>
                  <option value="Ashanti">Ashanti Region</option>
                  <option value="Western">Western Region</option>
                  <option value="Eastern">Eastern Region</option>
                  <option value="Central">Central Region</option>
                  <option value="Volta">Volta Region</option>
                  <option value="Northern">Northern Region</option>
                  <option value="Upper East">Upper East Region</option>
                  <option value="Upper West">Upper West Region</option>
                  <option value="Savannah">Savannah Region</option>
                  <option value="North East">North East Region</option>
                  <option value="Bono">Bono Region</option>
                  <option value="Bono East">Bono East Region</option>
                  <option value="Ahafo">Ahafo Region</option>
                  <option value="Western North">Western North Region</option>
                  <option value="Oti">Oti Region</option>
                </select>
              </div>

              {/* Order total info */}
              <div style={{ marginTop: '16px', borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontFamily: 'monospace' }}>
                <span style={{ fontSize: '0.8rem', color: '#888' }}>TOTAL SECURED AMOUNT:</span>
                <strong style={{ fontSize: '1.2rem', color: 'var(--color-red)' }}>GH₵{subtotal}</strong>
              </div>
            </form>

            <div className={styles.footer} style={{ background: '#080808', borderTop: '1px solid var(--color-border)', padding: '20px' }}>
              <Button type="button" fullWidth onClick={handleCheckoutSubmit} disabled={checkoutLoading}>
                {checkoutLoading ? 'Verifying Gateway...' : `Pay GH₵${subtotal} via Paystack`}
              </Button>
              <button
                type="button"
                onClick={() => setShowCheckout(false)}
                style={{ width: '100%', height: '40px', background: 'transparent', border: 'none', color: '#666', fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', marginTop: '8px', fontFamily: 'monospace' }}
              >
                Back to Bag
              </button>
            </div>
          </div>
        ) : (
          /* 3. NORMAL CART ITEMS STATE */
          <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 76px)', overflow: 'hidden' }}>
            <div className={styles.items}>
              {items.length === 0 ? (
                <div className={styles.empty}>
                  <div>
                    <h3>No pieces selected</h3>
                    <p>Build the uniform. Limited runs move quickly and do not restock.</p>
                    <div onClick={closeCart}>
                      <LinkButton href="/shop">View shop</LinkButton>
                    </div>
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

            {items.length > 0 && (
              <div className={styles.footer}>
                <p className={styles.subtotal}>
                  <span>Subtotal</span>
                  <strong>{formatCurrency(subtotal)}</strong>
                </p>
                <Button disabled={items.length === 0} fullWidth onClick={() => setShowCheckout(true)}>
                  Proceed to Checkout
                </Button>
                <p className={styles.checkoutNote} style={{ letterSpacing: '0.04em', fontSize: '0.68rem' }}>
                  Secure payment gateway processed by Paystack.
                </p>
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
