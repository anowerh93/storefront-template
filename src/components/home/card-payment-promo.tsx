import Link from 'next/link';
import { CreditCard } from 'lucide-react';
import type { HomepageConfig } from '../../lib/types';

export function CardPaymentPromo({ config }: { config: HomepageConfig['card_payment_promo'] }) {
  return (
    <section className="mx-auto max-w-[1280px] px-4 sm:px-6 mt-10">
      <div className="rounded-2xl bg-pink-50 p-6 sm:p-8 grid sm:grid-cols-[1fr_280px] gap-6 items-center overflow-hidden relative">
        <div>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900">{config.headline}</h3>
          {config.body && (
            <p className="text-sm text-slate-600 mt-2 max-w-md">{config.body}</p>
          )}
          <Link
            href={config.button_url}
            className="mt-4 inline-flex items-center gap-2 bg-purple-700 hover:bg-purple-800 text-white font-semibold text-sm px-5 py-2 rounded-full transition"
          >
            {config.button_text}
          </Link>
        </div>

        {/* Decorative card stack — visual flair, not configurable */}
        <div className="relative h-32 sm:h-40">
          <div className="absolute inset-x-4 top-2 h-24 sm:h-28 rounded-2xl bg-gradient-to-br from-rose-300 to-rose-400 shadow-lg rotate-[-6deg]" />
          <div className="absolute inset-x-2 bottom-0 h-24 sm:h-28 rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-900 shadow-xl rotate-[2deg] flex items-center px-4">
            <CreditCard className="h-7 w-7 text-emerald-50/70" />
          </div>
          <div className="absolute right-2 bottom-3 h-20 sm:h-24 w-32 sm:w-40 rounded-2xl bg-gradient-to-br from-orange-300 to-rose-400 shadow-lg rotate-[6deg]" />
        </div>
      </div>
    </section>
  );
}
