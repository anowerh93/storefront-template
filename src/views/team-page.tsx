import { ServiceHeader } from '../components/layout/service-header';
import { Footer } from '../components/layout/footer';
import { NotFoundPage } from './not-found';
import type { StorefrontMeta, TeamMember } from '../lib/types';

/**
 * Team page (service tenants) — a grid of staff cards (photo, name, role,
 * bio). Pure content → static HTML; the header's mobile menu is CSS-only.
 */
export function TeamPage({ meta, team }: { meta: StorefrontMeta | null; team: TeamMember[] }) {
  if (!meta) return <NotFoundPage />;
  return (
    <>
      <ServiceHeader meta={meta} />
      <main className="mx-auto max-w-[1100px] px-4 sm:px-6 py-12 sm:py-16">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">Our team</h1>
        <p className="mt-2 text-slate-600">The people who'll handle your work.</p>

        {team.length === 0 ? (
          <p className="mt-10 text-slate-500">Team details coming soon.</p>
        ) : (
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {team.map((m, i) => (
              <div key={i} className="sv-card bg-white rounded-2xl ring-1 ring-slate-200 p-6 text-center">
                {m.image_url ? (
                  <img src={m.image_url} alt={m.name} loading="lazy"
                       className="mx-auto w-24 h-24 rounded-full object-cover ring-1 ring-slate-200" />
                ) : (
                  <div className="mx-auto w-24 h-24 rounded-full bg-brand-50 text-brand-300 flex items-center justify-center text-2xl font-bold">
                    {m.name.charAt(0)}
                  </div>
                )}
                <h2 className="mt-4 font-bold text-slate-900">{m.name}</h2>
                {m.role && <p className="text-sm font-medium text-brand-700">{m.role}</p>}
                {m.bio && <p className="mt-2 text-sm text-slate-600 leading-relaxed whitespace-pre-line">{m.bio}</p>}
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer meta={meta} />
    </>
  );
}
