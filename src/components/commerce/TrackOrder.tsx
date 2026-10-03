'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/format';
import { FREE_STATION_DELIVERY_DETAILS, FREE_STATION_DELIVERY_LABEL, URGENT_STATION_DELIVERY_LABEL } from '@/lib/delivery';
import styles from './TrackOrder.module.css';

interface TrackedItem {
  productSlug: string;
  productName: string;
  color: string;
  size: string;
  quantity: number;
  lineTotal: number;
}

interface TrackedOrder {
  id: number;
  reference?: string;
  status: string;
  paymentStatus: string;
  items: TrackedItem[];
  extras?: { label: string; amount: number }[];
  price: number;
  discount?: number;
  serviceCharge?: number;
  deliveryMethod?: 'none' | 'standard' | 'urgent';
  deliveryFee?: number;
}

const STEPS = ['Placed', 'Processing', 'Shipped', 'Delivered'];

function progressIndex(status: string) {
  return status === 'Pending' ? 0 : STEPS.indexOf(status);
}

function paymentLabel(status: string) {
  if (status === 'paid') return 'Paid';
  if (status === 'refunded') return 'Refunded';
  if (status === 'failed' || status === 'abandoned') return 'Payment not completed';
  return 'Awaiting payment confirmation';
}

export function TrackOrder() {
  const [refInput, setRefInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState<TrackedOrder | null>(null);

  const lookupOrder = useCallback(async (reference: string) => {
    const trimmed = reference.trim();
    if (!trimmed) {
      setError('Enter your order reference to continue.');
      return;
    }
    setLoading(true);
    setError('');
    setOrder(null);
    try {
      const response = await fetch(`/api/orders?ref=${encodeURIComponent(trimmed)}`);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.order) {
        throw new Error(data?.error || 'We could not find that order. Check the reference and try again.');
      }
      setOrder(data.order);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Order tracking is unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('ref');
    if (!fromUrl) return;
    setRefInput(fromUrl);
    void lookupOrder(fromUrl);
  }, [lookupOrder]);

  const currentStep = order ? progressIndex(order.status) : -1;

  return (
    <section className={styles.panel} aria-labelledby="track-title">
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Your order</p>
        <h1 id="track-title">Track order</h1>
        <p>Enter the reference from your checkout confirmation.</p>
      </div>
      <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void lookupOrder(refInput); }}>
        <label className={styles.label} htmlFor="order-reference">Order reference</label>
        <div className={styles.formRow}>
          <input autoComplete="off" id="order-reference" onChange={(event) => setRefInput(event.target.value)} placeholder="RD-1025" required type="text" value={refInput} />
          <button disabled={loading} type="submit">{loading ? 'Checking…' : 'Track'}</button>
        </div>
      </form>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {loading && <p className={styles.feedback} role="status">Checking your order…</p>}

      {order && !loading && (
        <div className={styles.result} aria-live="polite">
          <div className={styles.summary}>
            <p className={styles.eyebrow}>Order RD-{order.id}</p>
            <h2>{order.status === 'Pending' ? 'Order placed' : order.status}</h2>
            <p className={styles.payment} data-payment={order.paymentStatus}>{paymentLabel(order.paymentStatus)}</p>
            {(order.paymentStatus === 'failed' || order.paymentStatus === 'abandoned') && (
              <p className={styles.note}>If you were charged, contact us with your payment reference.</p>
            )}
            {!['paid', 'refunded', 'failed', 'abandoned'].includes(order.paymentStatus) && (
              <p className={styles.note}>If you have paid, your status will update after confirmation. Please do not pay again.</p>
            )}
          </div>
          {currentStep >= 0 && (
            <details className={styles.details}>
              <summary>Delivery progress <span aria-hidden="true">+</span></summary>
              <ol className={styles.steps}>
                {STEPS.map((step, index) => (
                  <li className={index <= currentStep ? styles.stepDone : ''} key={step} aria-current={index === currentStep ? 'step' : undefined}>
                    <span className={styles.stepMark} aria-hidden="true">{index < currentStep ? '✓' : index + 1}</span>{step}
                  </li>
                ))}
              </ol>
            </details>
          )}
          <details className={styles.details}>
            <summary>Order details <span aria-hidden="true">+</span></summary>
            <div className={styles.detailBody}>
              {order.items?.map((item, index) => (
                <div className={styles.line} key={`${item.productSlug}-${item.color}-${item.size}-${index}`}>
                  <div><strong>{item.productName}</strong><small>{item.color} · Size {item.size} · Qty {item.quantity}</small></div>
                  <span>{formatCurrency(Number(item.lineTotal))}</span>
                </div>
              ))}
              {order.extras?.map((extra, index) => (
                <div className={styles.line} key={`${extra.label}-${index}`}><span>{extra.label}</span><span>{formatCurrency(Number(extra.amount))}</span></div>
              ))}
              {order.deliveryMethod && order.deliveryMethod !== 'none' && <div className={styles.line}><span>{order.deliveryMethod === 'urgent' ? URGENT_STATION_DELIVERY_LABEL : `${FREE_STATION_DELIVERY_LABEL} · ${FREE_STATION_DELIVERY_DETAILS}`}</span><span>{formatCurrency(order.deliveryFee || 0)}</span></div>}
              <div className={`${styles.line} ${styles.total}`}><strong>Total</strong><strong>{formatCurrency(Number(order.price))}</strong></div>
              {Number(order.discount) > 0 && <p className={styles.small}>Includes {formatCurrency(Number(order.discount))} discount.</p>}
              {Number(order.serviceCharge) > 0 && <p className={styles.small}>Includes service charge.</p>}
              {order.reference && <p className={styles.small}>Payment reference: {order.reference}</p>}
            </div>
          </details>
        </div>
      )}
    </section>
  );
}
