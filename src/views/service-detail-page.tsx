import { useState } from 'react';
import type { FormEvent } from 'react';
import { ServiceHeader } from '../components/layout/service-header';
import { Footer } from '../components/layout/footer';
import { NotFoundPage } from './not-found';
import { submitLead } from '../lib/api';
import type { ServiceDetail, StorefrontMeta } from '../lib/types';

/**
 * Service detail page — image/gallery + rich description + FAQ + a booking
 * form that feeds the Lead pipeline (the inquiry is pre-tagged with the
 * service name). No price; the CTA is "Book / send inquiry".
 */
export function ServiceDetailPage({ meta, service }: { meta: StorefrontMeta | null; service: ServiceDetail | null }) {
  if (!meta || !service) return <NotFoundPage />;

  const [hero, setHero] = useState(service.image_url);
  const thumbs = [service.image_url, ...service.gallery_urls].filter(Boolean) as string[];

  return (
    <>
      <ServiceHeader meta={meta} />
      <main className="mx-auto max-w-[1100px] px-4 sm:px-6 py-8 sm:py-12">
        <nav className="text-xs text-slate-500 mb-5">
          <a href="/services" className="hover:text-slate-700">Services</a>
          <span className="mx-1.5">/</span>
          <span className="text-slate-700">{service.name}</span>
        </nav>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-8 lg:gap-12 items-start">
          {/* ── Left: media + description + FAQ ── */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">{service.name}</h1>
            {service.summary && <p className="mt-2 text-slate-600 leading-relaxed">{service.summary}</p>}

            {hero && (
              <div className="mt-6">
                <img src={hero} alt={service.name} className="w-full rounded-2xl object-cover aspect-[16/10] ring-1 ring-slate-200" />
                {thumbs.length > 1 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {thumbs.map((t, i) => (
                      <button key={i} type="button" onClick={() => setHero(t)}
                              className={`h-16 w-16 rounded-lg overflow-hidden ring-2 transition ${t === hero ? 'ring-brand-500' : 'ring-slate-200 hover:ring-slate-300'}`}>
                        <img src={t} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {service.description_html && (
              <div className="prose prose-slate max-w-none mt-8"
                   dangerouslySetInnerHTML={{ __html: service.description_html }} />
            )}

            {service.faq.length > 0 && (
              <div className="mt-10">
                <h2 className="text-xl font-bold text-slate-900 mb-3">Frequently asked questions</h2>
                <div className="divide-y divide-slate-200 rounded-2xl ring-1 ring-slate-200 overflow-hidden">
                  {service.faq.map((f, i) => (
                    <details key={i} className="group bg-white">
                      <summary className="flex items-center justify-between gap-3 cursor-pointer px-5 py-4 text-sm font-semibold text-slate-900">
                        {f.q}
                        <svg className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <p className="px-5 pb-4 text-sm text-slate-600 leading-relaxed whitespace-pre-line">{f.a}</p>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Right: booking form (sticky on desktop) ── */}
          <aside className="lg:sticky lg:top-20">
            <BookingForm meta={meta} serviceName={service.name} />
          </aside>
        </div>
      </main>
      <Footer meta={meta} />
    </>
  );
}

/** Booking / inquiry form — submits a Lead pre-tagged with the service. */
function BookingForm({ meta, serviceName }: { meta: StorefrontMeta; serviceName: string }) {
  const [form, setForm] = useState({ name: '', phone: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const whatsapp = meta.whatsapp ? meta.whatsapp.replace(/\D+/g, '') : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      await submitLead({
        customer_name: form.name,
        customer_phone: form.phone,
        service: serviceName,
        message: form.message || undefined,
        source_url: typeof window !== 'undefined' ? window.location.href : undefined,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200 p-6 shadow-sm">
      <h2 className="font-bold text-slate-900">Book this service</h2>
      <p className="mt-1 text-sm text-slate-500">Send your details and we'll get back to you.</p>

      {sent ? (
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mb-3">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <p className="font-semibold text-slate-900">Thanks! We received your request.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Your name *</label>
            <input type="text" required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                   className="w-full border border-slate-300 rounded-xl text-base sm:text-sm px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mobile number *</label>
            <input type="tel" required maxLength={32} placeholder="01XXXXXXXXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                   className="w-full border border-slate-300 rounded-xl text-base sm:text-sm px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Message <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea rows={3} maxLength={2000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                      className="w-full border border-slate-300 rounded-xl text-base sm:text-sm px-4 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5">{error}</p>}
          <button type="submit" disabled={sending}
                  className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition">
            {sending ? 'Sending…' : 'Book now'}
          </button>
          {whatsapp && (
            <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener"
               className="block text-center text-sm font-medium text-emerald-700 hover:text-emerald-800">
              or message us on WhatsApp
            </a>
          )}
        </form>
      )}
    </div>
  );
}
