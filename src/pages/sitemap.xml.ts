import type { APIRoute } from 'astro';
import { getSitemap, type SitemapPage } from '../lib/api';

/**
 * Per-tenant sitemap.xml — SSR (like robots.txt.ts) so it always reflects
 * the live catalog: new products/categories appear without a redeploy.
 *
 * URLs are built from THIS request's origin, so the sitemap served on the
 * custom domain lists custom-domain URLs and the pages.dev mirror lists
 * pages.dev URLs — Google requires sitemap URLs to live on the host the
 * sitemap was fetched from.
 *
 * "Discourage search engines" makes the API return zero pages → an empty
 * (still valid) urlset, pairing with the Disallow-all robots.txt.
 */
export const prerender = false;

const xmlEscape = (s: string) =>
  s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c] as string,
  );

export const GET: APIRoute = async ({ url }) => {
  // SitemapPage.image (product photo / category banner / blog cover) renders
  // as a Google image-sitemap extension so photos get discovered by Google
  // Images — a real shopping channel in BD. Absent on older cached API
  // payloads; entries simply omit the block.
  let pages: SitemapPage[] = [];
  try {
    const data = await getSitemap();
    pages = data?.pages ?? [];
  } catch {
    // API unreachable — serve an empty urlset rather than a 500; crawlers
    // treat a broken sitemap as a site-quality signal.
  }

  const origin = url.origin;
  const entries = pages
    .map(
      (p) =>
        '  <url>\n' +
        `    <loc>${xmlEscape(origin + p.path)}</loc>\n` +
        (p.lastmod ? `    <lastmod>${xmlEscape(p.lastmod)}</lastmod>\n` : '') +
        (p.image
          ? `    <image:image><image:loc>${xmlEscape(p.image)}</image:loc></image:image>\n`
          : '') +
        '  </url>',
    )
    .join('\n');

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"' +
    ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' +
    (entries ? entries + '\n' : '') +
    '</urlset>\n';

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
