import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ShoppingCart, Truck, Minus, Plus, UserPlus, Trash2, Loader2, ShoppingBag, CreditCard } from 'lucide-react';
import type { ProductDetail, StorefrontMeta } from '../lib/types';
import { orderIdempotencyKey, submitOrder, setToken } from '../lib/api';
import { useCart, useCartHydrated, lineCeiling, type CartLine } from '../stores/cart';
import { formatBDT } from '../lib/format';
import { mintEventId, pixel } from '../lib/pixel';
import { Header } from '../components/layout/header';
import { Footer } from '../components/layout/footer';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/ui/button';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { FitImage } from '../components/ui/fit-image';

/**
 * Checkout page with TWO entry modes, sharing one Billing form + Order Summary:
 *
 *  - Express "buy now" (/checkout?p=slug&v=variantIndex&q=qty): legacy deep
 *    links only — the PDP "Order Now" button now goes through cart mode so a
 *    stacked cart is never hidden. checkout.astro fetches that one product
 *    server-side and passes it as `product`; the summary is a single,
 *    in-memory line (qty editable locally, not persisted to the cart).
 *  - Cart mode: reached from /cart's "Proceed to Checkout" AND the PDP
 *    "Order Now" (/checkout, no params). `product` is null; the summary is the
 *    persisted cart (qty edits and removals write through to the store). The
 *    cart is cleared on success only — an abandoned checkout keeps it intact.
 *
 * Both submit ONE order with an items[] body — the server prices + re-checks
 * stock per line and applies one order-level shipping fee on the combined
 * subtotal. Guest checkout and the opt-in "Create an account?" both work in
 * either mode.
 */
// shipping_zone is required ONLY when the tenant has shipping enabled with
// zones (i.e. the delivery-area selector is actually on screen). When shipping
// is OFF the selector — and its error message — are hidden, so a hard
// requirement would make the form fail validation on a field the shopper can't
// see or fix, and Place Order would silently do nothing. `requireZone` is
// passed from the component so the rule always matches what's rendered.
function makeCheckoutSchema(requireZone: boolean) {
  return z.object({
    customer_name:    z.string().min(2, 'Please enter your full name'),
    customer_address: z.string().min(10, 'Please enter your full delivery address'),
    customer_phone:   z.string().regex(/^(\+?88)?01[3-9]\d{8}$/, 'Enter a valid Bangladeshi mobile number'),
    // Optional — BD COD is phone-first. When blank we send `undefined` (never
    // ''), so the API's `nullable|email` rule treats it as absent rather than a
    // malformed email that would 422 and silently block Place Order.
    customer_email:   z.string().trim().email('Enter a valid email address').optional().or(z.literal('')),
    shipping_zone:    z.string().optional(),
    notes:            z.string().max(500).optional(),
    // Phase 1 opt-in account creation. Password is only required (min 6) when
    // the "Create an account?" box is ticked — guest checkout is unaffected.
    create_account:   z.boolean().optional(),
    password:         z.string().optional(),
  }).superRefine((val, ctx) => {
    if (requireZone && !(val.shipping_zone && val.shipping_zone.length > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['shipping_zone'],
        message: 'Choose a delivery area',
      });
    }
    if (val.create_account && (val.password ?? '').length < 6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['password'],
        message: 'Minimum 6 characters',
      });
    }
  });
}
type FormData = z.infer<ReturnType<typeof makeCheckoutSchema>>;

export function CheckoutPage({
  product,
  meta,
  variantIndex,
  qty: initialQty,
  expressAttempt = false,
}: {
  product: ProductDetail | null;
  meta: StorefrontMeta | null;
  variantIndex: number | null;
  qty: number;
  /** True when the URL carried ?p= (a "buy now"), even if the product fetch
   *  failed — lets us show "Nothing to check out" instead of silently showing
   *  the persisted cart for an express click. */
  expressAttempt?: boolean;
}) {
  const isExpress = !!product;

  const hydrated = useCartHydrated();
  const cartItems = useCart((s) => s.items);
  const setCartQty = useCart((s) => s.setQty);
  const removeCartLine = useCart((s) => s.removeFromCart);
  const clearCart = useCart((s) => s.clear);

  const [expressQty, setExpressQty] = useState(Math.max(1, initialQty || 1));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Synchronous re-entrancy guard: `disabled={submitting}` alone can't stop a
  // rapid double-tap — react-hook-form's async zod validation resolves in a
  // microtask, so two taps both reach onSubmit before setSubmitting(true)
  // re-renders the button. A ref is checked/set synchronously at entry.
  const inflight = useRef(false);
  // Mount part of the Idempotency-Key (see orderIdempotencyKey): the two
  // racing submits above (and a bfcache resubmit of the unchanged cart)
  // then collapse to the SAME order server-side — one order, one Purchase.
  const idemKey = useRef(mintEventId());
  const [createAccount, setCreateAccount] = useState(false);
  // Online payment is offered only when the tenant has a connected gateway
  // (meta advertises it). The shopper never picks WHICH gateway — the server
  // routes to the store's own connected account (SSLCommerz / EPS / aamarPay).
  const canPayOnline = !!meta?.payment_methods?.includes('online');
  const [payMethod, setPayMethod] = useState<'cod' | 'online'>('cod');

  // Coming BACK from the gateway (shopper changed their mind, wants COD, or
  // the gateway page stalled) restores this page from bfcache with its React
  // state intact — including submitting=true from the redirect, which would
  // leave the button permanently stuck on "Starting payment…". Reset it.
  // Resubmitting is safe: the 90s dedup window replays the SAME order and
  // renews the SAME gateway session (order-stable transaction id), never a
  // second payable one.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        inflight.current = false;
        setSubmitting(false);
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const zones = meta?.shipping?.zones ?? [];
  // Only require a delivery zone when the selector is actually shown (shipping
  // enabled + zones exist) — otherwise an empty hidden field blocks submit.
  const requireZone = !!(meta?.shipping?.enabled && zones.length > 0);
  const schema = useMemo(() => makeCheckoutSchema(requireZone), [requireZone]);
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { shipping_zone: zones[0]?.code ?? '', create_account: false },
  });

  // Express mode → one in-memory line derived from the product/variant/qty.
  const expressLine = useMemo<CartLine | null>(() => {
    if (!product) return null;
    // Resolve by the variant's stable `.index` (what the PDP puts in ?v=), NOT
    // by array position — they differ for a non-sequential variants array.
    const variant =
      (variantIndex != null ? product.variants.find((v) => v.index === variantIndex) : null) ??
      product.variants[0] ??
      null;
    return {
      product_id:    product.id,
      slug:          product.slug,
      name:          product.name,
      image_url:     product.gallery_urls?.[0] ?? product.image_url ?? null,
      variant_index: variant ? variant.index : null,
      variant_label: variant ? variant.label : null,
      unit_price:    variant?.price ?? product.price,
      quantity:      expressQty,
      max_stock:     variant ? variant.stock : null,
      currency:      product.currency,
    };
  }, [product, variantIndex, expressQty]);

  const lines: CartLine[] = isExpress ? (expressLine ? [expressLine] : []) : cartItems;

  // GA4 begin_checkout / Meta InitiateCheckout — once per checkout ENTRY (the
  // standard funnel step), not per Place-Order click. MUST sit above every
  // early return below: cart-mode's "!hydrated" loading return otherwise
  // changes the hook count between renders and React unmounts the island —
  // this exact mistake shipped a blank live /checkout page (July 2026).
  // Values are computed inside the effect because subtotal/currency are only
  // derived after the early returns.
  const beganCheckout = useRef(false);
  const sentCheckoutSteps = useRef(false);
  useEffect(() => {
    if (beganCheckout.current || lines.length === 0) return;
    if (!isExpress && !hydrated) return; // wait for the real cart, not the SSR-empty one
    beganCheckout.current = true;
    pixel.initiateCheckout({
      value: lines.reduce((n, l) => n + l.unit_price * l.quantity, 0),
      numItems: lines.reduce((n, l) => n + l.quantity, 0),
      currency: meta?.currency,
      items: lines.map((l) => ({
        item_id: l.product_id.toString(),
        item_name: l.name,
        price: l.unit_price,
        quantity: l.quantity,
      })),
    });
  }, [hydrated, lines.length]);

  // ── Empty / loading states ──
  // An express attempt whose product failed to load shows "Nothing to check
  // out" — NOT cart mode (which would surface the shopper's persisted cart for
  // a buy-now click).
  if (!meta || (expressAttempt && !product)) {
    return (
      <>
        {meta && <Header meta={meta} />}
        <main className="mx-auto max-w-xl px-4 py-24 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Nothing to check out</h1>
          <p className="mt-2 text-slate-600">We couldn't find that product. It may have been removed.</p>
          <a href="/products" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700">
            Browse products
          </a>
        </main>
        {meta && <Footer meta={meta} />}
      </>
    );
  }

  if (!isExpress && !hydrated) {
    return (
      <>
        <Header meta={meta} />
        <main className="mx-auto max-w-5xl px-4 py-24 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-400" />
          <p className="mt-4 text-sm text-slate-500">Loading your cart…</p>
        </main>
        <Footer meta={meta} />
      </>
    );
  }

  if (!isExpress && lines.length === 0) {
    return (
      <>
        <Header meta={meta} />
        <main className="mx-auto max-w-xl px-4 py-24 text-center">
          <ShoppingBag className="mx-auto h-10 w-10 text-slate-300" />
          <h1 className="mt-3 text-2xl font-bold text-slate-900">Your cart is empty</h1>
          <p className="mt-2 text-slate-600">Add a product before checking out.</p>
          <a href="/products" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700">
            Browse products
          </a>
        </main>
        <Footer meta={meta} />
      </>
    );
  }

  const currency = meta.currency;
  const selectedZone = form.watch('shipping_zone');
  const zone = zones.find((z) => z.code === selectedZone);
  const subtotal = lines.reduce((n, l) => n + l.unit_price * l.quantity, 0);
  const threshold = meta.shipping?.free_shipping_threshold ?? null;
  const shippingFee = !meta.shipping?.enabled
    ? 0
    : threshold && subtotal >= threshold
    ? 0
    : zone?.fee ?? 0;
  const total = subtotal + shippingFee;
  const numItems = lines.reduce((n, l) => n + l.quantity, 0);

  // Express mode edits a local qty; cart mode writes through to the store.
  function changeQty(line: CartLine, next: number) {
    const clamped = Math.min(Math.max(1, next), lineCeiling(line.max_stock));
    if (isExpress) setExpressQty(clamped);
    else setCartQty(line.product_id, line.variant_index, clamped);
  }

  async function onSubmit(values: FormData) {
    if (lines.length === 0) return;
    if (inflight.current) return;
    inflight.current = true;
    setSubmitting(true);
    setError(null);
    // GA4 items for the dataLayer half of the tracking calls (GTM tenants).
    const ga4Items = lines.map((l) => ({
      item_id: l.product_id.toString(),
      item_name: l.name,
      price: l.unit_price,
      quantity: l.quantity,
    }));
    // GA4 checkout-step events at submit (validation passed = the shopper
    // committed to these choices). Once per visit — a failed submit's retry
    // must not re-push them.
    if (!sentCheckoutSteps.current) {
      sentCheckoutSteps.current = true;
      if (requireZone && zone) {
        pixel.addShippingInfo({ value: total, currency, shippingTier: zone.label, items: ga4Items });
      }
      pixel.addPaymentInfo({ value: total, currency, paymentType: canPayOnline && payMethod === 'online' ? 'online' : 'cod', items: ga4Items });
    }
    try {
      const order = await submitOrder({
        customer_name:  values.customer_name,
        customer_phone: values.customer_phone,
        customer_email: values.customer_email || undefined,
        address:        values.customer_address,
        shipping_zone:  values.shipping_zone || undefined,
        notes:          values.notes,
        items: lines.map((l) => ({
          product_id:    l.product_id,
          variant_index: l.variant_index,
          quantity:      l.quantity,
        })),
        funnel_url:     typeof window !== 'undefined' ? window.location.href : undefined,
        // Only sent when the box is ticked → guest checkout is unchanged otherwise.
        ...(values.create_account ? { create_account: true, password: values.password } : {}),
        // Only sent when the tenant offers it AND the shopper picked it —
        // otherwise the server defaults to COD (legacy behavior unchanged).
        ...(canPayOnline && payMethod === 'online' ? { payment_method: 'online' as const } : {}),
      }, orderIdempotencyKey(idemKey.current, {
        customer_phone: values.customer_phone,
        items: lines.map((l) => ({ product_id: l.product_id, variant_index: l.variant_index, quantity: l.quantity })),
      }));
      // Account provisioned alongside the order → auto-login by storing the
      // token. If the phone already had an account (account_exists), no token
      // comes back — pass a flag so the success page nudges them to log in.
      if (order.customer?.token) {
        setToken(order.customer.token);
      }
      const last4 = values.customer_phone.slice(-4);
      const wasOnline = canPayOnline && payMethod === 'online';

      // ── Online payment: hand the browser to the gateway ──
      // The order is parked awaiting payment; the gateway page collects
      // bKash/Nagad/card and bounces back to /order/{number}?payment=…. The
      // return URL carries NO phone param, so stash the last-4 (and the
      // account-exists nudge) for the order page (same browser comes back —
      // it's a redirect flow). The CART IS NOT CLEARED here: it's the resume
      // mechanism if the shopper backs out of the gateway — resubmitting
      // replays the same order + same gateway session (no double charge). The
      // order page clears it once the payment is confirmed.
      // No client-side Purchase pixel here: the order isn't paid yet — firing
      // now would count abandoned payment attempts as sales. On confirmation
      // the server fires CAPI Purchase (Meta) and the order page fires the
      // GA4 purchase push (reading the pay-track stash set below).
      if (order.payment?.redirect_url) {
        try {
          sessionStorage.setItem(`replybd:pay-phone:${order.order_number}`, last4);
          if (order.account_exists && !order.customer?.token) {
            sessionStorage.setItem(`replybd:pay-acct:${order.order_number}`, '1');
          }
          // Everything the order page's purchase pixel needs once the payment
          // is CONFIRMED (see the note above): phone/email (the lookup API
          // never echoes them), the GA4 item rows (the lookup API returns
          // names only — stashing keeps item_id identity consistent with every
          // other event), and the server CAPI event id (lets the order page
          // fire a dedup-PAIRED browser fbq Purchase instead of skipping Meta).
          // Its presence also marks this tab as the buyer's own gateway
          // round-trip; the order page deletes it after the one-shot push.
          // Written LAST in this block: it's the only new throw point, and the
          // older pay-phone/pay-acct stashes must not be lost to it.
          sessionStorage.setItem(
            `replybd:pay-track:${order.order_number}`,
            JSON.stringify({
              phone: values.customer_phone,
              email: values.customer_email || undefined,
              items: ga4Items,
              metaEventId: order.meta_event_id ?? undefined,
            }),
          );
        } catch {
          /* storage blocked — the order page falls back to its lookup form */
        }
        window.location.href = order.payment.redirect_url;
        return;
      }

      // Online requested but NO payment link came back. Two shapes, neither
      // of which may fall into the COD success path:
      //  - a 90s-dedup replay of an order still awaiting payment whose
      //    gateway re-init failed (the server falls through without a link)
      //    → surface an error so the shopper can retry, don't fake success;
      //  - a replay of an order that already resolved (paid / cancelled)
      //    → send them to the order page, whose banners show the REAL payment
      //    outcome. Never placed=1, and never the client Purchase pixel — the
      //    server CAPI reports online purchases on confirm; firing here would
      //    double-count a paid order or invent a purchase for an unpaid one.
      if (wasOnline) {
        if (order.status === 'awaiting_payment') {
          setError('We could not start the online payment. Please try again, or choose Cash on Delivery.');
          inflight.current = false;
          setSubmitting(false);
          return;
        }
        try {
          sessionStorage.setItem(`replybd:pay-phone:${order.order_number}`, last4);
        } catch { /* falls back to the lookup form */ }
        if (!isExpress) clearCart();
        window.location.href = `/order/${order.order_number}?phone=${last4}`;
        return;
      }

      const acctFlag = order.account_exists && !order.customer?.token ? '&account_exists=1' : '';
      const dest = `/order/${order.order_number}?placed=1&phone=${last4}${acctFlag}`;
      // duplicate:true = the 90s-dedup window (or the Idempotency-Key)
      // replayed an EXISTING order (bfcache back + resubmit, double-tap) —
      // firing purchase again would double-count.
      if (order.duplicate) {
        if (!isExpress) clearCart();
        window.location.href = dest;
        return;
      }
      pixel.purchase({
        orderNumber: order.order_number,
        value: order.total,
        numItems,
        currency: order.currency,
        contentIds: lines.map((l) => l.product_id.toString()),
        items: ga4Items,
        metaEventId: order.meta_event_id ?? null,
        // Customer block for GTM (form state is still in scope here) — the
        // marketer maps customer.first_name/…/shipping_method on this event.
        customer: {
          name: values.customer_name,
          phone: values.customer_phone,
          email: values.customer_email || null,
          address: values.customer_address,
          shippingMethod: zone?.label ?? null,
        },
        // Deferred redirect: dataLayer.push only ENQUEUES — GTM tags fire
        // async, and non-beacon transports (custom-HTML Meta tags, older GA)
        // are cancelled by an immediate navigation, zero-firing the purchase
        // on exactly the slow Android WebViews our ad traffic lives in.
        // onFlushed runs after the container processed the message (or a
        // ≤700ms cap) — imperceptible, and tracking can never hold the
        // shopper hostage.
        onFlushed: () => { window.location.href = dest; },
      });
      // Cart-mode order succeeded → empty the cart so the badge clears
      // (synchronous — runs before the deferred navigation fires).
      if (!isExpress) clearCart();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong. Please try again.';
      // 422 password_required (create_account set without a password) — the
      // client-side zod check normally prevents this, but surface it on the
      // password field as a belt-and-suspenders if the server rejects.
      if (values.create_account && /password/i.test(msg)) {
        form.setError('password', { type: 'server', message: 'Minimum 6 characters' });
      } else {
        setError(msg);
      }
      inflight.current = false;
      setSubmitting(false);
    }
  }

  // Safety net: react-hook-form silently no-ops the submit when validation
  // fails. If the failing field isn't on screen (e.g. a hidden shipping_zone),
  // its inline message never renders and "Place Order" looks dead with no
  // feedback. Surface a top-level message naming the offending field(s) so the
  // shopper is never stuck guessing — guards the whole hidden-required-field
  // bug class, not just shipping_zone.
  function onInvalid(errors: FieldErrors<FormData>) {
    const labels: Record<string, string> = {
      customer_name:    'full name',
      customer_address: 'delivery address',
      customer_phone:   'phone number',
      customer_email:   'email address',
      shipping_zone:    'delivery area',
      password:         'password',
      notes:            'order notes',
    };
    const names = Object.keys(errors).map((k) => labels[k] ?? k);
    setError(
      names.length
        ? `Please check your ${names.join(', ')} before placing the order.`
        : 'Please check your details before placing the order.',
    );
  }

  return (
    <>
      <Header meta={meta} />
      <main className="bg-slate-50 py-8">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          {/* Secure Checkout banner */}
          <div className="mb-6 flex items-center gap-3 rounded-2xl bg-indigo-700 px-6 py-4 text-white shadow-sm">
            <ShoppingCart className="h-5 w-5" />
            <span className="text-lg font-bold">Secure Checkout</span>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
            {/* ── LEFT: Billing details ── */}
            <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-6">
              <h2 className="border-b border-slate-100 pb-3 text-lg font-bold text-slate-900">Billing Details</h2>

              {error && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
              )}

              <div className="mt-4 space-y-4">
                <div>
                  <Label htmlFor="co-name">Full Name <span className="text-rose-500">*</span></Label>
                  <Input id="co-name" placeholder="Enter your full name" {...form.register('customer_name')} className="mt-1.5" />
                  {form.formState.errors.customer_name && <p className="mt-1 text-xs text-rose-600">{form.formState.errors.customer_name.message}</p>}
                </div>
                <div>
                  <Label htmlFor="co-address">Address <span className="text-rose-500">*</span></Label>
                  <Textarea id="co-address" placeholder="House/road, area, district…" {...form.register('customer_address')} className="mt-1.5" />
                  {form.formState.errors.customer_address && <p className="mt-1 text-xs text-rose-600">{form.formState.errors.customer_address.message}</p>}
                </div>
                <div>
                  <Label htmlFor="co-phone">Phone <span className="text-rose-500">*</span></Label>
                  <Input id="co-phone" placeholder="01XXXXXXXXX" inputMode="tel" {...form.register('customer_phone')} className="mt-1.5" />
                  {form.formState.errors.customer_phone && <p className="mt-1 text-xs text-rose-600">{form.formState.errors.customer_phone.message}</p>}
                </div>
                <div>
                  <Label htmlFor="co-email">Email <span className="font-normal text-slate-400">(optional)</span></Label>
                  <Input id="co-email" type="email" placeholder="you@example.com" inputMode="email" autoComplete="email" {...form.register('customer_email')} className="mt-1.5" />
                  {form.formState.errors.customer_email && <p className="mt-1 text-xs text-rose-600">{form.formState.errors.customer_email.message}</p>}
                </div>
                <div>
                  <Label htmlFor="co-notes">Order Notes <span className="font-normal text-slate-400">(optional)</span></Label>
                  <Textarea id="co-notes" placeholder="Special notes for delivery, etc." {...form.register('notes')} className="mt-1.5" />
                </div>

                {/* ── Opt-in account creation ── */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <label htmlFor="co-create-account" className="flex cursor-pointer items-start gap-3">
                    <input
                      id="co-create-account"
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      {...form.register('create_account', {
                        onChange: (e) => {
                          setCreateAccount(e.target.checked);
                          if (!e.target.checked) form.clearErrors('password');
                        },
                      })}
                    />
                    <span>
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                        <UserPlus className="h-4 w-4 text-brand-600" /> Create an account?
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        Track all your orders in one place — no need to enter your phone next time.
                      </span>
                    </span>
                  </label>

                  {createAccount && (
                    <div className="mt-3">
                      <Label htmlFor="co-password">Password <span className="text-rose-500">*</span></Label>
                      <Input
                        id="co-password"
                        type="password"
                        placeholder="Minimum 6 characters"
                        autoComplete="new-password"
                        {...form.register('password')}
                        className="mt-1.5"
                      />
                      {form.formState.errors.password && <p className="mt-1 text-xs text-rose-600">{form.formState.errors.password.message}</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── RIGHT: Order summary + COD + Place Order ── */}
            <div className="space-y-6 lg:sticky lg:top-6">
              <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-6">
                <h2 className="border-b border-slate-100 pb-3 text-lg font-bold text-slate-900">Order Summary</h2>

                {/* Product lines */}
                <ul className="divide-y divide-slate-100">
                  {lines.map((l) => (
                    <li key={`${l.product_id}:${l.variant_index ?? '-'}`} className="flex items-start gap-3 py-4">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
                        {/* sizes: fixed 64px thumb — see cart.tsx. */}
                        {l.image_url && <FitImage src={l.image_url} alt={l.name} sizes="64px" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 line-clamp-2">{l.name}</p>
                        {l.variant_label && <p className="text-xs text-slate-500">{l.variant_label}</p>}
                        <p className="mt-0.5 text-sm font-semibold text-rose-600">{formatBDT(l.unit_price, { currency })}</p>
                        {!isExpress && (
                          <button
                            type="button"
                            onClick={() => removeCartLine(l.product_id, l.variant_index)}
                            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="h-3 w-3" /> Remove
                          </button>
                        )}
                      </div>
                      {/* qty stepper */}
                      <div className="flex items-center overflow-hidden rounded-lg border border-slate-300">
                        <button type="button" onClick={() => changeQty(l, l.quantity - 1)} disabled={l.quantity <= 1} aria-label="Decrease quantity" className="px-2 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Minus className="h-3.5 w-3.5" /></button>
                        <span className="w-8 text-center text-sm font-semibold tabular-nums">{l.quantity}</span>
                        <button type="button" onClick={() => changeQty(l, l.quantity + 1)} disabled={l.quantity >= lineCeiling(l.max_stock)} aria-label="Increase quantity" className="px-2 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Shipping method */}
                {meta.shipping?.enabled && zones.length > 0 && (
                  <div className="border-t border-slate-100 pt-4">
                    <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <Truck className="h-4 w-4" /> Shipping Method
                    </p>
                    <RadioGroup value={selectedZone} onValueChange={(v) => form.setValue('shipping_zone', v)} className="grid grid-cols-2 gap-2">
                      {zones.map((z) => (
                        <label key={z.code} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 cursor-pointer transition ${selectedZone === z.code ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'}`}>
                          <RadioGroupItem value={z.code} />
                          <span className="text-sm font-medium text-slate-900">{z.label}</span>
                        </label>
                      ))}
                    </RadioGroup>
                    {form.formState.errors.shipping_zone && <p className="mt-1 text-xs text-rose-600">{form.formState.errors.shipping_zone.message}</p>}
                  </div>
                )}

                {/* Totals */}
                <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-4 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal <span className="text-slate-400">({numItems} item{numItems === 1 ? '' : 's'})</span></span>
                    <span>{formatBDT(subtotal, { currency })}</span>
                  </div>
                  {meta.shipping?.enabled && (
                    <div className="flex justify-between text-slate-600">
                      <span>Shipping</span>
                      <span>{shippingFee === 0 ? <span className="font-semibold text-brand-600">Free</span> : formatBDT(shippingFee, { currency })}</span>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between border-t border-slate-100 pt-2">
                    <span className="font-bold text-slate-900">Total</span>
                    <span className="text-xl font-bold text-rose-600">{formatBDT(total, { currency })}</span>
                  </div>
                </div>
              </div>

              {/* Payment method + Place Order */}
              <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-6">
                {canPayOnline ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Method</p>
                    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${payMethod === 'cod' ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <input
                        type="radio"
                        name="payment_method"
                        value="cod"
                        checked={payMethod === 'cod'}
                        onChange={() => setPayMethod('cod')}
                        className="mt-1 h-4 w-4 shrink-0 border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="flex items-start gap-3">
                        <Truck className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
                        <span>
                          <span className="block text-sm font-semibold text-slate-900">Cash on Delivery</span>
                          <span className="block text-xs text-slate-500">Pay when your order arrives. No upfront payment needed.</span>
                        </span>
                      </span>
                    </label>
                    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${payMethod === 'online' ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <input
                        type="radio"
                        name="payment_method"
                        value="online"
                        checked={payMethod === 'online'}
                        onChange={() => setPayMethod('online')}
                        className="mt-1 h-4 w-4 shrink-0 border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="flex items-start gap-3">
                        <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
                        <span>
                          <span className="block text-sm font-semibold text-slate-900">Pay Online</span>
                          <span className="block text-xs text-slate-500">bKash, Nagad, Rocket or card — you'll be taken to a secure payment page.</span>
                        </span>
                      </span>
                    </label>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
                    <Truck className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
                    <div>
                      <p className="text-sm font-semibold text-brand-900">Cash on Delivery</p>
                      <p className="text-xs text-brand-700">Pay when your order arrives. No upfront payment needed.</p>
                    </div>
                  </div>
                )}

                <p className="mt-4 text-xs text-slate-500">
                  Your details are used only to process and deliver this order.
                </p>

                <Button type="submit" variant="brand" size="lg" className="mt-4 w-full shadow-md" disabled={submitting || lines.length === 0}>
                  {canPayOnline && payMethod === 'online' ? <CreditCard className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
                  {submitting
                    ? (canPayOnline && payMethod === 'online' ? 'Starting payment…' : 'Placing order…')
                    : (canPayOnline && payMethod === 'online'
                        ? `Pay Now — ${formatBDT(total, { currency })}`
                        : `Place Order — ${formatBDT(total, { currency })}`)}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </main>
      <Footer meta={meta} />
    </>
  );
}
