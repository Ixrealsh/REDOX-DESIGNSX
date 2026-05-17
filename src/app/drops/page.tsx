import Image from 'next/image';
import { DropCountdown } from '@/components/sections/DropCountdown';
import { getDbDrops } from '@/lib/catalog-db';
import { buildMetadata } from '@/lib/metadata';
import styles from '../pages.module.css';

export const metadata = buildMetadata({
  title: 'Drops',
  description: 'Upcoming and archived REDOXDESIGNX apparel drops. Limited pieces, no restocks.',
  path: '/drops'
});

export default async function DropsPage() {
  const drops = await getDbDrops();
  
  if (drops.length === 0) {
    return (
      <>
        <header className="pageHeader">
          <div className="pageHeaderInner">
            <p className="eyebrow">Drops</p>
            <h1 className="pageTitle">Release pressure.</h1>
            <p className="pageLead">
              New releases go live on a fixed clock. When the run is gone, it enters the archive.
            </p>
          </div>
        </header>
        <section className={styles.section}>
          <div className={styles.inner} style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
            <h2 className="sectionTitle">NO DROPS LAUNCHED YET</h2>
            <p className="sectionCopy" style={{ marginTop: 'var(--space-2)' }}>Check back soon for the next campaign or add drops in the Admin Panel!</p>
          </div>
        </section>
      </>
    );
  }

  const [upcoming, ...archive] = drops;

  return (
    <>
      <header className="pageHeader">
        <div className="pageHeaderInner">
          <p className="eyebrow">Drops</p>
          <h1 className="pageTitle">Release pressure.</h1>
          <p className="pageLead">
            New releases go live on a fixed clock. When the run is gone, it enters the archive.
          </p>
        </div>
      </header>
      <DropCountdown drop={upcoming} />
      <section className={styles.section}>
        <div className={styles.inner}>
          <p className="eyebrow">Archive</p>
          <h2 className="sectionTitle">Past drops</h2>
          <div className={styles.archiveGrid} style={{ marginTop: 'var(--space-7)' }}>
            {archive.map((drop) => (
              <article className={styles.overlayCard} key={drop.slug}>
                <Image alt={drop.summary} fill sizes="(min-width: 900px) 50vw, 100vw" src={drop.image} />
                <div className={styles.overlayContent}>
                  <p className="eyebrow">Sold out / {drop.itemCount} pieces</p>
                  <h3>{drop.name}</h3>
                  <p>{drop.summary}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
