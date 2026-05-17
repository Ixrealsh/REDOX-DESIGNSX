import { ProductCard } from '@/components/product/ProductCard';
import { ArrowRightIcon } from '@/components/ui/Icons';
import { LinkButton } from '@/components/ui/LinkButton';
import type { Product } from '@/types/product';
import styles from './HomeSections.module.css';

interface ProductRailProps {
  products: Product[];
  eyebrow: string;
  title: string;
  copy: string;
}

export function ProductRail({ products, eyebrow, title, copy }: ProductRailProps) {
  return (
    <section className={styles.section}>
      <div className="container">
        <div className={styles.sectionHeader}>
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2 className="sectionTitle">{title}</h2>
            <p className="sectionCopy">{copy}</p>
          </div>
          <LinkButton href="/shop" variant="secondary">
            View shop <ArrowRightIcon />
          </LinkButton>
        </div>
        <div className={styles.grid}>
          {products.map((product, index) => (
            <ProductCard key={product.id} priority={index < 2} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
