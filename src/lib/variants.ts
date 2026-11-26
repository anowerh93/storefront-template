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
 * belongs to the separate size chips (sizePickerHeading).
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

export type VariantAxis = 'color' | 'size' | 'weight';

/** The axes in the server's order (myapp Product::VARIANT_AXES). */
const AXES: VariantAxis[] = ['color', 'size', 'weight'];

/** What PHP's trim() strips (" \t\n\r\0\x0B"), narrower than String#trim(). */
const PHP_TRIM = /^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g;

/** The server's default axis names (Product::DEFAULT_VARIANT_AXIS_LABELS). */
const DEFAULT_AXIS_NAMES: Record<VariantAxis, string> = { color: 'Color', size: 'Size', weight: 'Weight' };

/**
 * The shop's own name for one variant axis ("flavor" for color), from the
 * product's `variant_axis_labels`, trimmed exactly as the server's trim() does; its casing is
 * kept as typed. Null when the payload has no usable name for that axis (an
 * older API or cached payload without the field, null, a blank, a non-string),
 * so each axis falls back on its own. Only the DISPLAYED name changes: the
 * stored keys stay color / size / weight.
 */
export function axisName(labels: unknown, axis: VariantAxis): string | null {
  if (!labels || typeof labels !== 'object') return null;
  const raw = (labels as Record<string, unknown>)[axis];
  if (typeof raw !== 'string') return null;
  const name = raw.replace(PHP_TRIM, '');
  return name === '' ? null : name;
}

/**
 * A renamed axis only: null when the name is missing OR is the server's
 * default ("Color" / "Size" / "Weight", which the API now sends for every
 * product it has not renamed). Lets the picker headings keep today's wording
 * ("Choose colour", "Choose size") for shops that renamed nothing.
 */
function renamedAxis(labels: unknown, axis: VariantAxis): string | null {
  const name = axisName(labels, axis);
  return name === null || name === DEFAULT_AXIS_NAMES[axis] ? null : name;
}

/**
 * Heading over the variant picker: "Choose <the shop's colour name>" when
 * every row has a colour, else "Choose option" (the rows differ on more than
 * one axis, so no single name fits). Unrenamed → "Choose colour", as before.
 */
export function variantPickerHeading(variants: ProductVariant[], labels: unknown): string {
  if (!variants.every((v) => !!v.color?.trim())) return 'Choose option';
  const name = renamedAxis(labels, 'color');
  return name ? `Choose ${name}` : 'Choose colour';
}

/** Heading over the size chips: "Choose <the shop's size name>", else "Choose size". */
export function sizePickerHeading(labels: unknown): string {
  const name = renamedAxis(labels, 'size');
  return name ? `Choose ${name}` : 'Choose size';
}

/** PHP's `!empty()` for a variant value, as Product::variantLabel() tests it. */
function phpFilled(value: unknown): boolean {
  return !(value == null || value === '' || value === '0' || value === 0 || value === false);
}

/**
 * Display label for a cart/checkout line: the row's own label until a size
 * is chosen, then the same "Color: X · Size: Y" shape with the ONE chosen
 * size substituted for the range.
 *
 * With the product's `variant_axis_labels` it mirrors the server's
 * Product::variantLabel() byte for byte: "<name>: <value>" for each filled
 * axis (PHP empty() skips it), in color / size / weight order, joined by
 * " · ", each name the shop's own (trimmed) or the default. Without labels
 * (an older API or cached payload) the output is exactly what it always was.
 */
export function lineLabel(variant: ProductVariant, chosenSize: string | null, labels?: unknown): string {
  if (!chosenSize) return variant.label;
  if (labels == null) {
    const parts: string[] = [];
    if (variant.color) parts.push(`Color: ${variant.color}`);
    parts.push(`Size: ${chosenSize}`);
    if (variant.weight) parts.push(`Weight: ${variant.weight}`);
    return parts.join(' · ');
  }
  const values: Record<VariantAxis, unknown> = { color: variant.color, size: chosenSize, weight: variant.weight };
  const parts: string[] = [];
  for (const axis of AXES) {
    if (phpFilled(values[axis])) {
      parts.push(`${axisName(labels, axis) ?? DEFAULT_AXIS_NAMES[axis]}: ${values[axis]}`);
    }
  }
  return parts.join(' · ');
}
