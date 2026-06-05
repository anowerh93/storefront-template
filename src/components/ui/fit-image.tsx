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
 */
export function FitImage({
  src,
  alt = '',
  eager = false,
}: {
  src: string;
  alt?: string;
  eager?: boolean;
}) {
  const loading = eager ? 'eager' : 'lazy';

  return (
    <>
      {/* Blurred fill — covers the box so there are no empty bars. */}
      <img
        src={src}
        alt=""
        aria-hidden="true"
        loading={loading}
        className="absolute inset-0 h-full w-full object-cover blur-2xl scale-110"
      />
      {/* The actual image — fully visible, never cropped. */}
      <img
        src={src}
        alt={alt}
        loading={loading}
        className="absolute inset-0 h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.03]"
      />
    </>
  );
}
