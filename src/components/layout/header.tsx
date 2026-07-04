'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, MapPin, Menu, Search, ShoppingCart, User, UserCircle, X } from 'lucide-react';
import type { StorefrontMeta, Category, SuggestProduct } from '../../lib/types';
import { getToken, suggestProducts } from '../../lib/api';
import { formatBDT } from '../../lib/format';
import { useCart, cartCount, useCartHydrated } from '../../stores/cart';

/**
 * Two-row header inspired by the Omerce design:
 *   Row 1 — logo · location · big search · cart · account
 *   Row 2 — "Browse all categories" mega dropdown · primary nav · phone/messenger CTA
 *
 * The cart icon shows a live item count (Phase 2 multi-product cart). The count
 * is read after mount (the cart lives in localStorage) so the static HTML and
 * the first client render agree — same deferral as the auth token below.
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
  // Token lives in localStorage (client-only) — read it AFTER mount so the
  // SSR'd/static HTML and the first client render agree (no hydration
  // mismatch). Defaults to logged-out; flips to logged-in once we've checked.
  const [loggedIn, setLoggedIn] = useState(false);
  useEffect(() => { setLoggedIn(Boolean(getToken())); }, []);
  const accountHref = loggedIn ? '/account' : '/login';
  const accountLabel = loggedIn ? 'My Account' : 'Login';

  // Live cart count — read after mount (cart is in localStorage); the badge
  // stays hidden until hydration so SSR HTML and the first client render match.
  const hydrated = useCartHydrated();
  const cartUnits = useCart((s) => cartCount(s.items));
  const cartBadge = hydrated && cartUnits > 0 ? cartUnits : null;

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

            {/* Location pill — desktop only; rendered only when the tenant set a delivery location */}
            {meta.location && (
              <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-600 px-2.5 py-1.5 rounded-lg shrink-0">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500">Deliver to</span>
                <span className="font-semibold text-slate-900">{meta.location}</span>
              </div>
            )}

            {/* Search bar — full-width second line on mobile; on desktop a
                centred hero (max-w-2xl + mx-auto) so it stays visually centred
                regardless of how wide the logo or the right-hand cluster are.
                (Was md:flex-1, which grew from right after the logo and only
                looked centred when both sides happened to be balanced — it
                drifted left once the wishlist button and location pill were
                removed.) */}
            <SearchBox categories={categories} currency={meta.currency} />

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

              {/* Account: "Login" for guests, "My Account" once a token is
                  present. Token-aware affordance — see the mount effect above. */}
              <a
                href={accountHref}
                className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 text-sm"
              >
                <UserCircle className="h-5 w-5 text-slate-600" />
                <div className="text-left hidden xl:block">
                  <div className="text-[10px] text-slate-500 leading-none">{loggedIn ? 'Account' : 'Sign in'}</div>
                  <div className="text-xs font-semibold text-slate-900">{accountLabel}</div>
                </div>
              </a>

              {/* Cart — live item-count badge (Phase 2). Always visible (mobile
                  + desktop); the badge appears once the cart hydrates. */}
              <a
                href="/cart"
                className="relative flex items-center gap-2 p-2 md:px-3 rounded-lg hover:bg-slate-50 text-sm"
                aria-label={cartBadge ? `Cart, ${cartBadge} item${cartBadge === 1 ? '' : 's'}` : 'Cart'}
              >
                <ShoppingCart className="h-5 w-5 text-slate-600" />
                <span className="text-left hidden xl:block">
                  <span className="block text-[10px] text-slate-500 leading-none">Cart</span>
                  <span className="block text-xs font-semibold text-slate-900">My Cart</span>
                </span>
                {cartBadge && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold leading-none text-white tabular-nums">
                    {cartBadge}
                  </span>
                )}
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
              {meta.has_blog && <NavLink href="/blog">Blog</NavLink>}
              <NavLink href="/order/lookup">Track Order</NavLink>
            </nav>

            {/* Right side — featured/promo (optional) */}
            <div className="ml-auto hidden lg:block">
              {meta.whatsapp && (
                <a
                  href={`https://wa.me/${meta.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700 hover:bg-violet-200 transition"
                >
                  {/* em-sized so the icon always matches the pill's font size */}
                  <svg className="h-[1.2em] w-[1.2em] shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 2a10 10 0 00-8.65 15.02L2 22l5.13-1.33A10 10 0 1012 2zm5.46 14.12c-.23.65-1.35 1.24-1.86 1.28-.5.05-.97.23-3.27-.68-2.77-1.09-4.53-3.9-4.67-4.08-.13-.18-1.11-1.48-1.11-2.82 0-1.34.7-2 .95-2.27.25-.27.54-.34.72-.34l.52.01c.17.01.39-.06.61.47.23.54.77 1.87.84 2.01.07.13.11.29.02.47-.09.18-.13.29-.27.45l-.4.47c-.13.13-.27.28-.12.54.16.27.7 1.16 1.5 1.88 1.03.92 1.9 1.2 2.17 1.34.27.13.42.11.58-.07.16-.18.67-.78.85-1.05.18-.27.36-.22.6-.13.25.09 1.57.74 1.84.88.27.13.45.2.51.31.07.11.07.65-.16 1.3z" />
                  </svg>
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
          {meta.has_blog && <a onClick={() => setMobileOpen(false)} href="/blog" className="block px-3 py-2 rounded-lg hover:bg-slate-100">Blog</a>}
          <a onClick={() => setMobileOpen(false)} href="/order/lookup" className="block px-3 py-2 rounded-lg hover:bg-slate-100">Track order</a>
          <a onClick={() => setMobileOpen(false)} href="/cart" className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-100">
            <span>My Cart</span>
            {cartBadge && <span className="min-w-[20px] inline-flex items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-bold text-white">{cartBadge}</span>}
          </a>
          <a onClick={() => setMobileOpen(false)} href={accountHref} className="block px-3 py-2 rounded-lg hover:bg-slate-100 font-semibold text-brand-700">{accountLabel}</a>
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

/**
 * Header search bar with live autosuggest (thumb + name + price per row).
 *
 * Progressive enhancement over the plain GET form: typing ≥2 chars fires a
 * debounced /products/suggest fetch (aborting any stale in-flight request);
 * Enter with no row highlighted — or JS failing entirely — still submits the
 * normal form to /products?search=…, so search never breaks.
 *
 * Overflow discipline (see the mobile-overflow saga): the panel is absolutely
 * positioned inset-x-0 INSIDE the relative <form>, so its width can never
 * exceed the search bar's; row names get min-w-0 + truncate.
 */
function SearchBox({ categories, currency }: { categories: Category[]; currency?: string }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<SuggestProduct[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // Last query the current `items` belong to — distinguishes "no results for
  // this query" (show empty state) from "still waiting" (keep quiet).
  const [settledFor, setSettledFor] = useState('');
  const boxRef = useRef<HTMLFormElement>(null);
  // User dismissed the panel (Escape / tap outside) — a suggest response that
  // resolves AFTER the dismissal must not force it back open. Reset by any
  // new keystroke or re-focus (renewed intent).
  const dismissedRef = useRef(false);

  const query = q.trim();

  useEffect(() => {
    dismissedRef.current = false; // new keystroke = renewed intent
    if (query.length < 2) {
      setItems([]);
      setSettledFor('');
      setActive(-1);
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      suggestProducts(query, ctl.signal)
        .then((rows) => {
          setItems(rows);
          setSettledFor(query);
          setActive(-1);
          if (!dismissedRef.current) setOpen(true);
        })
        // Aborted (newer keystroke), throttled (429), or offline — keep the
        // prior rows and stay quiet. Errors must NEVER settle the query: a
        // settled empty state reads as an authoritative "No products found".
        .catch(() => {});
    }, 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [query]);

  // Close when clicking/tapping anywhere outside the search bar + panel.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        dismissedRef.current = true;
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  const showPanel = open && query.length >= 2 && (items.length > 0 || settledFor === query);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showPanel || items.length === 0) {
      if (e.key === 'Escape') {
        dismissedRef.current = true;
        setOpen(false);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      window.location.href = `/products/${encodeURIComponent(items[active].slug)}`;
    } else if (e.key === 'Escape') {
      dismissedRef.current = true;
      setOpen(false);
    }
  }

  return (
    <form
      ref={boxRef}
      action="/products"
      method="get"
      role="search"
      className="relative order-last w-full md:order-none md:mx-auto md:max-w-2xl"
    >
      <div className="flex items-stretch h-11 rounded-lg border border-slate-300 overflow-hidden focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/30 bg-white">
        {/* name="category" + option values so the dropdown actually
            filters — it submits ?category=<slug> to /products, which
            the product-list page reads. */}
        <select name="category" aria-label="Product category" className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-3 border-0 focus:outline-none cursor-pointer hidden sm:block">
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
        <input
          type="search"
          name="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => { dismissedRef.current = false; if (query.length >= 2) setOpen(true); }}
          onKeyDown={onKeyDown}
          placeholder="Type and search products..."
          autoComplete="off"
          role="combobox"
          aria-expanded={showPanel}
          aria-autocomplete="list"
          aria-controls="header-search-suggest"
          className="flex-1 min-w-0 px-3 text-sm border-0 focus:outline-none placeholder:text-slate-400"
        />
        <button type="submit" className="px-4 bg-slate-900 hover:bg-slate-800 text-white" aria-label="Search">
          <Search className="h-4 w-4" />
        </button>
      </div>

      {showPanel && (
        <div
          id="header-search-suggest"
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-1.5 max-h-[70vh] overflow-y-auto overflow-x-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-200"
        >
          {items.map((p, i) => (
            <a
              key={p.slug}
              href={`/products/${encodeURIComponent(p.slug)}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              className={`flex items-center gap-3 px-3 py-2.5 transition ${i === active ? 'bg-slate-50' : ''}`}
            >
              <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
                {p.image_url && (
                  <img src={p.image_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain p-0.5" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-900">{p.name}</span>
                <span className="text-sm font-bold text-brand-600">
                  {formatBDT(p.price, { currency })}
                  {p.compare_at_price != null && p.compare_at_price > p.price && (
                    <s className="ml-1.5 text-xs font-normal text-slate-400">
                      {formatBDT(p.compare_at_price, { currency })}
                    </s>
                  )}
                </span>
              </span>
            </a>
          ))}

          {items.length === 0 ? (
            <p className="px-3 py-3.5 text-sm text-slate-500">No products found for &ldquo;{query}&rdquo;</p>
          ) : (
            <button
              type="submit"
              className="block w-full border-t border-slate-100 px-3 py-2.5 text-center text-sm font-semibold text-brand-600 hover:bg-slate-50"
            >
              View all results for &ldquo;{query}&rdquo;
            </button>
          )}
        </div>
      )}
    </form>
  );
}
