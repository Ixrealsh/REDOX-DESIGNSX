import styles from './AnnouncementBar.module.css';

export function AnnouncementBar() {
  return (
    <div className={styles.bar} role="status">
      <div className={styles.inner}>
        <span>Free shipping over GH₵100</span>
        <span className={styles.divider}>/</span>
        <span className={styles.hideMobile}>Drop 012 releases June 21</span>
        <span className={styles.divider}>/</span>
        <span className={styles.hideMobile}>No restocks</span>
      </div>
    </div>
  );
}
