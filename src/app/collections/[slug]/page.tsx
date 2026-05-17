import { notFound } from 'next/navigation';
import { ProductCard } from '@/components/product/ProductCard';
import { getDbCollection, getDbCollections, getDbCollectionProducts } from '@/lib/catalog-db';
import { buildMetadata } from '@/lib/metadata';
import styles from '../../pages.module.css';

interface CollectionPageProps {
  params: { slug: string };
}

export async function generateStaticParams() {
  const collections = await getDbCollections();
  return collections.map((collection) => ({ slug: collection.slug }));
}

export async function generateMetadata({ params }: CollectionPageProps) {
  const collection = await getDbCollection(params.slug);

  if (!collection) {
    return buildMetadata({ title: 'Collection' });
  }

  return buildMetadata({
    title: collection.name,
    description: collection.description,
    path: `/collections/${collection.slug}`,
    image: collection.image
  });
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const collection = await getDbCollection(params.slug);

  if (!collection) {
    notFound();
  }

  const collectionProducts = await getDbCollectionProducts(collection.slug);

  return (
    <>
      <header className="pageHeader">
        <div className="pageHeaderInner">
          <p className="eyebrow">Collection</p>
          <h1 className="pageTitle">{collection.name}</h1>
          <p className="pageLead">{collection.description}</p>
        </div>
      </header>
      <section className={styles.section}>
        <div className={`${styles.inner} ${styles.productGrid}`}>
          {collectionProducts.map((product, index) => (
            <ProductCard key={product.id} priority={index < 2} product={product} />
          ))}
        </div>
      </section>
    </>
  );
}
