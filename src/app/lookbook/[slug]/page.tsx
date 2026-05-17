import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ProductCard } from '@/components/product/ProductCard';
import { getDbLookbook, getDbLookbooks, getDbProduct } from '@/lib/catalog-db';
import { buildMetadata } from '@/lib/metadata';
import type { Product } from '@/types/product';
import styles from '../../pages.module.css';

interface LookbookPageProps {
  params: { slug: string };
}

export async function generateStaticParams() {
  const lookbooks = await getDbLookbooks();
  return lookbooks.map((issue) => ({ slug: issue.slug }));
}

export async function generateMetadata({ params }: LookbookPageProps) {
  const issue = await getDbLookbook(params.slug);

  if (!issue) {
    return buildMetadata({ title: 'Lookbook' });
  }

  return buildMetadata({
    title: issue.title,
    description: issue.dek,
    path: `/lookbook/${issue.slug}`,
    image: issue.image
  });
}

export default async function LookbookIssuePage({ params }: LookbookPageProps) {
  const issue = await getDbLookbook(params.slug);

  if (!issue) {
    notFound();
  }

  const featuredProductsResult = await Promise.all(
    issue.featuredProductSlugs.map((slug) => getDbProduct(slug))
  );
  
  const featuredProducts = featuredProductsResult.filter(
    (product): product is Product => Boolean(product)
  );

  return (
    <>
      <header className="pageHeader">
        <div className="pageHeaderInner">
          <p className="eyebrow">{issue.season}</p>
          <h1 className="pageTitle">{issue.title}</h1>
          <p className="pageLead">{issue.dek}</p>
        </div>
      </header>
      <section className={styles.section} style={{ paddingTop: 0 }}>
        <div className={styles.inner}>
          <div className={styles.imageCard} style={{ minHeight: '76vh' }}>
            <Image alt={issue.dek} fill priority sizes="100vw" src={issue.image} />
          </div>
        </div>
      </section>
      <section className={styles.section}>
        <div className={`${styles.tight} ${styles.manifesto}`}>
          <p>Clothes are language.</p>
          <p>Every piece is a sentence.</p>
          <p>Say less. Mean more.</p>
        </div>
      </section>
      <section className={styles.section}>
        <div className={styles.inner}>
          <p className="eyebrow">Shop this look</p>
          <h2 className="sectionTitle">Tagged pieces</h2>
          <div className={styles.productGrid} style={{ marginTop: 'var(--space-7)' }}>
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
