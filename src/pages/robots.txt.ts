import type { APIRoute } from 'astro';
import { getStorefront } from '../lib/api';

/**
 * Per-tenant robots.txt — SSR so it follows the dashboard's WordPress-style
 * "Discourage search engines" toggle live (no rebuild needed for crawlers
 * that re-fetch robots.txt). Pairs with the <meta name="robots"> tag in
 * Base.astro; together they cover both the robots.txt-first crawlers and
 * pages already in the index.
 */
export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  let discourage = false;
  try {
    const meta = await getStorefront();
    discourage = !!meta?.seo?.discourage;
  } catch {
    // API unreachable — fail open (allow); the meta tag is the backstop.
  }

  // Sitemap URL uses this request's origin — correct on both the custom
  // domain and the pages.dev mirror. Omitted while discouraged so crawlers
  // aren't handed a URL list alongside the Disallow.
  const body = discourage
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\n\nSitemap: ${url.origin}/sitemap.xml\n`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
