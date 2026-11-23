/**
 * "Ad landing pages only" builds (reply.bd plans with funnels and no website).
 *
 * reply.bd builds such a store with PUBLIC_FUNNELS_ONLY=1, and only from a
 * build that declares the `funnels_only` capability
 * (public/storefront-capabilities.json). The API answers that store's
 * funnel, order and order-lookup calls and refuses everything else (402),
 * so this build serves the same set of pages and nothing more:
 *   - the funnel at /{slug}, and the /f/{slug} redirect to it;
 *   - the order page /order/{number} (thank-you, tracking, payment return);
 *   - robots.txt and the favicon.
 * Every other route answers a plain 404 (src/middleware.ts). The catalogue
 * pages are never prerendered either (astro.config.mjs), so a build makes no
 * catalogue call.
 *
 * A full website build leaves the variable unset, and none of this runs.
 */
export const FUNNELS_ONLY: boolean = import.meta.env.PUBLIC_FUNNELS_ONLY === '1';

/**
 * Astro route patterns (context.routePattern) a landing-pages-only build
 * serves. A static route ("/about", "/cart") wins over "/[slug]" in Astro's
 * routing, so it is matched by its own pattern and refused here.
 */
export const FUNNELS_ONLY_ROUTES: readonly string[] = [
  '/[slug]',
  '/f/[slug]',
  '/order/[number]',
  '/robots.txt',
  '/favicon.ico',
  '/404',
];

export function funnelsOnlyServes(routePattern: string): boolean {
  return FUNNELS_ONLY_ROUTES.includes(routePattern);
}
