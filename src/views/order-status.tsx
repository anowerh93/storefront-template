import { useEffect, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { lookupOrder, getToken, getMyOrder, ApiError, UnauthenticatedError } from '../lib/api';
import { pixel } from '../lib/pixel';
import { useCart } from '../stores/cart';
import { Header } from '../components/layout/header';
import { Footer } from '../components/layout/footer';
import { MessengerCTA } from '../components/layout/messenger-cta';
import { Button } from '../components/ui/button';
import { OrderLookupForm } from '../components/order/order-lookup-form';
import { OrderDetail } from '../components/order/order-detail';
import { NotFoundPage } from './not-found';
import type { OrderResponse, StorefrontMeta } from '../lib/types';

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
  // Gateway return URLs (/order/{n}?payment=…) carry NO phone param — checkout
  // stashed the last-4 in sessionStorage before redirecting to the gateway
  // (same browser comes back; it's a redirect flow). Recover it so the shopper
  // lands straight on their order instead of the lookup form.
  const [phoneKey] = useState<string | undefined>(() => {
    if (phone) return phone;
    if (typeof window === 'undefined') return undefined;
    try {
      return sessionStorage.getItem(`replybd:pay-phone:${orderNumber}`) ?? undefined;
    } catch {
      return undefined;
    }
  });
  // A logged-in customer can view the order WITHOUT a phone (the account
  // session is the identity proof) — resolved on the client below.
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
  const [authed, setAuthed] = useState<boolean>(typeof window !== 'undefined' && Boolean(getToken()));
  const [loading, setLoading] = useState<boolean>(Boolean(phoneKey) || authed);
  const [notFound, setNotFound] = useState<boolean>(false);
  // Lookup refused for a reason OTHER than 404 (throttled, transient 5xx) —
  // rendered as a soft "try again" screen, never as "order not found".
  const [loadFailed, setLoadFailed] = useState<boolean>(false);
  const [retryTick, setRetryTick] = useState(0);
  // How many payment-status refetches we've done for a still-unpaid online
  // order (capped so an abandoned tab doesn't poll forever).
  const [polls, setPolls] = useState(0);
  const clearCart = useCart((s) => s.clear);

  useEffect(() => {
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
  }, [orderNumber, phoneKey, authed, retryTick]);

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
  const awaitingPayment =
    !!order &&
    order.payment_method === 'online' &&
    order.payment_status === 'unpaid' &&
    order.status !== 'canceled';
  const pollsExhausted = polls >= POLL_DELAYS_MS.length;

  // Online-payment outcome, derived from ORDER DATA only (the ?payment= URL
  // hint from the gateway return is untrusted and deliberately ignored — the
  // polled payment_status is the truth).
  const isOnline = order?.payment_method === 'online';
  const moneyCaptured =
    isOnline && (order?.payment_status === 'paid' || order?.payment_status === 'refunded');
  // Cancelled AFTER the money was captured (merchant cancel → manual refund)
  // is a different message than a failed/abandoned payment — telling a
  // charged customer "you have not been charged" is a dispute generator.
  const paidThenCanceled = moneyCaptured && order?.status === 'canceled';
  const paymentPaid = isOnline && order?.payment_status === 'paid' && order?.status !== 'canceled';
  const paymentFailed =
    isOnline && !moneyCaptured && (order?.payment_status === 'failed' || order?.status === 'canceled');

  // The checkout deliberately does NOT clear the cart before the gateway
  // redirect (the cart is the shopper's resume path if they back out). Once
  // the payment is confirmed the sale is done — clear it here, exactly once
  // per order (localStorage flag), so a later revisit of the paid order can't
  // wipe a NEW cart the shopper has since built.
  useEffect(() => {
    if (!paymentPaid) return;
    try {
      const k = `replybd:cart-cleared:${orderNumber}`;
      if (!localStorage.getItem(k)) {
        clearCart();
        localStorage.setItem(k, '1');
      }
    } catch {
      /* storage blocked — worst case the cart badge lingers */
    }
  }, [paymentPaid, orderNumber, clearCart]);

  // ── Purchase pixel for ONLINE orders ──
  // Fired HERE (payment confirmed), never at checkout submit, so abandoned
  // gateway sessions are not counted as sales. Gates besides paymentPaid:
  //  - the checkout's `pay-track` sessionStorage stash must exist — it only
  //    does in the buyer's own tab returning from the gateway, so a revisit
  //    from another browser/device (or a shared order link) pushes nothing;
  //  - a localStorage once-flag stops same-tab refreshes re-pushing.
  // The stash is DELETED after the push (and on a failed payment): it holds
  // plaintext phone/email, sessionStorage survives reopen-closed-tab restore
  // on shared machines, and consuming it also hard-stops any re-push.
  // Meta side: when the stash carries the server CAPI event id the fbq
  // Purchase fires WITH it (Meta collapses the browser+server pair and gains
  // _fbp/_fbc match signal); without the id it stays GA4-only — an unpaired
  // browser fire would double-count against CAPI.
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
      /* storage blocked / corrupt stash → treat as a revisit, push nothing */
    }
    if (!stash) return;
    try {
      const k = `replybd:purchase-pushed:${orderNumber}`;
      if (!localStorage.getItem(k)) {
        // Prefer the checkout's stashed item rows (item_id identity consistent
        // with view_item/add_to_cart/COD purchase); the lookup API returns
        // product NAMES only, so the fallback rows are name-only (GA4 accepts
        // either key).
        const stashedItems = Array.isArray(stash.items) && stash.items.length > 0 ? stash.items : null;
        const items = stashedItems ?? (order.items ?? []).map((i) => ({
          item_name: i.variant ? `${i.product_name} (${i.variant})` : i.product_name,
          price: i.unit_price,
          quantity: i.quantity,
        }));
        pixel.purchase({
          orderNumber,
          value: order.total,
          numItems: items.reduce((n, i) => n + i.quantity, 0),
          currency: order.currency,
          contentIds: (stashedItems ?? []).map((i) => i.item_id).filter((id): id is string => Boolean(id)),
          items,
          ...(stash.metaEventId ? { metaEventId: stash.metaEventId } : { ga4Only: true }),
          customer: {
            name: order.customer_name ?? null,
            phone: stash.phone ?? null,
            email: stash.email ?? null,
            address: order.address ?? null,
            shippingMethod:
              meta?.shipping?.zones?.find((z) => z.code === order.shipping_zone)?.label
                ?? order.shipping_zone
                ?? null,
          },
        });
        localStorage.setItem(k, '1');
      }
    } catch {
      /* localStorage blocked — the stash removal below still stops re-pushes */
    }
    // Consumed (or already pushed) — always drop the plaintext-PII stash.
    try { sessionStorage.removeItem(stashKey); } catch { /* storage blocked */ }
  }, [paymentPaid, paymentFailed, orderNumber, order, meta]);

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
  if (!phoneKey && !authed) {
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

  if (loading) {
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
                <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Payment received</h1>
                <p className="mt-0.5 text-sm text-slate-500">Thank you. Your payment is confirmed and your order is being processed.</p>
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

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
            <a href="/products">
              <Button variant="brand" className="w-full sm:w-auto">Continue Shopping</Button>
            </a>
            {authed ? (
              <a href="/account">
                <Button variant="outline" className="w-full sm:w-auto">My Orders</Button>
              </a>
            ) : (
              <a href="/cart">
                <Button variant="outline" className="w-full sm:w-auto">Back to Cart</Button>
              </a>
            )}
          </div>
        </div>
      </main>

      <Footer meta={meta} />
      <MessengerCTA href={meta.messenger?.url ?? null} />
    </>
  );
}
