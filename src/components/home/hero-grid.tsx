import { ArrowRight } from 'lucide-react';
import type { ProductCard } from '../../lib/types';
import { formatBDT, discountPct } from '../../lib/format';

/**
 * Hero — full-bleed promo banner on the left + two full-bleed product tiles
 * stacked on the right, matching the Shopwise-style reference.
 *
 * Every panel uses a FULL-CONTAINER image (object-cover, absolute inset-0)
 * with a gradient scrim so the overlaid text stays readable — no contained/
 * letterboxed images, no empty colour boxes. Product-driven (featured
 * product_ids), so it auto-fills; real product photos (or the demo's stock
 * photos) fill the frame edge-to-edge.
 */
export function HeroGrid({
  featured,
  eyebrow,
}: {
  featured: ProductCard[];
  eyebrow?: string;
}) {
  const big = featured[0];
  const tiles = featured.slice(1, 3);

  return (
    <section className="mx-auto max-w-[1280px] px-4 sm:px-6 mt-5">
      <div className="grid lg:grid-cols-[1.9fr_1fr] gap-4 lg:gap-5">
        {big ? <BigBanner product={big} eyebrow={eyebrow} /> : <BannerPlaceholder />}

        <div className="grid grid-cols-2 lg:grid-cols-1 gap-4 lg:gap-5">
          {tiles[0] ? <Tile product={tiles[0]} /> : <TilePlaceholder />}
          {tiles[1] ? <Tile product={tiles[1]} /> : <TilePlaceholder />}
        </div>
      </div>
    </section>
  );
}

function BigBanner({ product, eyebrow }: { product: ProductCard; eyebrow?: string }) {
  const off = discountPct(product.price, product.compare_at_price ?? null);
  const badge = off ? `Get ${off}% Off` : (eyebrow || 'Featured');

  return (
    <a
      href={`/products/${product.slug}`}
      className="group relative block overflow-hidden rounded-2xl min-h-[300px] sm:min-h-[420px] bg-brand-700"
    >
      {/* Full-container image */}
      {product.image_url && (
        <img
          src={product.image_url}
          alt={product.name}
          loading="eager"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      )}
      {/* Scrim: opaque brand on the left for text → clear on the right for the photo */}
      <div className="absolute inset-0 bg-gradient-to-r from-brand-900/95 via-brand-800/70 to-brand-900/10" />

      <div className="relative z-10 flex h-full flex-col justify-center p-6 sm:p-10 max-w-[78%] sm:max-w-[58%] text-white">
        <span className="inline-block w-fit text-[11px] sm:text-xs uppercase tracking-wider font-bold bg-white/20 backdrop-blur px-3 py-1 rounded-full">
          {badge}
        </span>
        <h1 className="mt-4 text-2xl sm:text-4xl lg:text-5xl font-extrabold leading-[1.1] drop-shadow-sm">
          {product.name}
        </h1>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold">{formatBDT(product.price)}</span>
          {product.compare_at_price && Number(product.compare_at_price) > Number(product.price) && (
            <span className="text-sm text-white/70 line-through">{formatBDT(Number(product.compare_at_price))}</span>
          )}
        </div>
        <div className="mt-5 sm:mt-6 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 bg-white text-slate-900 font-bold text-sm px-5 py-2.5 rounded-full group-hover:bg-amber-300 transition">
            Shop Now <ArrowRight className="h-3.5 w-3.5" />
          </span>
          <span className="inline-flex items-center font-semibold text-sm px-5 py-2.5 rounded-full ring-1 ring-white/50 hover:bg-white/10 transition">
            View all
          </span>
        </div>
        <div className="mt-6 hidden sm:flex items-center gap-1.5">
          <span className="h-2 w-6 rounded-full bg-white/90" />
          <span className="h-2 w-2 rounded-full bg-white/40" />
          <span className="h-2 w-2 rounded-full bg-white/40" />
        </div>
      </div>
    </a>
  );
}

function Tile({ product }: { product: ProductCard }) {
  const off = discountPct(product.price, product.compare_at_price ?? null);
  return (
    <a
      href={`/products/${product.slug}`}
      className="group relative block overflow-hidden rounded-2xl min-h-[150px] sm:min-h-[175px] lg:min-h-[202px] bg-slate-800"
    >
      {product.image_url && (
        <img
          src={product.image_url}
          alt={product.name}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      )}
      {/* Bottom-up scrim so the title/price read over any photo */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      {off && (
        <span className="absolute top-2.5 left-2.5 z-10 bg-rose-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
          -{off}%
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 z-10 p-3.5 sm:p-4 text-white">
        <h3 className="font-bold leading-tight text-sm sm:text-base line-clamp-2 drop-shadow">{product.name}</h3>
        <div className="mt-1 flex items-center justify-between">
          <p className="text-base sm:text-lg font-extrabold drop-shadow">{formatBDT(product.price)}</p>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-white/25 backdrop-blur px-2.5 py-1 rounded-full">
            Shop <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    </a>
  );
}

function BannerPlaceholder() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white p-6 sm:p-10 min-h-[300px] sm:min-h-[420px] flex items-center">
      <div className="max-w-sm">
        <span className="inline-block text-[11px] uppercase tracking-wider font-bold bg-white/20 backdrop-blur px-3 py-1 rounded-full">Welcome</span>
        <h1 className="mt-4 text-3xl sm:text-5xl font-extrabold leading-tight">Add your first product</h1>
        <p className="mt-3 text-sm text-white/80">Featured products appear here once you add them in the dashboard.</p>
        <a href="/products" className="mt-5 inline-flex items-center gap-2 bg-white text-slate-900 font-bold text-sm px-5 py-2.5 rounded-full">
          Browse all <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

function TilePlaceholder() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-300 to-slate-400 min-h-[150px] sm:min-h-[175px] lg:min-h-[202px] flex items-center justify-center text-white/80 text-sm p-4 text-center">
      Featured slot
    </div>
  );
}
