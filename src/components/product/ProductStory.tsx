'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
import type { Product } from '@/types/product';
import styles from './ProductStory.module.css';

interface ProductStoryProps {
  product: Product;
}

export function ProductStory({ product }: ProductStoryProps) {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cleanup = () => {};

    async function runAnimation() {
      if (!rootRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }

      const { default: gsap } = await import('gsap');
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);

      const context = gsap.context(() => {
        gsap.utils.toArray<HTMLElement>('[data-story-panel]').forEach((panel) => {
          const image = panel.querySelector('[data-story-image]');
          const copy = panel.querySelector('[data-story-copy]');

          gsap.fromTo(
            image,
            { opacity: 0, y: 36, scale: 0.96 },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              scrollTrigger: { trigger: panel, start: 'top 70%', end: 'center 45%', scrub: true }
            }
          );
          gsap.fromTo(
            copy,
            { opacity: 0, x: -36 },
            {
              opacity: 1,
              x: 0,
              scrollTrigger: { trigger: panel, start: 'top 68%', end: 'center 42%', scrub: true }
            }
          );
        });
      }, rootRef);

      cleanup = () => context.revert();
    }

    runAnimation();
    return () => cleanup();
  }, []);

  return (
    <section className={styles.story} ref={rootRef}>
      <div className={styles.panel} data-story-panel>
        <div className={styles.media} data-story-image>
          <Image alt={`${product.name} material detail`} fill sizes="(min-width: 860px) 45vw, 100vw" src={product.secondaryImage} />
        </div>
        <div className={styles.copy} data-story-copy>
          <p className="eyebrow">Construction</p>
          <h2>Cold-washed. Preshrunk. Built to hold.</h2>
          <p>{product.material} shaped through Redox pattern discipline and reinforced where the garment takes stress.</p>
          <div className={styles.callouts}>
            {product.details.slice(0, 3).map((detail) => (
              <span className={styles.callout} key={detail}>{detail}</span>
            ))}
          </div>
        </div>
      </div>
      <div className={styles.panel} data-story-panel>
        <div className={styles.copy} data-story-copy>
          <p className="eyebrow">Use case</p>
          <h2>Quiet in shape. Heavy in presence.</h2>
          <p>{product.story}</p>
          <div className={styles.callouts}>
            <span className={styles.callout}>Limited production run</span>
            <span className={styles.callout}>No planned restock</span>
            <span className={styles.callout}>Designed for daily rotation</span>
          </div>
        </div>
        <div className={styles.media} data-story-image>
          <Image alt={`${product.name} editorial styling`} fill sizes="(min-width: 860px) 45vw, 100vw" src="https://res.cloudinary.com/dti75gff0/image/upload/v1779032147/redox_designsx/underpass_editorial.png" />
        </div>
      </div>
    </section>
  );
}
