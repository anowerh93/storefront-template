import { defineMiddleware } from 'astro:middleware';
import { FUNNELS_ONLY, funnelsOnlyServes } from './lib/funnels-only';

/**
 * A landing-pages-only build (src/lib/funnels-only.ts) serves the funnel,
 * the order page and robots/favicon. Every other route gets a plain 404
 * before its page runs, so it makes no API call. The API refuses those
 * calls for such a store anyway.
 *
 * Such a build renders every route on request (astro.config.mjs), so this
 * runs for all of them. A full website build passes straight through.
 */
export const onRequest = defineMiddleware((context, next) => {
  if (!FUNNELS_ONLY || funnelsOnlyServes(context.routePattern)) {
    return next();
  }

  return new Response('Not found\n', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Robots-Tag': 'noindex',
      'Cache-Control': 'no-store',
    },
  });
});
