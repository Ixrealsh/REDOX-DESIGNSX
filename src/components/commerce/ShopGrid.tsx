'use client';

import { useMemo, useState } from 'react';
import { ProductCard } from '@/components/product/ProductCard';
import { Button } from '@/components/ui/Button';
import { SlidersIcon, XIcon } from '@/components/ui/Icons';
import type { Collection, Product, ProductCategory } from '@/types/product';
import styles from './ShopGrid.module.css';

interface ShopGridProps {
  products: Product[];
  collections: Collection[];
  initialCollection?: string;
  searchQuery?: string;
}

export function ShopGrid({ products, collections, initialCollection = 'All', searchQuery = '' }: ShopGridProps) {
  const [category, setCategory] = useState<string>('All');
  const [collection, setCollection] = useState(initialCollection);
  const [sort, setSort] = useState('featured');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const categories = useMemo(() => {
    const list = new Set(products.map((p) => p.category).filter(Boolean));
    return ['All', ...Array.from(list)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const nextProducts = products
      .filter((product) => (category === 'All' ? true : product.category === category))
      .filter((product) => (collection === 'All' ? true : product.collectionSlug === collection))
      .filter((product) => {
        if (!query) {
          return true;
        }

        return [product.name, product.collectionName, product.category, product.description]
          .join(' ')
          .toLowerCase()
          .includes(query);
      });

    return [...nextProducts].sort((a, b) => {
      if (sort === 'price-asc') return a.price - b.price;
      if (sort === 'price-desc') return b.price - a.price;
      if (sort === 'newest') return a.badge === 'NEW' ? -1 : 1;
      return 0;
    });
  }, [category, collection, products, searchQuery, sort]);

  const filters = (
    <>
      <div className={styles.filterGroup}>
        <h2 className={styles.filterTitle}>Category</h2>
        {categories.map((item) => (
          <button
            className={`${styles.filterButton} ${category === item ? styles.filterActive : ''}`}
            key={item}
            onClick={() => setCategory(item)}
            type="button"
          >
            {item}
          </button>
        ))}
      </div>
      <div className={styles.filterGroup}>
        <h2 className={styles.filterTitle}>Collection</h2>
        <button
          className={`${styles.filterButton} ${collection === 'All' ? styles.filterActive : ''}`}
          onClick={() => setCollection('All')}
          type="button"
        >
          All
        </button>
        {collections.map((item) => (
          <button
            className={`${styles.filterButton} ${collection === item.slug ? styles.filterActive : ''}`}
            key={item.slug}
            onClick={() => setCollection(item.slug)}
            type="button"
          >
            {item.name}
          </button>
        ))}
      </div>
      <div className={styles.filterGroup}>
        <h2 className={styles.filterTitle}>Sort</h2>
        <select className={styles.sortSelect} onChange={(event) => setSort(event.target.value)} value={sort}>
          <option value="featured">Featured</option>
          <option value="newest">Newest</option>
          <option value="price-asc">Price: Low to high</option>
          <option value="price-desc">Price: High to low</option>
        </select>
      </div>
    </>
  );

  return (
    <section className={styles.shop}>
      <aside className={`${styles.sidebar} ${filtersOpen ? styles.sidebarOpen : ''}`} aria-label="Product filters">
        {filtersOpen ? (
          <Button onClick={() => setFiltersOpen(false)} variant="secondary">
            <XIcon /> Close filters
          </Button>
        ) : null}
        {filters}
      </aside>
      <div className={styles.content}>
        <div className={styles.toolbar}>
          <p className={styles.resultCount}>
            Showing {filteredProducts.length} of {products.length} pieces
          </p>
          <Button className={styles.mobileFilter} onClick={() => setFiltersOpen(true)} variant="secondary">
            <SlidersIcon /> Filters
          </Button>
        </div>
        {filteredProducts.length > 0 ? (
          <div className={styles.grid}>
            {filteredProducts.map((product, index) => (
              <ProductCard key={product.id} priority={index < 2} product={product} />
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <h2>No pieces found</h2>
            <p>Reset a filter or search for hoodie, cargo, tee, black, or red.</p>
            <Button
              onClick={() => {
                setCategory('All');
                setCollection('All');
              }}
              variant="secondary"
            >
              Reset filters
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
