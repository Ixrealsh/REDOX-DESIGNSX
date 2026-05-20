import { ProductCard } from '@/components/product/ProductCard';
import { getDbProducts } from '@/lib/catalog-db';
import styles from './pages.module.css';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const products = await getDbProducts();

  return (
    <main className={styles.homePage}>
      <section className={styles.catalogSection} id="latest-products">
        {products.length > 0 ? (
          <div className={styles.landingGrid}>
            {products.map((product, index) => (
              <ProductCard key={product.id} priority={index < 4} product={product} />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '120px 24px' }}>
            <h2 style={{ fontSize: '1.2rem', letterSpacing: '0.1em', color: '#fff', textTransform: 'uppercase', marginBottom: '8px' }}>
              Catalog
            </h2>
            <p style={{ color: '#666', fontSize: '0.825rem', fontStyle: 'italic' }}>
              Add products in the admin panel to show them here.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
