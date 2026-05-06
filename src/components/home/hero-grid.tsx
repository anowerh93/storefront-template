import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import type { ProductCard } from '../../lib/types';
import { formatBDT } from '../../lib/format';

/**
 * Hero — 1 large featured product on the left, 3 smaller stacked cards on
 * the right. Mirrors the Omerce homepage layout. Falls back gracefully when
 * the tenant has fewer than 4 featured products.
 */
export function HeroGrid({
  featured,
  eyebrow = '100% Organic Food',
}: {
  featured: ProductCard[];
  /** Tenant-customizable text above the hero headline. */
  eyebrow?: string;
}) {
  const big = featured[0];
  const small = featured.slice(1, 4);

  return (
    <section className="mx-auto max-w-[1280px] px-4 sm:px-6 mt-5">
      <div className="grid lg:grid-cols-[2fr_1fr] gap-4 lg:gap-5">
        {/* Big card */}
        {big ? (
          <Link
            href={`/products/${big.slug}`}
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white p-6 sm:p-10 min-h-[280px] sm:min-h-[400px] flex"
          >
            <div className="relative z-10 max-w-sm flex flex-col justify-center">
              <span className="inline-block text-[10px] uppercase tracking-wider font-bold bg-white/15 backdrop-blur px-2.5 py-1 rounded-full w-fit">
                {eyebrow}
              </span>
              <h1 className="mt-4 text-3xl sm:text-5xl font-bold leading-tight">
                {big.name}
              </h1>
              {big.short_description && (
                <p className="mt-2 text-sm text-emerald-50 line-clamp-2 max-w-xs">{big.short_description}</p>
              )}
              <div className="mt-5">
                <div className="text-xs text-emerald-100">only</div>
                <div className="text-3xl sm:text-4xl font-bold">{formatBDT(big.price)}</div>
              </div>
              <div className="mt-5">
                <span className="inline-flex items-center gap-2 bg-amber-300 text-emerald-950 hover:bg-amber-200 transition font-bold text-sm px-5 py-2.5 rounded-full">
                  Shop Now
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
            {big.image_url && (
              <Image
                src={big.image_url}
                alt={big.name}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 800px"
                className="object-contain object-right p-8 group-hover:scale-105 transition-transform duration-700 mix-blend-luminosity opacity-90"
              />
            )}
          </Link>
        ) : (
          <HeroPlaceholder />
        )}

        {/* Small cards */}
        <div className="grid grid-rows-2 gap-4 lg:gap-5">
          {/* Top — wide single card */}
          {small[0] ? (
            <SmallCard product={small[0]} variant="purple" />
          ) : (
            <SmallPlaceholder variant="purple" />
          )}

          {/* Bottom — 2 small cards side by side */}
          <div className="grid grid-cols-2 gap-3 lg:gap-4">
            {small[1] ? (
              <SmallCard product={small[1]} variant="cyan" stacked />
            ) : (
              <SmallPlaceholder variant="cyan" stacked />
            )}
            {small[2] ? (
              <SmallCard product={small[2]} variant="indigo" stacked />
            ) : (
              <SmallPlaceholder variant="indigo" stacked />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function SmallCard({
  product,
  variant,
  stacked = false,
}: {
  product: ProductCard;
  variant: 'purple' | 'cyan' | 'indigo';
  stacked?: boolean;
}) {
  const cls = {
    purple: 'from-purple-500 to-purple-700 text-white',
    cyan:   'from-cyan-400 to-cyan-600 text-white',
    indigo: 'from-indigo-500 to-indigo-700 text-white',
  }[variant];

  return (
    <Link
      href={`/products/${product.slug}`}
      className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${cls} p-5 min-h-[140px] flex`}
    >
      <div className="relative z-10 flex flex-col justify-center max-w-[60%]">
        <h3 className={`font-bold leading-tight ${stacked ? 'text-base' : 'text-lg sm:text-xl'}`}>{product.name}</h3>
        {!stacked && (
          <p className="text-xs opacity-80 mt-1">only</p>
        )}
        <p className={`font-bold ${stacked ? 'text-lg mt-1' : 'text-2xl mt-0.5'}`}>{formatBDT(product.price)}</p>
        {!stacked && (
          <span className="mt-3 inline-block text-xs font-semibold bg-white/15 backdrop-blur px-3 py-1.5 rounded-full w-fit">
            Shop Now →
          </span>
        )}
      </div>
      {product.image_url && (
        <Image
          src={product.image_url}
          alt={product.name}
          fill
          sizes="(max-width: 1024px) 50vw, 300px"
          className="object-contain object-right p-4 group-hover:scale-105 transition-transform duration-500"
        />
      )}
    </Link>
  );
}

function HeroPlaceholder() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white p-6 sm:p-10 min-h-[280px] sm:min-h-[400px] flex items-center">
      <div className="max-w-sm">
        <span className="inline-block text-[10px] uppercase tracking-wider font-bold bg-white/15 backdrop-blur px-2.5 py-1 rounded-full">
          Welcome
        </span>
        <h1 className="mt-4 text-3xl sm:text-5xl font-bold leading-tight">Add your first product</h1>
        <p className="mt-2 text-sm text-emerald-50">Featured products show up here once you've added them in the dashboard.</p>
      </div>
    </div>
  );
}

function SmallPlaceholder({ variant, stacked = false }: { variant: 'purple' | 'cyan' | 'indigo'; stacked?: boolean }) {
  const cls = {
    purple: 'from-purple-500 to-purple-700',
    cyan:   'from-cyan-400 to-cyan-600',
    indigo: 'from-indigo-500 to-indigo-700',
  }[variant];
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${cls} ${stacked ? 'min-h-[140px]' : 'min-h-[180px]'} flex items-center justify-center text-white/60 text-sm p-4 text-center`}>
      Featured slot
    </div>
  );
}
