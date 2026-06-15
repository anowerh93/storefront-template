import { Mail, Phone, Clock, Facebook, Instagram, Youtube, MessageCircle } from 'lucide-react';
import type { ServiceHomeConfig, StorefrontMeta } from '../../lib/types';

/**
 * Unified service-tenant header — ONE header on EVERY page (home, /services,
 * /services/[slug], /about), so the site feels consistent no matter where you
 * land. Combines the top contact bar + sticky nav + a CSS-only mobile menu
 * (no JS → works identically whether the page is a hydrated island or static
 * HTML) + the floating call/WhatsApp buttons.
 *
 * Nav uses FULL page routes (not on-page anchors), because anchor-only links
 * dead-link off the home page. Top-bar phones come from the hero config
 * (meta.service_home.hero); brand/email/social from the tenant meta.
 */

type Hero = ServiceHomeConfig['hero'];

/** Render sanitised inline rich-text HTML (whitelist-cleaned server-side). */
function RT({ html, className }: { html: string; className?: string }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
const plain = (html?: string) => (html || '').replace(/<[^>]*>/g, '');

export function ServiceHeader({ meta }: { meta: StorefrontMeta }) {
  const hero = meta.service_home?.hero;
  const ctaLabel = plain(hero?.cta_label) || 'Book now';

  // Full page routes so links work from any page. Team appears only when the
  // tenant has visible members (meta.has_team) — no dead link otherwise.
  const nav = [
    { label: 'Home', href: '/' },
    { label: 'About', href: '/about' },
    { label: 'Services', href: '/services' },
    ...(meta.has_team ? [{ label: 'Team', href: '/team' }] : []),
    { label: 'Contact', href: '/#contact' },
  ];

  return (
    <>
      <TopBar meta={meta} hero={hero} />

      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
        {/* CSS-only mobile toggle: this checkbox is the `peer` the mobile nav
            reacts to. Hidden, but still toggled by its <label> below. */}
        <input type="checkbox" id="svc-nav" className="peer hidden" aria-hidden="true" />

        <div className="mx-auto max-w-[1100px] px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-2.5 min-w-0">
            {meta.logo_url && <img src={meta.logo_url} alt={meta.name} className="h-9 w-9 rounded-lg object-cover" />}
            <span className="font-bold text-slate-900 truncate">{meta.name}</span>
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            {nav.map((item) => (
              <a key={item.href} href={item.href} className="hover:text-slate-900 transition">{item.label}</a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <a href="/#contact"
               className="hidden sm:inline-flex bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">
              {ctaLabel}
            </a>
            <label htmlFor="svc-nav" aria-label="Menu"
                   className="md:hidden p-2 -mr-2 text-slate-700 cursor-pointer">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </label>
          </div>
        </div>

        {/* Mobile dropdown — shown only while #svc-nav is checked. md:!hidden
            forces it gone on desktop regardless of the checkbox state. */}
        <nav className="hidden peer-checked:block md:!hidden border-t border-slate-100 bg-white px-4 py-3 space-y-1">
          {nav.map((item) => (
            <a key={item.href} href={item.href} className="block py-2 text-sm font-medium text-slate-700">{item.label}</a>
          ))}
          <a href="/#contact"
             className="block mt-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl text-center transition">
            {ctaLabel}
          </a>
        </nav>
      </header>

      <FloatingButtons meta={meta} hero={hero} />
    </>
  );
}

/** Brand-coloured top contact bar: note · email · availability · phones ·
 *  social + business name. Phones come from the hero config; the rest from
 *  the tenant meta. Hidden entirely when there's nothing to show. */
function TopBar({ meta, hero }: { meta: StorefrontMeta; hero?: Hero }) {
  const phones = (hero?.phones ?? []).filter(Boolean);
  const social = (meta.social_links ?? {}) as Record<string, string>;
  const tel = (p: string) => `tel:${p.replace(/[^\d+]/g, '')}`;
  const has = hero?.top_note || meta.email || hero?.support_label || phones.length || social.facebook || meta.name;
  if (!has) return null;
  return (
    <div className="bg-brand-600 text-white text-xs sm:text-sm">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 py-2 flex flex-wrap items-center gap-x-5 gap-y-1.5">
        {hero?.top_note && <RT html={hero.top_note} className="font-semibold hidden sm:inline" />}
        {meta.email && (
          <a href={`mailto:${meta.email}`} className="inline-flex items-center gap-1.5 hover:text-white/80 transition">
            <Mail className="h-4 w-4 shrink-0" /> <span className="truncate max-w-[180px]">{meta.email}</span>
          </a>
        )}
        {hero?.support_label && (
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4 shrink-0" /> <RT html={hero.support_label} />
          </span>
        )}
        {phones.length > 0 && (
          <a href={tel(phones[0])} className="inline-flex items-center gap-1.5 hover:text-white/80 transition">
            <Phone className="h-4 w-4 shrink-0" /> <span>{phones.join(' · ')}</span>
          </a>
        )}
        <div className="ml-auto inline-flex items-center gap-3">
          {social.facebook && <a href={social.facebook} target="_blank" rel="noopener" aria-label="Facebook" className="hover:text-white/80"><Facebook className="h-4 w-4" /></a>}
          {social.instagram && <a href={social.instagram} target="_blank" rel="noopener" aria-label="Instagram" className="hover:text-white/80"><Instagram className="h-4 w-4" /></a>}
          {social.youtube && <a href={social.youtube} target="_blank" rel="noopener" aria-label="YouTube" className="hover:text-white/80"><Youtube className="h-4 w-4" /></a>}
          <span className="hidden md:inline font-semibold">{meta.name}</span>
        </div>
      </div>
    </div>
  );
}

/** Floating call + WhatsApp buttons (bottom-right, every page). */
function FloatingButtons({ meta, hero }: { meta: StorefrontMeta; hero?: Hero }) {
  const callNumber = (hero?.phones ?? []).filter(Boolean)[0] || meta.whatsapp || '';
  const wa = meta.whatsapp ? meta.whatsapp.replace(/\D/g, '') : '';
  if (!callNumber && !wa) return null;
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3">
      {callNumber && (
        <a href={`tel:${callNumber.replace(/[^\d+]/g, '')}`} aria-label="Call us"
           className="w-12 h-12 rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-lg ring-4 ring-brand-600/20 flex items-center justify-center transition">
          <Phone className="h-5 w-5" />
        </a>
      )}
      {wa && (
        <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener" aria-label="WhatsApp"
           className="w-12 h-12 rounded-full bg-[#25D366] hover:brightness-95 text-white shadow-lg ring-4 ring-[#25D366]/20 flex items-center justify-center transition">
          <MessageCircle className="h-5 w-5" />
        </a>
      )}
    </div>
  );
}
