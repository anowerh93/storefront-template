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

/** GA4 e-commerce item row. `item_id` is optional because the order-status
    page rebuilds items from the order-lookup API, which returns product NAMES
    only — GA4 accepts item_name without item_id. */
export type Ga4Item = {
  item_id?: string;
  item_name: string;
  price: number;
  quantity: number;
};

/** Customer block riding the purchase push — requested by tenant marketers so
    GTM can map `customer.first_name`, `customer.phone_number`, … into GA4 /
    Google Ads enhanced conversions. Raw (unhashed) values by design: the
    dataLayer stays in the shopper's own browser; hashing where a destination
    requires it is the GTM tag's job. */
export type PurchaseCustomer = {
  /** Full name as typed. Split on the FIRST space: first word → first_name,
      the rest → last_name; a single word becomes first_name only (agreed
      rule — BD checkout collects one full-name field). */
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  shippingMethod?: string | null;
};

/** Flatten a PurchaseCustomer into the dataLayer key names the marketer maps
    in GTM. Empty/absent fields are omitted (never pushed as '' or null). */
function ga4Customer(c: PurchaseCustomer | null | undefined): Record<string, string> | null {
  if (!c) return null;
  const out: Record<string, string> = {};
  const name = c.name?.trim().replace(/\s+/g, ' ');
  if (name) {
    const sp = name.indexOf(' ');
    if (sp === -1) {
      out.first_name = name;
    } else {
      out.first_name = name.slice(0, sp);
      out.last_name = name.slice(sp + 1);
    }
  }
  if (c.phone) out.phone_number = c.phone;
  if (c.email) out.email = c.email;
  if (c.address) out.address = c.address;
  if (c.shippingMethod) out.shipping_method = c.shippingMethod;
  return Object.keys(out).length ? out : null;
}

/**
 * Push a GA4 e-commerce event. No-ops when `window.dataLayer` is absent
 * (tenant has no GTM container). The `ecommerce: null` reset push before
 * each event is per Google's docs — it stops successive events merging
 * stale item arrays inside GTM's data model; `customer: null` rides the same
 * reset for symmetry. When the event itself carried a customer block, a
 * TRAILING `customer: null` is pushed too: GTM resolves each message's
 * variables against the model as of that message, so purchase-triggered tags
 * still read the values while any LATER trigger on the same page (scroll,
 * click, timer) reads null — without the trailing reset the purchase PII
 * would sit live in the data model for the rest of the page's lifetime
 * (the order-status page never pushes another event to reset it).
 */
function pushGa4(event: string, ecommerce: Record<string, unknown>, extra?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !Array.isArray(window.dataLayer)) return;
  window.dataLayer.push({ ecommerce: null, customer: null });
  window.dataLayer.push({ event, ecommerce, ...(extra ?? {}) });
  if (extra && 'customer' in extra) window.dataLayer.push({ customer: null });
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
    /** Customer details for the GTM mapping — pushed as a `customer` object
        alongside `ecommerce` (purchase event only). */
    customer?: PurchaseCustomer | null;
    /** Skip the Meta fbq fire. The order-status page uses this ONLY when its
        pay-track stash carries no `metaEventId` (old/partial stash): the
        server CAPI Purchase fires on gateway confirmation, so an UNPAIRED
        browser fbq would double-count. When the stash does carry the id, the
        page fires fbq WITH it — Meta collapses the pair and the browser fire
        adds _fbp/_fbc match-quality signal CAPI alone lacks. */
    ga4Only?: boolean;
  }) => {
    if (!params.ga4Only) {
      fire('Purchase', {
        content_ids: params.contentIds,
        value: params.value,
        num_items: params.numItems,
        currency: params.currency ?? 'BDT',
        order_id: params.orderNumber,
      }, params.metaEventId);
    }
    const customer = ga4Customer(params.customer);
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
    }, customer ? { customer } : undefined);
  },
};
