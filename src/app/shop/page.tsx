import { ShopGrid } from '@/components/commerce/ShopGrid';
import { collections } from '@/data/catalog';
import { getDbProducts } from '@/lib/catalog-db';
import { buildMetadata } from '@/lib/metadata';

export const metadata = buildMetadata({
  title: 'Shop',
  description: 'Shop limited-run Redox Design hoodies, tees, cargos, outerwear, and accessories.',
  path: '/shop'
});

export default async function ShopPage() {
  const products = await getDbProducts();

  return (
    <>
      <header className="pageHeader">
        <div className="pageHeaderInner">
          <p className="eyebrow">All products</p>
          <h1 className="pageTitle">The current uniform.</h1>
          <p className="pageLead">
            Filter the system by category, collection, or price. Every release is finite.
          </p>
        </div>
      </header>
      <ShopGrid collections={collections} products={products} />
    </>
  );
}
