import { ShopGrid } from '@/components/commerce/ShopGrid';
import { Button } from '@/components/ui/Button';
import { collections, products } from '@/data/catalog';
import { buildMetadata } from '@/lib/metadata';
import styles from '../pages.module.css';

interface SearchPageProps {
  searchParams?: { q?: string };
}

export const metadata = buildMetadata({
  title: 'Search',
  description: 'Search Redox Design products and collections.',
  path: '/search'
});

export default function SearchPage({ searchParams }: SearchPageProps) {
  const query = searchParams?.q || '';

  return (
    <>
      <header className="pageHeader">
        <div className="pageHeaderInner">
          <p className="eyebrow">Search</p>
          <h1 className="pageTitle">{query ? `Results for ${query}` : 'Find the piece.'}</h1>
          <p className="pageLead">Search hoodie, cargo, tee, black, red, or a collection name.</p>
        </div>
      </header>
      <section className={styles.section} style={{ paddingBottom: 0 }}>
        <div className={styles.tight}>
          <form action="/search" className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="q">Search term</label>
              <input defaultValue={query} id="q" name="q" placeholder="black hoodie" />
            </div>
            <Button type="submit">Search</Button>
          </form>
        </div>
      </section>
      <ShopGrid collections={collections} products={products} searchQuery={query} />
    </>
  );
}
