import { ArrowRight } from 'lucide-react';
import type { ProductCard, HomepageConfig } from '../../lib/types';
import { formatBDT, discountPct } from '../../lib/format';
import { FitImage } from '../ui/fit-image';
import { cdnSrcSet, BANNER_WIDTHS, BANNER_SIZES, TILE_SIZES } from '../../lib/img';

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
  priority = false,
}: {
  featured: ProductCard[];
  hero: HomepageConfig['hero'];
  /** True only when the hero is the FIRST homepage section (it is the LCP).
   *  Gates fetchPriority="high" the same way index.astro gates the head
   *  preload — a reordered below-fold hero must not outrank the real LCP. */
  priority?: boolean;
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
      <div className="grid lg:grid-cols-[1.9fr_1fr] gap-4 lg:gap-5 lg:items-start">
        {hero?.image_url
          ? <ConfiguredBigBanner hero={hero} priority={priority} />
          : (big ? <ProductBigBanner product={big} eyebrow={hero?.eyebrow} priority={priority} /> : <BannerPlaceholder />)}

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

function ConfiguredBigBanner({ hero, priority = false }: { hero: HomepageConfig['hero']; priority?: boolean }) {
  // The merchant uploaded a fully-designed banner (their own text + CTA baked
  // into the artwork), so we show it CLEAN — no gradient, no overlaid eyebrow /
  // headline / buttons / dots competing with their design. The whole banner is
  // one click target: button 1's link, then button 2's, then /products.
  const href = hero.button1?.url || hero.button2?.url || '/products';
  const srcSet = cdnSrcSet(hero.image_url!, BANNER_WIDTHS);

  // Sizing, two modes (no FitImage blur-fill in either — that letterboxed the
  // artwork with blurred bands):
  //   • MOBILE (below lg): the banner is alone on its row → render at the
  //     image's OWN aspect ratio (w-full h-auto). No bands, no crop.
  //   • DESKTOP (lg+): the banner sits BESIDE the two tiles, so the tiles
  //     column (2 × aspect-[840/400] + gap) defines the row height and the
  //     banner FILLS it exactly: zero-intrinsic-height wrapper (absolute-fill
  //     link) + object-cover. The two columns bottom-align at every viewport.
  //     A recommended 1600×840 (~1.9:1) upload fills with ~no crop; off-ratio
  //     art loses a sliver at the sides instead of leaving the layout ragged
  //     (the previous h-auto-everywhere left a gap under wide banners — a
  //     hint-perfect 1600×750 upload ended ~40px above the tiles column).
  return (
    <div className="relative lg:self-stretch">
      <a
        href={href}
        className="group block overflow-hidden rounded-2xl lg:absolute lg:inset-0"
        aria-label={hero.headline || 'Shop now'}
      >
        <img
          src={hero.image_url!}
          srcSet={srcSet}
          sizes={srcSet ? BANNER_SIZES : undefined}
          alt={hero.headline || 'Featured offer'}
          loading="eager"
          decoding="async"
          fetchPriority={priority ? 'high' : undefined}
          className="block w-full h-auto lg:h-full lg:w-full lg:object-cover"
        />
      </a>
    </div>
  );
}

function ConfiguredTile({ tile }: { tile: HomepageConfig['hero']['tiles'][number] }) {
  const srcSet = cdnSrcSet(tile.image_url!);
  // Image-first: the merchant uploaded fully-designed tile art (its own text /
  // CTA baked in), so we show it CLEAN — one click target, no overlaid copy
  // competing with the artwork. The only thing configured besides the image is
  // the link destination (tile.url).
  return (
    <a
      href={tile.url || '/products'}
      className="group relative block overflow-hidden rounded-2xl min-h-[150px] sm:min-h-[175px] lg:min-h-0 lg:aspect-[840/400] bg-slate-800"
    >
      {/* Artwork fills the slot edge-to-edge (cover). A correctly-sized 840x400
          upload fills with no crop; off-ratio images lose a sliver of an edge. */}
      <img
        src={tile.image_url!}
        srcSet={srcSet}
        sizes={srcSet ? TILE_SIZES : undefined}
        alt="Promotional banner"
        loading="eager"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
      />
    </a>
  );
}

/* ── Product-driven default (same full-bleed style, no upload needed) ─────── */

function ProductBigBanner({ product, eyebrow, priority = false }: { product: ProductCard; eyebrow?: string; priority?: boolean }) {
  const off = discountPct(Number(product.price), product.compare_at_price ? Number(product.compare_at_price) : null);
  const badge = off ? `Get ${off}% Off` : (eyebrow || 'Featured');

  return (
    <a
      href={`/products/${product.slug}`}
      className="group relative block overflow-hidden rounded-2xl min-h-[300px] sm:min-h-[420px] bg-slate-900"
    >
      {product.image_url && (
        <FitImage src={product.image_url} alt={product.name} eager fetchPriority={priority ? 'high' : undefined} sizes={BANNER_SIZES} widths={BANNER_WIDTHS} />
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
      className="group relative block overflow-hidden rounded-2xl min-h-[150px] sm:min-h-[175px] lg:min-h-0 lg:aspect-[840/400] bg-slate-800"
    >
      {product.image_url && (
        <FitImage src={product.image_url} alt={product.name} eager sizes={TILE_SIZES} />
      )}
      <div className={TILE_GRADIENT} />
      {off && (
        <span className="absolute top-2.5 right-2.5 z-10 bg-rose-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
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
    <div className="rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 min-h-[150px] sm:min-h-[175px] lg:min-h-0 lg:aspect-[840/400] flex items-center justify-center text-slate-500 text-sm p-4 text-center">
      Featured slot
    </div>
  );
}
