import { Star } from 'lucide-react';
import type { ProductCard as ProductCardType } from '../../lib/types';
import { formatBDT, discountPct } from '../../lib/format';
import { Badge } from '../ui/badge';

export function ProductCard({ product }: { product: ProductCardType }) {
  const discount = discountPct(product.price, product.compare_at_price);

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group block rounded-2xl bg-white ring-1 ring-slate-200 hover:ring-brand-300 hover:shadow-md transition overflow-hidden"
    >
      {/* Image */}
      <div className="relative aspect-square bg-slate-100 overflow-hidden">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-3xl font-bold">
            {product.name.charAt(0).toUpperCase()}
          </div>
        )}
        {discount && (
          <span className="absolute top-2 left-2 bg-rose-500 text-white text-[10px] font-bold px-2 py-1 rounded-full">
            -{discount}%
          </span>
        )}
        {!product.in_stock && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <Badge variant="default">Out of stock</Badge>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3 sm:p-4">
        <h3 className="text-sm font-medium text-slate-900 line-clamp-2 mb-1.5 group-hover:text-brand-600 transition">
          {product.name}
        </h3>

        {(product.rating_count ?? 0) > 0 && product.rating_avg != null && (
          <div className="flex items-center gap-1 mb-2 text-xs text-slate-500">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-slate-700">{product.rating_avg.toFixed(1)}</span>
            <span>({product.rating_count})</span>
          </div>
        )}

        <div className="flex items-baseline gap-2">
          <span className="text-base font-bold text-slate-900">{formatBDT(product.price)}</span>
          {product.compare_at_price && product.compare_at_price > product.price && (
            <span className="text-xs text-slate-400 line-through">{formatBDT(product.compare_at_price)}</span>
          )}
        </div>
      </div>
    </a>
  );
}
