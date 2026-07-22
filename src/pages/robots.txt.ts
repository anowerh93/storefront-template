import type { APIRoute } from 'astro';
import { getStorefront } from '../lib/api';
import { isMirrorHost } from '../lib/mirror';

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
  // Advertise the sitemap only on a POSITIVELY-confirmed canonical host:
  // meta fetched AND this host is not a mirror. API unreachable stays
  // crawlable (Allow — the meta tag is the backstop for discourage) but
  // must not hand a mirror its own sitemap URL, so the Sitemap line is
  // fail-CLOSED.
  let advertiseSitemap = false;
  try {
    const meta = await getStorefront();
    discourage = !!meta?.seo?.discourage;
    advertiseSitemap = !discourage && !isMirrorHost(url.hostname, meta?.public_url);
  } catch {
    // API unreachable — fail open on crawl, closed on the Sitemap line.
  }

  // Sitemap URL uses this request's origin — correct on both the custom
  // domain and a subdomain-only tenant's primary host. Omitted while
  // discouraged so crawlers aren't handed a URL list alongside the
  // Disallow, and on MIRROR hosts ({slug}.shop.reply.bd next to a live
  // custom domain) so the mirror never advertises its own URL set. Mirrors
  // deliberately stay Allow: a Disallow would stop crawlers from ever
  // SEEING the noindex tags that get the already-indexed pages dropped.
  const body = discourage
    ? 'User-agent: *\nDisallow: /\n'
    : advertiseSitemap
    ? `User-agent: *\nAllow: /\n\nSitemap: ${url.origin}/sitemap.xml\n`
    : 'User-agent: *\nAllow: /\n';

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
