import Image from 'next/image';
import Link from 'next/link';
import { getDbCollections } from '@/lib/catalog-db';
import { buildMetadata } from '@/lib/metadata';
import styles from '../pages.module.css';

export const metadata = buildMetadata({
  title: 'Collections',
  description: 'Explore Redox Designsx apparel collections built as complete streetwear systems.',
  path: '/collections'
});

export default async function CollectionsPage() {
  const collections = await getDbCollections();
  
  if (collections.length === 0) {
    return (
      <>
        <header className="pageHeader">
          <div className="pageHeaderInner">
            <p className="eyebrow">Collections</p>
            <h1 className="pageTitle">Systems, not outfits.</h1>
            <p className="pageLead">
              Each collection is a controlled reaction: fabric, fit, function, and a limited run.
            </p>
          </div>
        </header>
        <section className={styles.section}>
          <div className={styles.inner} style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
            <h2 className="sectionTitle">NO ACTIVE COLLECTIONS</h2>
            <p className="sectionCopy" style={{ marginTop: 'var(--space-2)' }}>Check back soon or create design collections inside the Admin Panel!</p>
          </div>
        </section>
      </>
    );
  }
  
  return (
    <>
      <header className="pageHeader">
        <div className="pageHeaderInner">
          <p className="eyebrow">Collections</p>
          <h1 className="pageTitle">Systems, not outfits.</h1>
          <p className="pageLead">
            Each collection is a controlled reaction: fabric, fit, function, and a limited run.
          </p>
        </div>
      </header>
      <section className={styles.section}>
        <div className={`${styles.inner} ${styles.grid}`}>
          {collections.map((collection) => (
            <Link className={styles.overlayCard} href={`/collections/${collection.slug}`} key={collection.slug}>
              <Image alt={collection.description} fill sizes="(min-width: 1040px) 33vw, 100vw" src={collection.image} />
              <div className={styles.overlayContent}>
                <p className="eyebrow">{collection.tagline}</p>
                <h2>{collection.name}</h2>
                <p>{collection.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
