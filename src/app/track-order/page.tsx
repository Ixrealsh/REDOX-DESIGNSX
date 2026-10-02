import { TrackOrder } from '@/components/commerce/TrackOrder';
import { buildMetadata } from '@/lib/metadata';

export const metadata = buildMetadata({
  title: 'Track Order',
  description: 'Trace your REDOXDESIGNX direct order shipping and delivery status live.',
  path: '/track-order'
});

export default function TrackOrderPage() {
  return (
    <main style={{ minHeight: '70vh', padding: 'clamp(120px, 14vw, 180px) var(--section-x) 80px' }}>
      <TrackOrder />
    </main>
  );
}
