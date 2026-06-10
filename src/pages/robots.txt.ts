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

export const GET: APIRoute = async () => {
  let discourage = false;
  try {
    const meta = await getStorefront();
    discourage = !!meta?.seo?.discourage;
  } catch {
    // API unreachable — fail open (allow); the meta tag is the backstop.
  }

  const body = discourage
    ? 'User-agent: *\nDisallow: /\n'
    : 'User-agent: *\nAllow: /\n';

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
