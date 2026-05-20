'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import type { ProductCard } from '../../lib/types';
import { formatBDT, discountPct } from '../../lib/format';

/**
 * Centerpiece "Deals of the Day" — featured product (with countdown timer
 * to midnight) flanked by 6 secondary picks (3 left, 3 right).
 *
 * Counts down to local midnight and resets — gives a constant sense of
 * urgency without needing real per-deal expiry data.
 */
export function DealsOfDay({
  products,
  spotlight,
  title = 'Deals of the Day',
}: {
  /** Mini cards around the centre spotlight (up to 6). */
  products: ProductCard[];
  /** Centre spotlight tile. If null and products is empty, the whole section returns null. */
  spotlight: ProductCard | null;
  title?: string;
}) {
  // Need at least the spotlight or one mini card to show anything.
  // If we have a spotlight + 0 mini cards, still render with the spotlight
  // alone. If only mini cards (no spotlight), promote the first mini.
  let featured: ProductCard | null = spotlight;
  let rest: ProductCard[] = products;
  if (!featured && products.length > 0) {
    featured = products[0];
    rest = products.slice(1);
  }
  if (!featured) return null;

  const left = rest.slice(0, 3);
  const right = rest.slice(3, 6);
  const discount = discountPct(featured.price, featured.compare_at_price);

  return (
    <section className="mx-auto max-w-[1280px] px-4 sm:px-6 mt-10">
      <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">{title}</h2>

      <div className="grid lg:grid-cols-[1fr_2fr_1fr] gap-3 sm:gap-4">
        {/* Left mini products */}
        <div className="grid grid-rows-3 gap-3">
          {left.map((p) => <MiniDealCard key={p.id} product={p} />)}
        </div>

        {/* Featured */}
        <Link
          href={`/products/${featured.slug}`}
          className="group bg-white ring-1 ring-slate-200 hover:ring-brand-300 hover:shadow-lg rounded-2xl p-5 sm:p-6 transition flex flex-col"
        >
          <div className="relative aspect-[4/3] rounded-xl bg-slate-50 overflow-hidden mb-4">
            {featured.image_url && (
              <Image
                src={featured.image_url}
                alt={featured.name}
                fill
                sizes="(max-width: 1024px) 100vw, 600px"
                className="object-contain p-4 group-hover:scale-105 transition-transform duration-500"
              />
            )}
            {discount && (
              <span className="absolute top-3 left-3 bg-rose-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                -{discount}%
              </span>
            )}
          </div>

          {(featured.rating_count ?? 0) > 0 && featured.rating_avg != null && (
            <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={`h-3.5 w-3.5 ${n <= Math.round(featured.rating_avg!) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                ))}
              </div>
              <span>({featured.rating_count})</span>
            </div>
          )}

          <h3 className="font-bold text-slate-900 text-base sm:text-lg leading-snug line-clamp-2">{featured.name}</h3>

          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{formatBDT(featured.price)}</span>
            {featured.compare_at_price && featured.compare_at_price > featured.price && (
              <span className="text-sm text-slate-400 line-through">{formatBDT(featured.compare_at_price)}</span>
            )}
          </div>

          <CountdownTimer />
        </a>

        {/* Right mini products */}
        <div className="grid grid-rows-3 gap-3">
          {right.map((p) => <MiniDealCard key={p.id} product={p} />)}
        </div>
      </div>
    </section>
  );
}

function MiniDealCard({ product }: { product: ProductCard }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex gap-3 items-center p-3 rounded-xl bg-white ring-1 ring-slate-200 hover:ring-brand-300 hover:shadow-sm transition"
    >
      <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-slate-50 overflow-hidden shrink-0">
        {product.image_url && (
          <img src={product.image_url} alt={product.name} fill sizes="80px" className="object-contain p-1" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs sm:text-sm font-medium text-slate-900 line-clamp-2 group-hover:text-brand-600">{product.name}</p>
        <p className="text-sm font-bold text-slate-900 mt-1">{formatBDT(product.price)}</p>
      </div>
    </a>
  );
}

function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState(() => calc());

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(calc()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mt-4 grid grid-cols-4 gap-1.5">
      <TimeBlock label="Day"  value={timeLeft.days} />
      <TimeBlock label="Hr"   value={timeLeft.hours} />
      <TimeBlock label="Min"  value={timeLeft.minutes} />
      <TimeBlock label="Sec"  value={timeLeft.seconds} />
    </div>
  );
}

function TimeBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-slate-100 rounded-lg py-2 text-center">
      <div className="text-base font-bold text-slate-900 tabular-nums">{value.toString().padStart(2, '0')}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}

function calc() {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  let diff = Math.max(0, end.getTime() - now.getTime());
  const days = Math.floor(diff / 86_400_000); diff -= days * 86_400_000;
  const hours = Math.floor(diff / 3_600_000);  diff -= hours * 3_600_000;
  const minutes = Math.floor(diff / 60_000);   diff -= minutes * 60_000;
  const seconds = Math.floor(diff / 1000);
  return { days, hours, minutes, seconds };
}
