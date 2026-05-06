import { getIcon } from '../../lib/icons';
import type { HomepageConfig } from '../../lib/types';

export function TrustBadges({ items }: { items: HomepageConfig['trust_badges']['items'] }) {
  if (!items || items.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1280px] px-4 sm:px-6 mt-12">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {items.map((b, i) => {
          const Icon = getIcon(b.icon);
          return (
            <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-white ring-1 ring-slate-200 hover:ring-brand-200 hover:shadow-sm transition">
              <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5 text-brand-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{b.title}</p>
                <p className="text-xs text-slate-500 line-clamp-2">{b.body}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
