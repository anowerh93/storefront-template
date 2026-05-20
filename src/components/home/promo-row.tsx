import { ArrowRight } from 'lucide-react';
import type { ProductCard, HomepageConfig } from '../../lib/types';
import { formatBDT } from '../../lib/format';

/**
 * 3-column promotional row — uses the next 3 products as content with
 * tenant-controlled eyebrow + tone per column.
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
            <Link
              key={p.id}
              href={`/products/${p.slug}`}
              className={`group relative overflow-hidden rounded-2xl ${tone.bg} p-5 sm:p-6 min-h-[200px] flex`}
            >
              <div className="relative z-10 max-w-[60%]">
                <span className={`text-[10px] uppercase tracking-wide font-bold ${tone.eyebrow}`}>{card.eyebrow}</span>
                <h3 className="mt-1.5 text-lg sm:text-xl font-bold text-slate-900 leading-tight">{p.name}</h3>
                <div className="mt-3">
                  <p className="text-xs text-slate-500">only</p>
                  <p className="text-2xl font-bold text-slate-900">{formatBDT(p.price)}</p>
                </div>
                <span className={`mt-4 inline-flex items-center gap-1.5 ${tone.cta} text-xs font-semibold px-4 py-2 rounded-full transition`}>
                  Shop Now <ArrowRight className="h-3 w-3" />
                </span>
              </div>
              {p.image_url && (
                <Image
                  src={p.image_url}
                  alt={p.name}
                  fill
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="object-contain object-right p-4 group-hover:scale-105 transition-transform duration-500"
                />
              )}
            </a>
          );
        })}
      </div>
    </section>
  );
}

/** Per-tone palette. Mirrors HomepageConfig::PROMO_TONES on the Laravel side. */
const TONE_MAP: Record<string, { bg: string; eyebrow: string; cta: string }> = {
  rose:    { bg: 'bg-rose-100',    eyebrow: 'text-rose-700',    cta: 'bg-rose-600 hover:bg-rose-700 text-white' },
  amber:   { bg: 'bg-amber-50',    eyebrow: 'text-amber-700',   cta: 'bg-amber-500 hover:bg-amber-600 text-white' },
  lime:    { bg: 'bg-lime-100',    eyebrow: 'text-lime-800',    cta: 'bg-lime-700 hover:bg-lime-800 text-white' },
  sky:     { bg: 'bg-sky-100',     eyebrow: 'text-sky-700',     cta: 'bg-sky-600 hover:bg-sky-700 text-white' },
  purple:  { bg: 'bg-purple-100',  eyebrow: 'text-purple-700',  cta: 'bg-purple-600 hover:bg-purple-700 text-white' },
  emerald: { bg: 'bg-emerald-100', eyebrow: 'text-emerald-700', cta: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  cyan:    { bg: 'bg-cyan-100',    eyebrow: 'text-cyan-700',    cta: 'bg-cyan-600 hover:bg-cyan-700 text-white' },
  orange:  { bg: 'bg-orange-100',  eyebrow: 'text-orange-700',  cta: 'bg-orange-600 hover:bg-orange-700 text-white' },
  pink:    { bg: 'bg-pink-100',    eyebrow: 'text-pink-700',    cta: 'bg-pink-600 hover:bg-pink-700 text-white' },
  slate:   { bg: 'bg-slate-100',   eyebrow: 'text-slate-700',   cta: 'bg-slate-700 hover:bg-slate-800 text-white' },
  indigo:  { bg: 'bg-indigo-100',  eyebrow: 'text-indigo-700',  cta: 'bg-indigo-600 hover:bg-indigo-700 text-white' },
  teal:    { bg: 'bg-teal-100',    eyebrow: 'text-teal-700',    cta: 'bg-teal-600 hover:bg-teal-700 text-white' },
};
