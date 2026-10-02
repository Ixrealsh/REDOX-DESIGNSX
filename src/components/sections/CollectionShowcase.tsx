import Image from 'next/image';
import type { Collection } from '@/types/product';
import styles from './HomeSections.module.css';

interface CollectionShowcaseProps {
  collections: Collection[];
}

export function CollectionShowcase({ collections }: CollectionShowcaseProps) {
  if (!collections || collections.length === 0) {
    return null;
  }
  const primary = collections[0];

  return (
    <section className={styles.collections}>
      <div className={styles.collectionMedia}>
        <Image alt={primary.description} fill sizes="(min-width: 1024px) 60vw, 100vw" src={primary.image} />
      </div>
      <div className={styles.collectionPanel}>
        <p className="eyebrow">Collections</p>
        <h2 className="sectionTitle">Systems, not outfits.</h2>
        <p className="sectionCopy">
          Each collection is built as a calibrated uniform: a small set of pieces that can carry
          the entire week.
        </p>
        <div className={styles.collectionList}>
          {collections.map((collection) => (
            <div className={styles.collectionItem} key={collection.slug}>
              <strong>{collection.name}</strong>
              <span>{collection.tagline}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
