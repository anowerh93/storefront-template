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
 * What one row's picker button should SAY. The row's REAL axis, bare:
 * colour when the row has one (these catalogs keep one row per colour, so
 * "Maroon" — never "Color: Maroon · Size: M, L, XL"); else a single-valued
 * size or weight (one-row-per-size catalogs → "M"); else the combined
 * label as the last resort. A size RANGE never appears here — that list
 * belongs to the separate "Choose size" chips.
 */
function optionName(variant: ProductVariant): string {
  const color = variant.color?.trim() ?? '';
  if (color) return color;
  const size = variant.size?.trim() ?? '';
  if (size && sizeOptions(size).length === 0) return size;
  const weight = variant.weight?.trim() ?? '';
  if (weight) return weight;
  return variant.label;
}

/**
 * Button captions for the variant picker, one per row (same order). If
 * stripping the shared axes would make two rows read the same — e.g. two
 * "Red" rows that differ only by weight — EVERY caption falls back to the
 * row's full label: ambiguous buttons are worse than long ones.
 */
export function optionNames(variants: ProductVariant[]): string[] {
  const names = variants.map(optionName);
  const seen = new Set<string>();
  for (const n of names) {
    const k = n.trim().toLowerCase();
    if (seen.has(k)) return variants.map((v) => v.label);
    seen.add(k);
  }
  return names;
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
