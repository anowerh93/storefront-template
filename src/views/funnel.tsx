import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ShoppingBag, Truck, Minus, Plus, Star, Check, Clock,
  ShieldCheck, RefreshCw, Headphones, Package, CreditCard, Gift,
  Award, Phone, Heart, Sparkles, BadgeCheck, ThumbsUp,
} from 'lucide-react';
import type { FunnelData, FunnelBlockConfig, FunnelProduct, StorefrontMeta } from '../lib/types';
import { submitOrder } from '../lib/api';
import { formatBDT, discountPct } from '../lib/format';
import { pixel } from '../lib/pixel';
import { FitImage } from '../components/ui/fit-image';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/ui/button';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';

/**
 * Ad funnel landing page (/f/{slug}). Renders the tenant's block config in
 * `section_order`, with an embedded Cash-on-Delivery order form. Minimal
 * chrome (slim header/footer, no nav) + a sticky mobile CTA — built to
 * convert Facebook-ad traffic. Reuses the checkout order schema + submitOrder.
 */

const ICON_MAP: Record<string, any> = {
  'truck': Truck, 'shield-check': ShieldCheck, 'refresh-cw': RefreshCw, 'headphones': Headphones,
  'package': Package, 'credit-card': CreditCard, 'gift': Gift, 'award': Award, 'clock': Clock,
  'phone': Phone, 'heart': Heart, 'sparkles': Sparkles, 'badge-check': BadgeCheck, 'thumbs-up': ThumbsUp,
};
function BadgeIcon({ name, className }: { name: string; className?: string }) {
  const C = ICON_MAP[name] || Check;
  return <C className={className} />;
}

const schema = z.object({
  customer_name:    z.string().min(2, 'Please enter your full name'),
  customer_address: z.string().min(10, 'Please enter your full delivery address'),
  customer_phone:   z.string().regex(/^(\+?88)?01[3-9]\d{8}$/, 'Enter a valid Bangladeshi mobile number'),
  shipping_zone:    z.string().min(1, 'Choose a delivery area'),
  notes:            z.string().max(500).optional(),
});
type FormData = z.infer<typeof schema>;

/* Fade/slide a block in as it scrolls into view (funnels are noindex + JS-only
   FB-ad traffic, so a JS-driven reveal is safe). Disabled → renders immediately. */
function Reveal({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(!enabled);
  useEffect(() => {
    if (!enabled || shown) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) { setShown(true); io.disconnect(); } },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enabled, shown]);
  return (
    <div ref={ref} className={`transition-all duration-700 ease-out ${shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}>
      {children}
    </div>
  );
}

export function FunnelPage({ funnel, meta }: { funnel: FunnelData | null; meta: StorefrontMeta | null }) {
  useEffect(() => {
    if (funnel?.product) {
      pixel.viewContent({ id: funnel.product.id, name: funnel.product.name, price: funnel.product.price });
    }
  }, [funnel]);

  if (!funnel || !meta) return <NotFound meta={meta} />;

  const { config, product } = funnel;
  const order = config.section_order ?? [];

  const renderBlock = (key: string) => {
    switch (key) {
      case 'hero':
        return config.hero.visible ? <Hero config={config.hero} product={product} /> : null;
      case 'benefits':
        return config.benefits.visible && config.benefits.items.length ? <Benefits config={config.benefits} /> : null;
      case 'gallery': {
        const imgs = config.gallery.image_urls?.length ? config.gallery.image_urls : product.gallery_urls;
        return config.gallery.visible && imgs.length ? <Gallery images={imgs} /> : null;
      }
      case 'price':
        return config.price.visible ? <PriceBlock config={config.price} product={product} /> : null;
      case 'urgency':
        return config.urgency.visible ? <Urgency config={config.urgency} /> : null;
      case 'order_form':
        return config.order_form.visible ? <OrderForm config={config.order_form} product={product} meta={meta} /> : null;
      case 'why_us':
        return config.why_us.visible && config.why_us.items.length ? <WhyUs config={config.why_us} /> : null;
      case 'reviews':
        return config.reviews.visible && product.reviews.items.length ? <Reviews config={config.reviews} product={product} /> : null;
      case 'faq':
        return config.faq.visible && config.faq.items.length ? <Faq config={config.faq} /> : null;
      case 'trust_badges':
        return config.trust_badges.visible && config.trust_badges.items.length ? <TrustBadges items={config.trust_badges.items} /> : null;
      default:
        return null;
    }
  };

  return (
    <>
      <SlimHeader meta={meta} />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6 space-y-10 pb-28 sm:pb-10">
        {order.map((key: string) => {
          const node = renderBlock(key);
          return node ? <Reveal key={key} enabled={config.animate !== false}>{node}</Reveal> : null;
        })}
      </main>
      <SlimFooter meta={meta} />
      <StickyCta label={config.hero.cta_label || 'Order Now'} />
    </>
  );
}

/* ── Header / Footer (minimal) ────────────────────────────────────────── */
function SlimHeader({ meta }: { meta: StorefrontMeta }) {
  const phone = meta.whatsapp?.trim() || null;
  return (
    <header className="border-b border-slate-100 bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <a href="/" className="flex items-center gap-2">
          {meta.logo_url
            ? <img src={meta.logo_url} alt={meta.name} className="h-8 w-auto" />
            : <span className="font-bold text-slate-900">{meta.name}</span>}
        </a>
        {phone && (
          <a href={`tel:${phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600">
            <Phone className="h-4 w-4" /> {phone}
          </a>
        )}
      </div>
    </header>
  );
}

function SlimFooter({ meta }: { meta: StorefrontMeta }) {
  return (
    <footer className="border-t border-slate-100 py-8 text-center text-xs text-slate-400">
      <p>© {new Date().getFullYear()} {meta.name}</p>
    </footer>
  );
}

function StickyCta({ label }: { label: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 backdrop-blur sm:hidden">
      <a href="#funnel-order" className="block w-full rounded-xl bg-brand-600 py-3 text-center text-base font-bold text-white shadow">{label}</a>
    </div>
  );
}

/* ── Blocks ───────────────────────────────────────────────────────────── */
function Hero({ config, product }: { config: FunnelBlockConfig['hero']; product: FunnelProduct }) {
  const img = config.image_url || product.image_url;
  return (
    <section className="text-center">
      {config.eyebrow && <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">{config.eyebrow}</p>}
      {(() => {
        // headline is sanitized inline HTML (bold/underline/highlight/colour);
        // fall back to the plain product name when empty.
        const html = (config.headline || '').trim();
        const hs = config.headline_style || 'plain';
        const base = 'mt-1 text-2xl font-extrabold leading-tight sm:text-4xl';
        if (hs === 'gradient') {
          const cls = `${base} bg-gradient-to-r from-brand-500 to-amber-500 bg-clip-text text-transparent`;
          return html
            ? <h1 className={cls} dangerouslySetInnerHTML={{ __html: html }} />
            : <h1 className={cls}>{product.name}</h1>;
        }
        if (hs === 'highlight') {
          return (
            <h1 className={base}>
              <span className="box-decoration-clone rounded bg-brand-100 px-2 text-brand-900">
                {html ? <span dangerouslySetInnerHTML={{ __html: html }} /> : product.name}
              </span>
            </h1>
          );
        }
        const cls = `${base} text-slate-900`;
        return html
          ? <h1 className={cls} dangerouslySetInnerHTML={{ __html: html }} />
          : <h1 className={cls}>{product.name}</h1>;
      })()}
      {config.subheadline && <p className="mx-auto mt-3 max-w-2xl text-slate-600" dangerouslySetInnerHTML={{ __html: config.subheadline }} />}
      {img && (
        <div className="relative mt-5 aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
          <FitImage src={img} alt={product.name} eager />
        </div>
      )}
      <a href="#funnel-order" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-7 py-3 text-base font-bold text-white shadow transition hover:bg-brand-700">
        <ShoppingBag className="h-5 w-5" /> {config.cta_label || 'Order Now'}
      </a>
    </section>
  );
}

function Benefits({ config }: { config: FunnelBlockConfig['benefits'] }) {
  return (
    <section>
      {config.title && <h2 className="mb-4 text-center text-xl font-bold text-slate-900">{config.title}</h2>}
      <ul className="mx-auto max-w-xl space-y-2.5">
        {config.items.map((b, i) => (
          <li key={i} className="flex gap-3 rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
            <Check className="h-5 w-5 shrink-0 text-emerald-600" />
            <span className="text-slate-700">{b}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Gallery({ images }: { images: string[] }) {
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {images.slice(0, 8).map((src, i) => (
        <div key={i} className="relative aspect-square overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
          <img src={src} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        </div>
      ))}
    </section>
  );
}

function PriceBlock({ config, product }: { config: FunnelBlockConfig['price']; product: FunnelProduct }) {
  const off = discountPct(product.price, product.compare_at_price);
  return (
    <section className="text-center">
      <div className="inline-flex flex-wrap items-baseline justify-center gap-3 rounded-2xl bg-brand-50 px-6 py-4 ring-1 ring-brand-100">
        <span className="text-3xl font-extrabold text-rose-600">{formatBDT(product.price, { currency: product.currency })}</span>
        {product.compare_at_price && product.compare_at_price > product.price && (
          <span className="text-lg text-slate-400 line-through">{formatBDT(product.compare_at_price, { currency: product.currency })}</span>
        )}
        {off && <span className="rounded-full bg-rose-600 px-2.5 py-1 text-xs font-bold text-white">Save {off}%</span>}
      </div>
      {config.note && <p className="mt-2 text-sm text-slate-500">{config.note}</p>}
    </section>
  );
}

function Urgency({ config }: { config: FunnelBlockConfig['urgency'] }) {
  const [left, setLeft] = useState((config.countdown_minutes || 0) * 60);
  useEffect(() => {
    if (!config.countdown_minutes) return;
    const t = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [config.countdown_minutes]);
  const hh = String(Math.floor(left / 3600)).padStart(2, '0');
  const mm = String(Math.floor((left % 3600) / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  return (
    <section className="rounded-2xl bg-amber-50 px-5 py-4 text-center ring-1 ring-amber-200">
      <p className="flex items-center justify-center gap-2 font-bold text-amber-900"><Clock className="h-5 w-5" /> {config.headline}</p>
      {config.stock_text && <p className="mt-1 text-sm text-amber-700">{config.stock_text}</p>}
      {config.countdown_minutes > 0 && <p className="mt-2 text-2xl font-extrabold tabular-nums text-amber-900">{hh}:{mm}:{ss}</p>}
    </section>
  );
}

function WhyUs({ config }: { config: FunnelBlockConfig['why_us'] }) {
  return (
    <section>
      {config.title && <h2 className="mb-4 text-center text-xl font-bold text-slate-900">{config.title}</h2>}
      <div className="grid gap-3 sm:grid-cols-2">
        {config.items.map((w, i) => (
          <div key={i} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <p className="font-semibold text-slate-900">{w.title}</p>
            {w.body && <p className="mt-1 text-sm text-slate-600">{w.body}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

function Reviews({ config, product }: { config: FunnelBlockConfig['reviews']; product: FunnelProduct }) {
  return (
    <section>
      {config.title && <h2 className="mb-4 text-center text-xl font-bold text-slate-900">{config.title}</h2>}
      <div className="space-y-4">
        {product.reviews.items.slice(0, 10).map((r) => (
          <article key={r.id} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <div className="mb-1 flex items-center gap-2">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={`h-4 w-4 ${n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                ))}
              </div>
              <span className="text-sm font-medium text-slate-900">{r.author_name}</span>
              {r.location && <span className="text-xs text-slate-400">· {r.location}</span>}
            </div>
            <p className="text-sm leading-relaxed text-slate-600">{r.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Faq({ config }: { config: FunnelBlockConfig['faq'] }) {
  return (
    <section>
      <h2 className="mb-4 text-center text-xl font-bold text-slate-900">FAQ</h2>
      <div className="mx-auto max-w-xl space-y-3">
        {config.items.map((f, i) => (
          <details key={i} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <summary className="cursor-pointer font-semibold text-slate-900">{f.q}</summary>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function TrustBadges({ items }: { items: { icon: string; title: string }[] }) {
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((b, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5 rounded-xl bg-white p-4 text-center ring-1 ring-slate-200">
          <BadgeIcon name={b.icon} className="h-6 w-6 text-brand-600" />
          <span className="text-xs font-medium text-slate-700">{b.title}</span>
        </div>
      ))}
    </section>
  );
}

/* ── Order form (COD) — reuses the checkout schema + submitOrder ──────── */
function OrderForm({ config, product, meta }: { config: FunnelBlockConfig['order_form']; product: FunnelProduct; meta: StorefrontMeta }) {
  const [qty, setQty] = useState(1);
  const [variantIdx, setVariantIdx] = useState<number | null>(product.variants[0]?.index ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zones = meta.shipping?.zones ?? [];
  const form = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { shipping_zone: zones[0]?.code ?? '' } });

  const variant = (variantIdx != null ? product.variants.find((v) => v.index === variantIdx) : null) ?? null;
  const unitPrice = variant?.price ?? product.price;
  const inStock = variant ? variant.in_stock : product.in_stock;

  const selectedZone = form.watch('shipping_zone');
  const zone = zones.find((z) => z.code === selectedZone);
  const subtotal = unitPrice * qty;
  const threshold = meta.shipping?.free_shipping_threshold ?? null;
  const shippingFee = !meta.shipping?.enabled ? 0 : (threshold && subtotal >= threshold ? 0 : (zone?.fee ?? 0));
  const total = subtotal + shippingFee;

  async function onSubmit(values: FormData) {
    setSubmitting(true);
    setError(null);
    try {
      pixel.initiateCheckout({ value: subtotal, numItems: qty });
      const sp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const orderRes = await submitOrder({
        customer_name:  values.customer_name,
        customer_phone: values.customer_phone,
        address:        values.customer_address,
        shipping_zone:  values.shipping_zone || undefined,
        notes:          values.notes,
        product_id:     product.id,
        variant_index:  variant ? variant.index : null,
        quantity:       qty,
        utm_source:     sp?.get('utm_source') || undefined,
        utm_medium:     sp?.get('utm_medium') || undefined,
        utm_campaign:   sp?.get('utm_campaign') || undefined,
        funnel_url:     typeof window !== 'undefined' ? window.location.href : undefined,
      });
      pixel.purchase({ orderNumber: orderRes.order_number, value: orderRes.total, numItems: qty, contentIds: [product.id.toString()] });
      window.location.href = `/order/${orderRes.order_number}?placed=1&phone=${values.customer_phone.slice(-4)}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <section id="funnel-order" className="scroll-mt-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-6">
      <h2 className="text-center text-lg font-bold text-slate-900">{config.heading || 'Order now — Cash on Delivery'}</h2>

      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-4">
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}

        {product.variants.length > 0 && (
          <div>
            <Label>{product.variants.length > 1 ? 'Choose your pack' : 'Option'}</Label>
            <div className="mt-1.5 grid gap-2">
              {product.variants.map((v) => {
                const vp = v.price ?? product.price;
                const vc = v.compare_at_price ?? product.compare_at_price;
                const off = discountPct(vp, vc);
                const selected = variantIdx === v.index;
                return (
                  <button type="button" key={v.index} disabled={!v.in_stock} onClick={() => setVariantIdx(v.index)}
                          className={`flex items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left transition ${selected ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-slate-300 hover:border-slate-400'} ${!v.in_stock ? 'cursor-not-allowed opacity-40' : ''}`}>
                    <span className="flex items-center gap-2">
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-brand-500' : 'border-slate-300'}`}>
                        {selected && <span className="h-2 w-2 rounded-full bg-brand-500" />}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">{v.label}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="text-sm font-bold text-rose-600">{formatBDT(vp, { currency: product.currency })}</span>
                      {vc && vc > vp && <span className="ml-1 text-xs text-slate-400 line-through">{formatBDT(vc, { currency: product.currency })}</span>}
                      {off && <span className="ml-1 rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">-{off}%</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="f-name">Full Name <span className="text-rose-500">*</span></Label>
          <Input id="f-name" placeholder="Your name" {...form.register('customer_name')} className="mt-1.5" />
          {form.formState.errors.customer_name && <p className="mt-1 text-xs text-rose-600">{form.formState.errors.customer_name.message}</p>}
        </div>
        <div>
          <Label htmlFor="f-phone">Phone <span className="text-rose-500">*</span></Label>
          <Input id="f-phone" placeholder="01XXXXXXXXX" inputMode="tel" {...form.register('customer_phone')} className="mt-1.5" />
          {form.formState.errors.customer_phone && <p className="mt-1 text-xs text-rose-600">{form.formState.errors.customer_phone.message}</p>}
        </div>
        <div>
          <Label htmlFor="f-address">Address <span className="text-rose-500">*</span></Label>
          <Textarea id="f-address" placeholder="House/road, area, district…" {...form.register('customer_address')} className="mt-1.5" />
          {form.formState.errors.customer_address && <p className="mt-1 text-xs text-rose-600">{form.formState.errors.customer_address.message}</p>}
        </div>

        {meta.shipping?.enabled && zones.length > 0 && (
          <div>
            <Label className="flex items-center gap-2"><Truck className="h-4 w-4" /> Delivery area</Label>
            <RadioGroup value={selectedZone} onValueChange={(v) => form.setValue('shipping_zone', v)} className="mt-1.5 grid grid-cols-2 gap-2">
              {zones.map((z) => (
                <label key={z.code} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 transition ${selectedZone === z.code ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <RadioGroupItem value={z.code} />
                  <span className="text-sm font-medium text-slate-900">{z.label}</span>
                </label>
              ))}
            </RadioGroup>
            {form.formState.errors.shipping_zone && <p className="mt-1 text-xs text-rose-600">{form.formState.errors.shipping_zone.message}</p>}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="text-sm font-medium text-slate-700">Quantity</span>
          <div className="flex items-center overflow-hidden rounded-lg border border-slate-300">
            <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1} aria-label="Decrease" className="px-2 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Minus className="h-3.5 w-3.5" /></button>
            <span className="w-8 text-center text-sm font-semibold tabular-nums">{qty}</span>
            <button type="button" onClick={() => setQty(qty + 1)} aria-label="Increase" className="px-2 py-1.5 text-slate-600 hover:bg-slate-50"><Plus className="h-3.5 w-3.5" /></button>
          </div>
        </div>

        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{formatBDT(subtotal, { currency: product.currency })}</span></div>
          {meta.shipping?.enabled && (
            <div className="flex justify-between text-slate-600">
              <span>Shipping</span>
              <span>{shippingFee === 0 ? <span className="font-semibold text-brand-600">Free</span> : formatBDT(shippingFee, { currency: product.currency })}</span>
            </div>
          )}
          <div className="flex items-baseline justify-between border-t border-slate-100 pt-2">
            <span className="font-bold text-slate-900">Total</span>
            <span className="text-xl font-bold text-rose-600">{formatBDT(total, { currency: product.currency })}</span>
          </div>
        </div>

        <Button type="submit" variant="brand" size="lg" className="w-full shadow-md" disabled={!inStock || submitting}>
          <ShoppingBag className="h-4 w-4" />
          {submitting ? 'Placing order…' : !inStock ? 'Out of stock' : (config.button_label || 'Confirm Order')}
        </Button>
      </form>
    </section>
  );
}

function NotFound({ meta }: { meta: StorefrontMeta | null }) {
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 text-slate-600">This page doesn't exist or is no longer available.</p>
      <a href="/" className="mt-6 inline-block rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white">Go home</a>
    </main>
  );
}
