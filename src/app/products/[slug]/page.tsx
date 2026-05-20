import { notFound } from 'next/navigation';
import { ProductDetail } from '@/components/product/ProductDetail';
import { getDbProduct, getDbProducts } from '@/lib/catalog-db';
import { getProductStockSummary } from '@/lib/inventory';
import { buildMetadata, siteMeta } from '@/lib/metadata';

interface ProductPageProps {
  params: { slug: string };
}

export async function generateStaticParams() {
  const products = await getDbProducts();
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: ProductPageProps) {
  const product = await getDbProduct(params.slug);

  if (!product) {
    return buildMetadata({ title: 'Product' });
  }

  return buildMetadata({
    title: `${product.name} - ${product.collectionName}`,
    description: product.description,
    path: `/products/${product.slug}`,
    image: product.image
  });
}

export default async function ProductPage({ params }: ProductPageProps) {
  const product = await getDbProduct(params.slug);

  if (!product) {
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
    sku: product.variants[0]?.sku,
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
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        type="application/ld+json"
      />
      <ProductDetail product={product} />
    </>
  );
}
