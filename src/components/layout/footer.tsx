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

  return (
    <footer className="mt-16 bg-brand-900 text-brand-50">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 py-12 sm:py-14">
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
            {meta.about && (
              // Short summary only — hard-capped at 7 lines (the API already
              // sends a 300-char excerpt; the clamp guards the visual height).
              <p className="text-sm text-brand-200 leading-relaxed mb-4 max-w-xs line-clamp-7">{meta.about}</p>
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
              <FooterLink href="/#about">About</FooterLink>
              <FooterLink href="/#services">Services</FooterLink>
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
