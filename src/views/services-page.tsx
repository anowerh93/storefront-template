import { ServiceHeader } from '../components/layout/service-header';
import { Footer } from '../components/layout/footer';
import { NotFoundPage } from './not-found';
import { getIcon } from '../lib/icons';
import type { ServiceCard, StorefrontMeta } from '../lib/types';

/**
 * Services catalog — a grid of service cards (each links to its detail page).
 * Pure content, no interactivity → static HTML. Booking happens on the detail
 * page / the homepage contact form.
 */
export function ServicesPage({ meta, services }: { meta: StorefrontMeta | null; services: ServiceCard[] }) {
  if (!meta) return <NotFoundPage />;
  return (
    <>
      <ServiceHeader meta={meta} />
      <main className="mx-auto max-w-[1100px] px-4 sm:px-6 py-12 sm:py-16">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">Our services</h1>
        <p className="mt-2 text-slate-600">Choose a service to learn more and send a booking inquiry.</p>

        {services.length === 0 ? (
          <p className="mt-10 text-slate-500">Services coming soon.</p>
        ) : (
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {services.map((s) => {
              const Icon = s.icon ? getIcon(s.icon) : null;
              return (
                <a key={s.slug} href={`/services/${s.slug}`}
                   className="group sv-card bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden hover:shadow-md hover:ring-brand-300 transition">
                  {s.image_url ? (
                    <img src={s.image_url} alt={s.name} loading="lazy" className="w-full aspect-[4/3] object-cover" />
                  ) : (
                    <div className="w-full aspect-[4/3] bg-brand-50 flex items-center justify-center text-brand-300">
                      {Icon ? <Icon className="h-10 w-10" /> : <span className="text-2xl font-bold">{s.name.charAt(0)}</span>}
                    </div>
                  )}
                  <div className="p-5">
                    <h2 className="font-bold text-slate-900 group-hover:text-brand-700 transition">{s.name}</h2>
                    {s.summary && <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{s.summary}</p>}
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
                      Read more
                      <svg className="w-4 h-4 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </main>
      <Footer meta={meta} />
    </>
  );
}
