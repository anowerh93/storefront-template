import { cdnBlurThumb, cdnSrcSet } from '../../lib/img';

/**
 * FitImage — shows an image that "fits perfectly" in ANY container, whatever
 * the image's aspect ratio.
 *
 *   • A blurred, zoomed copy fills the box (no empty letterbox bars).
 *   • The real image sits on top with object-contain, so it's NEVER cropped.
 *
 * Drop it inside a `relative overflow-hidden` container (it's absolutely
 * positioned to fill the parent). Used by the hero, tiles, product cards and
 * the product page so a square/portrait/wide upload all look right.
 *
 * When PUBLIC_IMAGE_RESIZE is on (see lib/img.ts), the real image gets a
 * responsive srcset (edge-resized by Cloudflare — originals untouched,
 * fit=scale-down never upscales) and the blurred backdrop drops to a 64px
 * thumb (it renders behind blur-2xl; full resolution there is pure waste).
 * When off, both helpers pass through and the markup is identical to before.
 */
export function FitImage({
  src,
  alt = '',
  eager = false,
  fetchPriority,
  sizes,
  widths,
}: {
  src: string;
  alt?: string;
  eager?: boolean;
  /** 'high' for the LCP hero image only — everything else stays default. */
  fetchPriority?: 'high' | 'low' | 'auto';
  /** How wide this image renders (srcset `sizes`). Only emitted when resizing
   *  is enabled; defaults to 100vw — callers in grids should pass a tighter
   *  value so phones pick the small candidate. */
  sizes?: string;
  /** srcset width ladder override — the hero banner passes BANNER_WIDTHS so
   *  the <img> agrees with the head preload (mismatch = double download). */
  widths?: readonly number[];
}) {
  const loading = eager ? 'eager' : 'lazy';
  const srcSet = cdnSrcSet(src, widths);

  return (
    <>
      {/* Blurred fill — covers the box so there are no empty bars. */}
      <img
        src={cdnBlurThumb(src)}
        alt=""
        aria-hidden="true"
        loading={loading}
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover blur-2xl scale-110"
      />
      {/* The actual image — fully visible, never cropped. */}
      <img
        src={src}
        srcSet={srcSet}
        sizes={srcSet ? (sizes ?? '100vw') : undefined}
        alt={alt}
        loading={loading}
        decoding="async"
        fetchPriority={fetchPriority}
        className="absolute inset-0 h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.03]"
      />
    </>
  );
}
