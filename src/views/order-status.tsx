import { useEffect, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { lookupOrder, getToken, getMyOrder, markPurchaseTracked, ApiError, UnauthenticatedError } from '../lib/api';
import { pixel } from '../lib/pixel';
import { useCart } from '../stores/cart';
import { Header } from '../components/layout/header';
import { Footer } from '../components/layout/footer';
import { MessengerCTA } from '../components/layout/messenger-cta';
import { Button } from '../components/ui/button';
import { OrderLookupForm } from '../components/order/order-lookup-form';
import { OrderDetail } from '../components/order/order-detail';
import {
  clearPayReturnNote,
  isOnlineMethod,
  payRetryHref,
  payRetryOffer,
  payReturnHint,
  readPayReturnNote,
  takePayCartNote,
} from '../components/order/checkout-extras';
import { formatBDT } from '../lib/format';
import { NotFoundPage } from './not-found';
import type { OrderResponse, StorefrontMeta } from '../lib/types';

/**
 * Where an order's ONLINE payment stands, from order data alone (the
 * ?payment= hint on a gateway return URL is untrusted and never consulted).
 * Pure, so the banner logic can be checked without rendering the page.
 */
export function orderPaymentState(order: OrderResponse | null) {
  // Paid through the gateway — in full ('online') or as an advance with the
  // rest on delivery ('online_advance'). A payload without the field is COD.
  const isOnline = isOnlineMethod(order?.payment_method);
  // Only an order the SERVER still holds for its payment is "confirming". One
  // the store has already moved on (confirmed over the phone, shipped…) while
  // unpaid is a live order whose payment simply hasn't been recorded — a
  // spinner there would spin for the life of the order.
  const awaitingPayment =
    !!order && isOnline && order.payment_status === 'unpaid' && order.status === 'awaiting_payment';
  // 'partially_paid' = the advance of an 'online_advance' order was captured;
  // the remainder is cash on delivery.
  const partlyPaid = isOnline && order?.payment_status === 'partially_paid';
  const moneyCaptured =
    isOnline &&
    (order?.payment_status === 'paid' || order?.payment_status === 'refunded' || partlyPaid);
  // Cancelled AFTER the money was captured (merchant cancel → manual refund)
  // is a different message than a failed/abandoned payment — telling a
  // charged customer "you have not been charged" is a dispute generator.
  const paidThenCanceled = moneyCaptured && order?.status === 'canceled';
  const paymentPaid =
    isOnline && (order?.payment_status === 'paid' || partlyPaid) && order?.status !== 'canceled';
  // "Cancelled, not charged" is about the ORDER being cancelled — never about
  // payment_status alone: an order the store revived (or confirmed by phone)
  // can carry a failed/unpaid payment while it is being fulfilled.
  const paymentFailed = isOnline && !moneyCaptured && order?.status === 'canceled';
  // Live order, online payment never recorded: say so plainly, no spinner.
  // A DELIVERED one was settled at the door — there is nothing outstanding
  // to announce, so it gets the neutral heading.
  const paymentUnconfirmed =
    isOnline &&
    !moneyCaptured &&
    !!order &&
    order.status !== 'canceled' &&
    order.status !== 'delivered' &&
    !awaitingPayment;

  return { isOnline, awaitingPayment, partlyPaid, moneyCaptured, paidThenCanceled, paymentPaid, paymentFailed, paymentUnconfirmed };
}

/**
 * The line under "(Advance) payment received". Amounts arrive formatted;
 * null = the API did not send them. Once the order has been delivered
 * nothing is "due on delivery" or "being processed" any more.
 */
export function paymentReceivedLine(o: {
  partlyPaid: boolean;
  delivered: boolean;
  paid: string | null;
  due: string | null;
  /** The gateway confirmed a payment the store could not credit in taka
   *  (recorded as 0, held for review) — say it is being checked. */
  unmatched?: boolean;
}): string {
  if (o.unmatched && !o.delivered) {
    return 'Thank you. Your payment reached the store and is being checked — they will contact you if anything more is needed.';
  }
  if (!o.partlyPaid) {
    return o.delivered
      ? 'Thank you. Your payment is confirmed.'
      : 'Thank you. Your payment is confirmed and your order is being processed.';
  }
  if (o.delivered) {
    return o.paid ? `Thank you. Your advance of ${o.paid} was paid online.` : 'Thank you. Your advance was paid online.';
  }
  return o.paid && o.due
    ? `Thank you. Your advance of ${o.paid} is confirmed — ${o.due} is due on delivery.`
    : 'Thank you. Your advance is confirmed — the rest is due on delivery.';
}

/**
 * Astro+CF port: previously did its own `await getStorefront()` +
 * `await lookupOrder()`. Storefront meta now comes from the Astro page
 * as a prop. Order is looked up CLIENT-SIDE via fetch since the order
 * lookup is per-customer and shouldn't be cached at the CF edge — moving
 * it to the client also lets us show a loading state while the request
 * runs, and avoids the "order placed but page 404s because lookup race"
 * window right after submit.
 *
 * The order card itself is rendered by the shared <OrderDetail> component so
 * the logged-in account view (which fetches via the bearer-token endpoint)
 * shows the exact same UI.
 */
export function OrderStatusPage({
  orderNumber,
  phone,
  placed,
  accountExists,
  meta,
}: {
  orderNumber: string;
  phone?: string;
  placed?: boolean;
  /** Set when the customer ticked "Create an account?" but the phone already
   *  had one — show a subtle "log in to track all your orders" nudge. */
  accountExists?: boolean;
  meta: StorefrontMeta | null;
}) {
  const [order, setOrder] = useState<OrderResponse | null>(null);
  // Who is asking, as far as the SERVER can know: the ?phone= last-4, nobody
  // logged in. The two browser-only sources — the last-4 the order forms
  // stash before a gateway redirect, and the account token — are read in the
  // mount effect below, never during render: the first client render must be
  // the very tree the server sent. Reading them in the initial state made a
  // gateway return (no ?phone=, stash present) hydrate a loader over the
  // server's lookup form — React #418, the whole island thrown away and
  // rendered again. `ready` = that read has happened; until then the page
  // shows the neutral loader on both sides.
  const [phoneKey, setPhoneKey] = useState<string | undefined>(phone);
  const [ready, setReady] = useState(false);
  // The "log in to track your orders" nudge: from the URL on the COD path,
  // from the sessionStorage stash on the online path (the gateway redirect
  // can't carry query flags of ours).
  const [acctNudge] = useState<boolean>(() => {
    if (accountExists) return true;
    if (typeof window === 'undefined') return false;
    try {
      return sessionStorage.getItem(`replybd:pay-acct:${orderNumber}`) === '1';
    } catch {
      return false;
    }
  });
  // "Try again" for a payment that did not go through: the order form this
  // browser left for the gateway (the note both forms leave — see
  // payReturnKey). Read, not consumed, and already vetted as a same-origin
  // path; null in any other browser, after 24h, or with storage blocked — the
  // page is then exactly what it was without the link. Read from the browser
  // in the initial state, which the server cannot match — safe only because
  // nothing derived from it (or from `returnHint` below) reaches the DOM
  // before `order` has loaded, and the hydrating render never has an order.
  const [retryHref] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const path = readPayReturnNote(orderNumber, window.location.origin, localStorage, Date.now());
      return path ? payRetryHref(path) : null;
    } catch {
      return null;
    }
  });
  // The gateway's own ?payment= on the return URL. Untrusted: it only shapes
  // the "Try again" offer (see payRetryOffer) — what happened to the payment
  // is still read from the order alone.
  const [returnHint] = useState(() =>
    typeof window !== 'undefined' ? payReturnHint(window.location.search) : null,
  );
  // A logged-in customer can view the order WITHOUT a phone (the account
  // session is the identity proof) — resolved in the mount effect below.
  const [authed, setAuthed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(Boolean(phone));
  const [notFound, setNotFound] = useState<boolean>(false);
  // Lookup refused for a reason OTHER than 404 (throttled, transient 5xx) —
  // rendered as a soft "try again" screen, never as "order not found".
  const [loadFailed, setLoadFailed] = useState<boolean>(false);
  const [retryTick, setRetryTick] = useState(0);
  // How many payment-status refetches we've done for a still-unpaid online
  // order (capped so an abandoned tab doesn't poll forever).
  const [polls, setPolls] = useState(0);
  const clearCart = useCart((s) => s.clear);

  // After hydration: recover who is asking from this browser. Gateway return
  // URLs (/order/{n}?payment=…) carry NO phone param — the order forms stash
  // the last-4 in sessionStorage before the redirect (same tab comes back),
  // so the shopper lands straight on their order instead of the lookup form.
  // One batch with `ready`, so the lookup below starts exactly once, with the
  // final identity, and an identity found here goes loader → order with no
  // lookup form (or "not found") in between.
  useEffect(() => {
    let stashedPhone: string | undefined;
    if (!phone) {
      try {
        stashedPhone = sessionStorage.getItem(`replybd:pay-phone:${orderNumber}`) ?? undefined;
      } catch {
        /* storage blocked — the lookup form asks for the last-4 */
      }
    }
    const hasToken = Boolean(getToken());
    if (stashedPhone) setPhoneKey(stashedPhone);
    if (hasToken) setAuthed(true);
    if (stashedPhone || hasToken) setLoading(true);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Not before the mount effect above has said who is asking — otherwise a
    // logged-in customer on a ?phone= URL would fire the lookup twice.
    if (!ready) return;
    let cancelled = false;

    // Guest path: look up by phone last-4. Account path: a logged-in customer
    // with no phone param fetches their own order via the bearer-token
    // endpoint. (A phone param always takes precedence — it's the guest
    // success-redirect shape and works even for logged-in customers.)
    if (phoneKey) {
      setLoading(true);
      lookupOrder(orderNumber, phoneKey)
        .then((res) => { if (!cancelled) { setOrder(res); setLoadFailed(false); } })
        .catch((err) => {
          if (cancelled) return;
          // A throttled (429) or erroring (5xx) lookup is NOT "order not
          // found" — the order exists and may already be paid. Only a real
          // 404 (wrong number/phone) gets the not-found page.
          if (err instanceof ApiError && err.status !== 404) setLoadFailed(true);
          else setNotFound(true);
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    } else if (authed) {
      setLoading(true);
      getMyOrder(orderNumber)
        .then((res) => { if (!cancelled) setOrder(res); })
        .catch((err) => {
          if (cancelled) return;
          // Token died mid-session → drop the authed flag so we fall through
          // to the guest lookup form instead of a hard 404.
          if (err instanceof UnauthenticatedError) { setAuthed(false); setLoading(false); return; }
          setNotFound(true);
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    }

    return () => { cancelled = true; };
  }, [ready, orderNumber, phoneKey, authed, retryTick]);

  // ── Online-payment status polling ──
  // An online order sits `unpaid` until the gateway confirmation lands
  // (browser-return verify or the SSLCommerz IPN). While it's in that window,
  // refetch on a BACKOFF schedule so the banner flips to paid/failed by
  // itself — the server is the source of truth, never the ?payment= URL hint.
  //
  // Backoff, not a fixed interval: the guest lookup endpoint is limited to
  // 60/hour per IP, and BD mobile networks CGNAT many shoppers behind one IP.
  // Browser-return gateways (EPS/aamarPay) confirm BEFORE redirecting here, so
  // this mostly covers SSLCommerz IPN latency (seconds) — poll quickly at
  // first, then back off. Total budget: 12 refetches over ~3 minutes.
  const POLL_DELAYS_MS = [3000, 4000, 5000, 7000, 10000, 15000, 20000, 30000, 30000, 30000, 30000, 30000];
  const { awaitingPayment, partlyPaid, paidThenCanceled, paymentPaid, paymentFailed, paymentUnconfirmed } =
    orderPaymentState(order);
  const pollsExhausted = polls >= POLL_DELAYS_MS.length;

  // What the gateway captured / what the rider collects — server figures,
  // absent on an API that predates them (the copy then stays generic).
  const paidOnline = typeof order?.online_paid_amount === 'number' ? order.online_paid_amount : null;
  const dueOnDelivery = typeof order?.due_on_delivery === 'number' ? order.due_on_delivery : null;

  // The checkout deliberately does NOT clear the cart before the gateway
  // redirect (the cart is the shopper's resume path if they back out). Once
  // the payment is confirmed the sale is done — clear it here, exactly once:
  // only when THIS browser's cart built the order (the cart checkout's
  // localStorage note, consumed here). A funnel / buy-now order, or one
  // looked up from another browser, has no note — confirming it must not
  // empty an unrelated cart, and a later revisit can't wipe a NEW one.
  useEffect(() => {
    if (!paymentPaid) return;
    try {
      if (takePayCartNote(orderNumber, localStorage)) clearCart();
    } catch {
      /* storage blocked — worst case the cart badge lingers */
    }
  }, [paymentPaid, orderNumber, clearCart]);

  // The money arrived (even on an order cancelled afterwards) — there is
  // nothing left to try again, so the return note has no further use. Never
  // dropped on a click of the link itself: Back from the retry must find it.
  useEffect(() => {
    if (!paymentPaid && !paidThenCanceled) return;
    try {
      clearPayReturnNote(orderNumber, localStorage);
    } catch {
      /* storage blocked */
    }
  }, [paymentPaid, paidThenCanceled, orderNumber]);

  // The way back to the order form: 'failed' once the order was cancelled
  // unpaid; 'unfinished' while it still awaits its payment — and never while
  // the gateway's return says the money was (or may have been) taken. See
  // payRetryOffer. Derived, never state.
  const retryOffer = payRetryOffer({
    hasLink: !!retryHref,
    paymentFailed,
    awaitingPayment,
    pollsExhausted,
    hint: returnHint,
  });

  // ── Purchase pixel for ONLINE orders ──
  // Fired HERE (payment confirmed), never at checkout submit, so abandoned
  // gateway sessions are not counted as sales. Exactly-once is layered:
  //  1. SERVER latch (order.purchase_tracked, consumed via
  //     markPurchaseTracked) — cross-device truth. COD orders arrive
  //     pre-stamped (their purchase fired at checkout), so this effect can
  //     never re-push them even though it only runs for paid ONLINE orders.
  //  2. localStorage once-flag — same-browser fast path (poll re-runs,
  //     refreshes, the fire-and-forget latch consume still in flight).
  //  3. The checkout's `pay-track` sessionStorage stash — now an ENRICHER,
  //     not the gate: it carries phone/email + item_id rows the lookup API
  //     doesn't return. The push no longer REQUIRES it, because sessionStorage
  //     continuity routinely breaks on real BD payments (bKash app-switch
  //     returning in the system browser, "Open in Chrome", closed tab + late
  //     IPN) — those paid orders used to zero-fire GA4 forever.
  // The stash is DELETED after the push (and on a failed payment): it holds
  // plaintext phone/email, and sessionStorage survives reopen-closed-tab
  // restore on shared machines.
  // Meta side: the fbq Purchase always carries the server-deterministic
  // event id (order.meta_event_id from the lookup, else the stash copy) so
  // Meta collapses it with the CAPI fire; if no id is available on some
  // path, the fire stays GA4-only — an unpaired browser fbq would
  // double-count against CAPI.
  // Like every hook in this component it MUST stay above the early returns —
  // a conditional hook count unmounts the island (blank page, July 2026).
  useEffect(() => {
    if (!order) return;
    const stashKey = `replybd:pay-track:${orderNumber}`;
    // Terminal failure → the stash will never be consumed; drop the PII now.
    if (paymentFailed) {
      try { sessionStorage.removeItem(stashKey); } catch { /* storage blocked */ }
      return;
    }
    if (!paymentPaid) return;
    type PayTrackStash = {
      phone?: string;
      email?: string;
      items?: { item_id?: string; item_name: string; price: number; quantity: number }[];
      metaEventId?: string;
    };
    let stash: PayTrackStash | null = null;
    try {
      const raw = sessionStorage.getItem(stashKey);
      if (raw) stash = JSON.parse(raw) as PayTrackStash;
    } catch {
      /* storage blocked / corrupt stash → the server-truth path below decides */
    }
    // Server latch closed → some browser already pushed this order (or it's
    // COD-owned). Nothing to do beyond dropping the PII stash.
    if (order.purchase_tracked) {
      try { sessionStorage.removeItem(stashKey); } catch { /* storage blocked */ }
      return;
    }
    // The stash-less fallback needs the server's explicit go-ahead
    // (purchase_tracked === false). `undefined` means an OLD API without the
    // latch fields (storefront deployed before the myapp pull+migration) —
    // treating that as "not tracked" would re-push on every cross-device
    // visit for the whole skew window, so the stash stays the gate there.
    const serverSaysUntracked = order.purchase_tracked === false;
    if (!stash && !serverSaysUntracked) return;
    // Same-browser once-flag. Read DEFENSIVELY (a throwing localStorage must
    // not skip the push — the server latch is the real cross-visit guard).
    const flagKey = `replybd:purchase-pushed:${orderNumber}`;
    let pushedHere = false;
    try { pushedHere = !!localStorage.getItem(flagKey); } catch { /* treat as not pushed */ }
    if (!pushedHere) {
      // Prefer the checkout's stashed item rows (item_id identity consistent
      // with view_item/add_to_cart/COD purchase); the lookup API returns
      // product NAMES only, so the fallback rows are name-only (GA4 accepts
      // either key).
      const stashedItems = stash && Array.isArray(stash.items) && stash.items.length > 0 ? stash.items : null;
      const items = stashedItems ?? (order.items ?? []).map((i) => ({
        item_name: i.variant ? `${i.product_name} (${i.variant})` : i.product_name,
        price: i.unit_price,
        quantity: i.quantity,
      }));
      const eventId = order.meta_event_id ?? stash?.metaEventId ?? null;
      pixel.purchase({
        orderNumber,
        value: order.total,
        numItems: items.reduce((n, i) => n + i.quantity, 0),
        currency: order.currency,
        contentIds: (stashedItems ?? []).map((i) => i.item_id).filter((id): id is string => Boolean(id)),
        items,
        // Server-deterministic id on every path — pairs the fbq fire with
        // CAPI (and any event_id-mapped GTM Meta tag). No id → GA4-only.
        ...(eventId ? { metaEventId: eventId } : { ga4Only: true }),
        customer: {
          name: order.customer_name ?? null,
          phone: stash?.phone ?? null,
          email: stash?.email ?? order.customer_email ?? null,
          address: order.address ?? null,
          shippingMethod:
            meta?.shipping?.zones?.find((z) => z.code === order.shipping_zone)?.label
              ?? order.shipping_zone
              ?? null,
        },
      });
      try { localStorage.setItem(flagKey, '1'); } catch { /* server latch still guards */ }
      // Consume the server latch (fire-and-forget, never throws). Also mark
      // the in-memory order so poll-driven effect re-runs in THIS tab gate
      // on layer 1 even before a refetch reflects it.
      order.purchase_tracked = true;
      void markPurchaseTracked(orderNumber, phoneKey);
    } else if (serverSaysUntracked) {
      // We pushed earlier but the latch consume evidently never landed (it's
      // best-effort) — retry it, else every OTHER device sees an open latch
      // forever and re-pushes. Idempotent server-side.
      order.purchase_tracked = true;
      void markPurchaseTracked(orderNumber, phoneKey);
    }
    // Pushed (now or earlier) — always drop the plaintext-PII stash.
    try { sessionStorage.removeItem(stashKey); } catch { /* storage blocked */ }
  }, [paymentPaid, paymentFailed, orderNumber, order, meta, phoneKey]);

  useEffect(() => {
    if (!awaitingPayment || pollsExhausted) return;
    const t = setTimeout(() => {
      const refetch = phoneKey
        ? lookupOrder(orderNumber, phoneKey)
        : authed
        ? getMyOrder(orderNumber)
        : null;
      if (!refetch) { setPolls(POLL_DELAYS_MS.length); return; }
      refetch
        .then((res) => setOrder(res))
        .catch(() => { /* transient (or throttled) — the next slot retries */ })
        .finally(() => setPolls((n) => n + 1));
    }, POLL_DELAYS_MS[polls]);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingPayment, pollsExhausted, polls, orderNumber, phoneKey, authed]);

  if (!meta) return <NotFoundPage />;

  // Guest with no phone → render the lookup form (identity verification).
  // A logged-in customer skips this (handled by the authed fetch above).
  // Only once `ready`: before the mount effect has read this browser's stash
  // / token, neither the server nor the hydrating render can know whether to
  // ask for the last-4 — both show the loader below.
  if (ready && !phoneKey && !authed) {
    return (
      <>
        <Header meta={meta} />
        <main className="mx-auto max-w-md px-4 sm:px-6 py-10">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Track order #{orderNumber}</h1>
          <p className="text-sm text-slate-500 mb-6">Enter the last 4 digits of the phone number you used to place the order.</p>
          <OrderLookupForm orderNumber={orderNumber} />
        </main>
        <Footer meta={meta} />
      </>
    );
  }

  if (!ready || loading) {
    return (
      <>
        <Header meta={meta} />
        <main className="mx-auto max-w-md px-4 sm:px-6 py-20 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-400" />
          <p className="mt-4 text-sm text-slate-500">Looking up your order…</p>
        </main>
        <Footer meta={meta} />
      </>
    );
  }

  // Throttled / transient failure — the order likely EXISTS; never show the
  // 404 page. Give the shopper a reassurance line and a manual retry.
  if (loadFailed && !order) {
    return (
      <>
        <Header meta={meta} />
        <main className="mx-auto max-w-md px-4 sm:px-6 py-20 text-center">
          <Loader2 className="mx-auto h-8 w-8 text-slate-400" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">We couldn't load your order right now</h1>
          <p className="mt-2 text-sm text-slate-500">
            The network is busy — your order is safe. Please try again in a moment.
          </p>
          <Button
            variant="brand"
            className="mt-6"
            onClick={() => { setLoadFailed(false); setLoading(true); setRetryTick((t) => t + 1); }}
          >
            Try again
          </Button>
        </main>
        <Footer meta={meta} />
      </>
    );
  }

  if (notFound || !order) {
    return <NotFoundPage />;
  }

  return (
    <>
      <Header meta={meta} />

      <main className="bg-slate-50">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12 space-y-6">
          {/* Banner priority: payment outcome (online orders) → fresh-COD
              success → neutral tracking heading. */}
          {paidThenCanceled ? (
            <div className="flex items-center gap-4 rounded-2xl bg-white ring-1 ring-amber-200 p-5 sm:p-6 shadow-sm">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-400 text-white">
                <X className="h-7 w-7" strokeWidth={3} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Order cancelled — payment received</h1>
                <p className="mt-0.5 text-sm text-slate-500">
                  {order.payment_status === 'refunded'
                    ? 'This order was cancelled and your payment has been refunded.'
                    : 'This order was cancelled after your payment was received. The store will refund you — contact them with your order number if you haven’t heard from them.'}
                </p>
              </div>
            </div>
          ) : paymentFailed ? (
            <div className="flex items-center gap-4 rounded-2xl bg-white ring-1 ring-rose-200 p-5 sm:p-6 shadow-sm">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white">
                <X className="h-7 w-7" strokeWidth={3} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Payment not completed</h1>
                <p className="mt-0.5 text-sm text-slate-500">
                  This order was cancelled and you have not been charged. If money did leave your
                  account, it will be confirmed automatically — or contact the store with your order number.
                </p>
              </div>
            </div>
          ) : paymentPaid ? (
            <div className="flex items-center gap-4 rounded-2xl bg-white ring-1 ring-slate-200 p-5 sm:p-6 shadow-sm">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check className="h-7 w-7" strokeWidth={3} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                  {partlyPaid ? 'Advance payment received' : 'Payment received'}
                </h1>
                <p className="mt-0.5 text-sm text-slate-500">
                  {paymentReceivedLine({
                    partlyPaid,
                    delivered: order.status === 'delivered',
                    paid: paidOnline !== null && paidOnline > 0 ? formatBDT(paidOnline, { currency: order.currency }) : null,
                    due: dueOnDelivery !== null ? formatBDT(dueOnDelivery, { currency: order.currency }) : null,
                    unmatched: paidOnline === 0,
                  })}
                </p>
              </div>
            </div>
          ) : awaitingPayment ? (
            <div className="flex items-center gap-4 rounded-2xl bg-white ring-1 ring-amber-200 p-5 sm:p-6 shadow-sm">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-400 text-white">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Confirming your payment…</h1>
                <p className="mt-0.5 text-sm text-slate-500">
                  {pollsExhausted
                    ? 'This is taking longer than usual. If you completed the payment, this page will update once it’s confirmed — you can also refresh in a few minutes.'
                    : 'This usually takes a few seconds. Keep this page open — it updates automatically.'}
                </p>
              </div>
            </div>
          ) : paymentUnconfirmed ? (
            <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-5 sm:p-6 shadow-sm">
              <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Order #{order.order_number}</h1>
              <p className="mt-1 text-sm text-slate-500">
                Your order is active, but we have not received an online payment for it
                {dueOnDelivery !== null && dueOnDelivery > 0
                  ? ` — ${formatBDT(dueOnDelivery, { currency: order.currency })} is due on delivery.`
                  : '.'}{' '}
                If you did pay online, it will show here once it is confirmed — or contact the store with your order number.
              </p>
            </div>
          ) : placed ? (
            <div className="flex items-center gap-4 rounded-2xl bg-white ring-1 ring-slate-200 p-5 sm:p-6 shadow-sm">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check className="h-7 w-7" strokeWidth={3} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Order placed successfully</h1>
                <p className="mt-0.5 text-sm text-slate-500">Thank you. Your order has been received.</p>
              </div>
            </div>
          ) : (
            <h1 className="text-2xl font-bold text-slate-900">Order #{order.order_number}</h1>
          )}

          {acctNudge && (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              You already have an account —{' '}
              <a href="/login" className="font-semibold text-brand-600 hover:underline">log in</a>{' '}
              to track all your orders in one place.
            </div>
          )}

          <OrderDetail order={order} meta={meta} phoneLast4={phoneKey} />

          {/* After a FAILED payment "Try again" is the primary action and
              "Continue Shopping" steps back to outline. While the order still
              awaits its payment the link is the quiet one, and says who it is
              for: the shopper who paid must not read it as the next step.
              Either way "Back to Cart" goes (a cart checkout's retry link
              already leads back to that cart). */}
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
            {retryOffer && retryHref && (
              <a href={retryHref}>
                {retryOffer === 'failed' ? (
                  <Button variant="brand" className="w-full sm:w-auto">Try again</Button>
                ) : (
                  <Button variant="outline" className="h-auto min-h-10 w-full whitespace-normal sm:w-auto">
                    Didn’t complete the payment? Try again
                  </Button>
                )}
              </a>
            )}
            <a href="/products">
              <Button variant={retryOffer === 'failed' ? 'outline' : 'brand'} className="w-full sm:w-auto">Continue Shopping</Button>
            </a>
            {authed ? (
              <a href="/account">
                <Button variant="outline" className="w-full sm:w-auto">My Orders</Button>
              </a>
            ) : !retryOffer ? (
              <a href="/cart">
                <Button variant="outline" className="w-full sm:w-auto">Back to Cart</Button>
              </a>
            ) : null}
          </div>
        </div>
      </main>

      <Footer meta={meta} />
      <MessengerCTA href={meta.messenger?.url ?? null} whatsapp={meta.whatsapp} />
    </>
  );
}
