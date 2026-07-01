import type { ProductCard, HomepageConfig } from '../../lib/types';

/**
 * 3-column promo row — "Shopwise" promo style. Each card is a light, neutral
 * panel with the copy on the LEFT (small gray eyebrow + bold dark headline +
 * a yellow CTA button) and the product image floating on the right over the
 * same light background. No coloured panels, no price — a clean marketing
 * strip that lets the product photo do the work.
 *
 * Headline + button label fall back to the product name / "Shop Now" when the
 * card has no custom copy set, so it works with the existing data and upgrades
 * automatically if editable copy fields are added later.
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
      <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
        {items.map((p, i) => {
          const card = cards[i] ?? cards[0];
          const headline = card?.headline?.trim() || p.name;
          const ctaLabel = card?.cta_label?.trim() || 'Shop Now';
          return (
            <a
              key={p.id}
              href={`/products/${p.slug}`}
              className="group relative grid grid-cols-2 overflow-hidden rounded-2xl min-h-[200px] sm:min-h-[210px] bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200/70 hover:ring-slate-300 hover:shadow-sm transition"
            >
              {/* Copy — left */}
              <div className="relative z-10 flex flex-col justify-center p-5 sm:p-6">
                {card.eyebrow && (
                  <span className="text-xs sm:text-sm text-slate-500">{card.eyebrow}</span>
                )}
                <h3 className="mt-1.5 text-lg sm:text-2xl font-extrabold leading-tight text-slate-900 line-clamp-2">
                  {headline}
                </h3>
                <span className="mt-4 inline-flex w-fit items-center bg-amber-400 group-hover:bg-amber-300 text-slate-900 text-[11px] font-bold uppercase tracking-wide px-5 py-2.5 rounded transition">
                  {ctaLabel}
                </span>
              </div>

              {/* Product image — right, floating on the light panel */}
              <div className="relative">
                {p.image_url && (
                  <img
                    src={p.image_url}
                    alt={p.name}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-contain object-center p-3 transition-transform duration-500 group-hover:scale-105"
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
