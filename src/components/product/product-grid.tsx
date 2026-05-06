import type { ProductCard as ProductCardType } from '../../lib/types';
import { ProductCard } from './product-card';

export function ProductGrid({ products }: { products: ProductCardType[] }) {
  if (products.length === 0) {
    return (
      <div className="text-center py-16 text-slate-500">
        <p>No products yet. Check back soon!</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
