/**
 * Mirror-host detection for SEO.
 *
 * Every tenant storefront is reachable on more than one host: the Cloudflare
 * Pages *.pages.dev URL, the platform subdomain ({slug}.shop.reply.bd) and —
 * once verified — the tenant's custom domain. `meta.public_url` is the single
 * canonical origin (the API already picks custom domain > subdomain >
 * pages.dev). Any OTHER host serving the same content is a mirror and must
 * not be indexed: canonicals alone did not stop Google listing
 * {slug}.shop.reply.bd pages next to the real domain.
 *
 * For tenants WITHOUT a custom domain the subdomain IS public_url, so their
 * only host never counts as a mirror — nothing changes for them.
 */

/**
 * Host suffixes that are ALWAYS platform mirrors, never a tenant's own
 * domain (the dashboard rejects custom domains under either suffix). The
 * PRERENDERED-page runtime check may only ever noindex hosts matching one
 * of these: its canonical host is baked at build time, and a stale bake
 * comparing "any host ≠ baked canonical" would noindex the tenant's REAL
 * custom domain the moment it verifies (the exact stale-deploy window this
 * layer defends). Structural suffixes make that impossible — a real domain
 * never matches them. SSR requests don't need this restriction: their
 * public_url is live (StorefrontCache bumps on every settings change).
 */
export const MIRROR_HOST_SUFFIXES = ['.pages.dev', '.shop.reply.bd'] as const;

export function normalizeHost(host: string | null | undefined): string {
  // `www.` and the bare apex are one site — never noindex the www variant
  // of the canonical host (the edge 301s it; if it ever serves, canonical
  // tags remain the right tool there, not a noindex).
  return (host ?? '').trim().toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
}

/** Canonical hostname from meta.public_url, '' when unset/unparsable. */
export function canonicalHost(publicUrl: string | null | undefined): string {
  if (!publicUrl) return '';
  try {
    return normalizeHost(new URL(publicUrl).hostname);
  } catch {
    return '';
  }
}

/**
 * True when `requestHostname` is a non-canonical mirror of this storefront.
 * False whenever we cannot be sure (no public_url, local/dev hosts) — the
 * failure mode of a wrong `true` is deindexing a tenant's real site, so
 * every ambiguous case stays indexable.
 */
export function isMirrorHost(
  requestHostname: string | null | undefined,
  publicUrl: string | null | undefined,
): boolean {
  const pub = canonicalHost(publicUrl);
  const req = normalizeHost(requestHostname);
  if (!pub || !req) return false;
  // Dev servers and the build-time origin (prerendered pages render with a
  // localhost URL) must never trip the check — on EITHER side: a localhost
  // request is never a mirror, and a localhost public_url (the dashboard's
  // STOREFRONT_PREVIEW_URL dev fallback can leak into meta) can never be
  // trusted as the canonical host — treating it as one would noindex every
  // real host the site serves on.
  const isLocal = (h: string) => h === 'localhost' || h === '127.0.0.1' || h.endsWith('.localhost');
  if (isLocal(req) || isLocal(pub)) return false;
  return req !== pub;
}
