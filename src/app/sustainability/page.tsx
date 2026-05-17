import { buildMetadata } from '@/lib/metadata';
import styles from '../pages.module.css';

export const metadata = buildMetadata({
  title: 'Sustainability',
  description: 'Redox Design material responsibility, limited production, and care philosophy.',
  path: '/sustainability'
});

export default function SustainabilityPage() {
  return (
    <>
      <header className="pageHeader">
        <div className="pageHeaderInner">
          <p className="eyebrow">Responsibility</p>
          <h1 className="pageTitle">Make less. Make it hold.</h1>
          <p className="pageLead">
            Our sustainability position is direct: finite production, better materials, repairable
            construction, and garments intended for long rotation.
          </p>
        </div>
      </header>
      <section className={styles.section}>
        <div className={`${styles.inner} ${styles.grid}`}>
          {[
            ['Limited runs', 'We avoid speculative overproduction by releasing focused, numbered drops.'],
            ['Material discipline', 'Cotton is selected for density, recovery, and wash behavior before it is selected for novelty.'],
            ['Care as design', 'Every piece ships with care instructions meant to extend life instead of hiding it.']
          ].map(([title, copy]) => (
            <article className={styles.panel} key={title}>
              <h2>{title}</h2>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
