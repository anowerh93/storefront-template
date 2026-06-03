import { ArrowRight } from 'lucide-react';
import type { ProductCard } from '../../lib/types';
import { formatBDT, discountPct } from '../../lib/format';

/**
 * Hero — split-panel banner on the left (solid brand-colour text panel +
 * CLEAN product image beside it) and two product tiles stacked on the right.
 *
 * No image overlays/scrims anywhere: the photo is shown in its true colours
 * and the text lives on a solid brand panel (big banner) or a white info bar
 * (tiles), so nothing tints the product image. Brand colour comes from the
 * tenant's theme via the `brand-*` palette.
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
      className="group grid grid-cols-1 sm:grid-cols-2 overflow-hidden rounded-2xl min-h-[300px] sm:min-h-[420px] bg-brand-600"
    >
      {/* Text panel — solid brand colour, no image behind it */}
      <div className="order-2 sm:order-1 flex flex-col justify-center p-6 sm:p-10 text-white bg-gradient-to-br from-brand-600 to-brand-700">
        <span className="inline-block w-fit text-[11px] sm:text-xs uppercase tracking-wider font-bold bg-white/20 px-3 py-1 rounded-full">
          {badge}
        </span>
        <h1 className="mt-4 text-2xl sm:text-4xl lg:text-5xl font-extrabold leading-[1.1]">
          {product.name}
        </h1>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold">{formatBDT(product.price)}</span>
          {product.compare_at_price && Number(product.compare_at_price) > Number(product.price) && (
            <span className="text-sm text-white/70 line-through">{formatBDT(Number(product.compare_at_price))}</span>
          )}
        </div>
        <div className="mt-5 sm:mt-6 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 bg-white text-brand-700 font-bold text-sm px-5 py-2.5 rounded-full group-hover:bg-brand-50 transition">
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

      {/* Clean product image — no overlay/scrim */}
      <div className="order-1 sm:order-2 relative min-h-[220px] sm:min-h-0 bg-brand-50">
        {product.image_url && (
          <img
            src={product.image_url}
            alt={product.name}
            loading="eager"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        )}
      </div>
    </a>
  );
}

function Tile({ product }: { product: ProductCard }) {
  const off = discountPct(product.price, product.compare_at_price ?? null);
  return (
    <a
      href={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl min-h-[150px] sm:min-h-[175px] lg:min-h-[202px] bg-white border border-slate-200/70 hover:shadow-md transition"
    >
      {/* Clean image — no overlay */}
      <div className="relative flex-1 min-h-[96px] bg-slate-100">
        {product.image_url && (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
        {off && (
          <span className="absolute top-2.5 left-2.5 bg-rose-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
            -{off}%
          </span>
        )}
      </div>

      {/* White info bar — brand-coloured price + Shop button */}
      <div className="p-3 sm:p-3.5">
        <h3 className="font-bold leading-tight text-sm line-clamp-1 text-slate-900">{product.name}</h3>
        <div className="mt-1 flex items-center justify-between">
          <p className="text-base font-extrabold text-brand-700">{formatBDT(product.price)}</p>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-brand-600 group-hover:bg-brand-700 text-white px-2.5 py-1 rounded-full transition">
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
        <span className="inline-block text-[11px] uppercase tracking-wider font-bold bg-white/20 px-3 py-1 rounded-full">Welcome</span>
        <h1 className="mt-4 text-3xl sm:text-5xl font-extrabold leading-tight">Add your first product</h1>
        <p className="mt-3 text-sm text-white/80">Featured products appear here once you add them in the dashboard.</p>
        <a href="/products" className="mt-5 inline-flex items-center gap-2 bg-white text-brand-700 font-bold text-sm px-5 py-2.5 rounded-full">
          Browse all <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

function TilePlaceholder() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 min-h-[150px] sm:min-h-[175px] lg:min-h-[202px] flex items-center justify-center text-slate-500 text-sm p-4 text-center">
      Featured slot
    </div>
  );
}
