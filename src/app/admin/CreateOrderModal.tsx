'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import type { Order, Product, Variant } from '@/types/product';
import { formatCurrency } from '@/lib/format';
import { getVariantStockLabel, getVariantStockLimit, isVariantInStock } from '@/lib/inventory';
import { resolveDiscount } from '@/lib/order-schema';
import { formatGhanaPhone, isValidGhanaPhone } from '@/lib/phone';
import styles from './Admin.module.css';

/**
 * Records an order taken in person.
 *
 * Built for someone standing with a customer: search, tap a colour, tap a size,
 * type a name and a number, done. Everything else has a sensible default.
 *
 * The totals shown here are for the merchant's eyes only — the server prices
 * every line from the catalogue and works the discount out itself. Both sides
 * share `resolveDiscount` so the figure on screen is the figure that is charged.
 */

const GHANA_REGIONS = [
  'Greater Accra',
  'Ashanti',
  'Western',
  'Eastern',
  'Central',
  'Volta',
  'Northern',
  'Upper East',
  'Upper West',
  'Savannah',
  'North East',
  'Bono',
  'Bono East',
  'Ahafo',
  'Western North',
  'Oti'
];

/** Rendering every product on each keystroke is wasted work on a phone. */
const MAX_RESULTS = 40;

export interface CreatedOrderResult {
  order: Order;
  smsSent: boolean;
  smsReason?: string;
  duplicate: boolean;
}

interface DraftLine {
  key: string;
  productSlug: string;
  productName: string;
  image: string;
  color: string;
  size: string;
  colorHex?: string;
  unitPrice: number;
  quantity: number;
  /** How many the catalogue believes are left. */
  stockLimit: number;
  /** Added past that limit, at the merchant's explicit confirmation. */
  override: boolean;
}

interface CreateOrderModalProps {
  products: Product[];
  onClose: () => void;
  onCreated: (result: CreatedOrderResult) => void;
  onPrint: (order: Order) => void;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * A key that survives a retry. `crypto.randomUUID` needs a secure context, which
 * an admin panel served over plain HTTP on a local network would not have — the
 * fallback keeps idempotency working there too.
 */
function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `man-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function lineKey(slug: string, color: string, size: string): string {
  return `${slug}::${color}::${size}`;
}

/** Colours that actually have variants, so a picked combination always exists. */
function colorsOf(product: Product): string[] {
  return Array.from(new Set(product.variants.map((variant) => variant.color)));
}

export function CreateOrderModal({ products, onClose, onCreated, onPrint }: CreateOrderModalProps) {
  const [clientRequestId, setClientRequestId] = useState(newRequestId);

  const [search, setSearch] = useState('');
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [openColor, setOpenColor] = useState<string | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([]);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingCity, setShippingCity] = useState('');

  const [paidNow, setPaidNow] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'MOMO' | 'BANK'>('CASH');
  const [note, setNote] = useState('');

  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  const [discountValue, setDiscountValue] = useState('');

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<CreatedOrderResult | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Escape closes, but never mid-save. Deliberately re-bound each render so the
  // handler sees the current basket — closing is guarded by a confirm that has
  // to know whether anything would be lost.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isCreating) requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // ── Picker ────────────────────────────────────────────────────
  const results = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = query
      ? products.filter((product) =>
          [product.name, product.slug, product.collectionName, product.category]
            .filter(Boolean)
            .some((field) => String(field).toLowerCase().includes(query))
        )
      : products;

    return matches.slice(0, MAX_RESULTS);
  }, [products, search]);

  const openProduct = openSlug ? products.find((product) => product.slug === openSlug) : undefined;

  const openVariants: Variant[] = useMemo(() => {
    if (!openProduct || !openColor) return [];
    return openProduct.variants.filter((variant) => variant.color === openColor);
  }, [openProduct, openColor]);

  const toggleProduct = (product: Product) => {
    if (openSlug === product.slug) {
      setOpenSlug(null);
      setOpenColor(null);
      return;
    }
    const colors = colorsOf(product);
    setOpenSlug(product.slug);
    setOpenColor(colors[0] ?? null);
  };

  const addVariant = (product: Product, variant: Variant) => {
    const stockLimit = getVariantStockLimit(variant);
    const inStock = isVariantInStock(variant);
    const key = lineKey(product.slug, variant.color, variant.size);
    const existing = lines.find((line) => line.key === key);
    const nextQuantity = (existing?.quantity ?? 0) + 1;

    // One prompt covers both "we have none recorded" and "that is more than is
    // recorded". Either way the merchant is asserting the count is stale.
    const needsOverride = !inStock || nextQuantity > stockLimit;

    if (needsOverride && !existing?.override) {
      const detail = inStock
        ? `Only ${stockLimit} of ${product.name} — ${variant.color} / ${variant.size} left in stock.`
        : `${product.name} — ${variant.color} / ${variant.size} is marked sold out.`;

      if (!window.confirm(`${detail}\n\nSell it anyway? Stock will not go below zero.`)) {
        return;
      }
    }

    setError('');

    if (existing) {
      setLines((previous) =>
        previous.map((line) =>
          line.key === key
            ? { ...line, quantity: line.quantity + 1, override: line.override || needsOverride }
            : line
        )
      );
      return;
    }

    setLines((previous) => [
      ...previous,
      {
        key,
        productSlug: product.slug,
        productName: product.name,
        image: product.colorImages?.[variant.color]?.[0] || product.image,
        color: variant.color,
        size: variant.size,
        colorHex: product.colorHex?.[variant.color],
        unitPrice: product.price,
        quantity: 1,
        stockLimit,
        override: needsOverride
      }
    ]);

    // Collapse so the next search starts from a clean list.
    setOpenSlug(null);
    setOpenColor(null);
  };

  const changeQuantity = (key: string, delta: number) => {
    const line = lines.find((candidate) => candidate.key === key);
    if (!line) return;

    const next = line.quantity + delta;

    if (next < 1) {
      removeLine(key);
      return;
    }

    // The prompt has to happen out here. A state updater must be pure — React is
    // free to run it more than once, which would put the dialog up twice.
    let override = line.override;

    if (delta > 0 && next > line.stockLimit && !override) {
      const message =
        line.stockLimit > 0
          ? `Only ${line.stockLimit} of ${line.productName} — ${line.color} / ${line.size} left in stock.`
          : `${line.productName} — ${line.color} / ${line.size} is marked sold out.`;

      if (!window.confirm(`${message}\n\nSell it anyway? Stock will not go below zero.`)) return;
      override = true;
    }

    setLines((previous) =>
      previous.map((candidate) =>
        candidate.key === key ? { ...candidate, quantity: next, override } : candidate
      )
    );
  };

  const removeLine = (key: string) => {
    setLines((previous) => previous.filter((line) => line.key !== key));
  };

  // ── Money ─────────────────────────────────────────────────────
  const subtotal = round2(lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0));
  const discount = resolveDiscount(subtotal, discountType, Number(discountValue) || 0);
  const total = round2(subtotal - discount);
  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  const hasOverride = lines.some((line) => line.override);

  // ── Phone ─────────────────────────────────────────────────────
  const msisdn = formatGhanaPhone(customerPhone);
  const phoneValid = isValidGhanaPhone(msisdn);
  const phoneTouched = customerPhone.trim().length > 0;

  const canSubmit =
    lines.length > 0 && customerName.trim().length >= 2 && phoneTouched && !isCreating;

  // ── Submit ────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!canSubmit) return;

    setIsCreating(true);
    setError('');

    try {
      const response = await fetch('/api/admin/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerEmail: customerEmail.trim() || undefined,
          shippingAddress: shippingAddress.trim() || undefined,
          shippingCity: shippingCity.trim() || undefined,
          items: lines.map((line) => ({
            productSlug: line.productSlug,
            color: line.color,
            size: line.size,
            quantity: line.quantity
          })),
          paidNow,
          paymentMethod: paidNow ? paymentMethod : 'COD',
          discountType,
          discountValue: Number(discountValue) || 0,
          allowOutOfStock: hasOverride,
          note: note.trim() || undefined,
          clientRequestId
        })
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'That order could not be created. Please try again.');
      }

      const result: CreatedOrderResult = {
        order: data.order,
        smsSent: Boolean(data.smsSent),
        smsReason: data.smsReason,
        duplicate: Boolean(data.duplicate)
      };

      setCreated(result);
      onCreated(result);
    } catch (err: any) {
      setError(err?.message || 'That order could not be created. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleResendSms = async () => {
    if (!created) return;

    setIsResending(true);
    setResendMessage('');

    try {
      const response = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resendSms', orderId: created.order.id })
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) throw new Error(data?.error || 'The text could not be sent.');

      setResendMessage(data.message);
      if (data.smsSent) {
        setCreated({ ...created, smsSent: true, smsReason: undefined });
      }
    } catch (err: any) {
      setResendMessage(err?.message || 'The text could not be sent.');
    } finally {
      setIsResending(false);
    }
  };

  /** Clears the form for the next customer, with a fresh idempotency key. */
  const startAnother = () => {
    setClientRequestId(newRequestId());
    setLines([]);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
    setShippingAddress('');
    setShippingCity('');
    setDiscountValue('');
    setDiscountType('amount');
    setNote('');
    setPaidNow(true);
    setPaymentMethod('CASH');
    setSearch('');
    setOpenSlug(null);
    setOpenColor(null);
    setError('');
    setResendMessage('');
    setCreated(null);
    window.setTimeout(() => searchRef.current?.focus(), 0);
  };

  function requestClose() {
    if (!created && lines.length > 0) {
      if (!window.confirm('Discard this order? Nothing has been saved yet.')) return;
    }
    onClose();
  }

  // ══════════════════════════════════════════════════════════════
  // Success
  // ══════════════════════════════════════════════════════════════
  if (created) {
    const order = created.order;

    return (
      <div className={styles.modalOverlay}>
        <div className={`${styles.modalContent} ${styles.orderModal}`}>
          <div className={styles.modalHeader}>
            <h3 className={styles.modalTitle}>Order Created</h3>
            <button className={styles.closeButton} onClick={onClose} type="button">
              &times;
            </button>
          </div>

          <div className={styles.successPanel}>
            <svg fill="none" height="46" stroke="#10b981" strokeWidth="2.5" viewBox="0 0 24 24" width="46">
              <polyline points="20 6 9 17 4 12" />
            </svg>

            <p className={styles.successRef}>#RD-{order.id}</p>
            <p className={styles.successTotal}>{formatCurrency(order.price)}</p>

            <p className={styles.successMeta}>
              {order.customerName} &middot; {order.customerPhone}
              <br />
              {order.totalQuantity} item{order.totalQuantity === 1 ? '' : 's'} &middot;{' '}
              {order.paymentStatus === 'paid' ? 'Paid' : 'Not paid yet — pay on delivery'}
              {created.duplicate && (
                <>
                  <br />
                  <span style={{ color: '#f59e0b' }}>
                    This order already existed — nothing was created twice.
                  </span>
                </>
              )}
            </p>

            <div
              className={`${styles.smsBanner} ${
                created.smsSent ? styles.smsBannerOk : styles.smsBannerWarn
              }`}
            >
              {created.smsSent ? (
                <>✓ Confirmation SMS delivered to {order.customerPhone}.</>
              ) : (
                <>
                  ⚠ The confirmation SMS was not delivered.
                  {created.smsReason ? ` ${created.smsReason}` : ''}
                  <br />
                  The order itself is saved and safe.
                </>
              )}
              {resendMessage && (
                <>
                  <br />
                  {resendMessage}
                </>
              )}
            </div>

            <div className={styles.successActions}>
              <button className={styles.saveButton} onClick={() => onPrint(order)} type="button">
                ⎙ Print slip
              </button>
              <button className={styles.saveButton} onClick={startAnother} type="button">
                + New order
              </button>
              {!created.smsSent && (
                <button
                  className={styles.cancelButton}
                  disabled={isResending}
                  onClick={handleResendSms}
                  type="button"
                >
                  {isResending ? 'Sending…' : 'Resend SMS'}
                </button>
              )}
              <button className={styles.cancelButton} onClick={onClose} type="button">
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // Form
  // ══════════════════════════════════════════════════════════════
  return (
    <div className={styles.modalOverlay}>
      <div className={`${styles.modalContent} ${styles.orderModal}`}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>New Order &middot; In Person</h3>
          <button className={styles.closeButton} onClick={requestClose} type="button">
            &times;
          </button>
        </div>

        <div className={styles.orderModalBody}>
          {error && (
            <div className={`${styles.notification} ${styles.notificationError}`} style={{ margin: 0 }}>
              <span>✕</span>
              <span>{error}</span>
            </div>
          )}

          {/* ── 1. Products ───────────────────────────────── */}
          <div>
            <p className={styles.orderBlockTitle}>1 · Add items</p>

            <input
              className={styles.input}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products by name, collection or category…"
              ref={searchRef}
              style={{ width: '100%', marginBottom: 'var(--space-3)' }}
              type="search"
              value={search}
            />

            <div className={styles.pickerList}>
              {results.length === 0 ? (
                <p className={styles.pickerEmpty}>
                  {products.length === 0
                    ? 'No products in the catalogue yet.'
                    : `Nothing matches “${search}”.`}
                </p>
              ) : (
                results.map((product) => {
                  const isOpen = openSlug === product.slug;
                  const colors = colorsOf(product);
                  const available = product.variants.filter(isVariantInStock).length;

                  return (
                    <div key={product.slug}>
                      <button
                        className={`${styles.pickerRow} ${isOpen ? styles.pickerRowActive : ''}`}
                        onClick={() => toggleProduct(product)}
                        type="button"
                      >
                        <span className={styles.pickerThumb}>
                          {product.image && (
                            <Image
                              alt={product.name}
                              fill
                              sizes="42px"
                              src={product.image}
                              style={{ objectFit: 'cover' }}
                            />
                          )}
                        </span>
                        <span className={styles.pickerInfo}>
                          <span className={styles.pickerName}>{product.name}</span>
                          <span className={styles.pickerMeta}>
                            {colors.length} colour{colors.length === 1 ? '' : 's'} ·{' '}
                            {available > 0 ? `${available} variants in stock` : 'SOLD OUT'}
                          </span>
                        </span>
                        <span className={styles.pickerPrice}>{formatCurrency(product.price)}</span>
                      </button>

                      {isOpen && (
                        <div className={styles.variantPanel}>
                          {colors.length === 0 ? (
                            <p className={styles.pickerEmpty} style={{ padding: 'var(--space-3)' }}>
                              This product has no colour/size variants yet.
                            </p>
                          ) : (
                            <>
                              <div className={styles.chipRow}>
                                {colors.map((color) => (
                                  <button
                                    className={`${styles.chip} ${
                                      openColor === color ? styles.chipActive : ''
                                    }`}
                                    key={color}
                                    onClick={() => setOpenColor(color)}
                                    type="button"
                                  >
                                    <span
                                      className={styles.chipSwatch}
                                      style={{ background: product.colorHex?.[color] || '#666' }}
                                    />
                                    {color}
                                  </button>
                                ))}
                              </div>

                              <div className={styles.chipRow}>
                                {openVariants.length === 0 ? (
                                  <span className={styles.pickerMeta}>Pick a colour above.</span>
                                ) : (
                                  openVariants.map((variant) => {
                                    const soldOut = !isVariantInStock(variant);

                                    return (
                                      <button
                                        className={`${styles.chip} ${
                                          soldOut ? styles.chipSoldOut : ''
                                        }`}
                                        key={variant.id || `${variant.color}-${variant.size}`}
                                        onClick={() => addVariant(product, variant)}
                                        title={getVariantStockLabel(variant)}
                                        type="button"
                                      >
                                        {variant.size}
                                        <span className={styles.chipHint}>
                                          {soldOut ? 'sold out' : getVariantStockLabel(variant)}
                                        </span>
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── 2. Basket ─────────────────────────────────── */}
          <div>
            <p className={styles.orderBlockTitle}>
              2 · Order{totalQuantity > 0 ? ` · ${totalQuantity} item${totalQuantity === 1 ? '' : 's'}` : ''}
            </p>

            <div className={styles.basket}>
              {lines.length === 0 ? (
                <p className={styles.basketEmpty}>
                  Nothing added yet. Search above, tap a colour, then tap a size.
                </p>
              ) : (
                lines.map((line) => (
                  <div className={styles.basketRow} key={line.key}>
                    <div className={styles.basketInfo}>
                      <p className={styles.basketName}>{line.productName}</p>
                      <p className={styles.basketVariant}>
                        {line.color} / {line.size} @ {formatCurrency(line.unitPrice)}
                        {line.override && <span className={styles.overrideTag}>OVER STOCK</span>}
                      </p>
                    </div>

                    <div className={styles.qtyStepper}>
                      <button
                        aria-label="Decrease quantity"
                        className={styles.qtyButton}
                        onClick={() => changeQuantity(line.key, -1)}
                        type="button"
                      >
                        −
                      </button>
                      <span className={styles.qtyValue}>{line.quantity}</span>
                      <button
                        aria-label="Increase quantity"
                        className={styles.qtyButton}
                        onClick={() => changeQuantity(line.key, 1)}
                        type="button"
                      >
                        +
                      </button>
                    </div>

                    <span className={styles.basketLineTotal}>
                      {formatCurrency(round2(line.unitPrice * line.quantity))}
                    </span>

                    <button
                      aria-label={`Remove ${line.productName}`}
                      className={styles.basketRemove}
                      onClick={() => removeLine(line.key)}
                      type="button"
                    >
                      &times;
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── 3. Customer ───────────────────────────────── */}
          <div>
            <p className={styles.orderBlockTitle}>3 · Customer</p>

            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Full Name *</label>
                <input
                  className={styles.input}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="e.g. Musli Sabur"
                  type="text"
                  value={customerName}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Phone * (receives the SMS)</label>
                <input
                  className={styles.input}
                  inputMode="tel"
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  placeholder="024 XXX XXXX"
                  type="tel"
                  value={customerPhone}
                />
                {phoneTouched && (
                  <p className={`${styles.hint} ${phoneValid ? styles.hintOk : styles.hintWarn}`}>
                    {phoneValid
                      ? `✓ SMS will be sent to ${msisdn}`
                      : '⚠ Not a valid Ghana number — the order will save, but no SMS can be sent.'}
                  </p>
                )}
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Email (optional)</label>
                <input
                  className={styles.input}
                  onChange={(event) => setCustomerEmail(event.target.value)}
                  placeholder="Leave blank for a walk-in"
                  type="email"
                  value={customerEmail}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Region (optional)</label>
                <select
                  className={styles.select}
                  onChange={(event) => setShippingCity(event.target.value)}
                  value={shippingCity}
                >
                  <option value="">Walk-in / not needed</option>
                  {GHANA_REGIONS.map((region) => (
                    <option key={region} value={region}>
                      {region} Region
                    </option>
                  ))}
                </select>
              </div>

              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.fieldLabel}>Delivery Address (optional)</label>
                <input
                  className={styles.input}
                  onChange={(event) => setShippingAddress(event.target.value)}
                  placeholder="House No., Street, Area — leave blank if collected in person"
                  type="text"
                  value={shippingAddress}
                />
              </div>
            </div>
          </div>

          {/* ── 4. Payment ────────────────────────────────── */}
          <div>
            <p className={styles.orderBlockTitle}>4 · Payment</p>

            <div className={styles.segmented}>
              <button
                className={`${styles.segment} ${paidNow ? styles.segmentActivePaid : ''}`}
                onClick={() => setPaidNow(true)}
                type="button"
              >
                ✓ Paid now
              </button>
              <button
                className={`${styles.segment} ${!paidNow ? styles.segmentActive : ''}`}
                onClick={() => setPaidNow(false)}
                type="button"
              >
                Not paid yet
              </button>
            </div>

            {paidNow ? (
              <div className={styles.segmented} style={{ marginTop: '8px' }}>
                {(
                  [
                    ['CASH', 'Cash'],
                    ['MOMO', 'Mobile money'],
                    ['BANK', 'Bank transfer']
                  ] as const
                ).map(([value, label]) => (
                  <button
                    className={`${styles.segment} ${
                      paymentMethod === value ? styles.segmentActive : ''
                    }`}
                    key={value}
                    onClick={() => setPaymentMethod(value)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <p className={`${styles.hint} ${styles.hintWarn}`}>
                Recorded as cash on delivery. Use “✓ Mark paid” in the orders table once the money
                arrives.
              </p>
            )}

            <div className={styles.field} style={{ marginTop: 'var(--space-4)' }}>
              <label className={styles.fieldLabel}>Discount (optional)</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  className={styles.input}
                  inputMode="decimal"
                  min="0"
                  onChange={(event) => setDiscountValue(event.target.value)}
                  placeholder="0"
                  step="0.01"
                  style={{ flex: 1, minWidth: 0 }}
                  type="number"
                  value={discountValue}
                />
                <button
                  className={`${styles.segment} ${
                    discountType === 'amount' ? styles.segmentActive : ''
                  }`}
                  onClick={() => setDiscountType('amount')}
                  style={{ flex: '0 0 auto', minWidth: '64px' }}
                  type="button"
                >
                  GH₵
                </button>
                <button
                  className={`${styles.segment} ${
                    discountType === 'percent' ? styles.segmentActive : ''
                  }`}
                  onClick={() => setDiscountType('percent')}
                  style={{ flex: '0 0 auto', minWidth: '64px' }}
                  type="button"
                >
                  %
                </button>
              </div>
            </div>

            <div className={styles.field} style={{ marginTop: 'var(--space-4)' }}>
              <label className={styles.fieldLabel}>Note (optional)</label>
              <input
                className={styles.input}
                onChange={(event) => setNote(event.target.value)}
                placeholder="e.g. Collected at the shop, paid in cash"
                type="text"
                value={note}
              />
            </div>
          </div>

          {/* ── Totals ────────────────────────────────────── */}
          <div className={styles.totalsBox}>
            <div className={styles.totalsRow}>
              <span>Subtotal</span>
              <span className={styles.totalsValue}>{formatCurrency(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className={styles.totalsRow}>
                <span>Discount{discountType === 'percent' ? ` (${Number(discountValue)}%)` : ''}</span>
                <span className={styles.totalsValue} style={{ color: '#10b981' }}>
                  −{formatCurrency(discount)}
                </span>
              </div>
            )}
            <div className={styles.totalsGrand}>
              <span className={styles.totalsGrandLabel}>Total</span>
              <span className={styles.totalsGrandValue}>{formatCurrency(total)}</span>
            </div>
            <p className={styles.totalsNote}>
              No 2% service fee on in-person orders — that fee covers the online payment gateway.
            </p>
          </div>
        </div>

        <div className={styles.orderModalFooter}>
          <button
            className={styles.saveButton}
            disabled={!canSubmit}
            onClick={handleCreate}
            style={{ width: '100%', padding: '14px' }}
            type="button"
          >
            {isCreating ? 'Creating order…' : `Create order · ${formatCurrency(total)}`}
          </button>
          <button className={styles.cancelButton} onClick={requestClose} type="button">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
