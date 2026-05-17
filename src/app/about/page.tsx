import Image from 'next/image';
import { buildMetadata } from '@/lib/metadata';
import styles from '../pages.module.css';

export const metadata = buildMetadata({
  title: 'About',
  description: 'The Redox Design origin story, manifesto, and brand values.',
  path: '/about'
});

export default function AboutPage() {
  return (
    <>
      <header className="pageHeader">
        <div className="pageHeaderInner">
          <p className="eyebrow">About</p>
          <h1 className="pageTitle">We are Redox.</h1>
          <p className="pageLead">
            A clothing brand built on transformation: raw street culture refined into deliberate,
            wearable design.
          </p>
        </div>
      </header>
      <section className={styles.section}>
        <div className={`${styles.inner} ${styles.split}`}>
          <div className={styles.imageCard}>
            <Image alt="Redox Design campaign models in dark apparel" fill sizes="(min-width: 1040px) 50vw, 100vw" src="/assets/images/campaigns/redox-hero.png" />
          </div>
          <div className={styles.panel}>
            <h2>Chemical precision. Street tension.</h2>
            <p>
              Redox began as a study in how clothing changes a room before a word is said. We make
              garments that feel intentional, tactile, and stripped of anything decorative that
              does not earn its place.
            </p>
            <p>
              The result is contemporary streetwear with a laboratory mindset: fabric weight,
              proportion, pocket logic, wash, and silhouette all tested until the piece holds.
            </p>
          </div>
        </div>
      </section>
      <section className={styles.section}>
        <div className={`${styles.tight} ${styles.manifesto}`}>
          <p>We believe clothes are language.</p>
          <p>Every piece is a sentence.</p>
          <p>We do not dress the crowd.</p>
          <p>We dress the individual.</p>
        </div>
      </section>
      <section className={styles.section}>
        <div className={styles.inner}>
          <div className={styles.statGrid}>
            <div className={styles.stat}><strong>12</strong><span>Drops</span></div>
            <div className={styles.stat}><strong>40K+</strong><span>Units sold</span></div>
            <div className={styles.stat}><strong>80</strong><span>Countries</span></div>
            <div className={styles.stat}><strong>0</strong><span>Restocks</span></div>
          </div>
        </div>
      </section>
    </>
  );
}
