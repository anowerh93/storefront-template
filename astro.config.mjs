// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

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
  ],
  // Astro's origin check answers 403 to every cross-site form POST on an
  // on-demand route — and that is exactly how a push-IPN payment gateway
  // (SSLCommerz) hands the shopper back: a form POST from ITS origin to
  // /order/{n}?payment=success|fail|cancel. With the check on, a shopper who
  // just paid (or pressed Cancel) lands on a bare "Cross-site POST form
  // submissions are forbidden" instead of their order. The check runs before
  // any middleware of ours, so it cannot be relaxed for that one route.
  //
  // Turning it off gives nothing away HERE: this template has no cookies, no
  // sessions, no actions and no POST handler — its only endpoints are GET
  // (robots / sitemap / indexnow), and every write goes from the browser
  // straight to the Reply.BD API with a header token. Whoever adds a
  // state-changing POST route to this worker must check the Origin there.
  security: { checkOrigin: false },
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
