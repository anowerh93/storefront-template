import { ArrowRight } from 'lucide-react';
import type { ProductCard as ProductCardType } from '../../lib/types';
import { ProductCard } from '../product/product-card';

/**
 * Reusable section: "Title — View All" + 4–8 product card grid.
 * Used for "Feature Products", "Most Selling Products", "Trending Products".
 */
export function ProductRow({
  title,
  products,
  viewAllHref = '/products',
  subtitle,
  cols = 5,
}: {
  title: string;
  products: ProductCardType[];
  viewAllHref?: string;
  subtitle?: string;
  cols?: 4 | 5 | 6;
}) {
  if (products.length === 0) return null;

  const gridCls = {
    4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6',
  }[cols];

  return (
    <section className="mx-auto max-w-[1280px] px-4 sm:px-6 mt-10">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <a href={viewAllHref} className="text-sm font-medium text-slate-600 hover:text-brand-600 inline-flex items-center gap-1">
          View All <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className={`grid ${gridCls} gap-3 sm:gap-4`}>
        {products.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  );
}
