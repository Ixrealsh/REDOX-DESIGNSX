import { TrackOrder } from '@/components/commerce/TrackOrder';
import { buildMetadata } from '@/lib/metadata';

export const metadata = buildMetadata({
  title: 'Track Order',
  description: 'Trace your Redox Designsx direct order shipping and delivery status live.',
  path: '/track-order'
});

export default function TrackOrderPage() {
  return (
    <main style={{ minHeight: '85vh', paddingTop: '140px', paddingBottom: '100px', display: 'grid', placeItems: 'center' }}>
      <div style={{ width: 'min(100%, var(--container-max))', margin: '0 auto', padding: '0 var(--section-x)', display: 'grid', placeItems: 'center' }}>
        <TrackOrder />
      </div>
    </main>
  );
}
