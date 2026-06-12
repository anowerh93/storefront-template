import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { getIcon } from '../lib/icons';
import { submitLead } from '../lib/api';
import type { ServiceHomeConfig, ServiceSectionBg, ServiceSectionKey, StorefrontMeta } from '../lib/types';

/**
 * Service-tenant website (urbanacdesign.com-style one-domain site):
 * hero → about → services → portfolio → stats → testimonials → FAQ →
 * contact/inquiry form. Rendered at `/` when meta.business_type === 'service'.
 *
 * Mirrors App\Services\ServiceSiteConfig — change blocks in lockstep.
 * Every text field is dashboard-authored inline rich text, sanitised
 * server-side (App\Support\RichText) so rendering it as HTML is safe.
 * Blocks support per-section backgrounds (SectionBg) + scroll reveal,
 * the same machinery as funnel pages.
 */

type Props = { meta: StorefrontMeta; config: ServiceHomeConfig };

/** Render sanitised inline rich-text HTML (safe — whitelist-cleaned server-side). */
function RT({ html, as: Tag = 'span', className }: { html: string; as?: any; className?: string }) {
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Plain-text version of a rich value (nav buttons, <option> labels). */
const plain = (html: string) => (html || '').replace(/<[^>]*>/g, '');

function isDarkHex(hex?: string): boolean {
  const m = /^#?([0-9a-fA-F]{6})$/.exec((hex || '').trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 140;
}

/** Per-section background (colour / gradient / image) — falls back to the
 *  block's design default. Dark backgrounds get .funnel-dark (text whitens;
 *  .sv-card children keep dark text — see styles.css). */
function SectionBg({ bg, fallback = '', children }: { bg?: ServiceSectionBg; fallback?: string; children: ReactNode }) {
  const t = bg?.bg_type || 'none';
  let style: CSSProperties = {};
  let dark = false;
  let has = false;
  if (t === 'color') {
    style = { background: bg!.bg_color || '#0f172a' };
    dark = isDarkHex(bg!.bg_color);
    has = true;
  } else if (t === 'gradient') {
    style = { background: `linear-gradient(${bg!.bg_gradient_angle ?? 135}deg, ${bg!.bg_gradient_from || '#6366f1'}, ${bg!.bg_gradient_to || '#f59e0b'})` };
    dark = isDarkHex(bg!.bg_gradient_from);
    has = true;
  } else if (t === 'image' && bg!.bg_image_url) {
    style = {
      backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${JSON.stringify(bg!.bg_image_url)})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
    dark = true;
    has = true;
  }
  if (!has) return <div className={fallback}>{children}</div>;
  return <div className={dark ? 'funnel-dark' : ''} style={style}>{children}</div>;
}

/** Fade/slide a block in as it scrolls into view (also triggers the per-word
 *  data-anim animations via .funnel-revealed). Disabled → renders immediately. */
function Reveal({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(!enabled);
  useEffect(() => {
    if (!enabled || shown) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) { setShown(true); io.disconnect(); } },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enabled, shown]);
  return (
    <div ref={ref} className={`transition-all duration-700 ease-out ${shown ? 'translate-y-0 opacity-100 funnel-revealed' : 'translate-y-6 opacity-0'}`}>
      {children}
    </div>
  );
}

/** Section key → nav anchor label. Only visible sections become nav items. */
const NAV_LABELS: Partial<Record<ServiceSectionKey, string>> = {
  about: 'About',
  services: 'Services',
  portfolio: 'Our work',
  testimonials: 'Reviews',
  faq: 'FAQ',
  contact: 'Contact',
};

/** Default block backgrounds when the tenant hasn't set a custom one. */
const FALLBACK_BG: Record<ServiceSectionKey, string> = {
  hero: 'bg-slate-50',
  about: '',
  services: 'bg-slate-50',
  portfolio: '',
  stats: '',
  testimonials: 'bg-slate-50',
  faq: '',
  contact: 'bg-slate-900 funnel-dark',
};

export function ServiceHome({ meta, config }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const animate = config.animate !== false;

  const navItems = useMemo(
    () =>
      config.section_order
        .filter((key) => NAV_LABELS[key] && (config[key] as { visible?: boolean })?.visible)
        .map((key) => ({ key, label: NAV_LABELS[key]! })),
    [config],
  );

  const renderSection = (key: ServiceSectionKey) => {
    switch (key) {
      case 'hero':         return config.hero.visible         ? <Hero config={config} />                : null;
      case 'about':        return config.about.visible        ? <About block={config.about} />          : null;
      case 'services':     return config.services.visible     ? <Services block={config.services} />    : null;
      case 'portfolio':    return config.portfolio.visible    ? <Portfolio block={config.portfolio} />  : null;
      case 'stats':        return config.stats.visible        ? <Stats block={config.stats} />          : null;
      case 'testimonials': return config.testimonials.visible ? <Testimonials block={config.testimonials} /> : null;
      case 'faq':          return config.faq.visible          ? <Faq block={config.faq} />              : null;
      case 'contact':      return config.contact.visible      ? <Contact meta={meta} config={config} /> : null;
      default:             return null;
    }
  };

  return (
    <div>
      {/* ── Sticky anchor-nav header ─────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-[1100px] px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-2.5 min-w-0">
            {meta.logo_url && <img src={meta.logo_url} alt={meta.name} className="h-9 w-9 rounded-lg object-cover" />}
            <span className="font-bold text-slate-900 truncate">{meta.name}</span>
          </a>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            {navItems.map((item) => (
              <a key={item.key} href={`#${item.key}`} className="hover:text-slate-900 transition">{item.label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {config.contact.visible && (
              <a href="#contact"
                 className="hidden sm:inline-flex bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">
                {plain(config.hero.cta_label) || 'Contact us'}
              </a>
            )}
            <button type="button" aria-label="Menu" onClick={() => setMenuOpen((v) => !v)}
                    className="md:hidden p-2 text-slate-700">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 7h16M4 12h16M4 17h16'} />
              </svg>
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="md:hidden border-t border-slate-100 bg-white px-4 py-3 space-y-1">
            {navItems.map((item) => (
              <a key={item.key} href={`#${item.key}`} onClick={() => setMenuOpen(false)}
                 className="block py-2 text-sm font-medium text-slate-700">{item.label}</a>
            ))}
          </nav>
        )}
      </header>

      <main>
        {config.section_order.map((key) => {
          const node = renderSection(key);
          return node ? (
            <Reveal key={key} enabled={animate}>
              <SectionBg bg={config[key] as ServiceSectionBg} fallback={FALLBACK_BG[key]}>
                {node}
              </SectionBg>
            </Reveal>
          ) : null;
        })}
      </main>
    </div>
  );
}

// ── Blocks ─────────────────────────────────────────────────────

function Hero({ config }: { config: ServiceHomeConfig }) {
  const b = config.hero;
  return (
    <section id="hero">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 py-14 sm:py-20 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          {b.eyebrow && (
            <p className="inline-flex bg-brand-100 text-brand-800 text-xs font-semibold px-3 py-1 rounded-full mb-4">
              <RT html={b.eyebrow} />
            </p>
          )}
          <RT as="h1" html={b.headline} className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight" />
          {b.subheadline && <RT as="p" html={b.subheadline} className="mt-4 text-base sm:text-lg text-slate-600 max-w-xl block" />}
          {config.contact.visible && (
            <a href="#contact"
               className="mt-7 inline-flex bg-brand-600 hover:bg-brand-700 text-white font-semibold px-6 py-3 rounded-xl transition">
              <RT html={b.cta_label || 'Contact us'} />
            </a>
          )}
        </div>
        {b.image_url && (
          <img src={b.image_url} alt={plain(b.headline) || 'Hero photo'} loading="eager"
               className="w-full rounded-2xl object-cover aspect-[4/3] ring-1 ring-slate-200 shadow-sm" />
        )}
      </div>
    </section>
  );
}

function About({ block }: { block: ServiceHomeConfig['about'] }) {
  return (
    <section id="about" className="scroll-mt-20">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 py-14 sm:py-20 grid lg:grid-cols-2 gap-10 items-center">
        {block.image_url && (
          <img src={block.image_url} alt={plain(block.title) || 'About us'} loading="lazy"
               className="w-full rounded-2xl object-cover aspect-[4/3] ring-1 ring-slate-200" />
        )}
        <div>
          <RT as="h2" html={block.title} className="text-2xl sm:text-3xl font-bold text-slate-900" />
          {block.body && <p className="mt-4 text-slate-600 whitespace-pre-line leading-relaxed">{block.body}</p>}
          {block.highlights.length > 0 && (
            <ul className="mt-6 space-y-2.5">
              {block.highlights.map((h, i) => (
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
      </div>
    </section>
  );
}

function Services({ block }: { block: ServiceHomeConfig['services'] }) {
  if (block.items.length === 0) return null;
  return (
    <section id="services" className="scroll-mt-20">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 py-14 sm:py-20">
        <div className="text-center max-w-2xl mx-auto">
          <RT as="h2" html={block.title} className="text-2xl sm:text-3xl font-bold text-slate-900" />
          {block.subtitle && <RT as="p" html={block.subtitle} className="mt-3 text-slate-600 block" />}
        </div>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {block.items.map((item, i) => {
            const Icon = getIcon(item.icon);
            return (
              <div key={i} className="sv-card bg-white rounded-2xl ring-1 ring-slate-200 p-6 hover:shadow-md transition">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-100 text-brand-700 mb-4">
                  <Icon className="h-6 w-6" />
                </div>
                <RT as="h3" html={item.title} className="font-bold text-slate-900" />
                {item.body && <RT as="p" html={item.body} className="mt-1.5 text-sm text-slate-600 leading-relaxed block" />}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Portfolio({ block }: { block: ServiceHomeConfig['portfolio'] }) {
  if (block.items.length === 0) return null;
  return (
    <section id="portfolio" className="scroll-mt-20">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 py-14 sm:py-20">
        <div className="text-center max-w-2xl mx-auto">
          <RT as="h2" html={block.title} className="text-2xl sm:text-3xl font-bold text-slate-900" />
          {block.subtitle && <RT as="p" html={block.subtitle} className="mt-3 text-slate-600 block" />}
        </div>
        <div className="mt-10 grid grid-cols-2 lg:grid-cols-3 gap-4">
          {block.items.map((item, i) => (
            <figure key={i} className="group relative rounded-2xl overflow-hidden ring-1 ring-slate-200">
              <img src={item.image_url} alt={plain(item.caption) || 'Portfolio photo'} loading="lazy"
                   className="w-full aspect-[4/3] object-cover group-hover:scale-105 transition duration-300" />
              {item.caption && (
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/80 to-transparent text-white text-xs sm:text-sm font-medium px-3 pb-2.5 pt-8">
                  <RT html={item.caption} />
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stats({ block }: { block: ServiceHomeConfig['stats'] }) {
  if (block.items.length === 0) return null;
  return (
    <section id="stats">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 py-6">
        <div className="bg-brand-600 rounded-3xl px-6 py-10 grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {block.items.map((item, i) => (
            <div key={i}>
              <p className="text-3xl sm:text-4xl font-extrabold text-white">{item.number}</p>
              <p className="mt-1 text-sm text-white/80">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials({ block }: { block: ServiceHomeConfig['testimonials'] }) {
  if (block.items.length === 0) return null;
  return (
    <section id="testimonials" className="scroll-mt-20">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 py-14 sm:py-20">
        <RT as="h2" html={block.title} className="text-2xl sm:text-3xl font-bold text-slate-900 text-center block" />
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {block.items.map((t, i) => (
            <figure key={i} className="sv-card bg-white rounded-2xl ring-1 ring-slate-200 p-6">
              <div className="flex gap-0.5 text-amber-400" aria-label={`${t.rating} out of 5 stars`}>
                {Array.from({ length: 5 }, (_, s) => (
                  <svg key={s} className={`h-4 w-4 ${s < t.rating ? '' : 'text-slate-200'}`} fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.077 10.1c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                ))}
              </div>
              <blockquote className="mt-3 text-sm text-slate-700 leading-relaxed">
                “<RT html={t.body} />”
              </blockquote>
              <figcaption className="mt-4 text-sm">
                <span className="font-semibold text-slate-900">{t.name}</span>
                {t.role && <span className="text-slate-500"> — {t.role}</span>}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq({ block }: { block: ServiceHomeConfig['faq'] }) {
  const [open, setOpen] = useState<number | null>(0);
  if (block.items.length === 0) return null;
  return (
    <section id="faq" className="scroll-mt-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-14 sm:py-20">
        <RT as="h2" html={block.title} className="text-2xl sm:text-3xl font-bold text-slate-900 text-center block" />
        <div className="mt-8 divide-y divide-slate-200 border-y border-slate-200">
          {block.items.map((f, i) => (
            <div key={i}>
              <button type="button" onClick={() => setOpen(open === i ? null : i)}
                      className="w-full flex items-center justify-between gap-4 py-4 text-left">
                <RT html={f.q} className="font-semibold text-slate-900 text-sm sm:text-base" />
                <span className="text-slate-400 text-xl leading-none shrink-0">{open === i ? '−' : '+'}</span>
              </button>
              {open === i && <RT as="p" html={f.a} className="pb-4 text-sm text-slate-600 leading-relaxed block" />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Contact block + inquiry form (→ Lead pipeline) ─────────────

function Contact({ meta, config }: { meta: StorefrontMeta; config: ServiceHomeConfig }) {
  const block = config.contact;
  const serviceOptions = config.services.visible
    ? config.services.items.map((s) => plain(s.title)).filter(Boolean)
    : [];

  const [form, setForm] = useState({ name: '', phone: '', service: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      await submitLead({
        customer_name: form.name,
        customer_phone: form.phone,
        service: form.service || undefined,
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

  const whatsapp = meta.whatsapp ? meta.whatsapp.replace(/\D+/g, '') : null;

  return (
    <section id="contact" className="scroll-mt-20">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 py-14 sm:py-20 grid lg:grid-cols-2 gap-10">
        <div>
          <RT as="h2" html={block.title} className="text-2xl sm:text-3xl font-bold text-slate-900" />
          {block.subtitle && <RT as="p" html={block.subtitle} className="mt-3 text-slate-600 leading-relaxed block" />}
          <div className="mt-8 space-y-3 text-sm">
            {meta.location && <p className="flex items-center gap-2.5 text-slate-600">📍 {meta.location}</p>}
            {meta.email && (
              <p><a href={`mailto:${meta.email}`} className="flex items-center gap-2.5 text-slate-600 hover:underline">✉️ {meta.email}</a></p>
            )}
            {whatsapp && (
              <a href={`https://wa.me/${whatsapp.startsWith('880') ? whatsapp : '88' + whatsapp}`} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition">
                WhatsApp us
              </a>
            )}
          </div>
        </div>

        <div className="sv-card bg-white rounded-2xl ring-1 ring-slate-200 p-6 sm:p-8">
          {sent ? (
            <div className="text-center py-10">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 mb-4">
                <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <RT as="p" html={block.success_message || 'Thanks! We received your inquiry.'} className="font-semibold text-slate-900 block" />
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {/* Honeypot — hidden from humans, bots fill it */}
              <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Your name *</label>
                <input type="text" required maxLength={120} value={form.name}
                       onChange={(e) => setForm({ ...form, name: e.target.value })}
                       className="w-full border border-slate-300 rounded-xl text-sm px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mobile number *</label>
                <input type="tel" required maxLength={32} placeholder="01XXXXXXXXX" value={form.phone}
                       onChange={(e) => setForm({ ...form, phone: e.target.value })}
                       className="w-full border border-slate-300 rounded-xl text-sm px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              {serviceOptions.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">What do you need?</label>
                  <select value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })}
                          className="w-full border border-slate-300 rounded-xl text-sm px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                    <option value="">Choose a service (optional)</option>
                    {serviceOptions.map((s, i) => <option key={i} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Your message</label>
                <textarea rows={3} maxLength={2000} value={form.message}
                          onChange={(e) => setForm({ ...form, message: e.target.value })}
                          className="w-full border border-slate-300 rounded-xl text-sm px-4 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5">{error}</p>}
              <button type="submit" disabled={sending}
                      className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition">
                {sending ? 'Sending…' : <RT html={block.button_label || 'Send inquiry'} />}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
