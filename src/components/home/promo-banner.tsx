import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { HomepageConfig } from '../../lib/types';

const GRADIENTS = {
  purple:  'from-violet-700 via-purple-600 to-fuchsia-600',
  rose:    'from-rose-600 via-pink-600 to-fuchsia-600',
  emerald: 'from-emerald-700 via-emerald-600 to-teal-600',
  amber:   'from-amber-600 via-orange-600 to-rose-600',
  sky:     'from-sky-700 via-blue-600 to-indigo-600',
  slate:   'from-slate-800 via-slate-700 to-slate-600',
} as const;

/**
 * Promo banner — content driven by HomepageConfig.promo_banner.
 * Every visual decision (color, copy, CTA) is tenant-overridable from the
 * dashboard's Customization tab.
 */
export function PromoBanner({ config }: { config: HomepageConfig['promo_banner'] }) {
  const grad = GRADIENTS[config.gradient] ?? GRADIENTS.purple;

  return (
    <section className="mx-auto max-w-[1280px] px-4 sm:px-6 mt-10">
      <Link
        href={config.button_url}
        className={`group flex items-center justify-between gap-6 p-5 sm:p-7 rounded-2xl bg-gradient-to-r ${grad} text-white overflow-hidden relative`}
      >
        <div className="max-w-md">
          {config.eyebrow && (
            <p className="text-xs uppercase tracking-wider font-semibold text-white/70 mb-1">{config.eyebrow}</p>
          )}
          <h3 className="text-base sm:text-2xl font-bold leading-snug">{config.headline}</h3>
          {config.subtitle && (
            <p className="text-[11px] sm:text-xs text-white/80 mt-1 line-clamp-2">{config.subtitle}</p>
          )}
        </div>
        <div className="text-right">
          {config.discount > 0 && (
            <p className="text-3xl sm:text-5xl font-black leading-none">
              {config.discount}% <span className="text-base sm:text-2xl font-bold">off</span>
            </p>
          )}
          <span className="mt-2 inline-flex items-center gap-1.5 bg-white text-slate-900 hover:bg-slate-100 transition font-semibold text-xs px-4 py-2 rounded-full">
            {config.button_text} <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </Link>
    </section>
  );
}
