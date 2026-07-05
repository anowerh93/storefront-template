import type { HomepageConfig } from '../../lib/types';

const TONE_MAP: Record<string, { bg: string; accent: string }> = {
  cyan:    { bg: 'bg-cyan-100',    accent: 'text-cyan-700' },
  orange:  { bg: 'bg-orange-100',  accent: 'text-orange-700' },
  pink:    { bg: 'bg-pink-100',    accent: 'text-pink-700' },
  emerald: { bg: 'bg-brand-100', accent: 'text-brand-700' },
  rose:    { bg: 'bg-rose-100',    accent: 'text-rose-700' },
  amber:   { bg: 'bg-amber-100',   accent: 'text-amber-700' },
  lime:    { bg: 'bg-brand-100',   accent: 'text-brand-700' },
  sky:     { bg: 'bg-sky-100',     accent: 'text-sky-700' },
  purple:  { bg: 'bg-purple-100',  accent: 'text-purple-700' },
  slate:   { bg: 'bg-slate-100',   accent: 'text-slate-700' },
  indigo:  { bg: 'bg-indigo-100',  accent: 'text-indigo-700' },
  teal:    { bg: 'bg-teal-100',    accent: 'text-teal-700' },
};

/**
 * Sponsor / partner-brand strip — 4 colourful tiles. Content driven entirely
 * by the tenant's HomepageConfig.brand_strip.items in the dashboard.
 */
export function BrandStrip({ items }: { items: HomepageConfig['brand_strip']['items'] }) {
  if (!items || items.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1280px] px-4 sm:px-6 mt-10">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map((b, i) => {
          const tone = TONE_MAP[b.tone] ?? TONE_MAP.cyan;
          return (
            <div key={i} className={`${tone.bg} rounded-2xl p-4 sm:p-5 hover:shadow-md transition`}>
              <span className={`text-[10px] uppercase tracking-wider font-bold ${tone.accent}`}>{b.badge}</span>
              <p className="font-bold text-slate-900 text-base mt-1">{b.name}</p>
              {b.detail && <p className="text-xs text-slate-600 mt-0.5">{b.detail}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
