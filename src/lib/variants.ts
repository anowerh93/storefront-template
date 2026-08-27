import type { ProductVariant } from './types';

/**
 * Size-choice helpers for catalogs that store ONE variant row per colour
 * with size as a comma list ("M, L, XL"). Such a row needs a second,
 * client-side "choose size" step — the API's variant_index alone can't say
 * WHICH size the customer wants, and orders used to snapshot the whole
 * range (the website twin of the bot's #FAAXGH mis-ship).
 */

/**
 * The choosable size tokens of a row: "M, L, XL" → ['M', 'L', 'XL'].
 * Returns [] when there is nothing to choose — no value, no comma, or a
 * "list" that collapses to a single distinct token (", L ," etc.), so a
 * plain "L" row or a variant-less product never grows a picker.
 */
export function sizeOptions(size: string | null | undefined): string[] {
  if (!size || !size.includes(',')) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of size.split(',')) {
    const t = raw.trim();
    const k = t.toLowerCase();
    if (t && !seen.has(k)) {
      seen.add(k);
      out.push(t);
    }
  }
  return out.length > 1 ? out : [];
}

/**
 * Display label for a cart/checkout line: the row's own label until a size
 * is chosen, then the same "Color: X · Size: Y" shape with the ONE chosen
 * size substituted for the range (mirrors the server's variantLabel()).
 */
export function lineLabel(variant: ProductVariant, chosenSize: string | null): string {
  if (!chosenSize) return variant.label;
  const parts: string[] = [];
  if (variant.color) parts.push(`Color: ${variant.color}`);
  parts.push(`Size: ${chosenSize}`);
  if (variant.weight) parts.push(`Weight: ${variant.weight}`);
  return parts.join(' · ');
}
