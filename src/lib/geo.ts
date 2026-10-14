/**
 * The visitor's country as Cloudflare saw it — "BD", "AE", … — or null when
 * unknown: off Cloudflare (a local build, its own prerender), "XX" (no
 * country) and "T1" (Tor).
 *
 * Read on an SSR page only, and only while that page's HTML is rendered per
 * request: nothing here may be baked into HTML a cache shares between
 * visitors (no SSR page sets Cache-Control today — keep it that way for a
 * page that uses this, or move the read client-side).
 *
 * Under @astrojs/cloudflare 14 `Astro.locals.runtime` throws; the raw Worker
 * request carries `cf`. The CF-IPCountry header is a fallback (it depends on
 * the zone's IP-geolocation setting).
 */
export function visitorCountry(request: Request): string | null {
  const cf = (request as Request & { cf?: { country?: unknown } }).cf;
  const raw = typeof cf?.country === 'string' ? cf.country : request.headers.get('cf-ipcountry');
  const code = (raw ?? '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) && code !== 'XX' && code !== 'T1' ? code : null;
}
