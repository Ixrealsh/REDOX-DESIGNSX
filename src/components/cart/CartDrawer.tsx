'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { MinusIcon, PlusIcon, TrashIcon, XIcon } from '@/components/ui/Icons';
import { LinkButton } from '@/components/ui/LinkButton';
import { formatCurrency } from '@/lib/format';
import { getCartTotals, useCartStore } from '@/store/cart.store';
import {
  claimPendingCheckoutRecovery,
  confirmPayment,
  forgetPendingCheckout,
  reportCheckoutClosed,
  runPaystackCheckout,
  startCheckout,
  type CheckoutSession
} from '@/lib/checkout-client';
import type { CustomerReceipt } from '@/lib/order-receipt';
import styles from './CartDrawer.module.css';

export function CartDrawer() {
  const items = useCartStore((state) => state.items);
  const isOpen = useCartStore((state) => state.isOpen);
  const openCart = useCartStore((state) => state.openCart);
  const closeCart = useCartStore((state) => state.closeCart);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQty = useCartStore((state) => state.updateQty);
  const clearCart = useCartStore((state) => state.clearCart);

  const { totalItems, subtotal, serviceCharge, orderTotal } = getCartTotals(items);

  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutStage, setCheckoutStage] = useState('');
  const [error, setError] = useState('');
  const [checkoutSuccess, setCheckoutSuccess] = useState<CustomerReceipt | null>(null);
  /**
   * Set when the payment went through but this browser could not get the
   * confirmation back. The order is already recorded server-side, so this is
   * reassurance — not an error.
   */
  const [pendingNotice, setPendingNotice] = useState<{ orderNumber: string; reference: string } | null>(null);

  // Receipt totals come straight off the confirmed order — the cart is cleared before it renders.
  const receiptTotal = Number(checkoutSuccess?.price) || 0;
  const receiptSubtotal = Number(checkoutSuccess?.subtotal) || 0;
  const receiptServiceCharge = Number(checkoutSuccess?.serviceCharge) || 0;

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    city: 'Greater Accra'
  });

  // Reset transient states when the drawer closes. A pending notice is kept:
  // the customer needs to see it again next time they open the bag.
  useEffect(() => {
    if (!isOpen) {
      setShowCheckout(false);
      setCheckoutSuccess(null);
      setError('');
    }
  }, [isOpen]);

  /**
   * Picks up a checkout that this browser walked away from — a reload during
   * payment, a crashed tab, a phone that lost signal on the callback. The
   * reference was written to storage before Paystack opened, so the receipt can
   * still be recovered here rather than leaving the customer in the dark.
   */
  useEffect(() => {
    // One recovery per page load, shared with the product page's Buy Now flow.
    const pending = claimPendingCheckoutRecovery();
    if (!pending) return;

    let cancelled = false;

    (async () => {
      // A single ask on page load: the customer is not waiting on this screen,
      // and the "Check payment status" button covers a deliberate retry.
      const result = await confirmPayment(pending.reference, undefined, 1);
      if (cancelled) return;

      if (result.paid && result.order) {
        forgetPendingCheckout();
        setCheckoutSuccess(result.order);
        setPendingNotice(null);
        clearCart();
        // Their payment landed while they were away — show the receipt rather
        // than leaving it hidden behind a closed drawer.
        openCart();
      } else if (result.settled) {
        // Explicitly cancelled or declined — nothing to recover.
        forgetPendingCheckout();
      } else {
        setPendingNotice({ orderNumber: pending.orderNumber, reference: pending.reference });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clearCart, openCart]);

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

  /**
   * Confirms a completed payment, then shows the receipt.
   *
   * If confirmation cannot get through, this deliberately does not show an
   * error: the order was written to the server before Paystack ever opened, and
   * the gateway's webhook settles it independently of this browser. The
   * customer is told their order is safe, because it is.
   */
  const finishPayment = async (session: CheckoutSession, reference: string) => {
    setCheckoutStage('Confirming your payment…');

    const result = await confirmPayment(reference, (attempt) => {
      if (attempt > 2) setCheckoutStage(`Still confirming with Paystack… (${attempt})`);
    });

    setCheckoutLoading(false);
    setCheckoutStage('');

    if (result.paid && result.order) {
      forgetPendingCheckout();
      setPendingNotice(null);
      setError('');
      setCheckoutSuccess(result.order);
      clearCart();
      return;
    }

    if (result.outcome === 'failed' || result.outcome === 'abandoned') {
      forgetPendingCheckout();
      setError(result.message || 'That payment did not go through. You can try again — nothing was charged.');
      return;
    }

    // Paid (or very likely paid) but unconfirmed here. The order is recorded.
    setPendingNotice({ orderNumber: session.orderNumber, reference });
    setError('');
    clearCart();
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.phone || !formData.email || !formData.address) {
      setError('Please fill in all required fields before continuing.');
      return;
    }

    if (items.length === 0) {
      setError('Your bag is empty.');
      return;
    }

    setCheckoutLoading(true);
    setError('');
    setCheckoutStage('Reserving your items…');

    let session: CheckoutSession;

    try {
      // The order is recorded here — before any money moves. Everything after
      // this point can fail without losing the sale.
      session = await startCheckout(formData, items.map((item) => ({
        productId: item.productId,
        productSlug: item.productSlug,
        variantId: item.variantId,
        color: item.color,
        size: item.size,
        quantity: item.quantity
      })));
    } catch (err: any) {
      setError(err.message || 'We could not start your checkout. Please try again.');
      setCheckoutLoading(false);
      setCheckoutStage('');
      return;
    }

    setCheckoutStage('Opening secure payment…');

    await runPaystackCheckout(session, formData, {
      onPaid: (reference) => {
        void finishPayment(session, reference);
      },
      onCancelled: (reference) => {
        reportCheckoutClosed(reference);
        forgetPendingCheckout();
        setCheckoutLoading(false);
        setCheckoutStage('');
        setError('Payment was cancelled. Your bag is untouched — you can try again anytime.');
      },
      onError: (message) => {
        forgetPendingCheckout();
        setCheckoutLoading(false);
        setCheckoutStage('');
        setError(message);
      },
      onRedirect: () => {
        setCheckoutStage('Taking you to Paystack…');
      }
    });
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
              : pendingNotice
              ? 'Order Received'
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
                    Thank you, <strong>{checkoutSuccess.customerName}</strong>. Your reference is{' '}
                    <span className={styles.receiptRef}>#RD-{checkoutSuccess.id}</span>.
                    You&apos;ll receive an SMS confirmation shortly.
                  </p>
                </div>

                {/* Items */}
                <div className={styles.receiptCard}>
                  <p className={styles.receiptCardTitle}>Items Ordered</p>
                  {checkoutSuccess.items.map((item) => (
                    <div className={styles.receiptItem} key={`${item.productSlug}-${item.color}-${item.size}`}>
                      <div>
                        <p className={styles.receiptItemName}>{item.productName}</p>
                        <p className={styles.receiptItemSize}>
                          {item.color} / {item.size} &times; {item.quantity}
                        </p>
                      </div>
                      <span className={styles.receiptItemPrice}>
                        {formatCurrency(item.lineTotal)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Totals derived from confirmed orders, not the (now-cleared) cart */}
                <div className={styles.receiptTotals}>
                  <div className={styles.receiptTotalRow}>
                    <span className={styles.receiptTotalLabel}>Subtotal</span>
                    <span className={styles.receiptTotalValue}>{formatCurrency(receiptSubtotal)}</span>
                  </div>
                  <div className={styles.receiptTotalRow}>
                    <span className={styles.receiptTotalLabel}>Service fee (2%)</span>
                    <span className={styles.receiptTotalValue}>{formatCurrency(receiptServiceCharge)}</span>
                  </div>
                  <hr className={styles.receiptGrandDivider} />
                  <div className={styles.receiptGrandTotal}>
                    <span className={styles.receiptGrandLabel}>Total Paid</span>
                    <span className={styles.receiptGrandValue}>{formatCurrency(receiptTotal)}</span>
                  </div>
                </div>

                {/* Shipping + payment info */}
                <div className={styles.receiptMeta}>
                  <div className={styles.receiptMetaRow}>
                    <span className={styles.receiptMetaKey}>Ship to</span>
                    <span className={styles.receiptMetaVal}>
                      {checkoutSuccess.shippingAddress}, {checkoutSuccess.shippingCity}
                    </span>
                  </div>
                  <div className={styles.receiptMetaRow}>
                    <span className={styles.receiptMetaKey}>Payment</span>
                    <span className={styles.receiptMetaVal}>
                      {checkoutSuccess.paymentStatus === 'paid'
                        ? `Paid · Paystack${checkoutSuccess.paymentChannel ? ` (${checkoutSuccess.paymentChannel.replace(/_/g, ' ')})` : ''}`
                        : 'Awaiting confirmation'}
                    </span>
                  </div>
                  {checkoutSuccess.reference && (
                    <div className={styles.receiptMetaRow}>
                      <span className={styles.receiptMetaKey}>Payment ref</span>
                      <span className={styles.receiptMetaVal}>{checkoutSuccess.reference}</span>
                    </div>
                  )}
                  <div className={styles.receiptMetaRow}>
                    <span className={styles.receiptMetaKey}>Contact</span>
                    <span className={styles.receiptMetaVal}>{checkoutSuccess.customerPhone}</span>
                  </div>
                </div>

                <p className={styles.receiptContact}>
                  Our team will reach out via{' '}
                  <strong style={{ color: 'var(--color-text-secondary)' }}>
                    {checkoutSuccess.customerPhone}
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
        ) : pendingNotice ? (
          /* ══════════════════════════════════════════
              1b. PAYMENT MADE, CONFIRMATION NOT RECEIVED HERE

              The order was written to the server before Paystack opened, and
              the gateway confirms it to us directly. This screen exists so a
              dropped connection reads as "we've got it" instead of "something
              went wrong".
          ══════════════════════════════════════════ */
          <>
            <div className={styles.receipt}>
              <div className={styles.receiptInner}>
                <div className={styles.receiptCheck}>
                  <div className={styles.receiptCheckIcon}>
                    <svg fill="none" height="36" stroke="#f59e0b" strokeWidth="2.5" viewBox="0 0 24 24" width="36">
                      <circle cx="12" cy="12" r="9" />
                      <polyline points="12 7 12 12 15 14" />
                    </svg>
                  </div>
                  <h2 className={styles.receiptHeading}>Your order is saved</h2>
                  <p className={styles.receiptSubtext}>
                    Order <span className={styles.receiptRef}>#{pendingNotice.orderNumber}</span> is
                    recorded and we&apos;re finalising the payment confirmation with Paystack.
                    You&apos;ll get an SMS the moment it clears — there&apos;s nothing more to do,
                    and you will not be charged twice.
                  </p>
                </div>

                <div className={styles.receiptMeta}>
                  <div className={styles.receiptMetaRow}>
                    <span className={styles.receiptMetaKey}>Order</span>
                    <span className={styles.receiptMetaVal}>#{pendingNotice.orderNumber}</span>
                  </div>
                  <div className={styles.receiptMetaRow}>
                    <span className={styles.receiptMetaKey}>Payment ref</span>
                    <span className={styles.receiptMetaVal}>{pendingNotice.reference}</span>
                  </div>
                </div>

                <p className={styles.receiptContact}>
                  Keep this reference. You can check the live status any time on the{' '}
                  <Link href={`/track-order?ref=${pendingNotice.orderNumber}`} onClick={closeCart}>
                    <strong style={{ color: 'var(--color-text-secondary)' }}>track order</strong>
                  </Link>{' '}
                  page, or quote it to our team.
                </p>
              </div>
            </div>

            <div className={styles.receiptFooter}>
              <Button
                fullWidth
                onClick={async () => {
                  setCheckoutStage('Checking…');
                  const result = await confirmPayment(pendingNotice.reference);
                  setCheckoutStage('');
                  if (result.paid && result.order) {
                    forgetPendingCheckout();
                    setPendingNotice(null);
                    setCheckoutSuccess(result.order);
                  } else if (result.settled) {
                    forgetPendingCheckout();
                    setPendingNotice(null);
                    setError(result.message);
                  }
                }}
                type="button"
              >
                {checkoutStage || 'Check payment status'}
              </Button>
              <button
                className={styles.backButton}
                onClick={() => {
                  forgetPendingCheckout();
                  setPendingNotice(null);
                  closeCart();
                }}
                type="button"
              >
                Continue shopping
              </button>
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
                  ? checkoutStage || 'Connecting to gateway…'
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
