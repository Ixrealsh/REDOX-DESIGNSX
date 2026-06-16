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

  const { totalItems, subtotal, serviceCharge, orderTotal } = getCartTotals(items);

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

  // Reset states when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setShowCheckout(false);
      setCheckoutSuccess(null);
      setError('');
    }
  }, [isOpen]);

  // Lock scroll + Esc key
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeCart(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, closeCart]);

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.phone || !formData.email || !formData.address) {
      setError('Please fill in all required fields before continuing.');
      return;
    }

    setCheckoutLoading(true);
    setError('');

    const paystackKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
    if (!paystackKey || paystackKey === 'your_paystack_public_key_here') {
      setError('Checkout is currently unavailable. Missing payment configuration.');
      setCheckoutLoading(false);
      return;
    }

    try {
      const paystack = await loadPaystackScript();
      if (!paystack) {
        throw new Error('Could not load secure payment gateway. Check your connection or disable ad-blockers.');
      }

      const handler = paystack.setup({
        key: paystackKey,
        email: formData.email,
        amount: Math.round(orderTotal * 100), // pesewas — includes 2% service charge
        currency: 'GHS',
        reference: 'RDX-CART-' + Math.floor(Math.random() * 1_000_000_000 + 1),
        callback: (response: any) => {
          saveCartOrders(response.reference).catch((err) => {
            console.error('Post-payment order save failed:', err);
          });
        },
        onClose: () => {
          setCheckoutLoading(false);
          setError('Payment was cancelled. You can try again anytime.');
        }
      });

      handler.openIframe();
    } catch (err: any) {
      setError(err.message || 'Payment initialization failed. Please try again.');
      setCheckoutLoading(false);
    }
  };

  const saveCartOrders = async (paymentRef: string) => {
    try {
      const created: any[] = [];

      for (const item of items) {
        const res = await fetch('/api/orders', {
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
            momoNumber: paymentRef,
            items: [{
              productId: item.productId,
              productSlug: item.productSlug,
              variantId: item.variantId,
              color: item.color,
              size: item.size,
              quantity: item.quantity
            }],
            skipSms: true
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to record order.');
        created.push(data.order);
      }

      // Single consolidated SMS after all orders are saved
      if (created.length > 0) {
        fetch('/api/orders/sms-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderIds: created.map((o) => o.id) })
        }).catch((err) => console.error('SMS summary failed:', err));
      }

      setCheckoutSuccess(created);
      clearCart();
    } catch (err: any) {
      setError(err.message || 'Payment succeeded but order recording failed. Contact support with your payment reference.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const field = (
    key: keyof typeof formData,
    label: string,
    type: string,
    placeholder: string
  ) => (
    <div className={styles.fieldGroup}>
      <label className={styles.fieldLabel}>{label}</label>
      <input
        className={styles.fieldInput}
        onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
        placeholder={placeholder}
        required
        type={type}
        value={formData[key]}
      />
    </div>
  );

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
        {/* ── Header ─────────────────────────────────── */}
        <div className={styles.header}>
          <h2 className={styles.title}>
            {checkoutSuccess
              ? 'Order Confirmed'
              : showCheckout
              ? 'Checkout'
              : `Bag · ${totalItems}`}
          </h2>
          <button aria-label="Close" className={styles.closeButton} onClick={closeCart} type="button">
            <XIcon />
          </button>
        </div>

        {/* ══════════════════════════════════════════
            1. SUCCESS — RECEIPT
        ══════════════════════════════════════════ */}
        {checkoutSuccess ? (
          <>
            <div className={styles.receipt}>
              <div className={styles.receiptInner}>
                {/* Check + heading */}
                <div className={styles.receiptCheck}>
                  <div className={styles.receiptCheckIcon}>
                    <svg fill="none" height="36" stroke="#10b981" strokeWidth="2.5" viewBox="0 0 24 24" width="36">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h2 className={styles.receiptHeading}>Order Placed!</h2>
                  <p className={styles.receiptSubtext}>
                    Thank you, <strong>{checkoutSuccess[0]?.customerName}</strong>. Your reference is{' '}
                    <span className={styles.receiptRef}>#{checkoutSuccess[0]?.id ? `RD-${checkoutSuccess[0].id}` : '—'}</span>.
                    You'll receive an SMS confirmation shortly.
                  </p>
                </div>

                {/* Items */}
                <div className={styles.receiptCard}>
                  <p className={styles.receiptCardTitle}>Items Ordered</p>
                  {checkoutSuccess.map((order) => (
                    <div className={styles.receiptItem} key={order.id}>
                      <div>
                        <p className={styles.receiptItemName}>{order.productName}</p>
                        <p className={styles.receiptItemSize}>{order.selectedSize}</p>
                      </div>
                      <span className={styles.receiptItemPrice}>
                        {formatCurrency(order.price)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className={styles.receiptTotals}>
                  <div className={styles.receiptTotalRow}>
                    <span className={styles.receiptTotalLabel}>Subtotal</span>
                    <span className={styles.receiptTotalValue}>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className={styles.receiptTotalRow}>
                    <span className={styles.receiptTotalLabel}>Service fee (2%)</span>
                    <span className={styles.receiptTotalValue}>{formatCurrency(serviceCharge)}</span>
                  </div>
                  <hr className={styles.receiptGrandDivider} />
                  <div className={styles.receiptGrandTotal}>
                    <span className={styles.receiptGrandLabel}>Total Paid</span>
                    <span className={styles.receiptGrandValue}>{formatCurrency(orderTotal)}</span>
                  </div>
                </div>

                {/* Shipping + payment info */}
                <div className={styles.receiptMeta}>
                  <div className={styles.receiptMetaRow}>
                    <span className={styles.receiptMetaKey}>Ship to</span>
                    <span className={styles.receiptMetaVal}>
                      {checkoutSuccess[0]?.shippingAddress}, {checkoutSuccess[0]?.shippingCity}
                    </span>
                  </div>
                  <div className={styles.receiptMetaRow}>
                    <span className={styles.receiptMetaKey}>Payment</span>
                    <span className={styles.receiptMetaVal}>Paystack — Verified</span>
                  </div>
                  <div className={styles.receiptMetaRow}>
                    <span className={styles.receiptMetaKey}>Contact</span>
                    <span className={styles.receiptMetaVal}>{checkoutSuccess[0]?.customerPhone}</span>
                  </div>
                </div>

                <p className={styles.receiptContact}>
                  Our team will reach out via{' '}
                  <strong style={{ color: 'var(--color-text-secondary)' }}>
                    {checkoutSuccess[0]?.customerPhone}
                  </strong>{' '}
                  to confirm dispatch and delivery details.
                </p>
              </div>
            </div>

            <div className={styles.receiptFooter}>
              <Button
                fullWidth
                onClick={() => { setCheckoutSuccess(null); closeCart(); }}
                type="button"
              >
                Continue Shopping
              </Button>
            </div>
          </>

        ) : showCheckout ? (
          /* ══════════════════════════════════════════
              2. CHECKOUT FORM
          ══════════════════════════════════════════ */
          <>
            <div className={styles.checkoutScroll}>
              <form id="checkout-form" onSubmit={handleCheckoutSubmit} className={styles.checkoutForm}>
                {error && (
                  <div className={styles.checkoutError}>
                    <span>✕</span>
                    <span>{error}</span>
                  </div>
                )}

                {/* Contact section */}
                <div className={styles.checkoutSection}>
                  <p className={styles.checkoutSectionTitle}>Contact</p>
                  <div className={styles.fieldRow}>
                    {field('fullName', 'Full Name *', 'text', 'e.g. Musli Sabur')}
                    {field('phone', 'Phone *', 'tel', '+233 24 XXX XXXX')}
                  </div>
                  {field('email', 'Email Address *', 'email', 'you@example.com')}
                </div>

                {/* Shipping section */}
                <div className={styles.checkoutSection}>
                  <p className={styles.checkoutSectionTitle}>Shipping</p>
                  {field('address', 'Delivery Address *', 'text', 'House No., Street, Area')}
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>City / Region *</label>
                    <select
                      className={styles.fieldSelect}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      value={formData.city}
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
                </div>

                {/* Order summary */}
                <div className={styles.checkoutSummary}>
                  <div className={styles.checkoutSummaryRow}>
                    <span className={styles.checkoutSummaryLabel}>Subtotal</span>
                    <span className={styles.checkoutSummaryValue}>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className={styles.checkoutSummaryRow}>
                    <span className={styles.checkoutSummaryLabel}>Service fee (2%)</span>
                    <span className={styles.checkoutSummaryValue}>{formatCurrency(serviceCharge)}</span>
                  </div>
                  <hr className={styles.checkoutSummaryDivider} />
                  <div className={styles.checkoutSummaryTotal}>
                    <span className={styles.checkoutSummaryTotalLabel}>Order Total</span>
                    <span className={styles.checkoutSummaryTotalValue}>{formatCurrency(orderTotal)}</span>
                  </div>
                </div>
              </form>
            </div>

            <div className={styles.checkoutFooter}>
              <Button
                disabled={checkoutLoading}
                form="checkout-form"
                fullWidth
                onClick={handleCheckoutSubmit}
                type="button"
              >
                {checkoutLoading
                  ? 'Connecting to gateway...'
                  : `Pay ${formatCurrency(orderTotal)} securely`}
              </Button>
              <button
                className={styles.backButton}
                onClick={() => { setShowCheckout(false); setError(''); }}
                type="button"
              >
                ← Back to bag
              </button>
            </div>
          </>

        ) : (
          /* ══════════════════════════════════════════
              3. CART ITEMS
          ══════════════════════════════════════════ */
          <>
            <div className={styles.items}>
              {items.length === 0 ? (
                <div className={styles.empty}>
                  <div>
                    <h3>No pieces selected</h3>
                    <p>Limited runs move fast and do not restock. Build the uniform.</p>
                    <div onClick={closeCart}>
                      <LinkButton href="/shop">View shop</LinkButton>
                    </div>
                  </div>
                </div>
              ) : (
                items.map((item) => (
                  <article className={styles.item} key={item.variantId}>
                    <Link className={styles.imageWrap} href={`/products/${item.productSlug}`} onClick={closeCart}>
                      <Image
                        alt={item.name}
                        className={styles.image}
                        fill
                        sizes="80px"
                        src={item.image}
                      />
                    </Link>
                    <div>
                      <div className={styles.itemTop}>
                        <div>
                          <Link href={`/products/${item.productSlug}`} onClick={closeCart}>
                            <h3 className={styles.itemName}>{item.name}</h3>
                          </Link>
                          <p className={styles.meta}>{item.color} / {item.size}</p>
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
                      <div className={styles.itemBottom}>
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
                            disabled={Boolean(item.stockLimit && item.quantity >= item.stockLimit)}
                            onClick={() => updateQty(item.variantId, item.quantity + 1)}
                            type="button"
                          >
                            <PlusIcon />
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>

            {items.length > 0 && (
              <div className={styles.footer}>
                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>Subtotal</span>
                  <span className={styles.summaryValue}>{formatCurrency(subtotal)}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>Service fee (2%)</span>
                  <span className={styles.summaryValue}>{formatCurrency(serviceCharge)}</span>
                </div>
                <div className={styles.summaryTotal}>
                  <span className={styles.summaryTotalLabel}>Order Total</span>
                  <span className={styles.summaryTotalValue}>{formatCurrency(orderTotal)}</span>
                </div>
                <Button disabled={items.length === 0} fullWidth onClick={() => setShowCheckout(true)}>
                  Proceed to Checkout
                </Button>
                <p className={styles.checkoutNote}>Secure payment via Paystack</p>
              </div>
            )}
          </>
        )}
      </aside>
    </>
  );
}
