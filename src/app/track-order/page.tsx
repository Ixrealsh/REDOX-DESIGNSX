import { buildMetadata } from '@/lib/metadata';
import { TrackOrder } from '@/components/commerce/TrackOrder';

export const metadata = buildMetadata({
  title: 'Track Order',
  description: 'Trace your Redox Designsx order status in real time.',
  path: '/track-order'
});

export default function TrackOrderPage() {
  return (
    <main style={{ minHeight: '85vh', paddingTop: '160px', paddingBottom: '120px' }}>
      <div style={{ width: 'min(100%, var(--container-narrow))', margin: '0 auto', padding: '0 var(--section-x)' }}>
        <h1 style={{ 
          fontSize: 'var(--text-3xl)', 
          textTransform: 'uppercase', 
          fontFamily: 'var(--font-display)', 
          marginBottom: 'var(--space-6)',
          letterSpacing: '0.05em',
          textAlign: 'center'
        }}>
          Track Order
        </h1>
        <TrackOrder />
      </div>
    </main>
  );
}
