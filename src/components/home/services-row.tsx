import { ArrowRight } from 'lucide-react';
import { getIcon } from '../../lib/icons';
import type { HomepageConfig } from '../../lib/types';

const TONE_STYLES: Record<string, { bg: string; tagBg: string }> = {
  amber:   { bg: 'bg-amber-100',   tagBg: 'bg-amber-200 text-amber-800' },
  emerald: { bg: 'bg-brand-100', tagBg: 'bg-brand-200 text-brand-800' },
  rose:    { bg: 'bg-rose-100',    tagBg: 'bg-rose-200 text-rose-800' },
  sky:     { bg: 'bg-sky-100',     tagBg: 'bg-sky-200 text-sky-800' },
  purple:  { bg: 'bg-purple-100',  tagBg: 'bg-purple-200 text-purple-800' },
  slate:   { bg: 'bg-slate-100',   tagBg: 'bg-slate-200 text-slate-800' },
};

export function ServicesRow({ items }: { items: HomepageConfig['services_row']['items'] }) {
  if (!items || items.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1280px] px-4 sm:px-6 mt-12">
      <div className="grid md:grid-cols-3 gap-4">
        {items.map((svc, i) => {
          const Icon = getIcon(svc.icon);
          const tone = TONE_STYLES[svc.tone] ?? TONE_STYLES.amber;
          return (
            <div key={i} className={`group ${tone.bg} rounded-2xl p-6 relative overflow-hidden hover:shadow-md transition`}>
              <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl ${tone.tagBg} mb-4`}>
                <Icon className="h-7 w-7" />
              </div>
              <h3 className="font-bold text-slate-900 text-base sm:text-lg leading-snug">{svc.title}</h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">{svc.body}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-slate-900">
                Learn more <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
