/**
 * Formatting helpers — primarily BDT-aware. Keep all currency / date
 * decisions in one place so a future Bangla locale flip is a one-liner.
 */

/**
 * Format a number as BDT currency. Defaults to `৳1,299` (no decimals on
 * round numbers — typical Bangladeshi e-commerce convention). Pass
 * `decimals: 2` for line items that have fractional pricing.
 */
/** Currency code → display symbol. Unknown codes fall back to the code itself. */
const CURRENCY_SYMBOLS: Record<string, string> = {
  BDT: '৳', USD: '$', INR: '₹', EUR: '€', GBP: '£', PKR: '₨', NPR: '₨', LKR: 'Rs ',
};

/**
 * Format a price in the store's currency. `opts.currency` is a 3-letter code
 * (e.g. "BDT", "USD") — mapped to a symbol. Defaults to BDT (৳).
 */
export function formatBDT(
  value: number | string | null | undefined,
  opts: { decimals?: number; currency?: string } = {},
): string {
  if (value === null || value === undefined || value === '') return '—';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(num)) return '—';

  const code = (opts.currency ?? 'BDT').toUpperCase();
  const symbol = CURRENCY_SYMBOLS[code] ?? `${code} `;
  const decimals = opts.decimals ?? (Number.isInteger(num) ? 0 : 2);

  // en-IN gives the right comma grouping for South Asian numbers
  // (1,29,999 style). For BD shoppers this reads more natural than
  // 129,999.
  const body = num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${symbol}${body}`;
}

/** Compute discount % from list+sale price. Returns null if no discount. */
export function discountPct(salePrice: number, listPrice: number | null): number | null {
  if (!listPrice || listPrice <= salePrice) return null;
  return Math.round(((listPrice - salePrice) / listPrice) * 100);
}

/** "2 hours ago", "yesterday", etc. — used for review timestamps. */
export function relativeTime(iso: string): string {
  const date = new Date(iso);
  const diffSec = (Date.now() - date.getTime()) / 1000;
  if (diffSec < 60)         return 'just now';
  if (diffSec < 3600)       return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86_400)     return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604_800)    return `${Math.floor(diffSec / 86_400)}d ago`;
  return date.toLocaleDateString();
}

/** Slugify for URL building (mirrors Laravel's Str::slug for the simple case). */
export function slugify(s: string): string {
  return s.toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

/**
 * Truncate to `n` characters, breaking at the last word boundary so we don't
 * cut a word in half. Used for SEO meta descriptions, card excerpts, etc.
 */
export function truncate(s: string | null | undefined, n: number): string {
  if (!s) return '';
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > n * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
}
