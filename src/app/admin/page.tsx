import { isDbConfigured } from '@/lib/db';
import { getDbProducts, getDbDrops, getDbCollections, getDbLookbooks, getDbWaitlist } from '@/lib/catalog-db';
import { AdminDashboard } from './AdminDashboard';

export const metadata = {
  title: 'Admin Console | Redox Designsx',
  description: 'Manage Redox Designsx apparel catalog, releases, and waitlist signups.',
  robots: {
    index: false,
    follow: false
  }
};

export default async function AdminPage() {
  const isDbConnected = isDbConfigured;
  
  const isCloudinaryConnected = Boolean(
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_KEY !== 'your_cloudinary_api_key_here' &&
    process.env.CLOUDINARY_API_SECRET &&
    process.env.CLOUDINARY_API_SECRET !== 'your_cloudinary_api_secret_here'
  );

  // Fetch initial datasets (safely falls back to mock files if DB not connected)
  const products = await getDbProducts();
  const drops = await getDbDrops();
  const collections = await getDbCollections();
  const lookbooks = await getDbLookbooks();
  const waitlist = await getDbWaitlist();

  return (
    <main style={{ minHeight: '100vh', background: '#050505', paddingTop: 'var(--space-8)' }}>
      <AdminDashboard
        isDbConnected={isDbConnected}
        isCloudinaryConnected={isCloudinaryConnected}
        initialProducts={products}
        initialDrops={drops}
        initialCollections={collections}
        initialLookbooks={lookbooks}
        initialWaitlist={waitlist}
      />
    </main>
  );
}
