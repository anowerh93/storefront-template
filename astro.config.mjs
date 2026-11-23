// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

/**
 * A landing-pages-only build (PUBLIC_FUNNELS_ONLY=1, set by reply.bd for a
 * plan with funnels and no website; see src/lib/funnels-only.ts) prerenders
 * nothing. Its static pages (home, about, contact, categories, order lookup)
 * would call the catalogue API at build time, which refuses such a store.
 * Every route is rendered on request instead, so src/middleware.ts can
 * answer 404 for the routes such a store does not serve. A full website
 * build is untouched.
 *
 * @returns {import('astro').AstroIntegration}
 */
function funnelsOnlyRendersOnRequest() {
  const on = process.env.PUBLIC_FUNNELS_ONLY === '1';

  return {
    name: 'replybd-funnels-only',
    hooks: {
      'astro:route:setup': ({ route }) => {
        if (on) {
          route.prerender = false;
        }
      },
    },
  };
}

/**
 * Reply.BD storefront — Astro on Cloudflare Pages.
 *
 * Output mode: 'static' (Astro 5 default — 'hybrid' was removed since it
 * now behaves identically). Pages are pre-rendered by default; individual
 * SSR routes opt in with `export const prerender = false;`. Used by:
 *   - /order/{number}   → fresh status lookup needs the live API
 *   - /api/revalidate   → receives Laravel's webhook
 */
export default defineConfig({
  output: 'static',
  adapter: cloudflare({
    // CF Workers can stream responses; opt in to be safe for future SSR routes.
    mode: 'directory',
    // Use platform-native fetch — no Node shims, smaller bundle.
    platformProxy: { enabled: true },
  }),
  integrations: [
    react(),
    funnelsOnlyRendersOnRequest(),
  ],
  vite: {
    plugins: [tailwindcss()],
    // DEV ONLY: accept any Host header so host-dependent behavior (the
    // mirror-host noindex in Base.astro) can be exercised locally with
    // `curl -H "Host: {slug}.shop.reply.bd" http://127.0.0.1:4321/…`.
    // Ignored by `astro build` — production runs on Cloudflare, not Vite.
    server: { allowedHosts: true },
    // Astro's CF adapter targets the workerd runtime which doesn't have a
    // node: module surface. These aliases mute the warnings on packages that
    // import them defensively (lucide-react does this).
    resolve: {
      alias: import.meta.env?.PROD
        ? { 'react-dom/server': 'react-dom/server.edge' }
        : undefined,
    },
  },
  // Env vars accessed via `import.meta.env.PUBLIC_*` (build-time inlined,
  // safe for client bundle). Match Vercel's NEXT_PUBLIC_* convention so the
  // mental model stays the same — Reply.BD sets these per-tenant on the
  // Cloudflare Pages project at deploy time.
  //
  // Required:
  //   PUBLIC_API_BASE        — Reply.BD API root (https://reply.bd)
  //   PUBLIC_STOREFRONT_SLUG — this tenant's slug
  // Required (server-only, NOT exposed to client):
  //   REVALIDATE_SECRET      — shared secret for the /api/revalidate webhook
});
