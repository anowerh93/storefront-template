import { ArrowRight } from 'lucide-react';
import type { ProductCard, HomepageConfig } from '../../lib/types';
import { formatBDT } from '../../lib/format';

/**
 * 3-column promotional row — hero-style cards: the product image is a
 * FULL-CARD background, with a tone-coloured left-to-right scrim so the
 * overlaid eyebrow / name / price / CTA stay readable. Mirrors the hero
 * banner treatment so the homepage reads as one design.
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
              className="group relative overflow-hidden rounded-2xl min-h-[210px] sm:min-h-[230px] bg-slate-800"
            >
              {/* Full-card background image */}
              {p.image_url && (
                <img
                  src={p.image_url}
                  alt={p.name}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              )}
              {/* Tone-coloured scrim: opaque on the left (for text) → clear on the right (shows the photo) */}
              <div className={`absolute inset-0 bg-gradient-to-r ${tone.scrim}`} />

              <div className="relative z-10 p-5 sm:p-6 max-w-[72%] text-white">
                <span className={`text-[10px] uppercase tracking-wide font-bold ${tone.eyebrow}`}>{card.eyebrow}</span>
                <h3 className="mt-1.5 text-lg sm:text-xl font-bold leading-tight drop-shadow-sm">{p.name}</h3>
                <div className="mt-3">
                  <p className="text-xs text-white/70">only</p>
                  <p className="text-2xl font-bold drop-shadow-sm">{formatBDT(p.price)}</p>
                </div>
                <span className={`mt-4 inline-flex items-center gap-1.5 ${tone.cta} text-xs font-semibold px-4 py-2 rounded-full transition`}>
                  Shop Now <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Per-tone palette for the hero-style cards.
 *   scrim   — left→right gradient over the photo (dark tone → transparent)
 *   eyebrow — light tone accent that reads on the dark scrim
 *   cta     — solid button keeping each card's colour identity
 * Mirrors HomepageConfig::PROMO_TONES on the Laravel side. Class strings
 * are literal so Tailwind's content scan picks them up.
 */
const TONE_MAP: Record<string, { scrim: string; eyebrow: string; cta: string }> = {
  rose:    { scrim: 'from-rose-950/90 via-rose-900/55 to-transparent',       eyebrow: 'text-rose-200',    cta: 'bg-rose-600 hover:bg-rose-700 text-white' },
  amber:   { scrim: 'from-amber-950/90 via-amber-900/55 to-transparent',     eyebrow: 'text-amber-200',   cta: 'bg-amber-500 hover:bg-amber-600 text-white' },
  lime:    { scrim: 'from-lime-950/90 via-lime-900/55 to-transparent',       eyebrow: 'text-lime-200',    cta: 'bg-lime-600 hover:bg-lime-700 text-white' },
  sky:     { scrim: 'from-sky-950/90 via-sky-900/55 to-transparent',         eyebrow: 'text-sky-200',     cta: 'bg-sky-600 hover:bg-sky-700 text-white' },
  purple:  { scrim: 'from-purple-950/90 via-purple-900/55 to-transparent',   eyebrow: 'text-purple-200',  cta: 'bg-purple-600 hover:bg-purple-700 text-white' },
  emerald: { scrim: 'from-emerald-950/90 via-emerald-900/55 to-transparent', eyebrow: 'text-emerald-200', cta: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  cyan:    { scrim: 'from-cyan-950/90 via-cyan-900/55 to-transparent',       eyebrow: 'text-cyan-200',    cta: 'bg-cyan-600 hover:bg-cyan-700 text-white' },
  orange:  { scrim: 'from-orange-950/90 via-orange-900/55 to-transparent',   eyebrow: 'text-orange-200',  cta: 'bg-orange-600 hover:bg-orange-700 text-white' },
  pink:    { scrim: 'from-pink-950/90 via-pink-900/55 to-transparent',       eyebrow: 'text-pink-200',    cta: 'bg-pink-600 hover:bg-pink-700 text-white' },
  slate:   { scrim: 'from-slate-950/90 via-slate-900/55 to-transparent',     eyebrow: 'text-slate-200',   cta: 'bg-slate-700 hover:bg-slate-800 text-white' },
  indigo:  { scrim: 'from-indigo-950/90 via-indigo-900/55 to-transparent',   eyebrow: 'text-indigo-200',  cta: 'bg-indigo-600 hover:bg-indigo-700 text-white' },
  teal:    { scrim: 'from-teal-950/90 via-teal-900/55 to-transparent',       eyebrow: 'text-teal-200',    cta: 'bg-teal-600 hover:bg-teal-700 text-white' },
};
