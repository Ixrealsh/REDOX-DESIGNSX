import { ProductCard } from '@/components/product/ProductCard';
import { TrackOrder } from '@/components/commerce/TrackOrder';
import { getDbProducts } from '@/lib/catalog-db';
import styles from './pages.module.css';

export default async function HomePage() {
  const products = await getDbProducts();

  return (
    <main style={{ minHeight: '80vh', paddingTop: '132px', paddingBottom: '100px' }}>
      <div style={{ width: 'min(100%, var(--container-max))', margin: '0 auto', padding: '0 var(--section-x)' }}>
        {products.length > 0 ? (
          <div className={styles.landingGrid}>
            {products.map((product, index) => (
              <ProductCard key={product.id} priority={index < 4} product={product} />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '120px 24px' }}>
            <h2 style={{ fontSize: '1.2rem', letterSpacing: '0.1em', color: '#fff', textTransform: 'uppercase', marginBottom: '8px' }}>
              REDOX CATALOG
            </h2>
            <p style={{ color: '#666', fontSize: '0.825rem', fontStyle: 'italic' }}>
              Add pieces in the Admin Panel to showcase them live on the storefront canvas.
            </p>
          </div>
        )}

        {/* Dynamic Interactive Order Tracing Console */}
        <TrackOrder />
      </div>
    </main>
  );
}
