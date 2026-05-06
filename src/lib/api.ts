/**
 * Reply.BD storefront API client.
 *
 * Two layers:
 *   1. `apiFetch()` — server-only fetch with Next.js cache + tag-based ISR.
 *      All read endpoints flow through here. The tag is used by the
 *      /api/revalidate route to invalidate specific paths in O(1).
 *   2. `clientPost()` — browser-only POST for order submission. Skips Next
 *      cache; talks straight to Laravel.
 *
 * Env vars expected:
 *   NEXT_PUBLIC_API_BASE       — Reply.BD API root (e.g. https://reply.bd)
 *   NEXT_PUBLIC_STOREFRONT_SLUG— this tenant's slug
 */

import type {
  Category,
  CreateOrderInput,
  OrderResponse,
  Paginated,
  ProductCard,
  ProductDetail,
  StorefrontMeta,
} from './types';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? '').replace(/\/$/, '');
export const STOREFRONT_SLUG = process.env.NEXT_PUBLIC_STOREFRONT_SLUG ?? '';

if (typeof window === 'undefined' && !API_BASE) {
  // Server-side, log once. Don't throw — Next.js can still render a graceful
  // error page for the user instead of crashing the build.
  console.warn('[storefront-template] NEXT_PUBLIC_API_BASE is not set');
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
    next: { tags: options.tags ?? [], revalidate: 60 },
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
// Read endpoints (server-side, ISR-cached)
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
    unwrap: false,   // paginated — keep both `data` (array) and `meta`
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

export function getCategory(slug: string, opts: { sort?: ProductSort; page?: number } = {}) {
  return apiFetch<{ category: Category; products: Paginated<ProductCard> }>(
    `/categories/${encodeURIComponent(slug)}`,
    {
      params: { sort: opts.sort, page: opts.page },
      tags: ['categories', `category:${slug}`, 'products'],
    },
  );
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
 * and reads the API base from window.__NEXT_DATA__ at runtime (already
 * inlined as NEXT_PUBLIC_*).
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
  const json = await res.json();
  if (!res.ok) {
    const msg = json?.message ?? json?.error ?? `Order failed (${res.status})`;
    throw new Error(msg);
  }
  return (json.data ?? json) as OrderResponse;
}
