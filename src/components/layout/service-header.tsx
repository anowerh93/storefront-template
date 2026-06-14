import type { StorefrontMeta } from '../../lib/types';

/**
 * Minimal sticky header for the standalone service pages (/services and
 * /services/[slug]). The one-page service home renders its own anchor-nav
 * header inline; these separate pages get this lightweight version so they
 * still feel part of the site. Brand-coloured CTA.
 */
export function ServiceHeader({ meta }: { meta: StorefrontMeta }) {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <a href="/" className="flex items-center gap-2.5 min-w-0">
          {meta.logo_url && <img src={meta.logo_url} alt={meta.name} className="h-9 w-9 rounded-lg object-cover" />}
          <span className="font-bold text-slate-900 truncate">{meta.name}</span>
        </a>
        <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-slate-600">
          <a href="/" className="hover:text-slate-900 transition">Home</a>
          <a href="/services" className="hover:text-slate-900 transition">Services</a>
          <a href="/#contact" className="hover:text-slate-900 transition">Contact</a>
        </nav>
        <a href="/#contact" className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">
          Book now
        </a>
      </div>
    </header>
  );
}
