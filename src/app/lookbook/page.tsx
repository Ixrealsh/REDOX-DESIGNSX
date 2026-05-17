import Image from 'next/image';
import Link from 'next/link';
import { getDbLookbooks } from '@/lib/catalog-db';
import { buildMetadata } from '@/lib/metadata';
import styles from '../pages.module.css';

export const metadata = buildMetadata({
  title: 'Lookbook',
  description: 'Editorial Redox Designsx styling, campaign imagery, and product callouts.',
  path: '/lookbook'
});

export default async function LookbookPage() {
  const lookbooks = await getDbLookbooks();
  
  if (lookbooks.length === 0) {
    return (
      <>
        <header className="pageHeader">
          <div className="pageHeaderInner">
            <p className="eyebrow">Lookbook</p>
            <h1 className="pageTitle">The brand as atmosphere.</h1>
            <p className="pageLead">Editorial styling for the pieces before they become part of your rotation.</p>
          </div>
        </header>
        <section className={styles.section}>
          <div className={styles.inner} style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
            <h2 className="sectionTitle">NO EDITORIAL CAMPAIGNS YET</h2>
            <p className="sectionCopy" style={{ marginTop: 'var(--space-2)' }}>Check back soon or create lookbook issues inside the Admin Panel!</p>
          </div>
        </section>
      </>
    );
  }
  
  return (
    <>
      <header className="pageHeader">
        <div className="pageHeaderInner">
          <p className="eyebrow">Lookbook</p>
          <h1 className="pageTitle">The brand as atmosphere.</h1>
          <p className="pageLead">Editorial styling for the pieces before they become part of your rotation.</p>
        </div>
      </header>
      <section className={styles.section}>
        <div className={`${styles.inner} ${styles.grid}`}>
          {lookbooks.map((issue) => (
            <Link className={styles.overlayCard} href={`/lookbook/${issue.slug}`} key={issue.slug}>
              <Image alt={issue.dek} fill sizes="(min-width: 1040px) 33vw, 100vw" src={issue.image} />
              <div className={styles.overlayContent}>
                <p className="eyebrow">{issue.season}</p>
                <h2>{issue.title}</h2>
                <p>{issue.dek}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
