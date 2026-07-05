import { ArrowRight, Apple, Cookie, Coffee, GlassWater, Package, Sandwich, Carrot, Leaf } from 'lucide-react';
import type { Category } from '../../lib/types';
import { cdnImage } from '../../lib/img';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  snacks:     Cookie,
  breakfast:  Sandwich,
  drinks:     GlassWater,
  coffee:     Coffee,
  canned:     Package,
  fruits:     Apple,
  vegetable:  Carrot,
  vegetables: Carrot,
  organic:    Leaf,
};

const TILE_COLORS = [
  'from-orange-100 to-orange-200 text-orange-700',
  'from-amber-100 to-amber-200 text-amber-700',
  'from-blue-100 to-blue-200 text-blue-700',
  'from-yellow-100 to-yellow-200 text-yellow-700',
  'from-pink-100 to-pink-200 text-pink-700',
  'from-rose-100 to-rose-200 text-rose-700',
  'from-brand-100 to-brand-200 text-brand-700',
  'from-purple-100 to-purple-200 text-purple-700',
];

export function CategoryStrip({
  categories,
  title = 'Categories',
}: {
  categories: Category[];
  title?: string;
}) {
  if (categories.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1280px] px-4 sm:px-6 mt-10">
      <div className="flex items-end justify-between mb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{title}</h2>
        <a href="/categories" className="text-sm font-medium text-slate-600 hover:text-brand-600 inline-flex items-center gap-1">
          View All <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
        {categories.slice(0, 8).map((c, i) => {
          const Icon = ICON_MAP[c.slug.toLowerCase()] ?? Package;
          const tileCls = TILE_COLORS[i % TILE_COLORS.length];
          return (
            <a
              key={c.slug}
              href={`/categories/${c.slug}`}
              className={`group flex flex-col items-center justify-center gap-2 rounded-2xl bg-gradient-to-br ${tileCls} aspect-square p-3 hover:shadow-md hover:-translate-y-0.5 transition`}
            >
              {c.image_url ? (
                // Tenant's uploaded category image takes precedence over the
                // generated icon so their branding shows on the storefront.
                <img src={cdnImage(c.image_url, 144)} alt={c.name} loading="lazy"
                     className="h-9 w-9 sm:h-11 sm:w-11 object-contain" />
              ) : (
                <Icon className="h-8 w-8 sm:h-10 sm:w-10" />
              )}
              <span className="text-xs sm:text-sm font-semibold text-slate-900 line-clamp-1 text-center">{c.name}</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
