import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ShoppingCart, Truck, Minus, Plus, UserPlus } from 'lucide-react';
import type { ProductDetail, StorefrontMeta } from '../lib/types';
import { submitOrder, setToken } from '../lib/api';
import { formatBDT } from '../lib/format';
import { pixel } from '../lib/pixel';
import { Header } from '../components/layout/header';
import { Footer } from '../components/layout/footer';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/ui/button';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { FitImage } from '../components/ui/fit-image';

/**
 * Dedicated checkout page reached from the PDP "Order Now" button
 * (/checkout?p=slug&v=variantIndex&q=qty). Two-column "Secure Checkout"
 * layout — Billing Details on the left, Order Summary + COD + Place Order
 * on the right. Reuses the SAME zod schema + submitOrder + shipping-zone
 * logic as the inline OrderNowForm so order placement behaves identically.
 */
const schema = z.object({
  customer_name:    z.string().min(2, 'Please enter your full name'),
  customer_address: z.string().min(10, 'Please enter your full delivery address'),
  customer_phone:   z.string().regex(/^(\+?88)?01[3-9]\d{8}$/, 'Enter a valid Bangladeshi mobile number'),
  shipping_zone:    z.string().min(1, 'Choose a delivery area'),
  notes:            z.string().max(500).optional(),
  // Phase 1 opt-in account creation. Password is only required (min 6) when
  // the "Create an account?" box is ticked — guest checkout is unaffected.
  create_account:   z.boolean().optional(),
  password:         z.string().optional(),
}).superRefine((val, ctx) => {
  if (val.create_account && (val.password ?? '').length < 6) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['password'],
      message: 'Minimum 6 characters',
    });
  }
});
type FormData = z.infer<typeof schema>;

export function CheckoutPage({
  product,
  meta,
  variantIndex,
  qty: initialQty,
}: {
  product: ProductDetail | null;
  meta: StorefrontMeta | null;
  variantIndex: number | null;
  qty: number;
}) {
  const [qty, setQty] = useState(Math.max(1, initialQty || 1));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Phase 1: opt-in account creation at checkout.
  const [createAccount, setCreateAccount] = useState(false);

  const zones = meta?.shipping?.zones ?? [];
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { shipping_zone: zones[0]?.code ?? '', create_account: false },
  });

  // Empty / not-found state.
  if (!meta || !product) {
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

  const variant = (variantIndex != null ? product.variants[variantIndex] : null) ?? product.variants[0] ?? null;
  const unitPrice = variant?.price ?? product.price;
  const inStock = variant ? variant.in_stock : product.in_stock;

  const selectedZone = form.watch('shipping_zone');
  const zone = zones.find((z) => z.code === selectedZone);
  const subtotal = unitPrice * qty;
  const threshold = meta.shipping?.free_shipping_threshold ?? null;
  const shippingFee = !meta.shipping?.enabled
    ? 0
    : threshold && subtotal >= threshold
    ? 0
    : zone?.fee ?? 0;
  const total = subtotal + shippingFee;
  const image = product.gallery_urls?.[0] ?? product.image_url;

  async function onSubmit(values: FormData) {
    if (!product) return;
    setSubmitting(true);
    setError(null);
    try {
      pixel.initiateCheckout({ value: subtotal, numItems: qty });
      const order = await submitOrder({
        customer_name:  values.customer_name,
        customer_phone: values.customer_phone,
        address:        values.customer_address,
        shipping_zone:  values.shipping_zone || undefined,
        notes:          values.notes,
        product_id:     product.id,
        variant_index:  variant ? variant.index : null,
        quantity:       qty,
        funnel_url:     typeof window !== 'undefined' ? window.location.href : undefined,
        // Only sent when the box is ticked → guest checkout is byte-for-byte
        // unchanged when it isn't.
        ...(values.create_account ? { create_account: true, password: values.password } : {}),
      });
      pixel.purchase({
        orderNumber: order.order_number,
        value: order.total,
        numItems: qty,
        contentIds: [product.id.toString()],
      });
      // Account provisioned alongside the order → auto-login by storing the
      // token, so the customer can reach /account straight away. If the phone
      // already had an account (account_exists), no token comes back — we pass
      // a flag to the success page so it can nudge them to log in.
      if (order.customer?.token) {
        setToken(order.customer.token);
      }
      const acctFlag = order.account_exists && !order.customer?.token ? '&account_exists=1' : '';
      window.location.href = `/order/${order.order_number}?placed=1&phone=${values.customer_phone.slice(-4)}${acctFlag}`;
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
      setSubmitting(false);
    }
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

          <form onSubmit={form.handleSubmit(onSubmit)} className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
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

                {/* Product line */}
                <div className="flex items-start gap-3 py-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
                    {image && <FitImage src={image} alt={product.name} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 line-clamp-2">{product.name}</p>
                    {variant && <p className="text-xs text-slate-500">{variant.label}</p>}
                    <p className="mt-0.5 text-sm font-semibold text-rose-600">{formatBDT(unitPrice, { currency: meta.currency })}</p>
                  </div>
                  {/* qty stepper */}
                  <div className="flex items-center overflow-hidden rounded-lg border border-slate-300">
                    <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1} aria-label="Decrease quantity" className="px-2 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Minus className="h-3.5 w-3.5" /></button>
                    <span className="w-8 text-center text-sm font-semibold tabular-nums">{qty}</span>
                    <button type="button" onClick={() => setQty(qty + 1)} aria-label="Increase quantity" className="px-2 py-1.5 text-slate-600 hover:bg-slate-50"><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                </div>

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
                    <span>Subtotal</span>
                    <span>{formatBDT(subtotal, { currency: meta.currency })}</span>
                  </div>
                  {meta.shipping?.enabled && (
                    <div className="flex justify-between text-slate-600">
                      <span>Shipping</span>
                      <span>{shippingFee === 0 ? <span className="font-semibold text-brand-600">Free</span> : formatBDT(shippingFee, { currency: meta.currency })}</span>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between border-t border-slate-100 pt-2">
                    <span className="font-bold text-slate-900">Total</span>
                    <span className="text-xl font-bold text-rose-600">{formatBDT(total, { currency: meta.currency })}</span>
                  </div>
                </div>
              </div>

              {/* COD + Place Order */}
              <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-6">
                <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
                  <Truck className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
                  <div>
                    <p className="text-sm font-semibold text-brand-900">Cash on Delivery</p>
                    <p className="text-xs text-brand-700">Pay when your order arrives. No upfront payment needed.</p>
                  </div>
                </div>

                <p className="mt-4 text-xs text-slate-500">
                  Your details are used only to process and deliver this order.
                </p>

                <Button type="submit" variant="brand" size="lg" className="mt-4 w-full shadow-md" disabled={!inStock || submitting}>
                  <ShoppingCart className="h-4 w-4" />
                  {submitting ? 'Placing order…' : !inStock ? 'Out of stock' : `Place Order — ${formatBDT(total, { currency: meta.currency })}`}
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
