import { buildMetadata } from '@/lib/metadata';
import styles from '../pages.module.css';

export const metadata = buildMetadata({
  title: 'Size Guide',
  description: 'REDOXDESIGNX apparel measurements, fit notes, and size tables.',
  path: '/size-guide'
});

const tops = [
  ['XS', '34-36', '28-30', '25'],
  ['S', '36-38', '30-32', '26'],
  ['M', '38-40', '32-34', '27'],
  ['L', '40-42', '34-36', '28'],
  ['XL', '42-45', '36-39', '29']
];

export default function SizeGuidePage() {
  return (
    <>
      <header className="pageHeader">
        <div className="pageHeaderInner">
          <p className="eyebrow">Fit system</p>
          <h1 className="pageTitle">Measure twice. Drop once.</h1>
          <p className="pageLead">
            Redox tops run true to size with a boxy streetwear fit. If between sizes, size up.
          </p>
        </div>
      </header>
      <section className={styles.section}>
        <div className={`${styles.inner} ${styles.split}`}>
          <div className={styles.panel}>
            <h2>How to measure</h2>
            <ul>
              <li>Chest: measure around the fullest part of the chest.</li>
              <li>Waist: measure where your waistband naturally sits.</li>
              <li>Length: measure from high shoulder point to hem.</li>
              <li>Inseam: measure inside leg from crotch seam to hem.</li>
            </ul>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className="srOnly">Tops size guide in inches</caption>
              <thead>
                <tr>
                  <th>Size</th>
                  <th>Chest</th>
                  <th>Waist</th>
                  <th>Body length</th>
                </tr>
              </thead>
              <tbody>
                {tops.map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell) => (
                      <td key={cell}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
