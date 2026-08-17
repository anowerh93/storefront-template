/**
 * Responsive images via Cloudflare Image Transformations.
 *
 * Tenant uploads live on the R2 custom domain (cdn.reply.bd), which is served
 * through the Cloudflare zone — so the edge can resize ON THE FLY via the
 * `/cdn-cgi/image/<options>/<path>` URL form. No upload-pipeline changes, no
 * stored variants, works retroactively for every image already in the bucket,
 * and the original files are never touched.
 *
 * SAFETY MODEL (production-first):
 *   • Everything is gated on PUBLIC_IMAGE_RESIZE === '1' (build-time env from
 *     the deploy pipeline). Off ⇒ every helper returns the original URL /
 *     undefined ⇒ the rendered HTML is byte-identical to today. The flag must
 *     stay off until Image Transformations is enabled on the reply.bd zone —
 *     /cdn-cgi/image/ URLs 404 without it.
 *   • Only URLs on PUBLIC_IMAGE_CDN_HOST are rewritten. Dashboard-preview
 *     blobs, dev URLs, external images: passed through untouched.
 *   • fit=scale-down NEVER upscales — a small original is served as-is, so
 *     quality can only be preserved. quality=85 + format=auto is Cloudflare's
 *     visually-lossless-tuned default (AVIF/WebP per browser).
 */

// Explicit '0'/'1' (deploy pipeline env, either name) always wins; with no
// opinion, production builds default ON (zone Transformations are enabled —
// verified live) and dev builds stay OFF (no /cdn-cgi/ on localhost).
// Kill switches: STOREFRONT_IMAGE_RESIZE=false (pipeline) or
// PUBLIC_IMAGE_TRANSFORMS=0 (direct build env).
const RAW = ((import.meta.env.PUBLIC_IMAGE_RESIZE ?? import.meta.env.PUBLIC_IMAGE_TRANSFORMS) ?? '') as string;
const ENABLED = RAW === '1' || (RAW !== '0' && !import.meta.env.DEV);
export const CDN_HOST = (import.meta.env.PUBLIC_IMAGE_CDN_HOST as string | undefined) || 'cdn.reply.bd';

/** Default srcset width ladder for fluid images (FitImage etc.). */
export const DEFAULT_WIDTHS = [320, 640, 1024] as const;

/** The homepage big banner (the mobile LCP). One source of truth — the
 *  <img srcset> in hero-grid and the <link rel=preload imagesrcset> in
 *  index.astro MUST agree, or the browser double-downloads. */
export const BANNER_WIDTHS = [480, 768, 1080, 1440, 1920] as const;
export const BANNER_SIZES = '(min-width: 1024px) 800px, 100vw';
/** Hero side tiles: full-width stacked on phones, two-up on tablets, single
 *  right column on desktop — MUST mirror hero-grid's tile wrapper
 *  (grid-cols-1 sm:grid-cols-2 lg:grid-cols-1) or phones fetch half-size. */
export const TILE_SIZES = '(min-width: 1024px) 420px, (min-width: 640px) 50vw, 100vw';
/** Funnel + PDP main image — the LCP of ad landing pages.
 *  The middle band caps at 672px because the centred funnel hero is
 *  max-w-2xl — a bare 100vw made ~1000px tablets fetch the 1200w
 *  candidate for a 672px box. */
export const DETAIL_WIDTHS = [480, 828, 1200] as const;
export const DETAIL_SIZES = '(min-width: 1024px) 600px, (min-width: 672px) 672px, 100vw';

/** Is this a URL the CDN can transform (right host, not already transformed)? */
function transformable(url: string): URL | null {
  if (!ENABLED || !url) return null;
  try {
    const u = new URL(url);
    if (u.hostname !== CDN_HOST) return null;
    if (u.pathname.startsWith('/cdn-cgi/')) return null; // never double-wrap
    return u;
  } catch {
    return null; // relative/invalid URLs (previews, placeholders) — untouched
  }
}

/** Single resized URL, or the original when resizing is off / not applicable. */
export function cdnImage(url: string, width: number, quality = 85): string {
  const u = transformable(url);
  if (!u) return url;
  return `https://${CDN_HOST}/cdn-cgi/image/width=${width},quality=${quality},format=auto,fit=scale-down${u.pathname}${u.search}`;
}

/** srcset covering the given widths, or undefined when resizing is off (the
 *  attribute is then omitted entirely — HTML identical to today). */
export function cdnSrcSet(url: string, widths: readonly number[] = DEFAULT_WIDTHS): string | undefined {
  if (!transformable(url)) return undefined;
  return widths.map((w) => `${cdnImage(url, w)} ${w}w`).join(', ');
}

/** Tiny, cheap version for FitImage's blurred backdrop layer — it renders
 *  behind blur-2xl, so 64px is indistinguishable from the full file. */
export function cdnBlurThumb(url: string): string {
  return cdnImage(url, 64, 50);
}
