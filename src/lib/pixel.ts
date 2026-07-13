/**
 * Client-side commerce tracking helpers — ONE callsite per event, fired to
 * BOTH marketing stacks so they can never drift apart:
 *
 *   1. Meta Pixel (`fbq`) — id from the storefront metadata API; the base
 *      snippet is injected by Base.astro when the tenant set a pixel id.
 *   2. GA4 dataLayer — pushed only when the tenant's GTM container is on
 *      the page (Base.astro seeds `window.dataLayer` via the GTM loader).
 *      Standard GA4 e-commerce schema (view_item / add_to_cart /
 *      begin_checkout / purchase) so marketers can build GA4 + Google Ads
 *      conversion tags entirely inside Tag Manager, no code changes.
 *
 * Page views are pixel-only on purpose: GTM has a native Page View trigger
 * (container load), so a page_view push would double-count.
 *
 * Server-side CAPI is handled by Laravel — these are the browser-side
 * mirrors needed for client-side optimization signals.
 */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    dataLayer?: Record<string, unknown>[];
  }
}

function fire(event: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
  window.fbq('track', event, params ?? {});
}

/** GA4 e-commerce item row. */
export type Ga4Item = {
  item_id: string;
  item_name: string;
  price: number;
  quantity: number;
};

/**
 * Push a GA4 e-commerce event. No-ops when `window.dataLayer` is absent
 * (tenant has no GTM container). The `ecommerce: null` reset push before
 * each event is per Google's docs — it stops successive events merging
 * stale item arrays inside GTM's data model.
 */
function pushGa4(event: string, ecommerce: Record<string, unknown>) {
  if (typeof window === 'undefined' || !Array.isArray(window.dataLayer)) return;
  window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push({ event, ecommerce });
}

export const pixel = {
  pageView: () => fire('PageView'),

  viewContent: (p: { id: number; name: string; price: number; currency?: string }) => {
    fire('ViewContent', {
      content_ids: [p.id.toString()],
      content_name: p.name,
      content_type: 'product',
      value: p.price,
      currency: p.currency ?? 'BDT',
    });
    pushGa4('view_item', {
      currency: p.currency ?? 'BDT',
      value: p.price,
      items: [{ item_id: p.id.toString(), item_name: p.name, price: p.price, quantity: 1 }],
    });
  },

  addToCart: (p: { id: number; name: string; price: number; quantity: number; currency?: string }) => {
    fire('AddToCart', {
      content_ids: [p.id.toString()],
      content_name: p.name,
      content_type: 'product',
      value: p.price * p.quantity,
      currency: p.currency ?? 'BDT',
    });
    pushGa4('add_to_cart', {
      currency: p.currency ?? 'BDT',
      value: p.price * p.quantity,
      items: [{ item_id: p.id.toString(), item_name: p.name, price: p.price, quantity: p.quantity }],
    });
  },

  initiateCheckout: (params: { value: number; numItems: number; currency?: string; items?: Ga4Item[] }) => {
    fire('InitiateCheckout', {
      value: params.value,
      num_items: params.numItems,
      currency: params.currency ?? 'BDT',
    });
    pushGa4('begin_checkout', {
      currency: params.currency ?? 'BDT',
      value: params.value,
      items: params.items ?? [],
    });
  },

  purchase: (params: {
    orderNumber: string;
    value: number;
    numItems: number;
    currency?: string;
    contentIds: string[];
    items?: Ga4Item[];
  }) => {
    fire('Purchase', {
      content_ids: params.contentIds,
      value: params.value,
      num_items: params.numItems,
      currency: params.currency ?? 'BDT',
      // Custom data so server-side CAPI events can be deduplicated by
      // matching `eventID` on both sides if/when we add that.
      order_id: params.orderNumber,
    });
    pushGa4('purchase', {
      transaction_id: params.orderNumber,
      currency: params.currency ?? 'BDT',
      value: params.value,
      items: params.items ?? params.contentIds.map((id) => ({
        item_id: id,
        item_name: '',
        price: 0,
        quantity: 1,
      })),
    });
  },
};
