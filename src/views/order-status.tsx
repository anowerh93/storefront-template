import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { lookupOrder, getToken, getMyOrder, UnauthenticatedError } from '../lib/api';
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
  // A logged-in customer can view the order WITHOUT a phone (the account
  // session is the identity proof) — resolved on the client below.
  const [authed, setAuthed] = useState<boolean>(typeof window !== 'undefined' && Boolean(getToken()));
  const [loading, setLoading] = useState<boolean>(Boolean(phone) || authed);
  const [notFound, setNotFound] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    // Guest path: look up by phone last-4. Account path: a logged-in customer
    // with no phone param fetches their own order via the bearer-token
    // endpoint. (A phone param always takes precedence — it's the guest
    // success-redirect shape and works even for logged-in customers.)
    if (phone) {
      setLoading(true);
      lookupOrder(orderNumber, phone)
        .then((res) => { if (!cancelled) setOrder(res); })
        .catch(() => { if (!cancelled) setNotFound(true); })
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
  }, [orderNumber, phone, authed]);

  if (!meta) return <NotFoundPage />;

  // Guest with no phone → render the lookup form (identity verification).
  // A logged-in customer skips this (handled by the authed fetch above).
  if (!phone && !authed) {
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

  if (notFound || !order) {
    return <NotFoundPage />;
  }

  return (
    <>
      <Header meta={meta} />

      <main className="bg-slate-50">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12 space-y-6">
          {/* Success banner (fresh order) vs. a neutral heading (tracking). */}
          {placed ? (
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

          {accountExists && (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              You already have an account —{' '}
              <a href="/login" className="font-semibold text-brand-600 hover:underline">log in</a>{' '}
              to track all your orders in one place.
            </div>
          )}

          <OrderDetail order={order} meta={meta} phoneLast4={phone} showTimeline={!placed} />

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
