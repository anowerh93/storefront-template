import type { APIRoute } from 'astro';
import { getStorefront } from '../lib/api';

/**
 * /favicon.ico — browsers and some crawlers ask for it whatever the page's
 * <link rel="icon"> says, and it 404'd on every shop host. SSR (like
 * robots.txt) so a new icon works without a redeploy: a 302 to the shop's
 * 192 px PNG (the API's `icons`), else to the old favicon_url (the site
 * icon, else the logo), else 404. Only an http(s) address is followed.
 */
export const prerender = false;

const isHttpUrl = (value: unknown): value is string =>
  typeof value === 'string' && /^https?:\/\//i.test(value);

export const GET: APIRoute = async () => {
  let target: string | null = null;
  try {
    const meta = await getStorefront();
    const icons = meta?.icons ?? [];
    const png = icons.find((i) => i?.sizes === '192x192')?.src ?? icons[0]?.src;
    target = [png, meta?.favicon_url].find(isHttpUrl) ?? null;
  } catch {
    // API unreachable or the shop is closed — no icon to point at.
  }

  if (!target) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: target,
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
