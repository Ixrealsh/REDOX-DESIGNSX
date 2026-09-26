import { notFound } from 'next/navigation';
import { ProductDetail } from '@/components/product/ProductDetail';
import { getDbProduct } from '@/lib/catalog-db';
import { getProductStockSummary, isProductVisible } from '@/lib/inventory';
import { buildMetadata, siteMeta } from '@/lib/metadata';
import { getAdminSessionToken, isAdminSessionValid } from '@/lib/admin-auth';

// Always resolve products from the database so admin-created items are available immediately.
export const dynamic = 'force-dynamic';

interface ProductPageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: ProductPageProps) {
  const product = await getDbProduct(params.slug);
  const isAdmin = isAdminSessionValid(getAdminSessionToken());

  // A hidden product must not leak its name or photo into a link preview unless admin preview.
  if (!product || (!isProductVisible(product) && !isAdmin)) {
    return buildMetadata({ title: 'Product' });
  }

  return buildMetadata({
    title: `${product.name}${product.visibility === 'hidden' ? ' (Admin Preview)' : ''}`,
    description: product.description,
    path: `/products/${product.slug}`,
    image: product.image
  });
}

export default async function ProductPage({ params }: ProductPageProps) {
  const product = await getDbProduct(params.slug);
  const isAdmin = isAdminSessionValid(getAdminSessionToken());

  if (!product) {
    notFound();
  }

  // Hidden reads exactly like deleted from the outside: someone holding an old
  // link, or guessing a slug, gets 404, but authenticated admins can preview live.
  if (!isProductVisible(product) && !isAdmin) {
    notFound();
  }

  const stock = getProductStockSummary(product);
  const productImage = product.image.startsWith('http') ? product.image : `${siteMeta.siteUrl}${product.image}`;

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: [productImage],
    description: product.description,
    sku: product.variants?.[0]?.sku || `RD-${product.id}`,
    brand: { '@type': 'Brand', name: 'REDOXDESIGNX' },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: product.rating,
      reviewCount: product.reviewCount
    },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'GHS',
      price: product.price,
      availability: product.badge === 'COMING SOON'
        ? 'https://schema.org/PreOrder'
        : stock.isSoldOut
          ? 'https://schema.org/OutOfStock'
          : 'https://schema.org/InStock',
      url: `${siteMeta.siteUrl}/products/${product.slug}`
    }
  };

  return (
    <>
      {isAdmin && product.visibility === 'hidden' && (
        <aside
          aria-label="Admin preview banner"
          style={{
            background: 'linear-gradient(90deg, #92400e 0%, #b45309 50%, #78350f 100%)',
            color: '#fff',
            padding: '10px 16px',
            fontSize: '0.8rem',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            position: 'sticky',
            top: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
            fontFamily: 'var(--font-mono), monospace'
          }}
        >
          <span>⊘ Admin Live Preview: This product is hidden from the public storefront</span>
          <a
            href="/admin"
            style={{
              background: 'rgba(0,0,0,0.4)',
              color: '#fff',
              padding: '3px 8px',
              borderRadius: '3px',
              textDecoration: 'none',
              fontSize: '0.72rem',
              border: '1px solid rgba(255,255,255,0.2)'
            }}
          >
            ← Admin Console
          </a>
        </aside>
      )}
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        type="application/ld+json"
      />
      <ProductDetail product={product} />
    </>
  );
}
