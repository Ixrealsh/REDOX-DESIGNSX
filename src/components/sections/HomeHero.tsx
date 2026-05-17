import Image from 'next/image';
import { ArrowRightIcon } from '@/components/ui/Icons';
import { LinkButton } from '@/components/ui/LinkButton';
import styles from './HomeSections.module.css';

export function HomeHero() {
  return (
    <section className={styles.hero}>
      <Image
        alt="REDOXDESIGNX dark streetwear campaign with models in black technical apparel"
        className={styles.heroImage}
        fill
        priority
        sizes="100vw"
        src="https://res.cloudinary.com/dti75gff0/image/upload/v1779032145/redox_designsx/redox_hero.png"
      />
      <div className={styles.heroScrim} />
      <div className={styles.heroContent}>
        <p className={styles.heroKicker}>Drop 012 / Night Lab / June 21</p>
        <h1 className={styles.heroTitle}>Chemical precision. Street tension.</h1>
        <p className={styles.heroCopy}>
          Limited-run apparel engineered through heavyweight fabric, restrained red, and a
          no-restock discipline.
        </p>
        <div className={`buttonRow ${styles.heroActions}`}>
          <LinkButton href="/shop">
            Shop latest <ArrowRightIcon />
          </LinkButton>
          <LinkButton href="/lookbook" variant="secondary">
            View lookbook
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
