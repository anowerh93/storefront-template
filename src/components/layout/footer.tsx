// Footer uses the tenant brand palette (brand-*) end-to-end and renders ONLY
// real tenant data — no fabricated email, no placeholder links. Every row is
// conditional: contact location/phone/email show only when set, and the
// "Links" column appears only if the tenant added footer links in
// Customization. "Powered by Reply.BD" is the platform credit (intentional).
import { Facebook, Instagram, Youtube, MessageCircle, MapPin, Phone, Mail } from 'lucide-react';
import type { StorefrontMeta, Category } from '../../lib/types';

export function Footer({
  meta,
  categories = [],
}: {
  meta: StorefrontMeta;
  categories?: Category[];
}) {
  const social = (meta.social_links ?? {}) as Record<string, string>;
  const footerLinks = meta.footer_links ?? [];
  // Editable menu columns; fallbacks keep cached payloads (no footer_nav
  // yet) rendering exactly the old hardcoded columns.
  const dept = meta.footer_nav?.department ?? { visible: true, heading: 'Department' };
  const shop = meta.footer_nav?.shop ?? {
    visible: true,
    heading: 'Shop',
    links: [
      { label: 'All products', url: '/products' },
      { label: 'Categories', url: '/categories' },
      { label: 'Track Order', url: '/order/lookup' },
      { label: `About ${meta.name}`, url: '/about' },
    ],
  };
  // Service-tenant websites have no catalog — swap the shop columns for
  // on-page anchors so the footer never links to empty product pages.
  const isService = meta.business_type === 'service';

  // Custom backdrop (builder → Footer & Social → Footer background).
  // Whenever the chosen mode is missing its value, fall back to brand.
  const bg = meta.footer_nav?.bg;
  const bgImage = bg?.type === 'image' && bg.image_url ? bg.image_url : null;
  const bgColor = bg?.type === 'color' && bg.color ? bg.color : null;
  // A light custom colour would hide the default light footer text — flip the
  // text dark via .footer-on-light (styles.css). Image backgrounds always
  // carry a dark scrim, so they keep light text. Mirrors .funnel-dark.
  const lightBg = bgColor ? isLightColor(bgColor) : false;

  return (
    <footer
      className={`relative mt-16 ${lightBg ? 'footer-on-light' : 'text-brand-50'} ${bgImage || bgColor ? '' : 'bg-brand-900'}`}
      style={
        bgImage
          ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : bgColor
            ? { backgroundColor: bgColor }
            : undefined
      }
    >
      {/* Dark scrim keeps the light footer text readable on any image */}
      {bgImage && <div className="absolute inset-0 bg-black/65" aria-hidden="true" />}
      <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 py-12 sm:py-14">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8">
          {/* Brand + contact */}
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-3">
              {meta.logo_url ? (
                <img src={meta.logo_url} alt={meta.name} className="h-9 w-auto max-w-[160px] rounded-lg object-contain" />
              ) : (
                <div className="h-9 w-9 rounded-lg bg-brand-700 flex items-center justify-center text-white font-bold">
                  {meta.name.charAt(0).toUpperCase()}
                </div>
              )}
              {!meta.logo_url && (
                <span className="font-bold text-white text-lg">{meta.name}</span>
              )}
            </div>
            {meta.footer_about && (
              // ONLY the hand-written footer summary renders here — never the
              // About article. Clamped at 7 lines as a visual safety net.
              <p className="text-sm text-brand-200 leading-relaxed mb-4 max-w-xs line-clamp-7">{meta.footer_about}</p>
            )}
            {(meta.location || meta.whatsapp || meta.email) && (
              <ul className="space-y-2 text-sm">
                {meta.location && (
                  <ContactRow icon={MapPin}><span className="text-brand-200">{meta.location}</span></ContactRow>
                )}
                {meta.whatsapp && (
                  <ContactRow icon={Phone}>
                    <a href={`tel:+${meta.whatsapp.replace(/\D/g, '')}`} className="text-brand-200 hover:text-white">+{meta.whatsapp}</a>
                  </ContactRow>
                )}
                {meta.email && (
                  <ContactRow icon={Mail}>
                    <a href={`mailto:${meta.email}`} className="text-brand-200 hover:text-white break-all">{meta.email}</a>
                  </ContactRow>
                )}
              </ul>
            )}
          </div>

          {isService ? (
            <FooterCol title="Quick links">
              <FooterLink href="/about">About</FooterLink>
              <FooterLink href="/services">Services</FooterLink>
              <FooterLink href="/#contact">Contact</FooterLink>
              {meta.messenger?.url && (
                <a href={meta.messenger.url} target="_blank" rel="noopener" className="block py-1 text-sm text-brand-200 hover:text-white transition">
                  Contact via Messenger
                </a>
              )}
            </FooterCol>
          ) : (
            <>
              {/* Department = categories under an editable heading. The API
                  resolves the tenant's picked list + order into items; cached
                  payloads without items fall back to the old auto slice. */}
              {dept.visible && (() => {
                const items = dept.items
                  ?? categories.slice(0, 6).map((c) => ({ label: c.name, url: `/categories/${c.slug}` }));
                return (
                  <FooterCol title={dept.heading}>
                    {items.map((l, i) => (
                      <FooterLink key={i} href={l.url}>{l.label}</FooterLink>
                    ))}
                    {items.length === 0 && (
                      <FooterLink href="/products">All products</FooterLink>
                    )}
                  </FooterCol>
                );
              })()}

              {/* Shop = tenant-editable links (defaults merged by the API) */}
              {shop.visible && (
                <FooterCol title={shop.heading}>
                  {shop.links.map((l, i) => (
                    <FooterLink key={i} href={l.url}>{l.label}</FooterLink>
                  ))}
                  {meta.messenger?.url && (
                    <a href={meta.messenger.url} target="_blank" rel="noopener" className="block py-1 text-sm text-brand-200 hover:text-white transition">
                      Contact via Messenger
                    </a>
                  )}
                </FooterCol>
              )}
            </>
          )}

          {/* Tenant-defined links (Privacy / Terms / FAQ …) — only if set */}
          {footerLinks.length > 0 && (
            <FooterCol title="Links">
              {footerLinks.map((l, i) => (
                <FooterLink key={i} href={l.url}>{l.label}</FooterLink>
              ))}
            </FooterCol>
          )}

          {/* WhatsApp newsletter — numbers land in the tenant's Subscribers
              inbox. Submit handling lives in Base.astro (global listener on
              [data-newsletter-form]) because this footer is usually static. */}
          {!isService && (meta.footer_nav?.newsletter?.visible ?? false) && (
            <div className="col-span-2 sm:col-span-1">
              <h4 className="font-semibold text-white text-sm mb-3 uppercase tracking-wide">
                {meta.footer_nav!.newsletter!.heading}
              </h4>
              <p className="text-sm text-brand-200 leading-relaxed mb-3 max-w-xs">
                {meta.footer_nav!.newsletter!.text}
              </p>
              {/* Stacked so the number field + button stay full-size and easy
                  to tap on mobile, where this column is otherwise cramped. */}
              <form data-newsletter-form className="flex flex-col gap-2 max-w-xs" noValidate>
                <label className="sr-only" htmlFor="footer-whatsapp">WhatsApp number</label>
                <input
                  id="footer-whatsapp"
                  name="whatsapp"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  required
                  placeholder="01XXXXXXXXX"
                  className="w-full rounded-lg border border-brand-700 bg-brand-800 px-3.5 py-2.5 text-base sm:text-sm text-white placeholder:text-brand-400 focus:outline-none focus:ring-2 focus:ring-white/40"
                />
                {/* Honeypot — hidden from humans, bots fill it */}
                <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
                <button
                  type="submit"
                  className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-brand-900 transition hover:bg-brand-100"
                >
                  Sign up
                </button>
              </form>
              <p data-newsletter-ok hidden className="mt-2 text-sm font-medium text-emerald-300">
                ✓ You're in! Offers will reach your WhatsApp first.
              </p>
              <p data-newsletter-err hidden className="mt-2 text-sm text-amber-300"></p>
            </div>
          )}
        </div>

        {/* Bottom strip */}
        <div className="mt-10 pt-6 border-t border-brand-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-brand-300">© {new Date().getFullYear()} {meta.name}. All rights reserved.</p>

          <div className="flex items-center gap-2">
            {social.facebook && <SocialIcon href={social.facebook} icon={Facebook} label="Facebook" />}
            {social.instagram && <SocialIcon href={social.instagram} icon={Instagram} label="Instagram" />}
            {social.youtube && <SocialIcon href={social.youtube} icon={Youtube} label="YouTube" />}
            {meta.messenger?.url && <SocialIcon href={meta.messenger.url} icon={MessageCircle} label="Messenger" />}
          </div>

          <p className="text-xs text-brand-300">
            Powered by <a href="https://reply.bd" target="_blank" rel="noopener" className="font-semibold text-white hover:underline">Reply.BD</a>
          </p>
        </div>
      </div>
    </footer>
  );
}

/** True when a #RRGGBB colour is light enough that the default light footer
 *  text would be unreadable on it (perceived sRGB luminance > 0.6). */
function isLightColor(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="font-semibold text-white text-sm mb-3 uppercase tracking-wide">{title}</h4>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="block py-1 text-sm text-brand-200 hover:text-white transition">
      {children}
    </a>
  );
}

function ContactRow({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-brand-400 shrink-0" />
      {children}
    </li>
  );
}

function SocialIcon({ href, icon: Icon, label }: { href: string; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      aria-label={label}
      className="w-9 h-9 rounded-full bg-brand-800 hover:bg-brand-700 flex items-center justify-center text-brand-200 hover:text-white transition"
    >
      <Icon className="h-4 w-4" />
    </a>
  );
}
