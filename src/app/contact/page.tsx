import { ContactForm } from '@/components/commerce/ContactForm';
import { MailIcon, MapPinIcon, PhoneIcon } from '@/components/ui/Icons';
import { buildMetadata } from '@/lib/metadata';
import styles from '../pages.module.css';

export const metadata = buildMetadata({
  title: 'Contact',
  description: 'Contact REDOXDESIGNX for orders, sizing, press, and wholesale.',
  path: '/contact'
});

export default function ContactPage() {
  return (
    <>
      <header className="pageHeader">
        <div className="pageHeaderInner">
          <p className="eyebrow">Contact</p>
          <h1 className="pageTitle">Signal received.</h1>
          <p className="pageLead">For order support, sizing guidance, press, and wholesale inquiries.</p>
        </div>
      </header>
      <section className={styles.section}>
        <div className={`${styles.inner} ${styles.split}`}>
          <div className={styles.panel}>
            <h2>Studio channels</h2>
            <p><MailIcon /> support@redoxdesign.com</p>
            <p><MapPinIcon /> Accra / New York / Remote studio</p>
            <p><PhoneIcon /> Response window: 2 business days</p>
          </div>
          <div className={styles.panel}>
            <ContactForm />
          </div>
        </div>
      </section>
    </>
  );
}
