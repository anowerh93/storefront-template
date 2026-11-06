import type { ShippingZone, StorefrontMeta } from './types';

/**
 * Free delivery on chosen products and categories — the template's copy of
 * myapp's App\Support\FreeDelivery rule.
 *
 * A product's `free_delivery` (from the product detail / the funnel's product,
 * its own setting or one of its categories') is:
 *   'all'          — free to every zone
 *   'inside_city'  — free to the inside-city zone only
 *   null           — the shop's ordinary charge
 *
 * A cart ships free to a zone only when EVERY line is free there; one ordinary
 * line brings the ordinary charge back (the threshold included). A line with
 * no value — a cart saved before this build, or an API that does not send it
 * yet — counts as ordinary, so the checkout never shows "Free" for an order the
 * server would charge. The server decides the order's total either way.
 */
export type FreeDelivery = 'all' | 'inside_city' | null;

/** Does this setting make delivery to `zone` free? */
export function coversZone(value: FreeDelivery | undefined, zone: string | undefined): boolean {
  if (!zone) return false;
  if (value === 'all') return zone === 'inside_city' || zone === 'outside_city';
  if (value === 'inside_city') return zone === 'inside_city';
  return false;
}

/** Every line (at least one) ships free to `zone`. */
export function cartShipsFree(
  lines: { free_delivery?: FreeDelivery }[],
  zone: string | undefined,
): boolean {
  return lines.length > 0 && lines.every((l) => coversZone(l.free_delivery, zone));
}

/**
 * The delivery charge for these lines to `zone`: nothing when the shop charges
 * none or every line is free there, else the zone's fee unless the subtotal
 * reaches the free-shipping threshold. No zone picked = no fee yet.
 */
export function deliveryFee(
  shipping: StorefrontMeta['shipping'] | null | undefined,
  lines: { free_delivery?: FreeDelivery }[],
  zone: ShippingZone | undefined,
  subtotal: number,
): number {
  if (!shipping?.enabled || !zone) return 0;
  if (cartShipsFree(lines, zone.code)) return 0;
  const threshold = shipping.free_shipping_threshold ?? null;
  if (threshold && subtotal >= threshold) return 0;
  return zone.fee ?? 0;
}

/**
 * The product page's line ("ফ্রি ডেলিভারি" / "ফ্রি ডেলিভারি · ঢাকার ভিতরে"),
 * or null. Only while the shop charges for delivery at all.
 */
export function freeDeliveryLabel(
  value: FreeDelivery | undefined,
  shipping: StorefrontMeta['shipping'] | null | undefined,
): string | null {
  if (!shipping?.enabled) return null;
  if (value === 'all') return 'ফ্রি ডেলিভারি';
  if (value === 'inside_city') {
    const inside = shipping.zones?.find((z) => z.code === 'inside_city')?.label?.trim() || 'Inside Dhaka';
    return `ফ্রি ডেলিভারি · ${inside}`;
  }
  return null;
}
