import Image from 'next/image';
import Link from 'next/link';
import { ProductCard } from '@/components/product/ProductCard';
import { LinkButton } from '@/components/ui/LinkButton';
import { getDbProducts } from '@/lib/catalog-db';
import { formatCurrency } from '@/lib/format';
import { getProductStockSummary } from '@/lib/inventory';
import styles from './pages.module.css';

export default async function HomePage() {
  const products = await getDbProducts();
  const featuredProduct = products[0];
  const featuredStock = featuredProduct ? getProductStockSummary(featuredProduct) : null;
  const totalKnownStock = products.reduce((sum, product) => {
    const stock = getProductStockSummary(product);
    return sum + stock.totalKnownStock;
  }, 0);

  return (
    <main className={styles.homePage}>
      {featuredProduct && (
        <section className={styles.storeHero}>
          <div className={styles.storeHeroCopy}>
            <p className="eyebrow">REDOXDESIGNX live catalog</p>
            <h1>{featuredProduct.collectionName}</h1>
            <p>
              Precision apparel drops with color-specific sizing, live stock signals, and secure checkout.
            </p>
            <div className={styles.heroStats}>
              <span>{products.length} products</span>
              <span>{totalKnownStock > 0 ? `${totalKnownStock} stocked pieces` : 'Live stock by variant'}</span>
              <span>Paystack checkout</span>
            </div>
            <div className="buttonRow">
              <LinkButton href="#latest-products">Shop catalog</LinkButton>
              <LinkButton href={`/products/${featuredProduct.slug}`} variant="secondary">
                View featured
              </LinkButton>
            </div>
          </div>

          <Link className={styles.heroProduct} href={`/products/${featuredProduct.slug}`}>
            <div className={styles.heroProductImage}>
              <Image
                alt={featuredProduct.imageAlt}
                fill
                priority
                sizes="(min-width: 980px) 40vw, 100vw"
                src={featuredProduct.image}
              />
            </div>
            <div className={styles.heroProductMeta}>
              <span>{featuredStock?.isSoldOut ? 'Out of stock' : 'Featured piece'}</span>
              <strong>{featuredProduct.name}</strong>
              <em>{formatCurrency(featuredProduct.price)}</em>
            </div>
          </Link>
        </section>
      )}

      <section className={styles.catalogSection} id="latest-products">
        {products.length > 0 ? (
          <>
            <div className={styles.catalogHeader}>
              <div>
                <p className="eyebrow">Latest stock</p>
                <h2>Shop all products</h2>
              </div>
              <LinkButton href="/shop" variant="secondary">Open shop</LinkButton>
            </div>
            <div className={styles.landingGrid}>
              {products.map((product, index) => (
                <ProductCard key={product.id} priority={index < 4} product={product} />
              ))}
            </div>
          </>
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
      </section>
    </main>
  );
}
