import { ServiceHeader } from '../components/layout/service-header';
import { Footer } from '../components/layout/footer';
import { NotFoundPage } from './not-found';
import type { StorefrontMeta } from '../lib/types';

/**
 * Dedicated About page for SERVICE tenants (/about). The e-commerce AboutPage
 * renders the product about article with a "Shop our products" CTA — wrong for
 * a service business — so service tenants get this view instead, built from the
 * service_home.about block (title / body / highlights / image) the API already
 * exposes, plus the stats band and service-appropriate CTAs (inquiry form,
 * services catalog, WhatsApp). Pure content → static HTML.
 */

const plain = (html?: string) => (html || '').replace(/<[^>]*>/g, '');
function RT({ html, className }: { html: string; className?: string }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function ServiceAboutPage({ meta }: { meta: StorefrontMeta | null }) {
  if (!meta) return <NotFoundPage />;

  const about = meta.service_home?.about;
  const stats = meta.service_home?.stats;
  const whatsapp = meta.whatsapp ? meta.whatsapp.replace(/\D+/g, '') : null;
  const title = plain(about?.title) || `About ${meta.name}`;

  return (
    <>
      <ServiceHeader meta={meta} />
      <main>
        {/* Intro band */}
        <section className="bg-slate-50 border-b border-slate-100">
          <div className="mx-auto max-w-[1100px] px-4 sm:px-6 py-12 sm:py-16">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">About us</p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">{title}</h1>
          </div>
        </section>

        {/* Body + highlights */}
        <section className="mx-auto max-w-[1100px] px-4 sm:px-6 py-12 sm:py-16 grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          <div>
            {about?.body ? (
              <p className="text-[15px] text-slate-600 leading-relaxed whitespace-pre-line">{about.body}</p>
            ) : meta.about_html ? (
              // Sanitized server-side (tenant Markdown → HTML) — safe to inject.
              <div className="prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: meta.about_html }} />
            ) : (
              <p className="text-slate-500">More about us coming soon.</p>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <a href="/#contact" className="inline-flex bg-brand-600 hover:bg-brand-700 text-white font-semibold px-5 py-2.5 rounded-xl transition">
                Get in touch
              </a>
              <a href="/services" className="inline-flex bg-white ring-1 ring-slate-300 hover:ring-brand-300 text-slate-700 font-semibold px-5 py-2.5 rounded-xl transition">
                Our services
              </a>
              {whatsapp && (
                <a href={`https://wa.me/${whatsapp.startsWith('880') ? whatsapp : '88' + whatsapp}`} target="_blank" rel="noopener noreferrer"
                   className="inline-flex bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-5 py-2.5 rounded-xl transition">
                  WhatsApp us
                </a>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {about?.image_url && (
              <img src={about.image_url} alt={title} loading="lazy"
                   className="w-full rounded-2xl object-cover aspect-[4/3] ring-1 ring-slate-200" />
            )}
            {about?.highlights && about.highlights.length > 0 && (
              <ul className="space-y-2.5">
                {about.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <svg className="h-5 w-5 text-brand-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <RT html={h} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Stats band — reuse the service_home.stats numbers */}
        {stats?.visible && stats.items.length > 0 && (
          <section className="mx-auto max-w-[1100px] px-4 sm:px-6 pb-14 sm:pb-20">
            <div className="bg-brand-600 rounded-3xl px-6 py-10 grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
              {stats.items.map((item, i) => (
                <div key={i}>
                  <p className="text-3xl sm:text-4xl font-extrabold text-white">{item.number}</p>
                  <p className="mt-1 text-sm text-white/80">{item.label}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer meta={meta} />
    </>
  );
}
