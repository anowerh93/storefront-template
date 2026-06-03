import { ArrowRight } from 'lucide-react';
import type { ProductCard, HomepageConfig } from '../../lib/types';
import { formatBDT } from '../../lib/format';

/**
 * 3-column promotional row — split cards: a solid tone-coloured text panel on
 * the left and a CLEAN product image on the right. No image overlay/scrim, so
 * the photo shows in its true colours. Mirrors the hero's split treatment so
 * the homepage reads as one design.
 */
export function PromoRow({
  products,
  cards,
}: {
  products: ProductCard[];
  cards: HomepageConfig['promo_row']['cards'];
}) {
  const items = products.slice(0, 3);
  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1280px] px-4 sm:px-6 mt-10">
      <div className="grid sm:grid-cols-3 gap-4">
        {items.map((p, i) => {
          const card = cards[i] ?? cards[0];
          const tone = TONE_MAP[card.tone] ?? TONE_MAP.rose;
          return (
            <a
              key={p.id}
              href={`/products/${p.slug}`}
              className="group grid grid-cols-2 overflow-hidden rounded-2xl min-h-[200px] sm:min-h-[220px] bg-white border border-slate-200/70 hover:shadow-md transition"
            >
              {/* Solid tone panel — text only, no image behind it */}
              <div className={`flex flex-col justify-center p-5 text-white ${tone.panel}`}>
                <span className="text-[10px] uppercase tracking-wide font-bold text-white/75">{card.eyebrow}</span>
                <h3 className="mt-1.5 text-lg font-bold leading-tight line-clamp-2">{p.name}</h3>
                <div className="mt-3">
                  <p className="text-xs text-white/70">only</p>
                  <p className="text-2xl font-bold">{formatBDT(p.price)}</p>
                </div>
                <span className={`mt-4 inline-flex w-fit items-center gap-1.5 ${tone.cta} text-xs font-semibold px-4 py-2 rounded-full transition`}>
                  Shop Now <ArrowRight className="h-3 w-3" />
                </span>
              </div>

              {/* Clean image — no overlay */}
              <div className="relative bg-slate-100">
                {p.image_url && (
                  <img
                    src={p.image_url}
                    alt={p.name}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Per-tone palette for the split cards.
 *   panel — solid background colour of the text panel
 *   cta   — white pill button keeping each card's colour identity
 * Green tones (lime, emerald) map to the brand palette so the storefront
 * never shows green. Class strings are literal so Tailwind's scan picks
 * them up.
 */
const TONE_MAP: Record<string, { panel: string; cta: string }> = {
  rose:    { panel: 'bg-rose-600',   cta: 'bg-white text-rose-700 hover:bg-rose-50' },
  amber:   { panel: 'bg-amber-500',  cta: 'bg-white text-amber-700 hover:bg-amber-50' },
  lime:    { panel: 'bg-brand-600',  cta: 'bg-white text-brand-700 hover:bg-brand-50' },
  sky:     { panel: 'bg-sky-600',    cta: 'bg-white text-sky-700 hover:bg-sky-50' },
  purple:  { panel: 'bg-purple-600', cta: 'bg-white text-purple-700 hover:bg-purple-50' },
  emerald: { panel: 'bg-brand-600',  cta: 'bg-white text-brand-700 hover:bg-brand-50' },
  cyan:    { panel: 'bg-cyan-600',   cta: 'bg-white text-cyan-700 hover:bg-cyan-50' },
  orange:  { panel: 'bg-orange-600', cta: 'bg-white text-orange-700 hover:bg-orange-50' },
  pink:    { panel: 'bg-pink-600',   cta: 'bg-white text-pink-700 hover:bg-pink-50' },
  slate:   { panel: 'bg-slate-700',  cta: 'bg-white text-slate-800 hover:bg-slate-100' },
  indigo:  { panel: 'bg-indigo-600', cta: 'bg-white text-indigo-700 hover:bg-indigo-50' },
  teal:    { panel: 'bg-teal-600',   cta: 'bg-white text-teal-700 hover:bg-teal-50' },
};
