/**
 * Meta Pixel firing helpers (client-side).
 *
 * The pixel id comes from the storefront metadata API; we inject the base
 * snippet via <Script> in the root layout once the id is known. After that
 * `fbq('track', ...)` is on `window` and these helpers wrap the canonical
 * commerce events.
 *
 * Server-side CAPI is handled by Laravel — these are the browser-side
 * mirrors needed for client-side optimization signals.
 */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

function fire(event: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
  window.fbq('track', event, params ?? {});
}

export const pixel = {
  pageView: () => fire('PageView'),

  viewContent: (p: { id: number; name: string; price: number; currency?: string }) =>
    fire('ViewContent', {
      content_ids: [p.id.toString()],
      content_name: p.name,
      content_type: 'product',
      value: p.price,
      currency: p.currency ?? 'BDT',
    }),

  addToCart: (p: { id: number; name: string; price: number; quantity: number; currency?: string }) =>
    fire('AddToCart', {
      content_ids: [p.id.toString()],
      content_name: p.name,
      content_type: 'product',
      value: p.price * p.quantity,
      currency: p.currency ?? 'BDT',
    }),

  initiateCheckout: (params: { value: number; numItems: number; currency?: string }) =>
    fire('InitiateCheckout', {
      value: params.value,
      num_items: params.numItems,
      currency: params.currency ?? 'BDT',
    }),

  purchase: (params: {
    orderNumber: string;
    value: number;
    numItems: number;
    currency?: string;
    contentIds: string[];
  }) =>
    fire('Purchase', {
      content_ids: params.contentIds,
      value: params.value,
      num_items: params.numItems,
      currency: params.currency ?? 'BDT',
      // Custom data so server-side CAPI events can be deduplicated by
      // matching `eventID` on both sides if/when we add that.
      order_id: params.orderNumber,
    }),
};
