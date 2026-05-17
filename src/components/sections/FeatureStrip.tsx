import { LockIcon, ReturnIcon, StarIcon, TruckIcon } from '@/components/ui/Icons';
import styles from './HomeSections.module.css';

const features = [
  { title: 'Free delivery', copy: 'Over GH₵100', icon: TruckIcon },
  { title: 'Zero restocks', copy: 'Limited runs', icon: StarIcon },
  { title: 'Easy returns', copy: '14 day window', icon: ReturnIcon },
  { title: 'Secure checkout', copy: 'Shopify ready', icon: LockIcon }
];

export function FeatureStrip() {
  return (
    <section aria-label="Store guarantees" className={styles.ticker}>
      {features.map((feature) => {
        const Icon = feature.icon;

        return (
          <div className={styles.tickerItem} key={feature.title}>
            <Icon />
            <div>
              <p className={styles.tickerTitle}>{feature.title}</p>
              <p className={styles.tickerCopy}>{feature.copy}</p>
            </div>
          </div>
        );
      })}
    </section>
  );
}
