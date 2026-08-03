import { Suspense } from 'react';
import type { Metadata } from 'next';
import { CheckoutComplete } from './CheckoutComplete';

export const metadata: Metadata = {
  title: 'Payment status — RedoxDesignx',
  description: 'Confirmation of your RedoxDesignx order payment.',
  robots: { index: false, follow: false }
};

export const dynamic = 'force-dynamic';

export default function CheckoutCompletePage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: '160px 24px', textAlign: 'center', color: '#888', fontFamily: 'monospace' }}>
          Confirming your payment…
        </div>
      }
    >
      <CheckoutComplete />
    </Suspense>
  );
}
