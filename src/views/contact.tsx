import { useRef, useState } from 'react';
import { Mail, Phone, Loader2, MessageCircle } from 'lucide-react';
import { Header } from '../components/layout/header';
import { Footer } from '../components/layout/footer';
import { MessengerCTA } from '../components/layout/messenger-cta';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/ui/button';
import { TurnstileWidget } from '../components/auth/turnstile';
import { NotFoundPage } from './not-found';
import { submitContact } from '../lib/api';
import type { StorefrontMeta } from '../lib/types';

/**
 * Contact page (meta fetched in src/pages/contact.astro). Shows the shop's
 * contact details beside a message form that emails the owner
 * (POST /storefronts/{slug}/contact). Guest-friendly — no login. Same honeypot
 * + Turnstile discipline as the auth forms; the honeypot is read from the live
 * DOM via a ref (a controlled input would never see a bot's programmatic fill).
 */
export function ContactPage({ meta }: { meta: StorefrontMeta | null }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const turnstileToken = useRef<string | null>(null);
  const resetTurnstile = useRef<(() => void) | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);

  if (!meta) return <NotFoundPage />;

  const siteKey = meta.turnstile?.site_key ?? null;
  const whatsapp = meta.whatsapp ? meta.whatsapp.replace(/\D+/g, '') : null;
  const waLink = whatsapp ? `https://wa.me/${whatsapp.startsWith('880') ? whatsapp : '88' + whatsapp}` : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await submitContact({
        customer_name: form.name,
        customer_phone: form.phone,
        customer_email: form.email || undefined,
        message: form.message,
        source_url: typeof window !== 'undefined' ? window.location.href : undefined,
        company: honeypot.current?.value || undefined,
        cf_turnstile_response: turnstileToken.current ?? undefined,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      resetTurnstile.current?.();
      turnstileToken.current = null;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Header meta={meta} />

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2">
          {meta.contact_heading?.trim() || `Contact ${meta.name}`}
        </h1>
        <p className="text-slate-500 mb-8 max-w-2xl whitespace-pre-line">
          {meta.contact_intro?.trim() || "Have a question about a product or your order? Send us a message and we'll get back to you."}
        </p>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
          {/* Contact details */}
          <div className="space-y-4 text-sm">
            {meta.location && (
              <p className="flex items-start gap-2.5 text-slate-600"><span aria-hidden="true">📍</span><span>{meta.location}</span></p>
            )}
            {meta.email && (
              <p>
                <a href={`mailto:${meta.email}`} className="inline-flex items-center gap-2.5 text-slate-600 hover:underline">
                  <Mail className="h-4 w-4 shrink-0" />{meta.email}
                </a>
              </p>
            )}
            {meta.whatsapp && (
              <p className="flex items-center gap-2.5 text-slate-600"><Phone className="h-4 w-4 shrink-0" />{meta.whatsapp}</p>
            )}
            <div className="flex flex-wrap gap-3 pt-2">
              {waLink && (
                <a href={waLink} target="_blank" rel="noopener noreferrer"
                   className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition">
                  WhatsApp us
                </a>
              )}
              {meta.messenger?.url && (
                <a href={meta.messenger.url} target="_blank" rel="noopener">
                  <Button variant="outline"><MessageCircle className="h-4 w-4" /> Message on Facebook</Button>
                </a>
              )}
            </div>
          </div>

          {/* Message form */}
          <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-5 sm:p-6">
            {sent ? (
              <div className="text-center py-10">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 mb-4">
                  <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="font-semibold text-slate-900">Thanks! Your message has been sent.</p>
                <p className="text-sm text-slate-500 mt-1">We'll get back to you soon.</p>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                {/* Honeypot — hidden from humans; bots fill it. Read via ref. */}
                <input ref={honeypot} type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

                {error && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
                )}

                <div>
                  <Label htmlFor="ct-name">Your name <span className="text-rose-500">*</span></Label>
                  <Input id="ct-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                         maxLength={120} required className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="ct-phone">Phone <span className="text-rose-500">*</span></Label>
                  <Input id="ct-phone" type="tel" inputMode="tel" placeholder="01XXXXXXXXX"
                         value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                         maxLength={32} required className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="ct-email">Email <span className="font-normal text-slate-400">(optional)</span></Label>
                  <Input id="ct-email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com"
                         value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                         maxLength={150} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="ct-message">Message <span className="text-rose-500">*</span></Label>
                  <Textarea id="ct-message" rows={4} value={form.message}
                            onChange={(e) => setForm({ ...form, message: e.target.value })}
                            maxLength={2000} required className="mt-1.5" />
                </div>

                <TurnstileWidget siteKey={siteKey} onToken={(t) => { turnstileToken.current = t; }} resetRef={resetTurnstile} />

                <Button type="submit" variant="brand" className="w-full" disabled={submitting}>
                  {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>) : 'Send message'}
                </Button>
              </form>
            )}
          </div>
        </div>
      </main>

      <Footer meta={meta} />
      <MessengerCTA href={meta.messenger?.url ?? null} />
    </>
  );
}
