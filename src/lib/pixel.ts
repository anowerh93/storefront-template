/**
 * Client-side commerce tracking helpers — ONE callsite per event, fired to
 * BOTH marketing stacks so they can never drift apart:
 *
 *   1. Meta Pixel (`fbq`) — id from the storefront metadata API; the base
 *      snippet is injected by Base.astro when the tenant set a pixel id.
 *      Fired via `trackSingle` scoped to OUR pixel id (Base.astro exposes it
 *      as window.__rbPixelId): the global `fbq('track', …)` form broadcasts
 *      to EVERY initialized pixel on the page, so a marketer adding a Meta
 *      base tag inside GTM would receive all our events twice (and vice
 *      versa). trackSingle isolates our fires no matter what the tenant's
 *      GTM container does.
 *   2. GA4 dataLayer — pushed only when the tenant's GTM container is on
 *      the page (Base.astro seeds `window.dataLayer` via the GTM loader).
 *      Standard GA4 e-commerce schema (view_item / add_to_cart /
 *      begin_checkout / purchase) so marketers can build GA4 + Google Ads
 *      conversion tags entirely inside Tag Manager, no code changes.
 *
 * EVENT DEDUP CONTRACT (the reason marketers can layer GTM Meta tags without
 * double-counting): every dual-fired event mints ONE event id, passed to the
 * fbq fire as `eventID` AND pushed top-level as `event_id` on the same
 * dataLayer message. A GTM Meta tag that maps a `event_id` Data Layer
 * Variable (Version 2) into its Event ID field then collapses with our fbq
 * fire — and, for Purchase, with the server CAPI fire too. CAVEAT for that
 * GTM tag: Meta dedups on the (event_name, event_id) PAIR and event names
 * are CASE-SENSITIVE — the tag must hard-code the Meta standard name
 * ('Purchase', 'AddToCart', …), never the lowercase GA4 event name it
 * triggers on ('purchase' vs 'Purchase' never dedup). Purchase NEVER
 * mints its own id: it uses the server-deterministic id
 * (`Purchase_{tenant}_{orderNumber}`, from the order API) or none at all —
 * a browser-minted Purchase id could never match CAPI's and would GUARANTEE
 * a double count through any GTM Meta tag. The one-owner guidance still
 * stands: Meta tags belong either in our settings (Pixel ID) or in GTM,
 * not both — event ids are defense in depth, not permission.
 *
 * Page views are pixel-only on purpose: GTM has a native Page View trigger
 * (container load), so a page_view push would double-count.
 *
 * Server-side CAPI is handled by Laravel — these are the browser-side
 * mirrors needed for client-side optimization signals.
 *
 * EVERY function here is exception-safe: tracking sits inside checkout
 * submit paths, and a throw (old WebView missing crypto.randomUUID, a
 * privacy extension breaking fbq) must never block an order.
 */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    dataLayer?: Record<string, unknown>[];
    /** Our tenant's Meta Pixel id — set by Base.astro's pixel snippet. */
    __rbPixelId?: string;
  }
}

/**
 * Mint a browser event id. Never throws: crypto.randomUUID needs
 * Chromium/WebView ≥92 / Safari ≥15.4 — BD low-end Androids and old
 * FB in-app WebViews miss it, so fall back through getRandomValues to a
 * time+random token (uniqueness only needs to hold per event name per 48h).
 */
export function mintEventId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch { /* fall through */ }
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const b = crypto.getRandomValues(new Uint8Array(16));
      return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    }
  } catch { /* fall through */ }
  return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function fire(event: string, params?: Record<string, unknown>, eventId?: string | null) {
  try {
    if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
    // Our Base.astro snippet always sets __rbPixelId in the same inline
    // script that inits our pixel — an fbq WITHOUT it means the only pixel
    // on the page is someone else's (a GTM-injected Meta base for a tenant
    // with no Pixel ID in our settings). Firing the global form there would
    // broadcast our events onto that foreign pixel on top of whatever its
    // own tags send — so we fire nothing.
    const pixelId = window.__rbPixelId;
    if (!pixelId) return;
    // eventID is Meta's dedup key: (event_name, event_id) pairs within 48h
    // collapse to one — across browser↔CAPI and across redundant browser
    // sources (our fbq + a correctly-mapped GTM Meta tag).
    const args: unknown[] = ['trackSingle', pixelId, event, params ?? {}];
    if (eventId) args.push({ eventID: eventId });
    window.fbq(...args);
  } catch { /* tracking must never break the shop */ }
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
    requires it is the GTM tag's job. NOTE for marketers: map these via GTM
    Data Layer Variables (Version 2) — never read them at runtime with
    dataLayer.get() inside Custom HTML tags; the trailing reset below nulls
    them the moment the purchase message is processed. */
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

type PushOpts = {
  /** Shared event id — rides the message top-level as `event_id` (the key a
      GTM Meta tag maps into its Event ID field). */
  eventId?: string | null;
  /** Called once the GTM container has processed this message's tags (or
      after a timeout / when no GTM exists). Used to defer the post-purchase
      redirect so non-beacon tags aren't cancelled by navigation. */
  onFlushed?: () => void;
};

/**
 * Push a GA4 e-commerce event. No-ops when `window.dataLayer` is absent
 * (tenant has no GTM container). The `ecommerce/customer/event_id: null`
 * reset push before each event is per Google's docs — it stops successive
 * events merging stale item arrays inside GTM's data model. The SAME reset
 * trails every event too: GTM resolves each message's variables against the
 * model as of that message, so the event's own tags still read the values,
 * while any LATER trigger on the same page (scroll, timer, click,
 * element-visibility) reads null. Without the trailing reset the purchase's
 * ecommerce object, PII customer block, and event_id would sit live in the
 * data model for the rest of the page's lifetime — an over-broad marketer
 * trigger would re-fire a fully-populated Purchase (the order-status page
 * never pushes another commerce event to overwrite it).
 */
function pushGa4(
  event: string,
  ecommerce: Record<string, unknown>,
  extra?: Record<string, unknown>,
  opts?: PushOpts,
) {
  const cb = opts?.onFlushed;
  let called = false;
  const done = () => {
    if (called) return;
    called = true;
    try { cb?.(); } catch { /* navigation callback failed — nothing to do */ }
  };
  try {
    if (typeof window === 'undefined' || !Array.isArray(window.dataLayer)) {
      // No GTM. Give fbq's own transport a beat before navigating.
      if (cb) setTimeout(done, 150);
      return;
    }
    window.dataLayer.push({ ecommerce: null, customer: null, event_id: null });
    const msg: Record<string, unknown> = { event, ecommerce, ...(extra ?? {}) };
    if (opts?.eventId) msg.event_id = opts.eventId;
    if (cb) {
      // eventCallback fires when this message's tags finish (once per
      // container); eventTimeout caps a stalled tag. The setTimeout below
      // is the safety net for a container that never loaded (plain array).
      msg.eventCallback = done;
      msg.eventTimeout = 500;
    }
    window.dataLayer.push(msg);
    window.dataLayer.push({ ecommerce: null, customer: null, event_id: null });
    if (cb) setTimeout(done, 700);
  } catch {
    if (cb) done();
  }
}

export const pixel = {
  pageView: () => fire('PageView'),

  /** GA4-only: product list rendered (category page / all-products). Meta has
      no canonical list-view event, so nothing fires to fbq. The minted
      event_id still rides the push so a marketer-mapped custom event stays
      dedupable. */
  viewItemList: (p: { listName: string; items: Ga4Item[] }) => {
    pushGa4('view_item_list', { item_list_name: p.listName, items: p.items }, undefined, { eventId: mintEventId() });
  },

  /** GA4-only: cart page viewed with at least one line. */
  viewCart: (p: { value: number; currency?: string; items: Ga4Item[] }) => {
    pushGa4('view_cart', { currency: p.currency ?? 'BDT', value: p.value, items: p.items }, undefined, { eventId: mintEventId() });
  },

  /** GA4-only: shipping zone chosen at checkout submit. */
  addShippingInfo: (p: { value: number; currency?: string; shippingTier?: string; items?: Ga4Item[] }) => {
    pushGa4('add_shipping_info', {
      currency: p.currency ?? 'BDT',
      value: p.value,
      shipping_tier: p.shippingTier,
      items: p.items ?? [],
    }, undefined, { eventId: mintEventId() });
  },

  /** Payment method chosen at checkout submit — dual-fired (Meta has a
      canonical AddPaymentInfo standard event). One shared id on both. */
  addPaymentInfo: (p: { value: number; currency?: string; paymentType?: string; items?: Ga4Item[] }) => {
    const eid = mintEventId();
    fire('AddPaymentInfo', { value: p.value, currency: p.currency ?? 'BDT' }, eid);
    pushGa4('add_payment_info', {
      currency: p.currency ?? 'BDT',
      value: p.value,
      payment_type: p.paymentType,
      items: p.items ?? [],
    }, undefined, { eventId: eid });
  },

  viewContent: (p: { id: number; name: string; price: number; currency?: string }) => {
    const eid = mintEventId();
    fire('ViewContent', {
      content_ids: [p.id.toString()],
      content_name: p.name,
      content_type: 'product',
      value: p.price,
      currency: p.currency ?? 'BDT',
    }, eid);
    pushGa4('view_item', {
      currency: p.currency ?? 'BDT',
      value: p.price,
      items: [{ item_id: p.id.toString(), item_name: p.name, price: p.price, quantity: 1 }],
    }, undefined, { eventId: eid });
  },

  addToCart: (p: { id: number; name: string; price: number; quantity: number; currency?: string }) => {
    const eid = mintEventId();
    fire('AddToCart', {
      content_ids: [p.id.toString()],
      content_name: p.name,
      content_type: 'product',
      value: p.price * p.quantity,
      currency: p.currency ?? 'BDT',
    }, eid);
    pushGa4('add_to_cart', {
      currency: p.currency ?? 'BDT',
      value: p.price * p.quantity,
      items: [{ item_id: p.id.toString(), item_name: p.name, price: p.price, quantity: p.quantity }],
    }, undefined, { eventId: eid });
  },

  initiateCheckout: (params: { value: number; numItems: number; currency?: string; items?: Ga4Item[] }) => {
    const eid = mintEventId();
    fire('InitiateCheckout', {
      value: params.value,
      num_items: params.numItems,
      currency: params.currency ?? 'BDT',
    }, eid);
    pushGa4('begin_checkout', {
      currency: params.currency ?? 'BDT',
      value: params.value,
      items: params.items ?? [],
    }, undefined, { eventId: eid });
  },

  purchase: (params: {
    orderNumber: string;
    value: number;
    numItems: number;
    currency?: string;
    contentIds: string[];
    items?: Ga4Item[];
    /** Server-deterministic Meta dedup key (`Purchase_{tenant}_{order}`) from
        the order API. Purchase NEVER mints a browser id — a random id could
        never pair with the CAPI fire and would guarantee a GTM-tag double
        count. Absent id → the dataLayer push carries no event_id. */
    metaEventId?: string | null;
    /** Customer details for the GTM mapping — pushed as a `customer` object
        alongside `ecommerce` (purchase event only). */
    customer?: PurchaseCustomer | null;
    /** Skip the Meta fbq fire. Only for a paid order whose server event id is
        genuinely unavailable: the server CAPI Purchase already fired on
        confirmation, so an UNPAIRED browser fbq would double-count. */
    ga4Only?: boolean;
    /** Defer-until-flushed hook for post-purchase redirects — see pushGa4. */
    onFlushed?: () => void;
  }) => {
    const eid = params.metaEventId ?? null;
    if (!params.ga4Only) {
      fire('Purchase', {
        content_ids: params.contentIds,
        value: params.value,
        num_items: params.numItems,
        currency: params.currency ?? 'BDT',
        order_id: params.orderNumber,
      }, eid);
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
    }, customer ? { customer } : undefined, { eventId: eid, onFlushed: params.onFlushed });
  },
};
