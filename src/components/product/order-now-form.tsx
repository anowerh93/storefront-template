import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Minus, Plus, ShoppingBag, Truck } from 'lucide-react';
import type { ProductDetail, ProductVariant, StorefrontMeta } from '../../lib/types';
import { submitOrder } from '../../lib/api';
import { formatBDT } from '../../lib/format';
import { pixel } from '../../lib/pixel';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Separator } from '../ui/separator';

/**
 * Inline "Order Now" form on the PDP. Replaces the legacy cart → checkout
 * flow: customer picks variant + qty + fills name/phone/address/zone,
 * submits directly to POST /orders, redirects to the order status page.
 *
 * No cart, no /checkout page. One product per order, one click to order.
 */
const schema = z.object({
  customer_name:    z.string().min(2, 'Please enter your name'),
  customer_phone:   z.string().regex(/^(\+?88)?01[3-9]\d{8}$/, 'Enter a valid Bangladeshi mobile number'),
  customer_address: z.string().min(10, 'Please enter your full delivery address'),
  shipping_zone:    z.string().min(1, 'Choose a delivery zone'),
  notes:            z.string().max(500).optional(),
});
type FormData = z.infer<typeof schema>;

export function OrderNowForm({
  product,
  meta,
}: {
  product: ProductDetail;
  meta: StorefrontMeta;
}) {
  const [variant, setVariant] = useState<ProductVariant | null>(product.variants[0] ?? null);
  const [qty, setQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zones = meta.shipping?.zones ?? [];
  const defaultZone = zones[0]?.code ?? '';
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { shipping_zone: defaultZone },
  });

  const unitPrice = variant?.price ?? product.price;
  const inStock   = variant ? variant.in_stock : product.in_stock;

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

  async function onSubmit(values: FormData) {
    setSubmitting(true);
    setError(null);
    try {
      pixel.initiateCheckout({ value: subtotal, numItems: qty });

      // The API expects `variant_index` (position in the variants array),
      // which each variant carries directly as `index`.
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
      });

      pixel.purchase({
        orderNumber: order.order_number,
        value: order.total,
        numItems: qty,
        contentIds: [product.id.toString()],
      });

      // Full navigation — the /order/{number} route is SSR'd on Cloudflare
      // Workers (prerender:false) so it sees the fresh order immediately.
      window.location.href = `/order/${order.order_number}?placed=1&phone=${values.customer_phone.slice(-4)}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      {/* ── Variant + quantity row (always visible at top of form) ── */}
      {product.variants.length > 0 && (
        <div className="space-y-2">
          <Label>Choose option</Label>
          <RadioGroup
            value={variant?.index.toString()}
            onValueChange={(v) => setVariant(product.variants.find((x) => x.index.toString() === v) ?? null)}
            className="grid grid-cols-2 sm:grid-cols-3 gap-2"
          >
            {product.variants.map((v) => (
              <label
                key={v.index}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition
                  ${variant?.index === v.index ? 'border-brand-500 bg-brand-50' : 'border-slate-300 hover:border-slate-400'}
                  ${!v.in_stock ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <RadioGroupItem value={v.index.toString()} disabled={!v.in_stock} />
                <span className="text-sm font-medium text-slate-900">{v.label}</span>
              </label>
            ))}
          </RadioGroup>
        </div>
      )}

      <div className="space-y-2">
        <Label>Quantity</Label>
        <div className="flex w-fit items-stretch overflow-hidden rounded-xl border border-slate-300 bg-white">
          <button
            type="button"
            onClick={() => setQty(Math.max(1, qty - 1))}
            disabled={qty <= 1}
            aria-label="Decrease quantity"
            className="flex items-center justify-center px-4 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="flex w-14 items-center justify-center border-x border-slate-300 py-2.5 text-sm font-bold tabular-nums text-slate-900">
            {qty}
          </span>
          <button
            type="button"
            onClick={() => setQty(qty + 1)}
            aria-label="Increase quantity"
            className="flex items-center justify-center px-4 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Customer details ── */}
      <Separator />

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div>
        <Label htmlFor="order-name">Your name</Label>
        <Input id="order-name" {...form.register('customer_name')} className="mt-1.5" />
        {form.formState.errors.customer_name && (
          <p className="text-xs text-rose-600 mt-1">{form.formState.errors.customer_name.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="order-phone">Mobile number</Label>
        <Input id="order-phone" placeholder="01XXXXXXXXX" inputMode="tel" {...form.register('customer_phone')} className="mt-1.5" />
        {form.formState.errors.customer_phone && (
          <p className="text-xs text-rose-600 mt-1">{form.formState.errors.customer_phone.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="order-address">Full delivery address</Label>
        <Textarea id="order-address" placeholder="House/road, area, district…" {...form.register('customer_address')} className="mt-1.5" />
        {form.formState.errors.customer_address && (
          <p className="text-xs text-rose-600 mt-1">{form.formState.errors.customer_address.message}</p>
        )}
      </div>

      {/* ── Delivery zone ── */}
      {meta.shipping?.enabled && zones.length > 0 && (
        <div className="space-y-2">
          <Label>Delivery zone</Label>
          <RadioGroup
            value={selectedZone}
            onValueChange={(v) => form.setValue('shipping_zone', v)}
            className="space-y-2"
          >
            {zones.map((z) => (
              <label
                key={z.code}
                className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border cursor-pointer transition
                  ${selectedZone === z.code ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value={z.code} />
                  <span className="text-sm font-medium text-slate-900">{z.label}</span>
                </div>
                <span className="text-sm font-semibold text-slate-900">
                  {z.fee === 0 ? 'Free' : formatBDT(z.fee, { currency: meta.currency })}
                </span>
              </label>
            ))}
          </RadioGroup>
          {form.formState.errors.shipping_zone && (
            <p className="text-xs text-rose-600 mt-1">{form.formState.errors.shipping_zone.message}</p>
          )}
        </div>
      )}

      {/* ── COD reassurance + price summary ── */}
      <div className="rounded-2xl bg-brand-50 border border-brand-200 p-4 flex items-start gap-3">
        <Truck className="h-5 w-5 text-brand-700 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-brand-900">Cash on Delivery</p>
          <p className="text-xs text-brand-700">Pay when your order arrives. No upfront payment.</p>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-50 p-4 space-y-1.5 text-sm">
        <div className="flex justify-between text-slate-600">
          <span>Subtotal ({qty} × {formatBDT(unitPrice, { currency: meta.currency })})</span>
          <span>{formatBDT(subtotal, { currency: meta.currency })}</span>
        </div>
        {meta.shipping?.enabled && (
          <div className="flex justify-between text-slate-600">
            <span>Shipping</span>
            <span>{shippingFee === 0 ? <span className="text-brand-600 font-semibold">Free</span> : formatBDT(shippingFee, { currency: meta.currency })}</span>
          </div>
        )}
        <Separator />
        <div className="flex items-baseline justify-between pt-1">
          <span className="font-semibold text-slate-900">Total</span>
          <span className="text-2xl font-bold text-slate-900">{formatBDT(total, { currency: meta.currency })}</span>
        </div>
      </div>

      <Button
        type="submit"
        variant="brand"
        size="lg"
        className="w-full shadow-md"
        disabled={!inStock || submitting}
      >
        <ShoppingBag className="h-4 w-4" />
        {submitting ? 'Placing order…' : !inStock ? 'Out of stock' : `Order Now — ${formatBDT(total, { currency: meta.currency })}`}
      </Button>
    </form>
  );
}
