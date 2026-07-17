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

function fire(event: string, params?: Record<string, unknown>, eventId?: string | null) {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
  // eventID is Meta's browser↔server dedup key: the server CAPI fire uses the
  // same deterministic id, so Events Manager collapses the pair instead of
  // double-counting.
  if (eventId) {
    window.fbq('track', event, params ?? {}, { eventID: eventId });
  } else {
    window.fbq('track', event, params ?? {});
  }
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

  /** GA4-only: product list rendered (category page / all-products). Meta has
      no canonical list-view event, so nothing fires to fbq. */
  viewItemList: (p: { listName: string; items: Ga4Item[] }) => {
    pushGa4('view_item_list', { item_list_name: p.listName, items: p.items });
  },

  /** GA4-only: cart page viewed with at least one line. */
  viewCart: (p: { value: number; currency?: string; items: Ga4Item[] }) => {
    pushGa4('view_cart', { currency: p.currency ?? 'BDT', value: p.value, items: p.items });
  },

  /** GA4-only: shipping zone chosen at checkout submit. */
  addShippingInfo: (p: { value: number; currency?: string; shippingTier?: string; items?: Ga4Item[] }) => {
    pushGa4('add_shipping_info', {
      currency: p.currency ?? 'BDT',
      value: p.value,
      shipping_tier: p.shippingTier,
      items: p.items ?? [],
    });
  },

  /** Payment method chosen at checkout submit — dual-fired (Meta has a
      canonical AddPaymentInfo standard event). */
  addPaymentInfo: (p: { value: number; currency?: string; paymentType?: string; items?: Ga4Item[] }) => {
    fire('AddPaymentInfo', { value: p.value, currency: p.currency ?? 'BDT' });
    pushGa4('add_payment_info', {
      currency: p.currency ?? 'BDT',
      value: p.value,
      payment_type: p.paymentType,
      items: p.items ?? [],
    });
  },

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
    /** Server CAPI dedup key from OrderResponse.meta_event_id. */
    metaEventId?: string | null;
  }) => {
    fire('Purchase', {
      content_ids: params.contentIds,
      value: params.value,
      num_items: params.numItems,
      currency: params.currency ?? 'BDT',
      order_id: params.orderNumber,
    }, params.metaEventId);
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
