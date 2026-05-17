import { LinkButton } from '@/components/ui/LinkButton';
import styles from './pages.module.css';

export default function NotFound() {
  return (
    <section className={styles.notFound}>
      <div>
        <h1>404</h1>
        <p>This page dropped and never restocked.</p>
        <div className="buttonRow" style={{ justifyContent: 'center' }}>
          <LinkButton href="/">Go home</LinkButton>
          <LinkButton href="/shop" variant="secondary">View shop</LinkButton>
        </div>
      </div>
    </section>
  );
}
