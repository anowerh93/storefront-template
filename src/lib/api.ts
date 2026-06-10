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
 *     subsystem doesn't exist on Astro/CF. We drop the cache hint here and
 *     rely on Astro's BUILD-TIME static generation: each page is fetched
 *     once at `astro build`, baked into HTML, then served as a static asset
 *     from Cloudflare's edge. Freshness happens via a full CF Pages rebuild
 *     triggered by the Laravel revalidate webhook (see `pages/api/revalidate.ts`).
 *   - The `tags` parameter is preserved in the API surface so callers don't
 *     have to change shape, but it's a no-op now. We can wire it up to CF
 *     KV-keyed cache invalidation later if rebuild latency becomes a pain.
 */

import type {
  Category,
  CreateOrderInput,
  FunnelData,
  OrderResponse,
  Paginated,
  ProductCard,
  ProductDetail,
  StorefrontMeta,
} from './types';

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

async function apiFetch<T>(
  path: string,
  options: { params?: Record<string, string | number | undefined>; tags?: string[]; unwrap?: boolean } = {},
): Promise<T> {
  const url = buildUrl(path, options.params);
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
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
} = {}) {
  return apiFetch<Paginated<ProductCard>>('/products', {
    params: {
      page: opts.page,
      per_page: opts.perPage,
      search: opts.search,
      category: opts.category,
      sort: opts.sort,
    },
    tags: ['products', 'home'],
    unwrap: false,
  });
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

export type SitemapPage = { path: string; lastmod: string | null };

/**
 * Page inventory for sitemap.xml. Paths only — the SSR route prefixes its
 * own request origin so URLs match whichever host the crawler fetched from.
 * Empty when the tenant has "Discourage search engines" on.
 */
export function getSitemap() {
  return apiFetch<{ pages: SitemapPage[] }>('/sitemap');
}

export function getMessengerLink(opts: { productId?: number; variant?: string } = {}) {
  return apiFetch<{ url: string }>('/messenger-link', {
    params: { product_id: opts.productId, variant: opts.variant },
    tags: ['storefront'],
  });
}

export function lookupOrder(orderNumber: string, phoneLast4: string) {
  return apiFetch<OrderResponse>(`/orders/${encodeURIComponent(orderNumber)}`, {
    params: { phone: phoneLast4 },
  });
}

// ──────────────────────────────────────────────────────────────
// Write endpoint (browser-side)
// ──────────────────────────────────────────────────────────────

/**
 * Submit a checkout. Called from the browser, so uses `cache: 'no-store'`
 * and reads the API base from `import.meta.env.PUBLIC_*` (Vite inlines
 * these at build time, same way Next.js inlined `NEXT_PUBLIC_*`).
 */
export async function submitOrder(input: CreateOrderInput): Promise<OrderResponse> {
  const url = buildUrl('/orders');
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
  // Parse defensively: an HTML error page (502, maintenance) would make
  // res.json() throw a raw "not valid JSON" parse error into the shopper's
  // error box. Shoppers get plain language; status codes stay internal.
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      json?.message ?? json?.error ?? 'Sorry, your order could not be placed. Please try again in a minute.';
    throw new Error(msg);
  }
  if (!json) {
    throw new Error('Sorry, your order could not be placed. Please try again in a minute.');
  }
  return (json.data ?? json) as OrderResponse;
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
    const msg =
      json?.message ?? json?.error ?? 'Sorry, your inquiry could not be sent. Please try again in a minute.';
    throw new Error(msg);
  }
  return { ok: true };
}
