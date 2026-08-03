'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/format';
import { confirmPayment, forgetPendingCheckout, readPendingCheckout } from '@/lib/checkout-client';

type Phase = 'checking' | 'paid' | 'unsettled' | 'failed' | 'missing';

/**
 * Landing page for Paystack's hosted checkout.
 *
 * Customers only reach this when the inline popup could not be used, but the
 * guarantees are identical: the order was recorded before payment, so this page
 * only has to *report* the outcome. Even if the customer never lands here at
 * all, the webhook and the reconciliation sweep settle the order anyway.
 */
export function CheckoutComplete() {
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>('checking');
  const [message, setMessage] = useState('Confirming your payment with Paystack…');
  const [order, setOrder] = useState<any>(null);
  const [reference, setReference] = useState('');

  useEffect(() => {
    // Paystack appends both `reference` and `trxref` to the callback URL.
    const fromUrl =
      searchParams.get('reference') || searchParams.get('trxref') || searchParams.get('ref') || '';
    const resolved = fromUrl || readPendingCheckout()?.reference || '';

    if (!resolved) {
      setPhase('missing');
      setMessage('We could not find a payment reference to check.');
      return;
    }

    setReference(resolved);
    let cancelled = false;

    (async () => {
      const result = await confirmPayment(resolved, (attempt) => {
        if (!cancelled && attempt > 2) setMessage(`Still confirming with Paystack… (attempt ${attempt})`);
      });

      if (cancelled) return;

      if (result.paid && result.order) {
        forgetPendingCheckout();
        setOrder(result.order);
        setPhase('paid');
        return;
      }

      if (result.outcome === 'failed' || result.outcome === 'abandoned') {
        forgetPendingCheckout();
        setPhase('failed');
        setMessage(result.message || 'That payment did not complete. Nothing was charged.');
        return;
      }

      setPhase('unsettled');
      setMessage(
        'Your order is saved and we are finalising the payment confirmation. ' +
          'You will receive an SMS as soon as it clears.'
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const accent =
    phase === 'paid' ? '#10b981' : phase === 'failed' ? '#ef4444' : phase === 'checking' ? '#888' : '#f59e0b';

  return (
    <div
      style={{
        maxWidth: '620px',
        margin: '120px auto 80px',
        padding: 'var(--space-6) var(--space-5)',
        background: 'rgba(10, 10, 10, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.07)',
        borderRadius: 'var(--radius-xl)',
        fontFamily: 'monospace',
        color: '#f5f3ee'
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: '58px',
            height: '58px',
            margin: '0 auto var(--space-4)',
            borderRadius: '50%',
            border: `2px solid ${accent}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: accent,
            fontSize: '1.6rem'
          }}
        >
          {phase === 'paid' ? '✓' : phase === 'failed' ? '✕' : '⏱'}
        </div>

        <h1 style={{ fontSize: '1.1rem', letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 10px' }}>
          {phase === 'paid'
            ? 'Payment confirmed'
            : phase === 'failed'
            ? 'Payment not completed'
            : phase === 'missing'
            ? 'Nothing to check'
            : 'Your order is saved'}
        </h1>

        <p style={{ color: '#aaa', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>
          {phase === 'paid'
            ? `Thank you, ${order?.customerName || 'friend'} — your order is confirmed and an SMS is on its way.`
            : message}
        </p>
      </div>

      {order && (
        <div
          style={{
            marginTop: 'var(--space-5)',
            padding: 'var(--space-4)',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '8px',
            display: 'grid',
            gap: '12px',
            fontSize: '0.82rem'
          }}
        >
          <div>
            <span style={{ color: '#666', fontSize: '0.7rem', display: 'block', letterSpacing: '0.08em' }}>
              ORDER REFERENCE
            </span>
            <strong>#{order.orderNumber}</strong>
          </div>

          <div>
            <span style={{ color: '#666', fontSize: '0.7rem', display: 'block', letterSpacing: '0.08em' }}>
              ITEMS
            </span>
            <div style={{ display: 'grid', gap: '6px', marginTop: '4px' }}>
              {order.items?.map((item: any, index: number) => (
                <div key={`${item.productSlug}-${item.color}-${item.size}-${index}`}>
                  <strong>{item.productName}</strong>
                  <div style={{ color: '#10b981', fontSize: '0.78rem' }}>
                    {item.color} / {item.size} &times; {item.quantity} — {formatCurrency(item.lineTotal)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <span style={{ color: '#666', fontSize: '0.7rem', display: 'block', letterSpacing: '0.08em' }}>
              TOTAL PAID
            </span>
            <strong>{formatCurrency(order.price)}</strong>
          </div>
        </div>
      )}

      {reference && (
        <p style={{ marginTop: 'var(--space-4)', color: '#666', fontSize: '0.72rem', textAlign: 'center' }}>
          Payment reference: {reference}
        </p>
      )}

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: 'var(--space-5)' }}>
        <Link
          href={order ? `/track-order?ref=${order.orderNumber}` : '/track-order'}
          style={{
            padding: '10px 18px',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '6px',
            fontSize: '0.72rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase'
          }}
        >
          Track order
        </Link>
        <Link
          href="/shop"
          style={{
            padding: '10px 18px',
            background: '#fff',
            color: '#000',
            borderRadius: '6px',
            fontSize: '0.72rem',
            fontWeight: 'bold',
            letterSpacing: '0.08em',
            textTransform: 'uppercase'
          }}
        >
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
