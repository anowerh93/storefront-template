import { Facebook, Instagram, Youtube, MessageCircle, MapPin, Phone, Mail } from 'lucide-react';
import type { StorefrontMeta, Category } from '../../lib/types';

/**
 * 5-column footer based on the Omerce reference:
 *   Brand · Department · About us · Services · Help · App Support
 *
 * Most columns are static; "Department" mirrors the live category list so
 * tenants get auto-updated footer nav as they add categories.
 */
export function Footer({
  meta,
  categories = [],
}: {
  meta: StorefrontMeta;
  categories?: Category[];
}) {
  const social = (meta.social_links ?? {}) as Record<string, string>;

  return (
    <footer className="mt-16 bg-emerald-900 text-emerald-50">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 py-12 sm:py-14">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-8">
          {/* Brand col */}
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-3">
              {meta.logo_url ? (
                // object-contain + auto width so wide wordmark logos show
                // whole, not a cropped centre slice. See header.tsx note.
                <img src={meta.logo_url} alt={meta.name} className="h-9 w-auto max-w-[160px] rounded-lg object-contain" />
              ) : (
                <div className="h-9 w-9 rounded-lg bg-emerald-700 flex items-center justify-center text-white font-bold">
                  {meta.name.charAt(0).toUpperCase()}
                </div>
              )}
              {/* Name text only when no logo — see header.tsx note. */}
              {!meta.logo_url && (
                <span className="font-bold text-white text-lg">{meta.name}</span>
              )}
            </div>
            {meta.about && (
              <p className="text-sm text-emerald-200 leading-relaxed mb-4 max-w-xs">{meta.about}</p>
            )}
            <ul className="space-y-2 text-sm">
              <ContactRow icon={MapPin}><span className="text-emerald-200">Bangladesh</span></ContactRow>
              {meta.whatsapp && (
                <ContactRow icon={Phone}>
                  <a href={`tel:+${meta.whatsapp.replace(/\D/g, '')}`} className="hover:text-white">+{meta.whatsapp}</a>
                </ContactRow>
              )}
              <ContactRow icon={Mail}>
                <span className="text-emerald-200">support@{(meta.slug ?? 'shop')}.com</span>
              </ContactRow>
            </ul>
          </div>

          {/* Department */}
          <FooterCol title="Department">
            {categories.slice(0, 6).map((c) => (
              <FooterLink key={c.slug} href={`/categories/${c.slug}`}>{c.name}</FooterLink>
            ))}
            {categories.length === 0 && (
              <FooterLink href="/products">All products</FooterLink>
            )}
          </FooterCol>

          {/* About */}
          <FooterCol title="About us">
            <FooterLink href="/about">About {meta.name}</FooterLink>
            <FooterLink href="/about">Our story</FooterLink>
            <FooterLink href="/about">Press &amp; Blog</FooterLink>
          </FooterCol>

          {/* Services */}
          <FooterCol title="Services">
            <FooterLink href="/order/lookup">Track Order</FooterLink>
            <FooterLink href="/about">Shipping &amp; Delivery</FooterLink>
            <FooterLink href="/about">Order History</FooterLink>
            <FooterLink href="/about">Returns &amp; Refunds</FooterLink>
          </FooterCol>

          {/* Help */}
          <FooterCol title="Help">
            <FooterLink href="/about">Privacy Policy</FooterLink>
            <FooterLink href="/about">Terms &amp; Conditions</FooterLink>
            <FooterLink href="/about">FAQs</FooterLink>
            {meta.messenger?.url && (
              <a href={meta.messenger.url} target="_blank" rel="noopener" className="block py-1 text-sm text-emerald-200 hover:text-white transition">
                Contact via Messenger
              </a>
            )}
          </FooterCol>
        </div>

        {/* Bottom strip */}
        <div className="mt-10 pt-6 border-t border-emerald-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-emerald-300">© {new Date().getFullYear()} {meta.name}. All rights reserved.</p>

          <div className="flex items-center gap-2">
            {social.facebook && (
              <SocialIcon href={social.facebook} icon={Facebook} label="Facebook" />
            )}
            {social.instagram && (
              <SocialIcon href={social.instagram} icon={Instagram} label="Instagram" />
            )}
            {social.youtube && (
              <SocialIcon href={social.youtube} icon={Youtube} label="YouTube" />
            )}
            {meta.messenger?.url && (
              <SocialIcon href={meta.messenger.url} icon={MessageCircle} label="Messenger" />
            )}
          </div>

          <p className="text-xs text-emerald-300">
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
    <a href={href} className="block py-1 text-sm text-emerald-200 hover:text-white transition">
      {children}
    </a>
  );
}

function ContactRow({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-emerald-400 shrink-0" />
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
      className="w-9 h-9 rounded-full bg-emerald-800 hover:bg-emerald-700 flex items-center justify-center text-emerald-200 hover:text-white transition"
    >
      <Icon className="h-4 w-4" />
    </a>
  );
}
