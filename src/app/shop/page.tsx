import { ProductCard } from '@/components/product/ProductCard';
import { getDbProducts } from '@/lib/catalog-db';
import { buildMetadata } from '@/lib/metadata';
import styles from '../pages.module.css';

export const dynamic = 'force-dynamic';

export const metadata = buildMetadata({
  title: 'Shop',
  description: 'Shop limited-run REDOXDESIGNX hoodies, tees, cargos, outerwear, and accessories.',
  path: '/shop'
});

export default async function ShopPage() {
  const products = await getDbProducts();

  return (
    <main className={styles.homePage}>
      <section className={styles.catalogSection}>
        {products.length > 0 ? (
          <div className={styles.landingGrid}>
            {products.map((product, index) => (
              <ProductCard key={product.id} priority={index < 4} product={product} />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '120px 24px' }}>
            <p style={{ color: '#666', fontSize: '0.825rem' }}>No products available yet.</p>
          </div>
        )}
      </section>
    </main>
  );
}
