import { ArrowRight } from 'lucide-react';
import type { ProductCard, HomepageConfig } from '../../lib/types';
import { formatBDT, discountPct } from '../../lib/format';
import { FitImage } from '../ui/fit-image';

/**
 * Hero — big banner on the left + two tiles stacked on the right (Shopwise
 * layout). The hero ALWAYS renders in the full-bleed designed style — a
 * full-cover image with the copy overlaid on a light left-only legibility
 * gradient. Two content sources, decided per slot:
 *
 *   • CONFIGURED — the merchant uploaded a banner/tile image in Storefront →
 *     Customization. Uses their headline + buttons.
 *   • PRODUCT (default) — no upload yet, so we use the featured product's own
 *     image as the banner background and overlay its name + price. This means
 *     a brand-new store looks like the reference out of the box, with no setup.
 *
 * Each slot falls back independently, so a merchant can mix a designed banner
 * with product tiles, or vice-versa.
 */
export function HeroGrid({
  featured,
  hero,
}: {
  featured: ProductCard[];
  hero: HomepageConfig['hero'];
}) {
  const big           = featured[0];
  const tileProducts  = featured.slice(1, 3);
  const heroTiles     = hero?.tiles ?? [];

  const renderTile = (i: number) => {
    const configured = heroTiles[i];
    if (configured?.image_url) return <ConfiguredTile key={`c${i}`} tile={configured} />;
    const product = tileProducts[i];
    return product ? <ProductTile key={`p${i}`} product={product} /> : <TilePlaceholder key={`e${i}`} />;
  };

  return (
    <section className="mx-auto max-w-[1280px] px-4 sm:px-6 mt-5">
      <div className="grid lg:grid-cols-[1.9fr_1fr] gap-4 lg:gap-5">
        {hero?.image_url
          ? <ConfiguredBigBanner hero={hero} />
          : (big ? <ProductBigBanner product={big} eyebrow={hero?.eyebrow} /> : <BannerPlaceholder />)}

        <div className="grid grid-cols-2 lg:grid-cols-1 gap-4 lg:gap-5">
          {renderTile(0)}
          {renderTile(1)}
        </div>
      </div>
    </section>
  );
}

/* ── Shared style tokens ─────────────────────────────────────────────────── */

// A light LEFT-side legibility gradient — text reads, the right of the image
// (where the model/product usually sits) stays clean. No colour tint.
const BANNER_GRADIENT = 'absolute inset-0 bg-gradient-to-r from-black/55 via-black/20 to-transparent';
const TILE_GRADIENT   = 'absolute inset-0 bg-gradient-to-r from-black/55 via-black/15 to-transparent';

/* ── Configured (admin-designed) banner + tiles ──────────────────────────── */

function ConfiguredBigBanner({ hero }: { hero: HomepageConfig['hero'] }) {
  const b1 = hero.button1;
  const b2 = hero.button2;

  return (
    <div className="group relative block overflow-hidden rounded-2xl min-h-[300px] sm:min-h-[420px] bg-slate-900">
      <FitImage src={hero.image_url!} alt={hero.headline || ''} eager />
      <div className={BANNER_GRADIENT} />

      <div className="relative z-10 flex h-full flex-col justify-center p-6 sm:p-10 max-w-[82%] sm:max-w-[60%] text-white">
        {hero.eyebrow && (
          <span className="text-sm sm:text-base font-medium text-white/90">{hero.eyebrow}</span>
        )}
        {hero.headline && (
          <h1 className="mt-2 text-2xl sm:text-4xl lg:text-5xl font-extrabold uppercase leading-[1.1] drop-shadow-sm">
            {hero.headline}
          </h1>
        )}
        <div className="mt-5 sm:mt-7 flex flex-wrap items-center gap-3">
          {b1?.label && (
            <a href={b1.url || '/products'}
               className="inline-flex items-center gap-2 ring-1 ring-white/70 hover:bg-white/10 font-semibold text-sm px-6 py-2.5 rounded uppercase tracking-wide transition">
              {b1.label} <ArrowRight className="h-3.5 w-3.5" />
            </a>
          )}
          {b2?.label && (
            <a href={b2.url || '/products'}
               className="inline-flex items-center bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold text-sm px-6 py-2.5 rounded uppercase tracking-wide transition">
              {b2.label}
            </a>
          )}
        </div>
        <div className="mt-6 hidden sm:flex items-center gap-1.5">
          <span className="h-2 w-6 rounded-full bg-white/90" />
          <span className="h-2 w-2 rounded-full bg-white/40" />
          <span className="h-2 w-2 rounded-full bg-white/40" />
        </div>
      </div>
    </div>
  );
}

function ConfiguredTile({ tile }: { tile: HomepageConfig['hero']['tiles'][number] }) {
  return (
    <a
      href={tile.url || '/products'}
      className="group relative block overflow-hidden rounded-2xl min-h-[150px] sm:min-h-[175px] lg:min-h-[202px] bg-slate-800"
    >
      <FitImage src={tile.image_url!} alt={tile.heading || ''} />
      {(tile.heading || tile.subtext) && (
        <>
          <div className={TILE_GRADIENT} />
          <div className="absolute inset-0 z-10 flex flex-col justify-center p-4 sm:p-5 max-w-[78%] text-white">
            {tile.heading && (
              <h3 className="font-bold uppercase text-base sm:text-lg leading-tight drop-shadow">{tile.heading}</h3>
            )}
            {tile.subtext && (
              <p className="text-xs text-white/85 mt-1 drop-shadow line-clamp-2">{tile.subtext}</p>
            )}
          </div>
        </>
      )}
    </a>
  );
}

/* ── Product-driven default (same full-bleed style, no upload needed) ─────── */

function ProductBigBanner({ product, eyebrow }: { product: ProductCard; eyebrow?: string }) {
  const off = discountPct(Number(product.price), product.compare_at_price ? Number(product.compare_at_price) : null);
  const badge = off ? `Get ${off}% Off` : (eyebrow || 'Featured');

  return (
    <a
      href={`/products/${product.slug}`}
      className="group relative block overflow-hidden rounded-2xl min-h-[300px] sm:min-h-[420px] bg-slate-900"
    >
      {product.image_url && (
        <FitImage src={product.image_url} alt={product.name} eager />
      )}
      <div className={BANNER_GRADIENT} />

      <div className="relative z-10 flex h-full flex-col justify-center p-6 sm:p-10 max-w-[82%] sm:max-w-[60%] text-white">
        <span className="inline-block w-fit text-[11px] sm:text-xs uppercase tracking-wider font-bold bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">
          {badge}
        </span>
        <h1 className="mt-3 text-2xl sm:text-4xl lg:text-5xl font-extrabold uppercase leading-[1.1] drop-shadow-sm">
          {product.name}
        </h1>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold drop-shadow">{formatBDT(product.price, { currency: product.currency })}</span>
          {product.compare_at_price && Number(product.compare_at_price) > Number(product.price) && (
            <span className="text-sm text-white/70 line-through">{formatBDT(Number(product.compare_at_price), { currency: product.currency })}</span>
          )}
        </div>
        <div className="mt-5 sm:mt-6 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 bg-white text-slate-900 font-bold text-sm px-6 py-2.5 rounded uppercase tracking-wide group-hover:bg-brand-50 transition">
            Shop Now <ArrowRight className="h-3.5 w-3.5" />
          </span>
          <span className="inline-flex items-center font-semibold text-sm px-6 py-2.5 rounded uppercase tracking-wide ring-1 ring-white/70 hover:bg-white/10 transition">
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

function ProductTile({ product }: { product: ProductCard }) {
  const off = discountPct(Number(product.price), product.compare_at_price ? Number(product.compare_at_price) : null);

  return (
    <a
      href={`/products/${product.slug}`}
      className="group relative block overflow-hidden rounded-2xl min-h-[150px] sm:min-h-[175px] lg:min-h-[202px] bg-slate-800"
    >
      {product.image_url && (
        <FitImage src={product.image_url} alt={product.name} />
      )}
      <div className={TILE_GRADIENT} />
      {off && (
        <span className="absolute top-2.5 right-2.5 z-10 bg-rose-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
          -{off}%
        </span>
      )}
      <div className="absolute inset-0 z-10 flex flex-col justify-center p-4 sm:p-5 max-w-[80%] text-white">
        <h3 className="font-bold uppercase text-sm sm:text-base leading-tight drop-shadow line-clamp-2">{product.name}</h3>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-base sm:text-lg font-extrabold drop-shadow">{formatBDT(product.price, { currency: product.currency })}</span>
          {product.compare_at_price && Number(product.compare_at_price) > Number(product.price) && (
            <span className="text-xs text-white/70 line-through">{formatBDT(Number(product.compare_at_price), { currency: product.currency })}</span>
          )}
        </div>
      </div>
    </a>
  );
}

/* ── Placeholders (empty store) ──────────────────────────────────────────── */

function BannerPlaceholder() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white p-6 sm:p-10 min-h-[300px] sm:min-h-[420px] flex items-center">
      <div className="max-w-sm">
        <span className="inline-block text-[11px] uppercase tracking-wider font-bold bg-white/20 px-3 py-1 rounded-full">Welcome</span>
        <h1 className="mt-4 text-3xl sm:text-5xl font-extrabold leading-tight">Add your first product</h1>
        <p className="mt-3 text-sm text-white/80">Set a hero banner image in Customization, or add featured products.</p>
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
