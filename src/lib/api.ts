/**
 * Reply.BD storefront API client (Astro/Cloudflare Pages port).
 *
 * Two layers:
 *   1. `apiFetch()` — server-side fetch used during Astro's static build AND
 *      from any SSR route running as a Cloudflare Worker.
 *   2. `submitOrder()` — browser-only POST for order placement. Skips cache;
 *      talks straight to the Laravel API.
 *
 * Env vars expected (Astro convention — `PUBLIC_*` is build-time inlined,
 * server-only vars omit the prefix):
 *   PUBLIC_API_BASE        — Reply.BD API root (e.g. https://reply.bd)
 *   PUBLIC_STOREFRONT_SLUG — this tenant's slug
 *
 * Cache strategy difference vs. the Next.js original:
 *   - The previous Next.js version used `fetch(url, { next: { tags, revalidate: 60 } })`
 *     to opt into Next's ISR cache with tag-based invalidation. That whole
 *     subsystem doesn't exist on Astro/CF. Prerendered pages rely on Astro's
 *     BUILD-TIME static generation: fetched once at `astro build`, baked into
 *     HTML, served static from Cloudflare's edge. Freshness happens via a full
 *     CF Pages rebuild triggered by the Laravel revalidate webhook.
 *   - SSR routes (product/category/checkout/funnel pages) fetch per request.
 *     Those reads go through the Workers Cache API (`caches.default`) with a
 *     60s TTL matching Laravel's server-side StorefrontCache — repeat views
 *     within a minute skip the origin round-trip entirely. The cache is
 *     per-colo and the worst-case staleness is 60s edge + 60s StorefrontCache.
 *     Endpoints with side effects or per-customer data (`/resolve` logs 404s;
 *     order lookup returns live status) opt out via `cache: false`.
 *     `caches` only exists on the Workers runtime, so Node (astro dev/build)
 *     transparently bypasses it.
 *   - The `tags` parameter is preserved in the API surface so callers don't
 *     have to change shape, but it's a no-op now. We can wire it up to CF
 *     KV-keyed cache invalidation later if rebuild latency becomes a pain.
 */

import type {
  AbandonedCartInput,
  AccountOrderSummary,
  BlogPostCard,
  BlogPostDetail,
  InfoPageDetail,
  Category,
  CreateOrderInput,
  Customer,
  CustomerAuthResponse,
  ForgotPasswordInput,
  FunnelData,
  HomepageConfig,
  LoginCustomerInput,
  OrderResponse,
  Paginated,
  ProductCard,
  ProductDetail,
  Certification,
  RegisterCustomerInput,
  ResetPasswordInput,
  ServiceCard,
  ServiceDetail,
  StorefrontMeta,
  SuggestProduct,
  TeamMember,
} from './types';
import { homepageProductIds } from './home-data';

const API_BASE = (import.meta.env.PUBLIC_API_BASE ?? '').replace(/\/$/, '');
export const STOREFRONT_SLUG = import.meta.env.PUBLIC_STOREFRONT_SLUG ?? '';

if (typeof window === 'undefined' && !API_BASE) {
  // Server-side, log once. Don't throw — Astro can still render a graceful
  // error page for the visitor instead of crashing the build. Same behaviour
  // as the Next.js original — Vercel build hangs were caused by the value
  // being `undefined` AFTER the warning, not by this line.
  console.warn('[storefront-template] PUBLIC_API_BASE is not set');
}

function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const qs = params
    ? '?' + Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  return `${API_BASE}/api/v1/storefronts/${STOREFRONT_SLUG}${path}${qs}`;
}

/** Edge-cache TTL for API reads, matching Laravel's StorefrontCache (60s). */
const EDGE_CACHE_TTL = 60;

/**
 * The Workers Cache API, when running on the Cloudflare runtime. Node
 * (astro dev / astro build) has no `caches` global → undefined → bypass.
 */
function edgeCache(): { match(url: string): Promise<Response | undefined>; put(url: string, res: Response): Promise<void> } | undefined {
  return (globalThis as { caches?: { default?: any } }).caches?.default;
}

async function apiFetch<T>(
  path: string,
  options: {
    params?: Record<string, string | number | undefined>;
    tags?: string[];
    unwrap?: boolean;
    /** Set false for endpoints with side effects or per-customer data. */
    cache?: boolean;
  } = {},
): Promise<T> {
  const url = buildUrl(path, options.params);
  const cache = options.cache === false ? undefined : edgeCache();

  // Edge-cache lookup. Cache failures must never break a render — treat
  // any throw as a miss and fall through to the origin fetch.
  if (cache) {
    try {
      const hit = await cache.match(url);
      if (hit) {
        const json = await hit.json();
        if (options.unwrap === false) return json as T;
        return (json.data ?? json) as T;
      }
    } catch {
      // miss
    }
  }

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    // ApiError carries the HTTP status so callers can tell "doesn't exist"
    // (404) apart from "temporarily refused" (429 throttle, 5xx) — the payment
    // order-status page must never render a throttled lookup as "not found".
    throw new ApiError(`API ${path} failed: ${res.status} ${res.statusText}`, res.status);
  }
  // Read as text so the same body can be parsed AND stored: the Laravel API
  // sends `Cache-Control: no-cache, private` (correct for direct browser
  // hits), which cache.put() would refuse to store — so we re-wrap the body
  // in a fresh Response carrying our own TTL instead of storing `res`.
  const text = await res.text();
  const json = JSON.parse(text);

  if (cache) {
    try {
      await cache.put(
        url,
        new Response(text, {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': `public, max-age=${EDGE_CACHE_TTL}`,
          },
        }),
      );
    } catch {
      // best-effort — a full cache or oversized body never breaks the page
    }
  }

  // Two response shapes from Laravel:
  //   - Single resource:  { data: { ... } }              → unwrap
  //   - Paginated list:   { data: [...], meta: {...} }   → keep as-is (caller wants both fields)
  // `unwrap: false` keeps the wrapper. Default unwraps `data` for the singular case.
  if (options.unwrap === false) return json as T;
  return (json.data ?? json) as T;
}

// ──────────────────────────────────────────────────────────────
// Read endpoints (server-side at build time, or SSR'd on the edge)
// ──────────────────────────────────────────────────────────────

export function getStorefront() {
  return apiFetch<StorefrontMeta>('', { tags: ['storefront', 'home'] });
}

export type ProductSort = 'newest' | 'price_asc' | 'price_desc' | 'name_asc';

export function getProducts(opts: {
  page?: number;
  perPage?: number;
  search?: string;
  category?: string;
  sort?: ProductSort;
  /**
   * Exact-id lookup. Bypasses the list's per_page cap (server bounds it to
   * 100 ids, one page) and keeps the same public-visibility filter.
   */
  ids?: number[];
} = {}) {
  return apiFetch<Paginated<ProductCard>>('/products', {
    params: {
      page: opts.page,
      per_page: opts.perPage,
      search: opts.search,
      category: opts.category,
      sort: opts.sort,
      ids: opts.ids?.length ? opts.ids.join(',') : undefined,
    },
    tags: ['products', 'home'],
    unwrap: false,
  });
}

/**
 * Guarantee every product the homepage config references is present in
 * `products`, fetching by id whatever the general list is missing.
 *
 * The general /products list is newest-first and CAPPED by the API (60), so
 * on a bigger catalog an older product the merchant picked for a section
 * silently failed to resolve and vanished from it — and a missing Deals of
 * the Day spotlight was then SUBSTITUTED by a mini card (live 2026-09-06:
 * the dashboard said Sukkari, the site showed Bertini). Zero extra requests
 * for a small shop; one small by-id request for a big one. Fail-soft, and
 * tolerant of an API deploy that doesn't know `ids` yet — it then answers
 * with its first page, which we already hold, so nothing is added (never
 * worse than today).
 */
export async function ensureHomepageProducts(
  home: HomepageConfig | null,
  products: ProductCard[],
): Promise<ProductCard[]> {
  const have = new Set(products.map((p) => p.id));
  const missing = homepageProductIds(home).filter((id) => !have.has(id));
  if (missing.length === 0) return products;

  let fetched: ProductCard[] = [];
  try {
    fetched = (await getProducts({ ids: missing })).data ?? [];
  } catch {
    return products; // fail-soft: render with what we have
  }
  // Only ADD what was actually missing — this is what makes an old API that
  // ignores `ids` (answering with its first page) a no-op, not a duplicate.
  const wanted = new Set(missing);
  const added = fetched.filter((p) => wanted.has(p.id) && !have.has(p.id));
  return added.length ? [...products, ...added] : products;
}

export function getProduct(slug: string) {
  return apiFetch<ProductDetail>(`/products/${encodeURIComponent(slug)}`, {
    tags: ['products', `product:${slug}`],
  });
}

export function getCategories() {
  return apiFetch<Category[]>('/categories', {
    tags: ['categories'],
  });
}

export function getServices() {
  return apiFetch<ServiceCard[]>('/services', { tags: ['services'] });
}

export function getTeam() {
  return apiFetch<TeamMember[]>('/team', { tags: ['team'] });
}

export function getCertifications() {
  return apiFetch<Certification[]>('/certifications', { tags: ['certifications'] });
}

export function getService(slug: string) {
  return apiFetch<ServiceDetail>(`/services/${encodeURIComponent(slug)}`, {
    tags: ['services', `service:${slug}`],
  });
}

export function getBlogPosts(opts: { page?: number; perPage?: number; search?: string } = {}) {
  return apiFetch<Paginated<BlogPostCard>>('/blog', {
    params: { page: opts.page, per_page: opts.perPage, search: opts.search },
    tags: ['blog'],
    unwrap: false,   // keep the pagination meta
  });
}

export function getBlogPost(slug: string) {
  return apiFetch<BlogPostDetail>(`/blog/${encodeURIComponent(slug)}`, {
    tags: ['blog', `blog:${slug}`],
  });
}

/** A default info page (Terms/Privacy/Refund/Careers) by its /pages/{slug}. */
export function getInfoPage(slug: string) {
  return apiFetch<InfoPageDetail>(`/pages/${encodeURIComponent(slug)}`, {
    tags: ['pages', `page:${slug}`],
  });
}

export async function getCategory(
  slug: string,
  opts: { sort?: ProductSort; page?: number } = {},
): Promise<{ category: Category; products: Paginated<ProductCard> }> {
  // The API returns { data: { ...category fields, products: [...] }, meta: {pagination} }
  // — i.e. the category fields are FLAT on `data` with a nested products
  // array, and pagination lives in the sibling top-level `meta`. The page,
  // though, wants { category, products: Paginated }. Reshape here (unwrap:false
  // so we keep the top-level `meta`). Mismatching this is what blanked the
  // category page: `const { category } = res` was undefined → category.name threw.
  const json = await apiFetch<any>(`/categories/${encodeURIComponent(slug)}`, {
    params: { sort: opts.sort, page: opts.page },
    tags: ['categories', `category:${slug}`, 'products'],
    unwrap: false,
  });

  const data: Record<string, any> = json?.data ?? {};
  const { products: items, ...category } = data;
  const list = (items ?? []) as ProductCard[];

  return {
    category: category as Category,
    products: {
      data: list,
      meta: json?.meta ?? {
        current_page: 1,
        last_page: 1,
        per_page: list.length || 24,
        total: list.length,
      },
    } as Paginated<ProductCard>,
  };
}

export function getFunnel(funnelSlug: string) {
  return apiFetch<FunnelData>(`/funnels/${encodeURIComponent(funnelSlug)}`, {
    tags: ['funnels', `funnel:${funnelSlug}`],
  });
}

// `image` (product photo / category banner / blog cover) is optional so
// older cached API payloads without the key stay type-honest.
export type SitemapPage = { path: string; lastmod: string | null; image?: string | null };

/**
 * Page inventory for sitemap.xml. Paths only — the SSR route prefixes its
 * own request origin so URLs match whichever host the crawler fetched from.
 * Empty when the tenant has "Discourage search engines" on.
 */
export function getSitemap() {
  return apiFetch<{ pages: SitemapPage[] }>('/sitemap');
}

/**
 * Redirect lookup for missed pages (slug renames leave 301s behind on the
 * Laravel side). Returns null on no-redirect / API failure — callers fall
 * through to their normal 404 render. The miss itself is recorded in the
 * tenant's 404 log server-side by this same call.
 */
export async function resolvePath(path: string): Promise<{ to: string; status: number } | null> {
  try {
    // cache:false — every call has a server-side effect (404 logging /
    // redirect hit counting), and a cached miss would mask a redirect the
    // tenant just created.
    return await apiFetch<{ to: string; status: number }>('/resolve', { params: { path }, cache: false });
  } catch {
    return null;
  }
}

export function getMessengerLink(opts: { productId?: number; variant?: string } = {}) {
  return apiFetch<{ url: string }>('/messenger-link', {
    params: { product_id: opts.productId, variant: opts.variant },
    tags: ['storefront'],
  });
}

export function lookupOrder(orderNumber: string, phoneLast4: string) {
  // cache:false — live order status, and it's one customer's private data;
  // an edge-cached copy could be served to a different visitor in the colo.
  return apiFetch<OrderResponse>(`/orders/${encodeURIComponent(orderNumber)}`, {
    params: { phone: phoneLast4 },
    cache: false,
  });
}

/**
 * Consume the server-side purchase-tracking latch after the order-status page
 * pushed the GA4 purchase — so no other device/visit ever pushes it again.
 * Guest calls verify with the phone last-4 (same guard as lookupOrder);
 * with a customer token and no phone the authed twin is used instead.
 * Fire-and-forget by design: never throws (a failed consume only risks the
 * cross-device localStorage flag being the sole guard, which was the status
 * quo before the latch existed).
 */
export async function markPurchaseTracked(orderNumber: string, phoneLast4?: string): Promise<void> {
  try {
    if (phoneLast4) {
      await fetch(buildUrl(`/orders/${encodeURIComponent(orderNumber)}/purchase-tracked`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ phone: phoneLast4 }),
        cache: 'no-store',
      });
      return;
    }
    const token = getToken();
    if (!token) return;
    await fetch(buildUrl(`/customer/orders/${encodeURIComponent(orderNumber)}/purchase-tracked`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
      cache: 'no-store',
    });
  } catch {
    /* best-effort — see doc block */
  }
}

// ──────────────────────────────────────────────────────────────
// Live-search autosuggest (browser-side)
// ──────────────────────────────────────────────────────────────

/**
 * Header search suggestions. Browser-only, fired per (debounced) keystroke —
 * pass an AbortSignal so a stale in-flight request never overwrites a newer
 * response. HTTP/parse errors REJECT (throw) — the SearchBox caller catches,
 * keeps the previous rows, and stays quiet. Only a genuine 200 with a data
 * array may settle a query, so a 429/500 can never masquerade as an
 * authoritative "No products found" to a shopper. The plain form submit to
 * /products always still works.
 */
export async function suggestProducts(q: string, signal?: AbortSignal): Promise<SuggestProduct[]> {
  const res = await fetch(buildUrl('/products/suggest', { q }), {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  });
  if (!res.ok) throw new Error(`suggest failed: ${res.status}`);
  const json = await res.json().catch(() => null);
  if (!Array.isArray(json?.data)) throw new Error('suggest: bad payload');
  return json.data as SuggestProduct[];
}

// ──────────────────────────────────────────────────────────────
// Write endpoint (browser-side)
// ──────────────────────────────────────────────────────────────

/**
 * Compose the checkout's Idempotency-Key: a PER-BROWSER stable seed + a hash
 * of the submitted content (phone + lines). The server treats the header as
 * the full dedup identity (it REPLACES the content fingerprint), so the seed
 * must be shared across tabs — a per-mount seed would let two tabs with the
 * same cart create two real orders. With the browser-stable seed:
 * double-tap, bfcache resubmit, and a second tab all produce the SAME key
 * for the same cart (→ one order, one Purchase, matching the old
 * fingerprint semantics), while an EDITED cart changes the content part and
 * rightly creates a new order. An intentional identical reorder works after
 * the server's 90s window — also unchanged. `mountFallback` covers blocked
 * localStorage (private mode): per-mount is the best identity available.
 */
export function orderIdempotencyKey(
  mountFallback: string,
  input: { customer_phone: string; items: { product_id: number; variant_index: number | null; variant?: { size?: string | null } | null; quantity: number }[] },
): string {
  let seed: string | null = null;
  try {
    seed = localStorage.getItem('replybd:idem-seed');
    if (!seed) {
      seed = mountFallback;
      localStorage.setItem('replybd:idem-seed', seed);
    }
  } catch {
    seed = mountFallback;
  }
  const s = input.customer_phone + '|' + JSON.stringify(input.items);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return seed + '-' + (h >>> 0).toString(36);
}

/**
 * Submit a checkout. Called from the browser, so uses `cache: 'no-store'`
 * and reads the API base from `import.meta.env.PUBLIC_*` (Vite inlines
 * these at build time, same way Next.js inlined `NEXT_PUBLIC_*`).
 *
 * `idempotencyKey` (see orderIdempotencyKey) rides as the server's
 * `Idempotency-Key` header: concurrent double-taps and bfcache resubmits
 * collapse to ONE order server-side even beyond the fingerprint window —
 * which is what keeps the Purchase event count at exactly one per real order.
 */
export async function submitOrder(input: CreateOrderInput, idempotencyKey?: string): Promise<OrderResponse> {
  const url = buildUrl('/orders');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      ...(input.cf_turnstile_response ? { 'cf-turnstile-response': input.cf_turnstile_response } : {}),
    },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  // Parse defensively: an HTML error page (502, maintenance) would make
  // res.json() throw a raw "not valid JSON" parse error into the shopper's
  // error box. Shoppers get plain language; status codes stay internal.
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    // The API's error envelope is { error: { code, message } } — json.error is
    // an OBJECT, so it must never be fed to new Error() directly (the shopper
    // would see "[object Object]" instead of e.g. the online_unavailable /
    // payment_init_failed guidance to fall back to Cash on Delivery).
    const msg =
      json?.message ??
      json?.error?.message ??
      (typeof json?.error === 'string' ? json.error : undefined) ??
      'Sorry, your order could not be placed. Please try again in a minute.';
    throw new Error(msg);
  }
  if (!json) {
    throw new Error('Sorry, your order could not be placed. Please try again in a minute.');
  }
  return (json.data ?? json) as OrderResponse;
}

// ──────────────────────────────────────────────────────────────
// Abandoned Cart Recovery (POST /storefronts/{slug}/abandoned-carts)
// ──────────────────────────────────────────────────────────────

/**
 * Beacon the shopper's PARTIAL checkout so the shop can call them if they
 * leave without ordering. Fire-and-forget from lib/abandoned.ts — the caller
 * swallows errors. `keepalive` lets the page-leave flush outlive the
 * navigation (a plain fetch is cancelled by it); the body is tiny, far under
 * the 64KB keepalive cap. No Turnstile: there's no token at blur time — the
 * API relies on honeypot + throttle + a valid-phone gate instead.
 */
export async function captureAbandonedCart(input: AbandonedCartInput, keepalive = false): Promise<void> {
  const res = await fetch(buildUrl('/abandoned-carts'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
    keepalive,
  });
  if (!res.ok) throw new Error(`abandoned_cart_${res.status}`);
}

// ──────────────────────────────────────────────────────────────
// Service-tenant inquiry form (POST /storefronts/{slug}/leads)
// ──────────────────────────────────────────────────────────────

export type CreateLeadInput = {
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  /** Which service the visitor is asking about (from the services block). */
  service?: string;
  message?: string;
  source_url?: string;
  /** Honeypot — leave empty; bots fill it. */
  company?: string;
  cf_turnstile_response?: string;
};

/**
 * Submit a website inquiry (service tenants). Same defensive parsing and
 * plain-language errors as submitOrder — shoppers never see status codes.
 */
export async function submitLead(input: CreateLeadInput): Promise<{ ok: boolean }> {
  const url = buildUrl('/leads');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(input.cf_turnstile_response ? { 'cf-turnstile-response': input.cf_turnstile_response } : {}),
    },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    // Same envelope note as submitOrder: json.error is an object, never a string.
    const msg =
      json?.message ??
      json?.error?.message ??
      (typeof json?.error === 'string' ? json.error : undefined) ??
      'Sorry, your inquiry could not be sent. Please try again in a minute.';
    throw new Error(msg);
  }
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────
// Storefront contact form (POST /storefronts/{slug}/contact)
// ──────────────────────────────────────────────────────────────

export type CreateContactInput = {
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  message: string;
  source_url?: string;
  /** Honeypot — leave empty; bots fill it. */
  company?: string;
  cf_turnstile_response?: string;
};

/**
 * Submit a storefront contact message (emails the shop owner). Same defensive
 * parsing + plain-language errors as submitOrder / submitLead.
 */
export async function submitContact(input: CreateContactInput): Promise<{ ok: boolean }> {
  const url = buildUrl('/contact');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(input.cf_turnstile_response ? { 'cf-turnstile-response': input.cf_turnstile_response } : {}),
    },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      json?.message ??
      json?.error?.message ??
      (typeof json?.error === 'string' ? json.error : undefined) ??
      'Sorry, your message could not be sent. Please try again in a minute.';
    throw new Error(msg);
  }
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────
// Customer accounts (Phase 1) — bearer-token auth, browser-only
// ──────────────────────────────────────────────────────────────

/**
 * Token is scoped to THIS tenant's slug so the same browser visiting two
 * Reply.BD storefronts (rare, but possible on a shared device) never leaks one
 * tenant's token to another. localStorage is per-origin already, but the slug
 * key is belt-and-suspenders and keeps the contract explicit.
 */
const TOKEN_KEY = `sf_token_${STOREFRONT_SLUG}`;

/** SSR-safe: there's no `window`/`localStorage` during Astro build or on the edge. */
function hasStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getToken(): string | null {
  if (!hasStorage()) return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // private-mode / quota — nothing we can do; the session just won't persist.
  }
}

export function clearToken(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

/** Thrown when an authed request comes back 401 — the caller redirects to /login. */
export class UnauthenticatedError extends Error {
  constructor(message = 'Your session has expired. Please log in again.') {
    super(message);
    this.name = 'UnauthenticatedError';
  }
}

/**
 * Authenticated browser fetch. Adds the bearer token, skips all caching (every
 * call is per-customer, live data), and parses defensively the same way as
 * submitOrder. On 401 it clears the stored token and throws
 * UnauthenticatedError so the caller can bounce to /login.
 */
async function authFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; params?: Record<string, string | number | undefined> } = {},
): Promise<T> {
  const token = getToken();
  if (!token) throw new UnauthenticatedError('You are not logged in.');

  const url = buildUrl(path, options.params);
  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  if (res.status === 401) {
    clearToken();
    throw new UnauthenticatedError();
  }

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = json?.error?.message ?? json?.message ?? 'Something went wrong. Please try again.';
    throw new Error(msg);
  }
  // `unwrap: false` style handled by the caller — return the whole envelope so
  // list endpoints can read `meta` too.
  return json as T;
}

/**
 * Unwraps Laravel's `{ data, error }` envelope for the customer auth endpoints,
 * surfacing `error.code` on the thrown Error (so callers can branch on
 * 'registration_failed' / 'invalid_credentials' / 'password_required') and
 * applying the same defensive JSON parse as submitOrder.
 */
export class ApiError extends Error {
  code?: string;
  status: number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function postAuth<T>(
  path: string,
  body: Record<string, unknown>,
  turnstileToken?: string,
): Promise<T> {
  const url = buildUrl(path);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(turnstileToken ? { 'cf-turnstile-response': turnstileToken } : {}),
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const code: string | undefined = json?.error?.code;
    const msg =
      json?.error?.message ??
      json?.message ??
      // Laravel validation errors → first field message.
      (json?.errors ? Object.values(json.errors).flat()[0] : undefined) ??
      'Something went wrong. Please try again.';
    throw new ApiError(String(msg), res.status, code);
  }
  return (json?.data ?? json) as T;
}

export function registerCustomer(input: RegisterCustomerInput): Promise<CustomerAuthResponse> {
  return postAuth<CustomerAuthResponse>(
    '/customer/register',
    {
      name: input.name,
      phone: input.phone,
      email: input.email || undefined,
      password: input.password,
    },
    input.cf_turnstile_response,
  );
}

export function loginCustomer(input: LoginCustomerInput): Promise<CustomerAuthResponse> {
  return postAuth<CustomerAuthResponse>(
    '/customer/login',
    { identifier: input.identifier, password: input.password },
    input.cf_turnstile_response,
  );
}

/**
 * Step 1 of password reset: mail/SMS a 6-digit code to the account matching
 * `identifier`. The API always answers generically (anti-enumeration), so a
 * resolved promise means "request accepted", NOT "an account exists".
 */
export function forgotPassword(input: ForgotPasswordInput): Promise<{ ok: boolean; message: string }> {
  return postAuth<{ ok: boolean; message: string }>(
    '/customer/password/forgot',
    { channel: input.channel, identifier: input.identifier },
    input.cf_turnstile_response,
  );
}

/**
 * Step 2: verify the code + set the new password. On success the API returns a
 * fresh token + customer (auto-login), same shape as login. A bad/expired code
 * throws an ApiError('reset_failed').
 */
export function resetPassword(input: ResetPasswordInput): Promise<CustomerAuthResponse> {
  return postAuth<CustomerAuthResponse>(
    '/customer/password/reset',
    { identifier: input.identifier, code: input.code, password: input.password },
    input.cf_turnstile_response,
  );
}

/**
 * Log out: best-effort token revocation server-side, then always clear the
 * local token (so a network failure still logs the customer out of this
 * device). Never throws — logout should always "work" from the user's view.
 */
export async function logoutCustomer(): Promise<void> {
  const token = getToken();
  if (token) {
    try {
      await authFetch('/customer/logout', { method: 'POST', body: {} });
    } catch {
      // ignore — clearing the local token below is what matters.
    }
  }
  clearToken();
}

export async function getAccount(): Promise<Customer> {
  const json = await authFetch<{ data: Customer }>('/customer/me');
  return json.data;
}

export async function getMyOrders(page?: number): Promise<Paginated<AccountOrderSummary>> {
  const json = await authFetch<Paginated<AccountOrderSummary>>('/customer/orders', {
    params: { page },
  });
  // The list envelope already carries { data, meta } — return as-is.
  return json;
}

export async function getMyOrder(orderNumber: string): Promise<OrderResponse> {
  const json = await authFetch<{ data: OrderResponse }>(
    `/customer/orders/${encodeURIComponent(orderNumber)}`,
  );
  return json.data;
}
