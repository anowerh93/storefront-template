import { ArrowRight } from 'lucide-react';
import type { ProductCard } from '../../lib/types';
import { formatBDT, discountPct } from '../../lib/format';

/**
 * Hero — a big promotional banner on the left + two vivid product tiles
 * stacked on the right (inspired by the Shopwise-style storefront hero).
 *
 * Product-driven: the banner + tiles use the tenant's featured products
 * (image, name, price, discount), so it auto-fills with no manual banner
 * uploads. Falls back to a clean placeholder when there are no featured
 * products yet.
 *
 * Key visual upgrades over the old version:
 *  - Full-colour product images (dropped the mix-blend-luminosity that
 *    washed them out into the panel colour).
 *  - "Get N% Off" eyebrow auto-computed from compare-at price.
 *  - Two CTAs (Shop Now + Browse all), like the reference.
 *  - Brand-coloured big banner (uses the tenant's --color-brand-*), vivid
 *    amber/sky tiles on the right.
 */
export function HeroGrid({
  featured,
  eyebrow,
}: {
  featured: ProductCard[];
  /** Tenant-customizable text above the hero headline (fallback when no discount). */
  eyebrow?: string;
}) {
  const big = featured[0];
  const tiles = featured.slice(1, 3);

  return (
    <section className="mx-auto max-w-[1280px] px-4 sm:px-6 mt-5">
      <div className="grid lg:grid-cols-[2fr_1fr] gap-4 lg:gap-5">
        {/* ── Big banner ── */}
        {big ? <BigBanner product={big} eyebrow={eyebrow} /> : <BigPlaceholder />}

        {/* ── Two stacked tiles ── */}
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-4 lg:gap-5">
          {tiles[0] ? <PromoTile product={tiles[0]} tone="amber" /> : <TilePlaceholder tone="amber" />}
          {tiles[1] ? <PromoTile product={tiles[1]} tone="sky" /> : <TilePlaceholder tone="sky" />}
        </div>
      </div>
    </section>
  );
}

function BigBanner({ product, eyebrow }: { product: ProductCard; eyebrow?: string }) {
  const off = discountPct(product.price, product.compare_at_price ?? null);
  const badge = off ? `Get ${off}% Off` : (eyebrow || 'Featured');

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white min-h-[320px] sm:min-h-[440px]">
      <div className="relative z-10 flex h-full flex-col justify-center p-6 sm:p-10 max-w-[62%] sm:max-w-[55%]">
        <span className="inline-block w-fit text-[11px] uppercase tracking-wider font-bold bg-white/20 backdrop-blur px-3 py-1 rounded-full">
          {badge}
        </span>
        <h1 className="mt-4 text-2xl sm:text-4xl lg:text-5xl font-extrabold leading-tight">
          {product.name}
        </h1>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold">{formatBDT(product.price)}</span>
          {product.compare_at_price && Number(product.compare_at_price) > Number(product.price) && (
            <span className="text-sm text-white/70 line-through">{formatBDT(Number(product.compare_at_price))}</span>
          )}
        </div>
        <div className="mt-5 sm:mt-6 flex flex-wrap items-center gap-3">
          <a
            href={`/products/${product.slug}`}
            className="inline-flex items-center gap-2 bg-white text-slate-900 hover:bg-slate-100 transition font-bold text-sm px-5 py-2.5 rounded-full"
          >
            Shop Now <ArrowRight className="h-3.5 w-3.5" />
          </a>
          <a
            href="/products"
            className="inline-flex items-center font-semibold text-sm px-5 py-2.5 rounded-full ring-1 ring-white/40 hover:bg-white/10 transition"
          >
            Browse all
          </a>
        </div>
        {/* Decorative slider dots — matches the reference look. */}
        <div className="mt-6 hidden sm:flex items-center gap-1.5">
          <span className="h-2 w-6 rounded-full bg-white/90" />
          <span className="h-2 w-2 rounded-full bg-white/40" />
          <span className="h-2 w-2 rounded-full bg-white/40" />
        </div>
      </div>

      {product.image_url && (
        // object-CONTAIN, not cover: product images are square (and demo
        // placeholders are labelled cards) — cover would slice them. Contain
        // shows the whole image, full colour, floating on the brand panel.
        <img
          src={product.image_url}
          alt={product.name}
          loading="eager"
          className="pointer-events-none absolute right-0 top-0 h-full w-[42%] sm:w-[46%] object-contain object-center p-4 sm:p-6"
        />
      )}
    </div>
  );
}

function PromoTile({ product, tone }: { product: ProductCard; tone: 'amber' | 'sky' }) {
  const cls = {
    amber: 'from-orange-500 to-amber-500',
    sky:   'from-sky-500 to-indigo-600',
  }[tone];

  return (
    <a
      href={`/products/${product.slug}`}
      className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${cls} text-white min-h-[150px] sm:min-h-[170px] lg:min-h-[210px] flex`}
    >
      <div className="relative z-10 flex flex-col justify-center p-4 sm:p-5 max-w-[60%]">
        <h3 className="font-bold leading-tight text-sm sm:text-base line-clamp-2">{product.name}</h3>
        <p className="mt-1 text-base sm:text-lg font-extrabold">{formatBDT(product.price)}</p>
        <span className="mt-2 inline-flex w-fit items-center gap-1 text-[11px] font-semibold bg-white/20 backdrop-blur px-2.5 py-1 rounded-full">
          Shop now <ArrowRight className="h-3 w-3" />
        </span>
      </div>
      {product.image_url && (
        <img
          src={product.image_url}
          alt={product.name}
          loading="lazy"
          className="pointer-events-none absolute right-0 top-0 h-full w-[40%] object-contain object-center p-2.5 group-hover:scale-105 transition-transform duration-500"
        />
      )}
    </a>
  );
}

function BigPlaceholder() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white p-6 sm:p-10 min-h-[320px] sm:min-h-[440px] flex items-center">
      <div className="max-w-sm">
        <span className="inline-block text-[11px] uppercase tracking-wider font-bold bg-white/20 backdrop-blur px-3 py-1 rounded-full">
          Welcome
        </span>
        <h1 className="mt-4 text-3xl sm:text-5xl font-extrabold leading-tight">Add your first product</h1>
        <p className="mt-3 text-sm text-white/80">Featured products appear here once you add them in the dashboard.</p>
        <a href="/products" className="mt-5 inline-flex items-center gap-2 bg-white text-slate-900 font-bold text-sm px-5 py-2.5 rounded-full">
          Browse all <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

function TilePlaceholder({ tone }: { tone: 'amber' | 'sky' }) {
  const cls = { amber: 'from-orange-500 to-amber-500', sky: 'from-sky-500 to-indigo-600' }[tone];
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${cls} min-h-[150px] sm:min-h-[170px] lg:min-h-[210px] flex items-center justify-center text-white/70 text-sm p-4 text-center`}>
      Featured slot
    </div>
  );
}
