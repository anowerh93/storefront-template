'use client';

import { useState } from 'react';
import { ChevronDown, MapPin, Menu, Search, User, X } from 'lucide-react';
import type { StorefrontMeta, Category } from '../../lib/types';
import { Button } from '../ui/button';

/**
 * Two-row header inspired by the Omerce design:
 *   Row 1 — logo · location · big search · account/wishlist
 *   Row 2 — "Browse all categories" mega dropdown · primary nav · phone/messenger CTA
 *
 * The cart icon was intentionally removed — this storefront uses a direct
 * order-on-PDP funnel rather than a multi-product cart.
 */
export function Header({
  meta,
  categories = [],
}: {
  meta: StorefrontMeta;
  categories?: Category[];
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      {/* ───────────────────── Row 1 ───────────────────── */}
      <div className="border-b border-slate-100">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
          {/* Mobile: wrap so the search bar drops to its own full-width second
              line (logo + menu on top). Desktop (md+): single 64px row with
              search inline. flex-wrap + the search's order-last/w-full is the
              standard mobile-commerce header that stops the bar getting
              crushed next to a wide logo on phones. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 md:h-16 md:flex-nowrap md:gap-4 md:py-0">
            {/* Logo */}
            <a href="/" className="flex items-center gap-2 shrink-0">
              {meta.logo_url ? (
                // object-CONTAIN (not cover) + auto width: logos are often
                // wide wordmarks, and a fixed square + object-cover would
                // crop them to a meaningless centre slice (e.g. showing
                // "larriag" out of a longer name). Contain shows the whole
                // logo; w-auto lets a wordmark be wide and an icon stay square.
                <img src={meta.logo_url} alt={meta.name}
                       className="h-8 w-auto max-w-[130px] sm:h-9 sm:max-w-[160px] rounded-lg object-contain" />
              ) : (
                <div className="h-9 w-9 rounded-lg bg-brand-500 flex items-center justify-center text-white font-bold">
                  {meta.name.charAt(0).toUpperCase()}
                </div>
              )}
              {/* Show the shop-name text ONLY when there's no logo. A logo
                  is usually a wordmark that already includes the name, so
                  rendering both produced redundant "[logo] Anower". */}
              {!meta.logo_url && (
                <span className="font-bold text-slate-900 text-lg sm:text-xl tracking-tight hidden sm:inline">
                  {meta.name}
                </span>
              )}
            </a>

            {/* Location pill — desktop only */}
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-600 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer shrink-0">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-500">Deliver to</span>
              <span className="font-semibold text-slate-900">Bangladesh</span>
            </div>

            {/* Search bar — full-width second line on mobile, inline hero on desktop */}
            <form action="/products" method="get" className="order-last w-full md:order-none md:flex-1 md:max-w-2xl">
              <div className="flex items-stretch h-11 rounded-lg border border-slate-300 overflow-hidden focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/30 bg-white">
                {/* name="category" + option values so the dropdown actually
                    filters — it submits ?category=<slug> to /products, which
                    the product-list page reads. Was decorative before (no
                    name attr, no option values → selecting did nothing). */}
                <select name="category" className="bg-amber-300 text-slate-900 text-xs font-semibold px-3 border-0 focus:outline-none cursor-pointer hidden sm:block">
                  <option value="">All Categories</option>
                  {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                </select>
                <input
                  type="search"
                  name="search"
                  placeholder="Type and search products..."
                  className="flex-1 px-3 text-sm border-0 focus:outline-none placeholder:text-slate-400"
                />
                <button type="submit" className="px-4 bg-slate-900 hover:bg-slate-800 text-white" aria-label="Search">
                  <Search className="h-4 w-4" />
                </button>
              </div>
            </form>

            {/* Right cluster: track order, mobile menu.
                NOTE: these used to be dead <button>s copied from the
                reference design. "Track My Order" now links to the real
                order-lookup page. The "Wishlist" button was removed — this
                storefront has no wishlist (or cart) feature; the funnel is
                direct-order on the PDP, so a wishlist button was pure dead
                UI. Add it back only if/when a wishlist feature ships. */}
            <div className="flex items-center gap-1 shrink-0 ml-auto md:ml-0">
              <a
                href="/order/lookup"
                className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 text-sm"
              >
                <User className="h-5 w-5 text-slate-600" />
                <div className="text-left hidden xl:block">
                  <div className="text-[10px] text-slate-500 leading-none">Track</div>
                  <div className="text-xs font-semibold text-slate-900">My Order</div>
                </div>
              </a>

              <button
                onClick={() => setMobileOpen((v) => !v)}
                className="md:hidden p-2 rounded-lg hover:bg-slate-100"
                aria-label="Open menu"
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────────── Row 2 ───────────────────── */}
      <div className="hidden md:block">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
          <div className="flex h-12 items-center gap-2">
            {/* Categories mega-dropdown trigger */}
            <div className="relative">
              <button
                onClick={() => setCatsOpen((v) => !v)}
                onBlur={() => setTimeout(() => setCatsOpen(false), 200)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition"
              >
                <Menu className="h-4 w-4" />
                Browse All Categories
                <ChevronDown className={`h-4 w-4 transition-transform ${catsOpen ? 'rotate-180' : ''}`} />
              </button>

              {catsOpen && categories.length > 0 && (
                <div className="absolute left-0 top-full mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-40">
                  {categories.map((c) => (
                    <a
                      key={c.slug}
                      href={`/categories/${c.slug}`}
                      className="flex items-center justify-between px-4 py-2 hover:bg-slate-50 text-sm text-slate-700"
                    >
                      <span>{c.name}</span>
                      <span className="text-xs text-slate-400">{c.product_count}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Primary nav */}
            <nav className="flex items-center gap-1 text-sm ml-2">
              <NavLink href="/">Home</NavLink>
              <NavLink href="/products">Shop</NavLink>
              <NavLink href="/categories">Categories</NavLink>
              <NavLink href="/about">About</NavLink>
              <NavLink href="/order/lookup">Track Order</NavLink>
            </nav>

            {/* Right side — featured/promo (optional) */}
            <div className="ml-auto hidden lg:block">
              {meta.whatsapp && (
                <a
                  href={`https://wa.me/${meta.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener"
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700 hover:bg-violet-200 transition"
                >
                  Need help? +{meta.whatsapp}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-100 px-4 py-3 space-y-1 text-sm">
          <a onClick={() => setMobileOpen(false)} href="/" className="block px-3 py-2 rounded-lg hover:bg-slate-100">Home</a>
          <a onClick={() => setMobileOpen(false)} href="/products" className="block px-3 py-2 rounded-lg hover:bg-slate-100">Shop</a>
          <a onClick={() => setMobileOpen(false)} href="/categories" className="block px-3 py-2 rounded-lg hover:bg-slate-100">Categories</a>
          <a onClick={() => setMobileOpen(false)} href="/about" className="block px-3 py-2 rounded-lg hover:bg-slate-100">About</a>
          <a onClick={() => setMobileOpen(false)} href="/order/lookup" className="block px-3 py-2 rounded-lg hover:bg-slate-100">Track order</a>
        </div>
      )}
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="px-3 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-medium transition">
      {children}
    </a>
  );
}
