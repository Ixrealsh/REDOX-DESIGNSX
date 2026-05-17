import styles from './Badge.module.css';

const classMap = {
  NEW: styles.new,
  SALE: styles.sale,
  LIMITED: styles.limited,
  'SOLD OUT': styles.soldOut,
  'COMING SOON': styles.comingSoon
} as const;

interface BadgeProps {
  label: keyof typeof classMap;
}

export function Badge({ label }: BadgeProps) {
  return <span className={`${styles.badge} ${classMap[label]}`}>{label}</span>;
}
